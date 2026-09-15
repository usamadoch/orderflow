import http from 'http';

const PORT = 3001;
const pendingOrders = []; // FIFO queue
const results = new Map(); // requestId -> result object

// MT5 Connection State
let lastMt5Heartbeat = 0;
let mt5Account = {
  accountName: '',
  balance: 0,
  equity: 0,
  openPositions: 0,
  pnl: 0,
  positions: []
};
let wasMt5Connected = false;
let lastWebHeartbeat = 0;
let wasWebConnected = false;

// Modification State
const pendingModifications = []; // FIFO queue
const modificationResults = new Map(); // requestId -> result

// Close Position State
const pendingCloses = []; // FIFO queue
const closeResults = new Map(); // requestId -> result

// MT5 Candle & View Sync State
const MAX_CACHED_BARS = 300;
const candleCache = new Map(); // "symbol:timeframe" -> Candle[]
let activeViewState = {
  active: false,
  symbol: 'BTCUSD',
  timeframe: '1m',
  mt5Timeframe: 'M1',
  count: 200,
  lastUpdated: 0
};

const server = http.createServer((req, res) => {
  // CORS & Cache headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const bodyStr = Buffer.concat(chunks).toString();
    let body = {};
    if (bodyStr) {
      try {
        body = JSON.parse(bodyStr);
      } catch {
        // ignore
      }
    }

    const respondJson = (statusCode, data) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    // --- CONNECTION & STATUS ---

    if (req.method === 'POST' && req.url === '/account-update') {
      lastMt5Heartbeat = Date.now();
      if (body) {
        mt5Account = {
          accountName: body.accountName || '',
          balance: body.balance || 0,
          equity: body.equity || 0,
          openPositions: body.openPositions || 0,
          pnl: body.pnl || 0,
          positions: Array.isArray(body.positions) ? body.positions : []
        };
      }
      return respondJson(200, { success: true });
    }

    if (req.method === 'GET' && req.url === '/status') {
      lastWebHeartbeat = Date.now();
      const isConnected = (Date.now() - lastMt5Heartbeat) < 5000; // 5 seconds timeout
      return respondJson(200, {
        connected: isConnected,
        ...mt5Account
      });
    }

    // --- MARKET ORDERS ---

    if (req.method === 'POST' && req.url === '/order') {
      const { requestId, symbol, direction, slPrice } = body;
      if (!requestId || !symbol || !direction || slPrice == null) {
        return respondJson(400, { error: 'Missing required fields' });
      }
      
      pendingOrders.push({ requestId, symbol, direction, slPrice, timestamp: Date.now() });
      console.log(`[BRIDGE] New order received: ${requestId} for ${symbol} (${direction})`);
      return respondJson(200, { success: true });
    }

    if (req.method === 'GET' && (req.url === '/pending' || req.url === '/poll')) {
      lastMt5Heartbeat = Date.now(); // Polling acts as a heartbeat too
      const order = pendingOrders.shift();
      if (order) {
        console.log(`[BRIDGE] Dispensing order ${order.requestId} to EA`);
        
        // Map Binance symbols (e.g. BTCUSDT) to MT5 symbols (e.g. BTCUSD)
        let mt5Symbol = order.symbol;
        if (mt5Symbol.endsWith('USDT')) {
          mt5Symbol = mt5Symbol.replace('USDT', 'USD');
        }
        
        return respondJson(200, {
          requestId: order.requestId,
          symbol: mt5Symbol,
          direction: order.direction,
          sl: order.slPrice,
          slPrice: order.slPrice
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('null');
      return;
    }

    if (req.method === 'POST' && req.url === '/result') {
      lastMt5Heartbeat = Date.now();
      const { requestId, status, ticket, fillPrice, sl, tp, error, message } = body;
      if (!requestId) {
        return respondJson(400, { error: 'Missing requestId' });
      }
      results.set(requestId, { status, ticket, fillPrice, sl, tp, error: error || message, timestamp: Date.now() });
      console.log(`[BRIDGE] Result received for ${requestId}: ${status}`);
      return respondJson(200, { success: true });
    }

    if (req.method === 'GET' && req.url.startsWith('/result/')) {
      const requestId = req.url.split('/')[2];
      const result = results.get(requestId);
      if (result) {
        return respondJson(200, result);
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Result not found' }));
      return;
    }

    // --- MODIFICATIONS ---

    if (req.method === 'POST' && req.url === '/modify') {
      const { requestId, ticket, sl, tp } = body;
      if (!requestId || !ticket) {
        return respondJson(400, { error: 'Missing requestId or ticket' });
      }
      pendingModifications.push({ requestId, ticket, sl, tp, timestamp: Date.now() });
      // Optimistically update in-memory cache so subsequent /status polls return updated positions immediately
      if (Array.isArray(mt5Account.positions)) {
        const pos = mt5Account.positions.find(p => p.ticket === ticket || p.ticket === Number(ticket) || String(p.ticket) === String(ticket));
        if (pos) {
          if (sl !== undefined) pos.sl = sl;
          if (tp !== undefined) pos.tp = tp;
        }
      }
      console.log(`[BRIDGE] Modification requested for ticket ${ticket} (SL: ${sl}, TP: ${tp})`);
      return respondJson(200, { success: true });
    }

    if (req.method === 'GET' && req.url === '/poll-modify') {
      lastMt5Heartbeat = Date.now();
      const mod = pendingModifications.shift();
      if (mod) {
        console.log(`[BRIDGE] Dispensing modification ${mod.requestId} to EA`);
        return respondJson(200, mod);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('null');
      return;
    }

    if (req.method === 'POST' && req.url === '/modify-result') {
      lastMt5Heartbeat = Date.now();
      const { requestId, success, error } = body;
      if (!requestId) return respondJson(400, { error: 'Missing requestId' });
      modificationResults.set(requestId, { success, error, timestamp: Date.now() });
      console.log(`[BRIDGE] Modification result for ${requestId}: ${success ? 'SUCCESS' : 'FAILED'}`);
      return respondJson(200, { success: true });
    }

    if (req.method === 'GET' && req.url.startsWith('/modify-result/')) {
      const requestId = req.url.split('/')[2];
      const result = modificationResults.get(requestId);
      if (result) {
        return respondJson(200, result);
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Result not found' }));
      return;
    }

    // --- POSITION CLOSING ---

    if (req.method === 'POST' && req.url === '/close-position') {
      const { requestId, ticket } = body;
      if (!requestId || !ticket) {
        return respondJson(400, { error: 'Missing requestId or ticket' });
      }
      pendingCloses.push({ requestId, ticket, timestamp: Date.now() });
      // Optimistically remove from in-memory cache so subsequent /status polls reflect closed state immediately
      if (Array.isArray(mt5Account.positions)) {
        mt5Account.positions = mt5Account.positions.filter(p => p.ticket !== ticket && p.ticket !== Number(ticket) && String(p.ticket) !== String(ticket));
        mt5Account.openPositions = mt5Account.positions.length;
      }
      console.log(`[BRIDGE] Close position requested for ticket ${ticket}`);
      return respondJson(200, { success: true });
    }

    if (req.method === 'GET' && req.url === '/poll-close') {
      lastMt5Heartbeat = Date.now();
      const closeItem = pendingCloses.shift();
      if (closeItem) {
        console.log(`[BRIDGE] Dispensing close ${closeItem.requestId} to EA`);
        return respondJson(200, closeItem);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('null');
      return;
    }

    if (req.method === 'POST' && req.url === '/close-result') {
      lastMt5Heartbeat = Date.now();
      const { requestId, success, error } = body;
      if (!requestId) return respondJson(400, { error: 'Missing requestId' });
      closeResults.set(requestId, { success, error, timestamp: Date.now() });
      console.log(`[BRIDGE] Close result for ${requestId}: ${success ? 'SUCCESS' : 'FAILED'}`);
      return respondJson(200, { success: true });
    }

    if (req.method === 'GET' && req.url.startsWith('/close-result/')) {
      const requestId = req.url.split('/')[2];
      const result = closeResults.get(requestId);
      if (result) {
        return respondJson(200, result);
      }
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Result not found' }));
      return;
    }

    // --- MT5 CANDLE COMPARISON & VIEW REVERSE CHANNEL ---

    if (req.method === 'POST' && req.url === '/mt5-view-state') {
      const { active, symbol, timeframe, count } = body;
      let mt5Symbol = symbol || activeViewState.symbol;
      if (mt5Symbol && mt5Symbol.endsWith('USDT')) {
        mt5Symbol = mt5Symbol.replace('USDT', 'USD');
      }
      const tf = timeframe || activeViewState.timeframe;
      
      const normalizeTimeframeToMt5 = (t) => {
        if (!t) return 'M1';
        const lower = String(t).toLowerCase().trim();
        if (lower === '1m') return 'M1';
        if (lower === '3m') return 'M3';
        if (lower === '5m') return 'M5';
        if (lower === '15m') return 'M15';
        if (lower === '30m') return 'M30';
        if (lower === '1h') return 'H1';
        if (lower === '4h') return 'H4';
        if (lower === '1d') return 'D1';
        return lower.toUpperCase();
      };
      const mt5Tf = normalizeTimeframeToMt5(tf);
      const wasActive = activeViewState.active;
      const prevTf = activeViewState.timeframe;
      const prevSym = activeViewState.symbol;

      activeViewState = {
        active: Boolean(active),
        symbol: mt5Symbol,
        timeframe: tf,
        mt5Timeframe: mt5Tf,
        count: count || 200,
        lastUpdated: Date.now()
      };

      if (activeViewState.active !== wasActive || prevTf !== tf || prevSym !== mt5Symbol) {
        console.log(`[BRIDGE] View state updated: active=${activeViewState.active}, symbol=${mt5Symbol}, tf=${tf} (${mt5Tf})`);
      }
      return respondJson(200, { success: true, activeViewState });
    }

    if (req.method === 'GET' && req.url === '/poll-view') {
      lastMt5Heartbeat = Date.now();
      return respondJson(200, activeViewState);
    }

    if (req.method === 'POST' && req.url === '/mt5-candles-history') {
      lastMt5Heartbeat = Date.now();
      const { symbol, timeframe, candles } = body;
      if (!symbol || !timeframe || !Array.isArray(candles)) {
        return respondJson(400, { error: 'Invalid payload' });
      }
      const getTimeframeSeconds = (tf) => {
        if (!tf) return 60;
        const s = String(tf).toLowerCase().trim();
        if (s === '1m' || s === 'm1') return 60;
        if (s === '3m' || s === 'm3') return 180;
        if (s === '5m' || s === 'm5') return 300;
        if (s === '15m' || s === 'm15') return 900;
        if (s === '30m' || s === 'm30') return 1800;
        if (s === '1h' || s === 'h1') return 3600;
        if (s === '4h' || s === 'h4') return 14400;
        if (s === '1d' || s === 'd1') return 86400;
        if (s.endsWith('m')) return (parseInt(s, 10) || 1) * 60;
        if (s.endsWith('h')) return (parseInt(s, 10) || 1) * 3600;
        if (s.endsWith('d')) return (parseInt(s, 10) || 1) * 86400;
        return 60;
      };

      const tfSec = getTimeframeSeconds(timeframe);
      const normalizeCandle = (c) => {
        if (!c || !Number.isFinite(c.time)) return null;
        let timeSec = c.time > 1e11 ? Math.floor(c.time / 1000) : Math.floor(c.time);
        timeSec = Math.round(timeSec / tfSec) * tfSec;
        return {
          time: timeSec,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
          isClosed: Boolean(c.isClosed)
        };
      };

      const key = `${symbol}:${timeframe}`;
      const byTime = new Map();
      for (const raw of candles) {
        const c = normalizeCandle(raw);
        if (c && Number.isFinite(c.time) && Number.isFinite(c.close)) {
          byTime.set(c.time, c);
        }
      }
      const normalized = Array.from(byTime.values()).sort((a, b) => a.time - b.time);
      const pruned = normalized.slice(-MAX_CACHED_BARS);
      candleCache.set(key, pruned);
      console.log(`[BRIDGE] Ingested ${pruned.length} historical candles for ${key}`);
      return respondJson(200, { success: true, count: pruned.length });
    }

    if (req.method === 'POST' && req.url === '/mt5-candles-live') {
      lastMt5Heartbeat = Date.now();
      const { symbol, timeframe, candle, previousCandle } = body;
      if (!symbol || !timeframe || !candle) {
        return respondJson(400, { error: 'Invalid payload' });
      }

      const getTimeframeSeconds = (tf) => {
        if (!tf) return 60;
        const s = String(tf).toLowerCase().trim();
        if (s === '1m' || s === 'm1') return 60;
        if (s === '3m' || s === 'm3') return 180;
        if (s === '5m' || s === 'm5') return 300;
        if (s === '15m' || s === 'm15') return 900;
        if (s === '30m' || s === 'm30') return 1800;
        if (s === '1h' || s === 'h1') return 3600;
        if (s === '4h' || s === 'h4') return 14400;
        if (s === '1d' || s === 'd1') return 86400;
        if (s.endsWith('m')) return (parseInt(s, 10) || 1) * 60;
        if (s.endsWith('h')) return (parseInt(s, 10) || 1) * 3600;
        if (s.endsWith('d')) return (parseInt(s, 10) || 1) * 86400;
        return 60;
      };

      const tfSec = getTimeframeSeconds(timeframe);
      const normalizeCandle = (c) => {
        if (!c || !Number.isFinite(c.time)) return null;
        let timeSec = c.time > 1e11 ? Math.floor(c.time / 1000) : Math.floor(c.time);
        timeSec = Math.round(timeSec / tfSec) * tfSec;
        return {
          time: timeSec,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume || 0),
          isClosed: Boolean(c.isClosed)
        };
      };

      const key = `${symbol}:${timeframe}`;
      let list = candleCache.get(key) || [];

      const normPrev = normalizeCandle(previousCandle);
      if (normPrev) {
        const prevIdx = list.findIndex(c => c.time === normPrev.time);
        if (prevIdx >= 0) {
          list[prevIdx] = normPrev;
        } else {
          list.push(normPrev);
        }
      }

      const normCur = normalizeCandle(candle);
      if (normCur) {
        const curIdx = list.findIndex(c => c.time === normCur.time);
        if (curIdx >= 0) {
          list[curIdx] = normCur;
        } else {
          list.push(normCur);
        }
      }

      list.sort((a, b) => a.time - b.time);
      if (list.length > MAX_CACHED_BARS) {
        list = list.slice(-MAX_CACHED_BARS);
      }
      candleCache.set(key, list);
      return respondJson(200, { success: true });
    }

    if (req.method === 'GET' && req.url.startsWith('/mt5-candles')) {
      lastWebHeartbeat = Date.now();
      const parsedUrl = new URL(req.url, 'http://localhost');
      let symbol = parsedUrl.searchParams.get('symbol') || activeViewState.symbol;
      if (symbol && symbol.endsWith('USDT')) {
        symbol = symbol.replace('USDT', 'USD');
      }
      const timeframe = parsedUrl.searchParams.get('timeframe') || activeViewState.timeframe;
      const key = `${symbol}:${timeframe}`;
      const candles = candleCache.get(key) || [];
      return respondJson(200, {
        success: true,
        symbol,
        timeframe,
        active: activeViewState.active,
        candles
      });
    }

    res.writeHead(404);
    res.end('Not found');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BRIDGE] Server listening on http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
  
  // Log connection state transitions so the user knows what's going on
  setInterval(() => {
    const isMt5Connected = (Date.now() - lastMt5Heartbeat) < 3000;
    const isWebConnected = (Date.now() - lastWebHeartbeat) < 4000;
    
    if (isMt5Connected !== wasMt5Connected) {
      wasMt5Connected = isMt5Connected;
      if (isMt5Connected) {
        console.log(`[BRIDGE] \x1b[32mMT5 CONNECTED\x1b[0m (receiving heartbeats from EA)`);
      } else {
        console.log(`[BRIDGE] \x1b[31mMT5 DISCONNECTED\x1b[0m (no heartbeats for 3s)`);
      }
    }

    if (isWebConnected !== wasWebConnected) {
      wasWebConnected = isWebConnected;
      if (isWebConnected) {
        console.log(`[BRIDGE] \x1b[36mWEB APP CONNECTED\x1b[0m (receiving /status polls)`);
      } else {
        console.log(`[BRIDGE] \x1b[33mWEB APP DISCONNECTED\x1b[0m (no /status polls for 4s)`);
      }
    }
  }, 1000);
});
