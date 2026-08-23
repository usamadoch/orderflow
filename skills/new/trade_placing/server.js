// server.js — local trade execution bridge.
//
// Web client  --POST /order-->        this server
// MT5 EA      --GET  /pending-->      this server (polls, consumes)
// MT5 EA      --POST /result-->       this server (reports fill/reject)
// Web client  --GET  /result/:id-->   this server (polls for outcome)
//
// Deliberately minimal: in-memory only, single pending-order slot,
// no auth. This is safe ONLY because it's bound to 127.0.0.1 and
// never reachable from outside this machine — see README before
// changing the bind address.

const express = require("express");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = 4785;
const HOST = "127.0.0.1";

// Single-slot pending queue. A second order request before the EA
// has polled the first simply overwrites it — there's only ever one
// account/EA on the other end, so this is enough for a first version.
let pendingOrder = null;

// requestId -> latest known status/result.
const results = new Map();

// Populated by the EA's periodic /account-update posts, if it sends them.
let accountInfo = null;

app.post("/order", (req, res) => {
  const { symbol, direction, sl } = req.body || {};

  if (typeof symbol !== "string" || !symbol) {
    return res.status(400).json({ error: "symbol is required" });
  }
  if (direction !== "BUY" && direction !== "SELL") {
    return res.status(400).json({ error: "direction must be BUY or SELL" });
  }
  if (typeof sl !== "number" || !Number.isFinite(sl) || sl <= 0) {
    return res.status(400).json({ error: "sl must be a positive number" });
  }

  const requestId = crypto.randomUUID();
  pendingOrder = { requestId, symbol, direction, sl, createdAt: Date.now() };
  results.set(requestId, { requestId, status: "PENDING" });

  res.json({ requestId, status: "PENDING" });
});

// The EA polls this. Returning the order also consumes it, so the
// same order is never handed to the EA twice.
app.get("/pending", (req, res) => {
  if (!pendingOrder) return res.json(null);
  const order = pendingOrder;
  pendingOrder = null;
  results.set(order.requestId, { requestId: order.requestId, status: "SENT_TO_EA" });
  res.json(order);
});

// The EA posts the outcome here once the broker responds.
app.post("/result", (req, res) => {
  const { requestId, status, ticket, fillPrice, sl, tp, volume, message } = req.body || {};
  if (!requestId || !status) {
    return res.status(400).json({ error: "requestId and status are required" });
  }
  results.set(requestId, { requestId, status, ticket, fillPrice, sl, tp, volume, message });
  res.json({ ok: true });
});

// The web client polls this after sending an order.
app.get("/result/:requestId", (req, res) => {
  const result = results.get(req.params.requestId);
  if (!result) return res.status(404).json({ error: "unknown requestId" });
  res.json(result);
});

// Optional — EA pushes account snapshots here periodically.
app.post("/account-update", (req, res) => {
  accountInfo = { ...req.body, updatedAt: Date.now() };
  res.json({ ok: true });
});

// Optional — web client reads the last known account snapshot.
app.get("/account", (req, res) => {
  if (!accountInfo) return res.status(404).json({ error: "no account data received yet" });
  res.json(accountInfo);
});

app.listen(PORT, HOST, () => {
  console.log(`Trade bridge listening on http://${HOST}:${PORT}`);
  console.log(`Bound to localhost only — do not change HOST without adding authentication first.`);
});
