//+------------------------------------------------------------------+
//|                                       MarketOrderBridgeEA.mq5    |
//|                                                                    |
//| Polls a local HTTP bridge for market-order requests coming from   |
//| the web chart, calculates lot size from a fixed risk percent and  |
//| the SL price it received, and executes the market order with a   |
//| 1R take-profit. Market orders only — no pending/limit/stop.       |
//|                                                                    |
//| Compile and test on a DEMO account before any live use.           |
//+------------------------------------------------------------------+
#property version   "1.00"
#property description "Local web-bridge market order execution EA. Demo-test before live use."

#include <Trade/Trade.mqh>

//--- inputs
input string InpBridgeUrl        = "http://127.0.0.1:3001"; // Bridge base URL
input double InpRiskPercent      = 1.0;                       // Risk % of balance per trade
input int    InpPollIntervalMs   = 200;                       // How often to check for a new order
input int    InpMaxSlippagePoints = 30;                       // Max allowed slippage, in points
input ulong  InpMagicNumber      = 20260823;                  // Magic number for orders from this EA

CTrade trade;
int    g_timerTicks = 0;

//+------------------------------------------------------------------+
int OnInit()
  {
   trade.SetExpertMagicNumber(InpMagicNumber);
   trade.SetDeviationInPoints(InpMaxSlippagePoints);
   trade.SetTypeFillingBySymbol(_Symbol);

   if(!EventSetMillisecondTimer(InpPollIntervalMs))
     {
      Print("Failed to set timer");
      return(INIT_FAILED);
     }

   Print("MarketOrderBridgeEA initialized. Polling ", InpBridgeUrl, " every ", InpPollIntervalMs, "ms.");
   Print("Reminder: Tools > Options > Expert Advisors must have '", InpBridgeUrl, "' in the allowed WebRequest URL list.");
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   g_timerTicks++;

   CheckForPendingOrder();

   if(g_timerTicks % 2 == 0)
      CheckForPendingModifications();

   // Push an account snapshot roughly every 5 seconds, not every poll.
   int ticksPerAccountUpdate = (int)MathMax(1, 5000 / InpPollIntervalMs);
   if(g_timerTicks % ticksPerAccountUpdate == 0)
      SendAccountUpdate();
  }

//+------------------------------------------------------------------+
//| Fetch /pending. If a request is waiting, execute it.             |
//+------------------------------------------------------------------+
void CheckForPendingOrder()
  {
   char   data[];
   char   result[];
   string resultHeaders;

   ResetLastError();
   int status = WebRequest("GET", InpBridgeUrl + "/pending", "", 3000, data, result, resultHeaders);

   if(status == -1)
     {
      int err = GetLastError();
      if(err == 4014) // ERR_FUNCTION_NOT_CONFIRMED — URL not whitelisted
         Print("WebRequest blocked. Add ", InpBridgeUrl, " to Tools > Options > Expert Advisors > allowed URLs.");
      else
         Print("WebRequest to /pending failed, error ", err);
      return;
     }

   if(status != 200)
     {
      Print("/pending returned HTTP ", status);
      return;
     }

   string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   StringTrimLeft(body);
   StringTrimRight(body);

   if(body == "" || body == "null")
      return; // nothing pending

   string requestId = JsonGetString(body, "requestId");
   string symbol     = JsonGetString(body, "symbol");
   string direction   = JsonGetString(body, "direction");
   double slPrice    = JsonGetNumber(body, "sl");

   if(requestId == "" || symbol == "" || direction == "" || slPrice <= 0)
     {
      Print("Malformed /pending payload: ", body);
      return;
     }

   ExecuteMarketOrder(requestId, symbol, direction, slPrice);
  }

//+------------------------------------------------------------------+
//| Validate, size, and place the market order.                      |
//+------------------------------------------------------------------+
void ExecuteMarketOrder(string requestId, string symbol, string direction, double slPrice)
  {
   if(!CanTrade(symbol))
     {
      SendResult(requestId, "REJECTED", 0, 0, 0, 0, 0, "Trading not allowed right now");
      return;
     }

   if(!SymbolSelect(symbol, true))
     {
      SendResult(requestId, "REJECTED", 0, 0, 0, 0, 0, "Symbol not available: " + symbol);
      return;
     }

   MqlTick tick;
   if(!SymbolInfoTick(symbol, tick))
     {
      SendResult(requestId, "REJECTED", 0, 0, 0, 0, 0, "Could not read current tick");
      return;
     }

   bool isBuy = (direction == "BUY" || direction == "buy");
   double entryPrice = isBuy ? tick.ask : tick.bid;
   double riskDistance = MathAbs(entryPrice - slPrice);

   // If risk distance is suspiciously small (e.g. less than 10 points), use a safe fallback
   long   stopsLevelPoints = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double point            = SymbolInfoDouble(symbol, SYMBOL_POINT);
   double minDistance = MathMax(stopsLevelPoints * point, 10 * point);
   if(riskDistance < minDistance)
     {
      riskDistance = minDistance;
     }

   // Always compute SL and TP relative to broker entry price to ensure valid stops
   double sl = isBuy ? (entryPrice - riskDistance) : (entryPrice + riskDistance);
   double tp = isBuy ? (entryPrice + riskDistance) : (entryPrice - riskDistance);

   double lots = CalculateLotSize(symbol, riskDistance, InpRiskPercent);
   if(lots <= 0)
     {
      SendResult(requestId, "REJECTED", 0, 0, 0, 0, 0, "Calculated lot size invalid (check risk/SL distance)");
      return;
     }

   string comment = "WebBridge " + requestId;
   bool ok = isBuy
             ? trade.Buy(lots, symbol, entryPrice, sl, tp, comment)
             : trade.Sell(lots, symbol, entryPrice, sl, tp, comment);

   if(ok)
     {
      ulong  ticket    = trade.ResultOrder();
      double fillPrice = trade.ResultPrice();
      SendResult(requestId, "FILLED", ticket, fillPrice, sl, tp, lots, "OK");
     }
   else
     {
      string msg = StringFormat("Trade error %d: %s", trade.ResultRetcode(), trade.ResultComment());
      SendResult(requestId, "REJECTED", 0, 0, 0, 0, 0, msg);
     }
  }

//+------------------------------------------------------------------+
//| Basic trading-allowed checks, done every time — never trust      |
//| that conditions haven't changed since the last poll.             |
//+------------------------------------------------------------------+
bool CanTrade(string symbol)
  {
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
     {
      Print("AutoTrading is disabled in the terminal.");
      return false;
     }
   if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
     {
      Print("This EA is not allowed to trade (check the AutoTrading button / EA properties).");
      return false;
     }
   if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
     {
      Print("Trading is not allowed on this account.");
      return false;
     }
   if((ENUM_SYMBOL_TRADE_MODE)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE) == SYMBOL_TRADE_MODE_DISABLED)
     {
      Print("Trading is disabled for ", symbol);
      return false;
     }
   return true;
  }

//+------------------------------------------------------------------+
//| Risk-percent -> lot size, using the symbol's own tick value/size |
//| so this works correctly across FX, crypto, indices, metals, etc. |
//| — never assume "1 point = $1".                                   |
//+------------------------------------------------------------------+
double CalculateLotSize(string symbol, double riskDistance, double riskPercent)
  {
   double balance = AccountInfoDouble(ACCOUNT_BALANCE);
   double riskAmount = balance * (riskPercent / 100.0);

   double tickSize  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);

   if(tickSize <= 0 || tickValue <= 0)
      return 0;

   double ticksInDistance = riskDistance / tickSize;
   double lossPerLot = ticksInDistance * tickValue;

   if(lossPerLot <= 0)
      return 0;

   double rawLots = riskAmount / lossPerLot;

   double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   double minLot   = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot   = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);

   if(lotStep <= 0)
      lotStep = 0.01;

   double lots = MathFloor(rawLots / lotStep) * lotStep;
   lots = MathMax(lots, minLot);
   lots = MathMin(lots, maxLot);

   return NormalizeDouble(lots, 2);
  }

//+------------------------------------------------------------------+
//| POST the execution outcome back to the bridge.                   |
//+------------------------------------------------------------------+
void SendResult(string requestId, string status, ulong ticket, double fillPrice,
                 double sl, double tp, double volume, string message)
  {
   string json = "{";
   json += "\"requestId\":\"" + requestId + "\",";
   json += "\"status\":\"" + status + "\",";
   json += "\"ticket\":" + IntegerToString((long)ticket) + ",";
   json += "\"fillPrice\":" + DoubleToString(fillPrice, _Digits) + ",";
   json += "\"sl\":" + DoubleToString(sl, _Digits) + ",";
   json += "\"tp\":" + DoubleToString(tp, _Digits) + ",";
   json += "\"volume\":" + DoubleToString(volume, 2) + ",";
   json += "\"message\":\"" + message + "\"";
   json += "}";

   string response;
   PostJson(InpBridgeUrl + "/result", json, response);
  }

//+------------------------------------------------------------------+
//| Fetch /poll-modify. If a modification is waiting, execute it.    |
//+------------------------------------------------------------------+
void CheckForPendingModifications()
  {
   char   data[];
   char   result[];
   string resultHeaders;

   ResetLastError();
   int status = WebRequest("GET", InpBridgeUrl + "/poll-modify", "", 3000, data, result, resultHeaders);

   if(status != 200) return;

   string body = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   StringTrimLeft(body); StringTrimRight(body);
   if(body == "" || body == "null") return;

   string requestId = JsonGetString(body, "requestId");
   double ticket    = JsonGetNumber(body, "ticket");
   double slPrice   = JsonGetNumber(body, "sl");
   double tpPrice   = JsonGetNumber(body, "tp");

   if(requestId == "" || ticket <= 0) return;

   ExecuteModification(requestId, (ulong)ticket, slPrice, tpPrice);
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
   
   // Apply broker stop levels check
   long stopsLevelPoints = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   double minStopDistance = stopsLevelPoints * point;
   double currentPrice = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID) : SymbolInfoDouble(symbol, SYMBOL_ASK);
   
   if(sl > 0 && MathAbs(currentPrice - sl) < minStopDistance)
     {
      SendModifyResult(requestId, false, StringFormat("SL too close to market (min distance %.5f)", minStopDistance));
      return;
     }
   if(tp > 0 && MathAbs(currentPrice - tp) < minStopDistance)
     {
      SendModifyResult(requestId, false, StringFormat("TP too close to market (min distance %.5f)", minStopDistance));
      return;
     }

   bool ok = trade.PositionModify(ticket, sl, tp);
   if(ok)
     {
      SendModifyResult(requestId, true, "OK");
     }
   else
     {
      SendModifyResult(requestId, false, StringFormat("Trade error %d: %s", trade.ResultRetcode(), trade.ResultComment()));
     }
  }

void SendModifyResult(string requestId, bool success, string errorMsg)
  {
   string json = "{";
   json += "\"requestId\":\"" + requestId + "\",";
   json += "\"success\":" + (success ? "true" : "false") + ",";
   json += "\"error\":\"" + errorMsg + "\"";
   json += "}";
   string response;
   PostJson(InpBridgeUrl + "/modify-result", json, response);
  }

//+------------------------------------------------------------------+
//| Lightweight periodic account snapshot (optional feature).        |
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

   string response;
   PostJson(InpBridgeUrl + "/account-update", json, response);
  }

//+------------------------------------------------------------------+
//| Generic JSON POST over WebRequest.                                |
//+------------------------------------------------------------------+
bool PostJson(string url, string jsonBody, string &responseOut)
  {
   char data[];
   int len = StringToCharArray(jsonBody, data, 0, WHOLE_ARRAY, CP_UTF8) - 1; // drop trailing null
   if(len > 0)
      ArrayResize(data, len);

   char   result[];
   string resultHeaders;
   string headers = "Content-Type: application/json\r\n";

   ResetLastError();
   int status = WebRequest("POST", url, headers, 3000, data, result, resultHeaders);

   if(status == -1)
     {
      Print("WebRequest POST to ", url, " failed, error ", GetLastError());
      return false;
     }

   responseOut = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   return (status == 200);
  }

//+------------------------------------------------------------------+
//| Minimal JSON field extraction for the small, fixed-shape         |
//| payloads this bridge sends. Not a general-purpose parser —       |
//| it only needs to handle the exact shapes server.js emits.        |
//+------------------------------------------------------------------+
string JsonGetString(string json, string key)
  {
   string pattern = "\"" + key + "\":\"";
   int start = StringFind(json, pattern);
   if(start < 0)
      return "";
   start += StringLen(pattern);
   int end = StringFind(json, "\"", start);
   if(end < 0)
      return "";
   return StringSubstr(json, start, end - start);
  }

double JsonGetNumber(string json, string key)
  {
   string pattern = "\"" + key + "\":";
   int start = StringFind(json, pattern);
   if(start < 0)
      return 0;
   start += StringLen(pattern);
   int end = start;
   int len = StringLen(json);
   while(end < len)
     {
      ushort c = StringGetCharacter(json, end);
      if(c == ',' || c == '}')
         break;
      end++;
     }
   string numStr = StringSubstr(json, start, end - start);
   StringTrimLeft(numStr);
   StringTrimRight(numStr);
   return StringToDouble(numStr);
  }
//+------------------------------------------------------------------+
