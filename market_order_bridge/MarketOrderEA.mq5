//+------------------------------------------------------------------+
//|                                              MarketOrderEA.mq5   |
//+------------------------------------------------------------------+
#property copyright "Orderflow"
#property link      ""
#property version   "1.00"

#include <Trade\Trade.mqh>

input double RiskPercent = 1.0;
input string BridgeUrl = "http://127.0.0.1:3001";

string g_bridgeUrl;
CTrade trade;

// MT5 Candle & View Sync State
bool             g_viewActive            = false;
string           g_viewSymbol            = "BTCUSD";
ENUM_TIMEFRAMES  g_viewTf                = PERIOD_M1;
string           g_viewTfStr             = "1m";
bool             g_isCandleReqActive     = false;
datetime         g_lastLiveCandleTime    = 0;
double           g_lastLiveCandleClose   = 0;
ulong            g_lastLiveCandleTickVol = 0;
double           g_lastLiveBid           = 0;
double           g_lastLiveAsk           = 0;

void SendAccountUpdate();
void CheckForViewSync();
void SendLiveCandleDelta();
void SendCandlesHistory(string sym, ENUM_TIMEFRAMES tf, int count = 200);
ENUM_TIMEFRAMES ParseTimeframe(string tf);

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
  {
   trade.SetExpertMagicNumber(12345);
   
   g_bridgeUrl = BridgeUrl;
   StringTrimLeft(g_bridgeUrl);
   StringTrimRight(g_bridgeUrl);
   while(StringLen(g_bridgeUrl) > 0 && StringSubstr(g_bridgeUrl, StringLen(g_bridgeUrl)-1, 1) == "/")
     {
      g_bridgeUrl = StringSubstr(g_bridgeUrl, 0, StringLen(g_bridgeUrl)-1);
     }

   EventSetMillisecondTimer(50);
   Print("MarketOrderEA initialized. Polling ", g_bridgeUrl, " at 50ms");
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
//| String extract helper                                            |
//+------------------------------------------------------------------+
string ExtractJsonValue(string json, string key)
  {
   string search = "\"" + key + "\":";
   int pos = StringFind(json, search);
   if(pos < 0) return "";
   
   pos += StringLen(search);
   
   // Skip spaces
   while(pos < StringLen(json) && (StringSubstr(json, pos, 1) == " " || StringSubstr(json, pos, 1) == "\n" || StringSubstr(json, pos, 1) == "\r")) pos++;
   
   string value = "";
   bool isString = false;
   
   if(StringSubstr(json, pos, 1) == "\"")
     {
      isString = true;
      pos++;
     }
     
   while(pos < StringLen(json))
     {
      string c = StringSubstr(json, pos, 1);
      if(isString)
        {
         if(c == "\"") break;
         value += c;
        }
      else
        {
         if(c == "," || c == "}" || c == " " || c == "\n" || c == "\r") break;
         value += c;
        }
      pos++;
     }
     
   return value;
  }

//+------------------------------------------------------------------+
//| Report result back to bridge                                     |
//+------------------------------------------------------------------+
void ReportResult(string reqId, string status, ulong ticket = 0, double fillPrice = 0, double sl = 0, double tp = 0, string errorMsg = "")
  {
   char postData[];
   string payload = "{\"requestId\":\"" + reqId + "\",\"status\":\"" + status + "\"";
   
   if(ticket > 0) payload += ",\"ticket\":" + IntegerToString(ticket);
   if(fillPrice > 0) payload += ",\"fillPrice\":" + DoubleToString(fillPrice);
   if(sl > 0) payload += ",\"sl\":" + DoubleToString(sl);
   if(tp > 0) payload += ",\"tp\":" + DoubleToString(tp);
   if(errorMsg != "") payload += ",\"error\":\"" + errorMsg + "\"";
   
   payload += "}";
   
   StringToCharArray(payload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   
   // We must remove the trailing null character added by StringToCharArray
   int size = ArraySize(postData);
   if(size > 0 && postData[size-1] == 0) ArrayResize(postData, size-1);
   
   char result[];
   string resultHeaders;
   string url = g_bridgeUrl + "/result";
   
   ResetLastError();
   string headers = "Content-Type: application/json\r\n";
   int res = WebRequest("POST", url, headers, 100, postData, result, resultHeaders);
   if(res == -1)
     {
      Print("Failed to report result for ", reqId, " error: ", GetLastError());
     }
  }

void CheckForPendingOrders();

//+------------------------------------------------------------------+
//| Expert tick function (instant order pickup on price ticks)       |
//+------------------------------------------------------------------+
void OnTick()
  {
   CheckForPendingOrders();
   if(g_viewActive)
     {
      SendLiveCandleDelta();
     }
  }

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
int g_timerTicks = 0;

void OnTimer()
  {
   g_timerTicks++;
   
   // 1. Check for pending market orders FIRST (highest priority action)
   CheckForPendingOrders();

   // Periodic account snapshot: fast ~300ms if positions open, otherwise ~5 seconds (100 * 50ms)
   if((PositionsTotal() > 0 && g_timerTicks % 6 == 0) || (g_timerTicks % 100 == 0))
     {
      SendAccountUpdate();
     }

   // Poll web view state (symbol/timeframe) every ~2 seconds (40 * 50ms)
   if(g_timerTicks % 40 == 0)
     {
      CheckForViewSync();
     }

   // Modifications and closes polled alternatively (~400ms)
   if(g_timerTicks % 8 == 0)
     {
      CheckForPendingModifications();
     }
   else if(g_timerTicks % 8 == 4)
     {
      CheckForPendingCloses();
     }

   // Stream live candle delta whenever web app is actively in Mode 4 (~100ms)
   if(g_viewActive && g_timerTicks % 2 == 0)
     {
      SendLiveCandleDelta();
     }
  }

//+------------------------------------------------------------------+
//| Check and execute pending market orders                          |
//+------------------------------------------------------------------+
void CheckForPendingOrders()
  {
   char postData[];
   char result[];
   string resultHeaders;
   string url = g_bridgeUrl + "/pending";
   
   ResetLastError();
   int res = WebRequest("GET", url, NULL, 50, postData, result, resultHeaders);
   
   if(res == -1)
     {
      int err = GetLastError();
      if(err == 4014)
         Print("WebRequest blocked! Add ", g_bridgeUrl, " to MT5 Tools > Options > Expert Advisors > Allowed URLs.");
     }
   else if(res == 200)
     {
      string json = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
      string reqId = ExtractJsonValue(json, "requestId");
      string sym = ExtractJsonValue(json, "symbol");
      string dir = ExtractJsonValue(json, "direction");
      string slStr = ExtractJsonValue(json, "sl");
      if(slStr == "") slStr = ExtractJsonValue(json, "slPrice");
      
      if(reqId == "") return;

      
      Print("Received order: ", json);
      
      if(sym == "") sym = _Symbol;
      
      double slPrice = StringToDouble(slStr);
      if(slPrice <= 0)
        {
         ReportResult(reqId, "rejected", 0, 0, 0, 0, "Invalid SL price");
         return;
        }
        
      // Ensure market watch
      SymbolSelect(sym, true);
      
      double ask = SymbolInfoDouble(sym, SYMBOL_ASK);
      double bid = SymbolInfoDouble(sym, SYMBOL_BID);
      double point = SymbolInfoDouble(sym, SYMBOL_POINT);
      
      if(ask == 0 || bid == 0)
        {
         ReportResult(reqId, "rejected", 0, 0, 0, 0, "Market price unavailable");
         return;
        }
        
      double currentPrice = (dir == "buy" || dir == "BUY") ? ask : bid;
      double riskDistance = MathAbs(currentPrice - slPrice);
      
      long stopsLevelPoints = SymbolInfoInteger(sym, SYMBOL_TRADE_STOPS_LEVEL);
      double minDistance = MathMax(stopsLevelPoints * point, 10 * point);
      if(riskDistance < minDistance)
        {
         riskDistance = minDistance;
        }
        
      bool isBuy = (dir == "buy" || dir == "BUY");
      double sl = isBuy ? (currentPrice - riskDistance) : (currentPrice + riskDistance);
      double tp = isBuy ? (currentPrice + riskDistance) : (currentPrice - riskDistance);
          
      // Risk calculation
      double balance = AccountInfoDouble(ACCOUNT_BALANCE);
      double riskMoney = balance * (RiskPercent / 100.0);
      
      double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
      double tickValue = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
      
      if(tickSize <= 0 || tickValue <= 0)
        {
         ReportResult(reqId, "rejected", 0, 0, 0, 0, "Invalid symbol properties");
         return;
        }
        
      double riskTicks = riskDistance / tickSize;
      double lots = riskMoney / (riskTicks * tickValue);
      
      // Normalize lots
      double volStep = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
      double volMin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
      double volMax = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
      
      lots = MathFloor(lots / volStep) * volStep;
      if(lots < volMin) lots = volMin;
      if(lots > volMax) lots = volMax;
      
      // Execute
      bool success = false;
      if(isBuy)
        {
         success = trade.Buy(lots, sym, currentPrice, sl, tp);
        }
      else
        {
         success = trade.Sell(lots, sym, currentPrice, sl, tp);
        }
        
      if(success)
        {
         ulong ticket = trade.ResultOrder();
         if(ticket <= 0) ticket = trade.ResultDeal();
         double fillPrice = trade.ResultPrice();
         if(fillPrice <= 0) fillPrice = currentPrice;
         ReportResult(reqId, "filled", ticket, fillPrice, sl, tp);
        }
      else
        {
         string error = "Trade failed: " + IntegerToString(trade.ResultRetcode());
         ReportResult(reqId, "rejected", 0, 0, 0, 0, error);
        }
     }
  }

//+------------------------------------------------------------------+
//| Fetch /poll-modify. If a modification is waiting, execute it.    |
//+------------------------------------------------------------------+
void CheckForPendingModifications()
  {
   char postData[];
   char result[];
   string resultHeaders;
   string url = g_bridgeUrl + "/poll-modify";

   ResetLastError();
   int res = WebRequest("GET", url, NULL, 50, postData, result, resultHeaders);

   if(res != 200) return;

   string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(body == "" || body == "null") return;

   string requestId = ExtractJsonValue(body, "requestId");
   string ticketStr = ExtractJsonValue(body, "ticket");
   string slStr     = ExtractJsonValue(body, "sl");
   string tpStr     = ExtractJsonValue(body, "tp");

   if(requestId == "" || ticketStr == "") return;

   ulong ticket  = (ulong)StringToInteger(ticketStr);
   double slPrice = StringToDouble(slStr);
   double tpPrice = StringToDouble(tpStr);

   if(ticket <= 0) return;

   ExecuteModification(requestId, ticket, slPrice, tpPrice);
  }

//+------------------------------------------------------------------+
//| Execute position modification and send result back.              |
//+------------------------------------------------------------------+
void ExecuteModification(string requestId, ulong ticket, double sl, double tp)
  {
   if(!PositionSelectByTicket(ticket))
     {
      SendModifyResult(requestId, false, "Position not found");
      return;
     }

   string symbol = PositionGetString(POSITION_SYMBOL);

   long stopsLevelPoints = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   double minStopDistance = stopsLevelPoints * point;
   double currentPrice = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);

   if(sl > 0 && MathAbs(currentPrice - sl) < minStopDistance)
     {
      SendModifyResult(requestId, false, "SL too close to market");
      return;
     }
   if(tp > 0 && MathAbs(currentPrice - tp) < minStopDistance)
     {
      SendModifyResult(requestId, false, "TP too close to market");
      return;
     }

   bool ok = trade.PositionModify(ticket, sl, tp);
   if(ok)
     {
      SendModifyResult(requestId, true, "OK");
      SendAccountUpdate();
     }
   else
     {
      SendModifyResult(requestId, false, "Trade error " + IntegerToString(trade.ResultRetcode()));
     }
  }

void SendModifyResult(string requestId, bool success, string errorMsg)
  {
   char postData[];
   string payload = "{\"requestId\":\"" + requestId + "\",\"success\":" + (success ? "true" : "false");
   if(errorMsg != "") payload += ",\"error\":\"" + errorMsg + "\"";
   payload += "}";

   StringToCharArray(payload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int size = ArraySize(postData);
   if(size > 0 && postData[size-1] == 0) ArrayResize(postData, size-1);

   char result[];
   string resultHeaders;
   string url = g_bridgeUrl + "/modify-result";

   ResetLastError();
   string headers = "Content-Type: application/json\r\n";
   WebRequest("POST", url, headers, 100, postData, result, resultHeaders);
  }

//+------------------------------------------------------------------+
//| Fetch /poll-close. If a close request is waiting, execute it.   |
//+------------------------------------------------------------------+
void CheckForPendingCloses()
  {
   char postData[];
   char result[];
   string resultHeaders;
   string url = g_bridgeUrl + "/poll-close";

   ResetLastError();
   int res = WebRequest("GET", url, NULL, 50, postData, result, resultHeaders);

   if(res != 200) return;

   string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(body == "" || body == "null") return;

   string requestId = ExtractJsonValue(body, "requestId");
   string ticketStr = ExtractJsonValue(body, "ticket");

   if(requestId == "" || ticketStr == "") return;

   ulong ticket = (ulong)StringToInteger(ticketStr);
   if(ticket <= 0) return;

   ExecutePositionClose(requestId, ticket);
  }

//+------------------------------------------------------------------+
//| Execute position close and send result back.                    |
//+------------------------------------------------------------------+
void ExecutePositionClose(string requestId, ulong ticket)
  {
   if(!PositionSelectByTicket(ticket))
     {
      SendCloseResult(requestId, false, "Position not found");
      return;
     }

   bool ok = trade.PositionClose(ticket);
   if(ok)
     {
      SendCloseResult(requestId, true, "OK");
      SendAccountUpdate();
     }
   else
     {
      SendCloseResult(requestId, false, "Close error " + IntegerToString(trade.ResultRetcode()));
     }
  }

void SendCloseResult(string requestId, bool success, string errorMsg)
  {
   char postData[];
   string payload = "{\"requestId\":\"" + requestId + "\",\"success\":" + (success ? "true" : "false");
   if(errorMsg != "") payload += ",\"error\":\"" + errorMsg + "\"";
   payload += "}";

   StringToCharArray(payload, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int size = ArraySize(postData);
   if(size > 0 && postData[size-1] == 0) ArrayResize(postData, size-1);

   char result[];
   string resultHeaders;
   string url = g_bridgeUrl + "/close-result";

   ResetLastError();
   string headers = "Content-Type: application/json\r\n";
   WebRequest("POST", url, headers, 100, postData, result, resultHeaders);
  }

//+------------------------------------------------------------------+
//| Account snapshot update helper                                   |
//+------------------------------------------------------------------+
void SendAccountUpdate()
  {
   string json = "{";
   json += "\"accountName\":\"" + AccountInfoString(ACCOUNT_NAME) + "\",";
   json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
   json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
   json += "\"openPositions\":" + IntegerToString(PositionsTotal()) + ",";
   json += "\"pnl\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ",";
   json += "\"positions\":[";

   int total = PositionsTotal();
   int count = 0;
   for(int i = 0; i < total; i++)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket > 0)
        {
         if(count > 0) json += ",";
         string typeStr = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "BUY" : "SELL";
         json += "{";
         json += "\"ticket\":" + IntegerToString((long)ticket) + ",";
         json += "\"symbol\":\"" + PositionGetString(POSITION_SYMBOL) + "\",";
         json += "\"type\":\"" + typeStr + "\",";
         json += "\"openPrice\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), _Digits) + ",";
         json += "\"sl\":" + DoubleToString(PositionGetDouble(POSITION_SL), _Digits) + ",";
         json += "\"tp\":" + DoubleToString(PositionGetDouble(POSITION_TP), _Digits) + ",";
         json += "\"profit\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) + ",";
         json += "\"volume\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2);
         json += "}";
         count++;
        }
     }

   json += "]";
   double curBid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double curAsk = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   json += ",\"bid\":" + DoubleToString(curBid, _Digits);
   json += ",\"ask\":" + DoubleToString(curAsk, _Digits);
   json += "}";

   char postData[];
   char result[];
   string resultHeaders;
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int size = ArraySize(postData);
   if(size > 0 && postData[size-1] == 0) ArrayResize(postData, size-1);

   ResetLastError();
   string headers = "Content-Type: application/json\r\n";
   WebRequest("POST", g_bridgeUrl + "/account-update", headers, 100, postData, result, resultHeaders);
  }
//+------------------------------------------------------------------+
//| Parse timeframe string to MT5 timeframe                          |
//+------------------------------------------------------------------+
ENUM_TIMEFRAMES ParseTimeframe(string tf)
  {
   string upper = tf;
   StringToUpper(upper);
   if(upper == "M1" || upper == "1M") return PERIOD_M1;
   if(upper == "M3" || upper == "3M") return PERIOD_M3;
   if(upper == "M5" || upper == "5M") return PERIOD_M5;
   if(upper == "M15" || upper == "15M") return PERIOD_M15;
   if(upper == "M30" || upper == "30M") return PERIOD_M30;
   if(upper == "H1" || upper == "1H") return PERIOD_H1;
   if(upper == "H4" || upper == "4H") return PERIOD_H4;
   if(upper == "D1" || upper == "1D") return PERIOD_D1;
   return _Period;
  }

//+------------------------------------------------------------------+
//| Check web view state to see if candle streaming is required     |
//+------------------------------------------------------------------+
void CheckForViewSync()
  {
   if(g_isCandleReqActive) return;
   
   char postData[];
   char result[];
   string resultHeaders;
   string url = g_bridgeUrl + "/poll-view";
   
   ResetLastError();
   int res = WebRequest("GET", url, NULL, 50, postData, result, resultHeaders);
   if(res != 200) return;
   
   string json = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(json == "" || json == "null") return;
   
   string activeStr = ExtractJsonValue(json, "active");
   bool isActive = (activeStr == "true" || activeStr == "1");
   string sym = ExtractJsonValue(json, "symbol");
   string tfStr = ExtractJsonValue(json, "timeframe");
   string mt5TfStr = ExtractJsonValue(json, "mt5Timeframe");
   if(sym == "") sym = _Symbol;
   if(tfStr == "") tfStr = "1m";
   
   ENUM_TIMEFRAMES targetTf = ParseTimeframe(mt5TfStr != "" ? mt5TfStr : tfStr);
   
   bool needsHistory = false;
   if(isActive && (!g_viewActive || sym != g_viewSymbol || targetTf != g_viewTf))
     {
      needsHistory = true;
     }
     
   g_viewActive = isActive;
   g_viewSymbol = sym;
   g_viewTf = targetTf;
   g_viewTfStr = tfStr;
   
   if(needsHistory)
     {
      SendCandlesHistory(g_viewSymbol, g_viewTf, 200);
     }
  }

//+------------------------------------------------------------------+
//| Send historical candles snapshot to bridge                       |
//+------------------------------------------------------------------+
void SendCandlesHistory(string sym, ENUM_TIMEFRAMES tf, int count = 200)
  {
   if(g_isCandleReqActive) return;
   g_isCandleReqActive = true;
   
   SymbolSelect(sym, true);
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   int copied = CopyRates(sym, tf, 0, count, rates);
   if(copied <= 0)
     {
      g_isCandleReqActive = false;
      return;
     }
     
   long rawOffset = (long)(TimeCurrent() - TimeGMT());
   long gmtOffsetSec = (long)(MathRound((double)rawOffset / 900.0) * 900.0);
   
   string json = "{\"symbol\":\"" + sym + "\",\"timeframe\":\"" + g_viewTfStr + "\",\"candles\":[";
   for(int i = 0; i < copied; i++)
     {
      if(i > 0) json += ",";
      long utcMs = ((long)rates[i].time - gmtOffsetSec) * 1000;
      json += "{\"time\":" + IntegerToString(utcMs) + ",";
      json += "\"open\":" + DoubleToString(rates[i].open, _Digits) + ",";
      json += "\"high\":" + DoubleToString(rates[i].high, _Digits) + ",";
      json += "\"low\":" + DoubleToString(rates[i].low, _Digits) + ",";
      json += "\"close\":" + DoubleToString(rates[i].close, _Digits) + ",";
      json += "\"volume\":" + IntegerToString((long)rates[i].tick_volume) + "}";
     }
   json += "]}";
   
   char postData[];
   char result[];
   string resultHeaders;
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int size = ArraySize(postData);
   if(size > 0 && postData[size-1] == 0) ArrayResize(postData, size-1);
   
   ResetLastError();
   string headers = "Content-Type: application/json\r\n";
   WebRequest("POST", g_bridgeUrl + "/mt5-candles-history", headers, 500, postData, result, resultHeaders);
   g_isCandleReqActive = false;
  }

//+------------------------------------------------------------------+
//| Send live forming candle delta to bridge                         |
//+------------------------------------------------------------------+
void SendLiveCandleDelta()
  {
   if(!g_viewActive || g_isCandleReqActive) return;
   
   MqlRates rates[];
   ArraySetAsSeries(rates, true); // index 0 is current, 1 is previous
   int copied = CopyRates(g_viewSymbol, g_viewTf, 0, 2, rates);
   if(copied <= 0) return;
   
   double bid = SymbolInfoDouble(g_viewSymbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(g_viewSymbol, SYMBOL_ASK);

   // Strictly synchronize forming candle close with current live Bid
   if(bid > 0)
     {
      rates[0].close = bid;
      if(bid > rates[0].high) rates[0].high = bid;
      if(bid < rates[0].low) rates[0].low = bid;
     }

   // Skip if forming candle and quotes haven't changed
   if(rates[0].time == g_lastLiveCandleTime && 
      rates[0].close == g_lastLiveCandleClose && 
      rates[0].tick_volume == g_lastLiveCandleTickVol &&
      bid == g_lastLiveBid &&
      ask == g_lastLiveAsk)
     {
      return;
     }
     
   g_lastLiveCandleTime = rates[0].time;
   g_lastLiveCandleClose = rates[0].close;
   g_lastLiveCandleTickVol = rates[0].tick_volume;
   g_lastLiveBid = bid;
   g_lastLiveAsk = ask;
   
   g_isCandleReqActive = true;
   long rawOffset = (long)(TimeCurrent() - TimeGMT());
   long gmtOffsetSec = (long)(MathRound((double)rawOffset / 900.0) * 900.0);
   long curUtcMs = ((long)rates[0].time - gmtOffsetSec) * 1000;
   
   string json = "{\"symbol\":\"" + g_viewSymbol + "\",\"timeframe\":\"" + g_viewTfStr + "\",";
   json += "\"bid\":" + DoubleToString(bid, _Digits) + ",\"ask\":" + DoubleToString(ask, _Digits) + ",";
   json += "\"candle\":{";
   json += "\"time\":" + IntegerToString(curUtcMs) + ",";
   json += "\"open\":" + DoubleToString(rates[0].open, _Digits) + ",";
   json += "\"high\":" + DoubleToString(rates[0].high, _Digits) + ",";
   json += "\"low\":" + DoubleToString(rates[0].low, _Digits) + ",";
   json += "\"close\":" + DoubleToString(rates[0].close, _Digits) + ",";
   json += "\"volume\":" + IntegerToString((long)rates[0].tick_volume);
   json += "}";
   
   if(copied > 1)
     {
      long prevUtcMs = ((long)rates[1].time - gmtOffsetSec) * 1000;
      json += ",\"previousCandle\":{";
      json += "\"time\":" + IntegerToString(prevUtcMs) + ",";
      json += "\"open\":" + DoubleToString(rates[1].open, _Digits) + ",";
      json += "\"high\":" + DoubleToString(rates[1].high, _Digits) + ",";
      json += "\"low\":" + DoubleToString(rates[1].low, _Digits) + ",";
      json += "\"close\":" + DoubleToString(rates[1].close, _Digits) + ",";
      json += "\"volume\":" + IntegerToString((long)rates[1].tick_volume);
      json += "}";
     }
   json += "}";
   
   char postData[];
   char result[];
   string resultHeaders;
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int size = ArraySize(postData);
   if(size > 0 && postData[size-1] == 0) ArrayResize(postData, size-1);
   
   ResetLastError();
   string headers = "Content-Type: application/json\r\n";
   WebRequest("POST", g_bridgeUrl + "/mt5-candles-live", headers, 50, postData, result, resultHeaders);
   g_isCandleReqActive = false;
  }
//+------------------------------------------------------------------+
