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

   EventSetMillisecondTimer(200);
   Print("MarketOrderEA initialized. Polling ", g_bridgeUrl);
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void SendAccountUpdate();

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
   int res = WebRequest("POST", url, headers, 1000, postData, result, resultHeaders);
   if(res == -1)
     {
      Print("Failed to report result for ", reqId, " error: ", GetLastError());
     }
  }

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
int g_timerTicks = 0;

void OnTimer()
  {
   g_timerTicks++;
   if(g_timerTicks % 25 == 0) // every ~5 seconds (25 * 200ms)
     {
      SendAccountUpdate();
     }

   if(g_timerTicks % 2 == 0) // alternate ticks (~400ms)
     {
      CheckForPendingModifications();
     }
   else
     {
      CheckForPendingCloses();
     }

   char postData[];
   char result[];
   string resultHeaders;
   string url = g_bridgeUrl + "/pending";
   
   ResetLastError();
   int res = WebRequest("GET", url, NULL, 500, postData, result, resultHeaders);
   
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
   int res = WebRequest("GET", url, NULL, 500, postData, result, resultHeaders);

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
   WebRequest("POST", url, headers, 1000, postData, result, resultHeaders);
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
   int res = WebRequest("GET", url, NULL, 500, postData, result, resultHeaders);

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
   WebRequest("POST", url, headers, 1000, postData, result, resultHeaders);
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

   json += "]}";

   char postData[];
   char result[];
   string resultHeaders;
   StringToCharArray(json, postData, 0, WHOLE_ARRAY, CP_UTF8);
   int size = ArraySize(postData);
   if(size > 0 && postData[size-1] == 0) ArrayResize(postData, size-1);

   ResetLastError();
   string headers = "Content-Type: application/json\r\n";
   WebRequest("POST", g_bridgeUrl + "/account-update", headers, 1000, postData, result, resultHeaders);
  }
//+------------------------------------------------------------------+
