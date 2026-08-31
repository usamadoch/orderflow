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
