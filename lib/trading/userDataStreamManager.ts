import 'server-only';

import type {
  AccountSnapshot,
  Balance,
  Order,
  OrderSide,
  OrderStatus,
  OrderTimeInForce,
  OrderType,
  Position,
  TradeFill,
  TradingUserStreamStatus,
  TradingUserStreamStatusPayload,
} from '../../types/trading';
import type { BinanceTradingConfig } from './config';
import { BinanceRestClientError } from './binanceRestClient';
import { createBinanceBrokerAdapter } from './binanceAdapter';
import { createBinanceFuturesBrokerAdapter } from './binanceFuturesAdapter';

function createAdapter(config: BinanceTradingConfig) {
  return config.isFutures
    ? createBinanceFuturesBrokerAdapter(config)
    : createBinanceBrokerAdapter(config);
}


const KEEPALIVE_INTERVAL_MS = 30 * 60 * 1000;
const LISTEN_KEY_TTL_MS = 60 * 60 * 1000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const MAX_RECENT_TRADES = 200;

interface ListenKeyResponse {
  listenKey?: unknown;
}

interface StartOptions {
  symbol?: string;
  recentTradesLimit?: number;
}

interface BinanceExecutionReport {
  e?: unknown;
  E?: unknown;
  s?: unknown;
  c?: unknown;
  S?: unknown;
  o?: unknown;
  f?: unknown;
  q?: unknown;
  p?: unknown;
  P?: unknown;
  x?: unknown;
  X?: unknown;
  i?: unknown;
  l?: unknown;
  z?: unknown;
  L?: unknown;
  n?: unknown;
  N?: unknown;
  T?: unknown;
  t?: unknown;
  O?: unknown;
  Z?: unknown;
}

type UnknownRecord = Record<string, unknown>;

export class BinanceUserDataStreamManager {
  private socket: WebSocket | null = null;
  private listenKey: string | null = null;
  private listenKeyCreatedAt: number | null = null;
  private listenKeyLastKeepaliveAt: number | null = null;
  private keepaliveTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectCount = 0;
  private connectionGeneration = 0;
  private startingPromise: Promise<void> | null = null;
  private streamStatus: TradingUserStreamStatus = 'idle';
  private lastEventAt: string | null = null;
  private lastErrorMessage: string | null = null;
  private reconciliationLoading = false;
  private lastReconciledAt: string | null = null;
  private lastOptions: StartOptions = {};
  private balances: Balance[] = [];
  private openOrders: Order[] = [];
  private positions: Position[] = [];
  private recentTrades: TradeFill[] = [];

  constructor(private readonly config: BinanceTradingConfig) {}

  async ensureStarted(options: StartOptions = {}) {
    this.lastOptions = {
      symbol: options.symbol ?? this.lastOptions.symbol,
      recentTradesLimit: options.recentTradesLimit ?? this.lastOptions.recentTradesLimit,
    };

    if (this.streamStatus === 'connected' || this.streamStatus === 'starting' || this.streamStatus === 'reconnecting') {
      if (this.startingPromise) await this.startingPromise;
      return;
    }

    this.startingPromise = this.start();
    try {
      await this.startingPromise;
    } finally {
      this.startingPromise = null;
    }
  }

  async reconcile(symbol = this.lastOptions.symbol, recentTradesLimit = this.lastOptions.recentTradesLimit) {
    this.lastOptions = {
      symbol: symbol ?? this.lastOptions.symbol,
      recentTradesLimit: recentTradesLimit ?? this.lastOptions.recentTradesLimit,
    };
    this.reconciliationLoading = true;

    try {
      const adapter = createAdapter(this.config);
      const snapshot = await adapter.getAccountSnapshot(symbol, recentTradesLimit);
      this.applySnapshot(snapshot);
      this.lastErrorMessage = null;
      return snapshot;
    } catch (error) {
      this.lastErrorMessage = safeErrorMessage(error, 'Binance account stream reconciliation failed.');
      throw error;
    } finally {
      this.reconciliationLoading = false;
    }
  }

  getStatus(): TradingUserStreamStatusPayload {
    const listenKeyExpiresAt = this.listenKeyCreatedAt
      ? new Date(this.listenKeyCreatedAt + LISTEN_KEY_TTL_MS).toISOString()
      : null;

    return {
      mode: this.config.mode,
      streamStatus: this.streamStatus,
      connected: this.isSocketOpen(),
      reconnecting: this.streamStatus === 'reconnecting',
      lastEventAt: this.lastEventAt,
      reconnectCount: this.reconnectCount,
      lastErrorMessage: this.lastErrorMessage,
      listenKeyActive: Boolean(this.listenKey),
      listenKeyLastKeepaliveAt: this.listenKeyLastKeepaliveAt
        ? new Date(this.listenKeyLastKeepaliveAt).toISOString()
        : null,
      listenKeyExpiresAt,
      reconciliationLoading: this.reconciliationLoading,
      lastReconciledAt: this.lastReconciledAt,
      checkedAt: new Date().toISOString(),
    };
  }

  getSnapshot(): AccountSnapshot {
    return {
      mode: this.config.mode,
      connectionStatus: this.isSocketOpen() ? 'connected' : 'degraded',
      checkedAt: this.lastReconciledAt ?? new Date().toISOString(),
      balances: this.balances,
      positions: this.positions,
      openOrders: this.openOrders,
      recentTrades: this.recentTrades,
    };
  }

  stop() {
    this.connectionGeneration += 1;
    this.clearTimer('keepalive');
    this.clearTimer('reconnect');
    this.closeSocket();
    this.listenKey = null;
    this.listenKeyCreatedAt = null;
    this.listenKeyLastKeepaliveAt = null;
    this.streamStatus = 'disconnected';
  }

  private async start() {
    if (!this.config.restBaseUrl || !this.config.userStreamWsBaseUrl) {
      this.streamStatus = 'blocked';
      this.lastErrorMessage = 'Binance user data stream is not configured for this trading mode.';
      return;
    }

    if (!this.config.apiKey || !this.config.apiSecret) {
      this.streamStatus = 'error';
      this.lastErrorMessage = 'Binance API key and secret are required to start the user data stream.';
      return;
    }

    if (typeof WebSocket === 'undefined') {
      this.streamStatus = 'error';
      this.lastErrorMessage = 'WebSocket is not available in this server runtime.';
      return;
    }

    this.streamStatus = this.reconnectCount > 0 ? 'reconnecting' : 'starting';
    this.closeSocket();

    try {
      this.listenKey = await this.createListenKey();
      this.listenKeyCreatedAt = Date.now();
      this.listenKeyLastKeepaliveAt = null;
      this.scheduleKeepalive();
      this.connectSocket(this.listenKey);
      await this.reconcile(this.lastOptions.symbol, this.lastOptions.recentTradesLimit).catch(() => undefined);
    } catch (error) {
      this.lastErrorMessage = safeErrorMessage(error, 'Binance user data stream start failed.');
      this.streamStatus = 'error';
      this.scheduleReconnect();
    }
  }

  private connectSocket(listenKey: string) {
    const generation = ++this.connectionGeneration;
    const socket = new WebSocket(`${this.config.userStreamWsBaseUrl}/${encodeURIComponent(listenKey)}`);
    this.socket = socket;

    socket.onopen = () => {
      if (generation !== this.connectionGeneration) return;
      this.streamStatus = 'connected';
      this.lastErrorMessage = null;
    };

    socket.onmessage = (event) => {
      if (generation !== this.connectionGeneration) return;
      this.handleMessage(event.data);
    };

    socket.onerror = () => {
      if (generation !== this.connectionGeneration) return;
      this.lastErrorMessage = 'Binance user data stream WebSocket error.';
      this.streamStatus = 'reconnecting';
    };

    socket.onclose = () => {
      if (generation !== this.connectionGeneration) return;
      if (this.streamStatus !== 'disconnected') {
        this.streamStatus = 'reconnecting';
        this.scheduleReconnect();
      }
    };
  }

  private async createListenKey() {
    const path = this.config.isFutures ? '/fapi/v1/listenKey' : '/api/v3/userDataStream';
    const response = await this.apiKeyRequest<ListenKeyResponse>('POST', path);
    const listenKey = typeof response.listenKey === 'string' ? response.listenKey : null;
    if (!listenKey) {
      throw new BinanceRestClientError('Binance user data stream did not return a listenKey.', 'listen_key_missing', 502);
    }
    return listenKey;
  }

  private async keepaliveListenKey() {
    if (!this.listenKey) return;

    try {
      const path = this.config.isFutures ? '/fapi/v1/listenKey' : '/api/v3/userDataStream';
      await this.apiKeyRequest<unknown>('PUT', path, { listenKey: this.listenKey });
      this.listenKeyLastKeepaliveAt = Date.now();
      this.scheduleKeepalive();
    } catch (error) {
      this.lastErrorMessage = safeErrorMessage(error, 'Binance user data stream keepalive failed.');
      this.streamStatus = 'reconnecting';
      this.scheduleReconnect(true);
    }
  }

  private async apiKeyRequest<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, params: Record<string, string> = {}) {
    if (!this.config.restBaseUrl || !this.config.apiKey) {
      throw new BinanceRestClientError('Binance user stream REST endpoint is not configured.', 'endpoint_not_configured', 400);
    }

    const searchParams = new URLSearchParams(params);
    const query = searchParams.toString();
    const response = await fetch(`${this.config.restBaseUrl}${path}${query ? `?${query}` : ''}`, {
      method,
      cache: 'no-store',
      headers: {
        'X-MBX-APIKEY': this.config.apiKey,
      },
    });

    if (response.ok) {
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }

    throw await createBinanceUserStreamError(response);
  }

  private handleMessage(data: unknown) {
    const event = parseEvent(data);
    if (!event) return;

    const eventType = typeof event.e === 'string' ? event.e : null;
    const eventTime = asNumber(event.E) ?? Date.now();
    this.lastEventAt = new Date(eventTime).toISOString();

    if (eventType === 'outboundAccountPosition') {
      this.mergeAccountPosition(event, eventTime);
      return;
    }

    if (eventType === 'balanceUpdate') {
      this.mergeBalanceUpdate(event, eventTime);
      return;
    }

    if (eventType === 'executionReport') {
      this.mergeExecutionReport(event as BinanceExecutionReport, eventTime);
      return;
    }

    if (eventType === 'listenKeyExpired') {
      this.lastErrorMessage = 'Binance user data stream listenKey expired.';
      this.streamStatus = 'reconnecting';
      this.scheduleReconnect(true);
    }
  }

  private mergeAccountPosition(event: UnknownRecord, eventTime: number) {
    const balances = Array.isArray(event.B) ? event.B : [];
    for (const rawBalance of balances) {
      if (!rawBalance || typeof rawBalance !== 'object') continue;
      const balance = normalizeStreamBalance(rawBalance as UnknownRecord, eventTime);
      if (!balance) continue;
      this.upsertBalance(balance);
    }
  }

  private mergeBalanceUpdate(event: UnknownRecord, eventTime: number) {
    const asset = asString(event.a);
    const delta = asNumber(event.d);
    if (!asset || delta === undefined) return;

    const existing = this.balances.find((balance) => balance.asset === asset);
    const free = Math.max(0, (existing?.free ?? 0) + delta);
    const locked = existing?.locked ?? 0;
    this.upsertBalance({
      asset,
      free,
      locked,
      total: free + locked,
      updatedAt: asNumber(event.T) ?? eventTime,
    });
  }

  private mergeExecutionReport(event: BinanceExecutionReport, eventTime: number) {
    const order = normalizeExecutionReportOrder(event, eventTime);
    if (order) {
      if (order.status === 'open' || order.status === 'partially_filled' || order.status === 'pending') {
        this.upsertOrder(order);
      } else {
        this.openOrders = this.openOrders.filter((existing) => existing.id !== order.id);
      }
    }

    const fill = normalizeExecutionReportFill(event, eventTime);
    if (fill) {
      this.upsertFill(fill);
    }
  }

  private upsertBalance(balance: Balance) {
    const byAsset = new Map(this.balances.map((existing) => [existing.asset, existing]));
    byAsset.set(balance.asset, balance);
    this.balances = Array.from(byAsset.values())
      .filter((entry) => entry.total > 0)
      .sort((a, b) => a.asset.localeCompare(b.asset));
  }

  private upsertOrder(order: Order) {
    const byId = new Map(this.openOrders.map((existing) => [existing.id, existing]));
    byId.set(order.id, order);
    this.openOrders = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  private upsertFill(fill: TradeFill) {
    const byId = new Map(this.recentTrades.map((existing) => [getFillKey(existing), existing]));
    byId.set(getFillKey(fill), fill);
    this.recentTrades = Array.from(byId.values())
      .sort((a, b) => b.time - a.time)
      .slice(0, MAX_RECENT_TRADES);
  }

  private applySnapshot(snapshot: AccountSnapshot) {
    this.balances = snapshot.balances;
    this.openOrders = snapshot.openOrders;
    this.positions = snapshot.positions;
    this.recentTrades = snapshot.recentTrades;
    this.lastReconciledAt = snapshot.checkedAt;
  }

  private scheduleKeepalive() {
    this.clearTimer('keepalive');
    this.keepaliveTimer = setTimeout(() => {
      void this.keepaliveListenKey();
    }, KEEPALIVE_INTERVAL_MS);
  }

  private scheduleReconnect(recreateListenKey = false) {
    this.clearTimer('reconnect');
    this.clearTimer('keepalive');
    this.closeSocket();
    if (recreateListenKey) {
      this.listenKey = null;
      this.listenKeyCreatedAt = null;
      this.listenKeyLastKeepaliveAt = null;
    }

    this.reconnectCount += 1;
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** Math.min(5, this.reconnectCount - 1));
    this.reconnectTimer = setTimeout(() => {
      this.startingPromise = this.start();
      void this.startingPromise.finally(() => {
        this.startingPromise = null;
      });
    }, delay);
  }

  private closeSocket() {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  }

  private clearTimer(name: 'keepalive' | 'reconnect') {
    const timer = name === 'keepalive' ? this.keepaliveTimer : this.reconnectTimer;
    if (timer) clearTimeout(timer);
    if (name === 'keepalive') {
      this.keepaliveTimer = null;
    } else {
      this.reconnectTimer = null;
    }
  }

  private isSocketOpen() {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN && this.streamStatus === 'connected');
  }
}

let streamManager: BinanceUserDataStreamManager | null = null;
let streamManagerKey: string | null = null;

export function getBinanceUserDataStreamManager(config: BinanceTradingConfig) {
  const key = [
    config.mode,
    config.restBaseUrl,
    config.userStreamWsBaseUrl,
    Boolean(config.apiKey),
    Boolean(config.apiSecret),
  ].join('|');

  if (!streamManager || streamManagerKey !== key) {
    streamManager?.stop();
    streamManager = new BinanceUserDataStreamManager(config);
    streamManagerKey = key;
  }

  return streamManager;
}

async function createBinanceUserStreamError(response: Response) {
  let message = `Binance user data stream request failed with HTTP ${response.status}.`;
  let binanceCode: number | undefined;

  try {
    const body = (await response.json()) as { code?: unknown; msg?: unknown };
    if (typeof body.msg === 'string') {
      message = `Binance user data stream request failed: ${body.msg}`;
    }
    if (typeof body.code === 'number') {
      binanceCode = body.code;
    }
  } catch {
    // Keep the generic HTTP message.
  }

  return new BinanceRestClientError(message, 'binance_user_stream_request_failed', response.status, binanceCode);
}

function parseEvent(data: unknown): UnknownRecord | null {
  if (typeof data !== 'string') return null;

  try {
    const parsed = JSON.parse(data) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as UnknownRecord : null;
  } catch {
    return null;
  }
}

function normalizeStreamBalance(balance: UnknownRecord, eventTime: number): Balance | null {
  const asset = asString(balance.a);
  const free = asNumber(balance.f);
  const locked = asNumber(balance.l);
  if (!asset || free === undefined || locked === undefined) return null;

  return {
    asset,
    free,
    locked,
    total: free + locked,
    updatedAt: eventTime,
  };
}

function normalizeExecutionReportOrder(event: BinanceExecutionReport, eventTime: number): Order | null {
  const id = asString(event.i);
  const symbol = asString(event.s);
  const side = normalizeSide(event.S);
  const type = normalizeOrderType(event.o);
  const status = normalizeOrderStatus(event.X);
  const quantity = asNumber(event.q);
  const filledQuantity = asNumber(event.z);
  const createdAt = asNumber(event.O) ?? eventTime;

  if (!id || !symbol || !side || !type || !status || quantity === undefined || filledQuantity === undefined) {
    return null;
  }

  const quoteQuantity = asNumber(event.Z);
  const averagePrice = filledQuantity > 0 && quoteQuantity !== undefined ? quoteQuantity / filledQuantity : undefined;

  return {
    id,
    clientOrderId: asString(event.c),
    symbol,
    side,
    type,
    status,
    quantity,
    filledQuantity,
    averagePrice,
    price: asOptionalPositiveNumber(event.p),
    stopPrice: asOptionalPositiveNumber(event.P),
    timeInForce: normalizeTimeInForce(event.f),
    createdAt,
    updatedAt: asNumber(event.T) ?? eventTime,
  };
}

function normalizeExecutionReportFill(event: BinanceExecutionReport, eventTime: number): TradeFill | null {
  if (event.x !== 'TRADE') return null;

  const tradeId = asString(event.t);
  const orderId = asString(event.i);
  const symbol = asString(event.s);
  const side = normalizeSide(event.S);
  const price = asNumber(event.L);
  const quantity = asNumber(event.l);
  const time = asNumber(event.T) ?? eventTime;

  if (!tradeId || !orderId || !symbol || !side || price === undefined || quantity === undefined || quantity <= 0) {
    return null;
  }

  return {
    id: `${symbol}:${tradeId}`,
    orderId,
    symbol,
    side,
    price,
    quantity,
    fee: asNumber(event.n),
    feeAsset: asString(event.N),
    time,
  };
}

function normalizeSide(value: unknown): OrderSide | null {
  if (value === 'BUY') return 'buy';
  if (value === 'SELL') return 'sell';
  return null;
}

function normalizeOrderType(value: unknown): OrderType | null {
  if (value === 'MARKET') return 'market';
  if (value === 'LIMIT') return 'limit';
  if (value === 'STOP_LOSS' || value === 'TAKE_PROFIT' || value === 'STOP_MARKET') return 'stop_market';
  if (value === 'STOP_LOSS_LIMIT' || value === 'TAKE_PROFIT_LIMIT') return 'stop_limit';
  return null;
}

function normalizeOrderStatus(value: unknown): OrderStatus | null {
  if (value === 'NEW') return 'open';
  if (value === 'PARTIALLY_FILLED') return 'partially_filled';
  if (value === 'FILLED') return 'filled';
  if (value === 'CANCELED') return 'cancelled';
  if (value === 'REJECTED') return 'rejected';
  if (value === 'EXPIRED') return 'expired';
  return null;
}

function normalizeTimeInForce(value: unknown): OrderTimeInForce | undefined {
  if (value === 'GTC' || value === 'IOC' || value === 'FOK') return value;
  return undefined;
}

function getFillKey(fill: TradeFill) {
  return `${fill.symbol}:${fill.orderId}:${fill.id}:${fill.time}`;
}

function asString(value: unknown) {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asOptionalPositiveNumber(value: unknown) {
  const parsed = asNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function safeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
