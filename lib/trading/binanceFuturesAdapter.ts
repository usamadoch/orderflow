import 'server-only';

import type {
  AccountSnapshot,
  Balance,
  BrokerAdapter,
  OrderCancelRequest,
  Order,
  OrderRequest,
  OrderResult,
  Position,
  TradeFill,
} from '../../types/trading';
import type { BinanceTradingConfig } from './config';
import { BinanceRestClient } from './binanceRestClient';

// ─── Binance Futures raw response shapes ────────────────────────────────────

interface FuturesBalance {
  asset?: unknown;
  availableBalance?: unknown;
  walletBalance?: unknown;
  unrealizedProfit?: unknown;
  updateTime?: unknown;
}

interface FuturesAccountResponse {
  assets?: unknown;
  updateTime?: unknown;
}

interface FuturesPositionRisk {
  symbol?: unknown;
  positionSide?: unknown;
  positionAmt?: unknown;
  entryPrice?: unknown;
  markPrice?: unknown;
  unrealizedProfit?: unknown;
  liquidationPrice?: unknown;
  leverage?: unknown;
  marginType?: unknown;
  notional?: unknown;
  updateTime?: unknown;
}

interface FuturesOrderResponse {
  symbol?: unknown;
  orderId?: unknown;
  clientOrderId?: unknown;
  price?: unknown;
  origQty?: unknown;
  executedQty?: unknown;
  cumQuote?: unknown;
  status?: unknown;
  timeInForce?: unknown;
  type?: unknown;
  side?: unknown;
  stopPrice?: unknown;
  time?: unknown;
  transactTime?: unknown;
  updateTime?: unknown;
  reduceOnly?: unknown;
}

interface FuturesTradeResponse {
  id?: unknown;
  orderId?: unknown;
  symbol?: unknown;
  price?: unknown;
  qty?: unknown;
  commission?: unknown;
  commissionAsset?: unknown;
  time?: unknown;
  side?: unknown;
  buyer?: unknown;
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class BinanceFuturesBrokerAdapter implements BrokerAdapter {
  mode: BinanceTradingConfig['mode'];
  private readonly client: BinanceRestClient;

  constructor(private readonly config: BinanceTradingConfig) {
    this.mode = config.mode;
    this.client = new BinanceRestClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      restBaseUrl: config.restBaseUrl,
      serverTimeUrl: config.serverTimeUrl,
    });
  }

  async getAccountSnapshot(symbol?: string, recentTradesLimit?: number): Promise<AccountSnapshot> {
    const [balances, openOrders, positions, recentTrades] = await Promise.all([
      this.getBalances(),
      this.getOpenOrders(),
      this.getPositions(),
      symbol ? this.getRecentTrades(symbol, recentTradesLimit) : Promise.resolve([]),
    ]);

    return {
      mode: this.config.mode,
      connectionStatus: 'connected',
      checkedAt: new Date().toISOString(),
      balances,
      positions,
      openOrders,
      recentTrades,
    };
  }

  async getBalances(): Promise<Balance[]> {
    const response = await this.client.signedGet<FuturesAccountResponse>('/fapi/v2/account');
    const assets = Array.isArray(response.assets) ? response.assets : [];
    const updatedAt = asNumber(response.updateTime);

    return assets
      .map((asset) => normalizeFuturesBalance(asset as FuturesBalance, updatedAt))
      .filter((b): b is Balance => Boolean(b))
      .filter((b) => b.total > 0);
  }

  async getPositions(): Promise<Position[]> {
    const response = await this.client.signedGet<FuturesPositionRisk[]>('/fapi/v2/positionRisk');
    const positions = Array.isArray(response) ? response : [];
    return positions
      .map(normalizePosition)
      .filter((p): p is Position => Boolean(p))
      .filter((p) => p.side !== 'flat');
  }

  async getOpenOrders(): Promise<Order[]> {
    const response = await this.client.signedGet<FuturesOrderResponse[]>('/fapi/v1/openOrders');
    const orders = Array.isArray(response) ? response : [];
    return orders
      .map(normalizeOrder)
      .filter((o): o is Order => Boolean(o));
  }

  async getRecentTrades(symbol?: string, limit = 50): Promise<TradeFill[]> {
    if (!symbol) return [];
    const boundedLimit = Math.min(1000, Math.max(1, Math.trunc(Number.isFinite(limit) ? limit : 50)));
    const response = await this.client.signedGet<FuturesTradeResponse[]>('/fapi/v1/userTrades', {
      symbol: symbol.toUpperCase(),
      limit: boundedLimit,
    });
    const trades = Array.isArray(response) ? response : [];
    return trades
      .map(normalizeTrade)
      .filter((t): t is TradeFill => Boolean(t));
  }

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    if (request.contractType === 'spot') {
      return createRejectedResult(this.config.mode, 'Use the Spot adapter for spot orders.', 'wrong_adapter');
    }

    if (request.type !== 'market' && request.type !== 'limit') {
      return createRejectedResult(this.config.mode, 'Only market and limit orders are supported.', 'unsupported_order_type');
    }

    // Set leverage if requested (best-effort; failures are non-fatal for the order)
    if (request.leverage && Number.isFinite(request.leverage) && request.leverage >= 1) {
      try {
        await this.client.signedPost('/fapi/v1/leverage', {
          symbol: request.symbol.toUpperCase(),
          leverage: Math.round(request.leverage),
        });
      } catch {
        // Leverage setting is non-fatal — proceed with default leverage
      }
    }

    const params: Record<string, string | number | undefined> = {
      symbol:           request.symbol.toUpperCase(),
      side:             request.side === 'buy' ? 'BUY' : 'SELL',
      type:             request.type === 'market' ? 'MARKET' : 'LIMIT',
      quantity:         request.quantity,
      newClientOrderId: request.clientOrderId,
      reduceOnly:       request.reduceOnly === true ? 'true' : undefined,
    };

    if (request.type === 'limit') {
      params.price       = request.price;
      params.timeInForce = request.timeInForce ?? 'GTC';
    }

    const response = await this.client.signedPost<FuturesOrderResponse>('/fapi/v1/order', params);
    const order = normalizeOrder(response);

    return {
      success: Boolean(order),
      mode: this.config.mode,
      order: order ?? undefined,
      errorMessage: order ? undefined : 'Futures order response could not be normalized.',
      rejectedReason: order ? undefined : 'order_response_normalization_failed',
    };
  }

  async cancelOrder(request: OrderCancelRequest): Promise<OrderResult> {
    const response = await this.client.signedDelete<FuturesOrderResponse>('/fapi/v1/order', {
      symbol:            request.symbol.toUpperCase(),
      orderId:           request.orderId,
      origClientOrderId: request.clientOrderId,
    });
    const order = normalizeOrder(response);

    return {
      success: Boolean(order),
      mode: this.config.mode,
      order: order ?? undefined,
      errorMessage: order ? undefined : 'Futures cancel response could not be normalized.',
      rejectedReason: order ? undefined : 'cancel_response_normalization_failed',
    };
  }
}

export function createBinanceFuturesBrokerAdapter(config: BinanceTradingConfig): BrokerAdapter {
  return new BinanceFuturesBrokerAdapter(config);
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeFuturesBalance(raw: FuturesBalance, updatedAt?: number): Balance | null {
  const asset     = asString(raw.asset);
  const free      = asNumber(raw.availableBalance) ?? asNumber(raw.walletBalance) ?? 0;
  const unrealized = asNumber(raw.unrealizedProfit) ?? 0;
  if (!asset) return null;

  return {
    asset,
    free,
    locked: unrealized,        // unrealized profit as "locked" for display purposes
    total: free + unrealized,
    updatedAt,
  };
}

function normalizePosition(raw: FuturesPositionRisk): Position | null {
  const symbol = asString(raw.symbol);
  if (!symbol) return null;

  const positionAmt = asNumber(raw.positionAmt) ?? 0;
  const absQty = Math.abs(positionAmt);

  // Flat position — no size
  if (absQty < 1e-9) {
    return { symbol, side: 'flat', quantity: 0 };
  }

  const side: 'long' | 'short' | 'flat' = positionAmt > 0 ? 'long' : 'short';
  const entryPrice     = asOptionalPositiveNumber(raw.entryPrice);
  const markPrice      = asOptionalPositiveNumber(raw.markPrice);
  const unrealizedPnl  = asNumber(raw.unrealizedProfit);
  const liquidationPrice = asOptionalPositiveNumber(raw.liquidationPrice);
  const leverage       = asNumber(raw.leverage);
  const notional       = asNumber(raw.notional);

  const marginType = raw.marginType === 'cross' || raw.marginType === 'isolated'
    ? raw.marginType
    : undefined;

  let roe: number | undefined;
  if (
    notional != null && Math.abs(notional) > 0 &&
    unrealizedPnl != null && leverage != null && leverage > 0
  ) {
    const margin = Math.abs(notional) / leverage;
    roe = margin > 0 ? (unrealizedPnl / margin) * 100 : undefined;
  }

  return {
    symbol,
    side,
    quantity: absQty,
    entryPrice,
    markPrice,
    unrealizedPnl,
    liquidationPrice,
    leverage,
    marginType,
    notional: notional != null ? Math.abs(notional) : undefined,
    roe,
    updatedAt: asNumber(raw.updateTime),
  };
}

function normalizeOrder(raw: FuturesOrderResponse): Order | null {
  const id             = asString(raw.orderId);
  const symbol         = asString(raw.symbol);
  const side           = normalizeSide(raw.side);
  const type           = normalizeOrderType(raw.type);
  const status         = normalizeOrderStatus(raw.status);
  const quantity       = asNumber(raw.origQty);
  const filledQuantity = asNumber(raw.executedQty);
  const createdAt      = asNumber(raw.time) ?? asNumber(raw.transactTime) ?? asNumber(raw.updateTime) ?? Date.now();

  if (!id || !symbol || !side || !type || !status || quantity === undefined || filledQuantity === undefined || createdAt === undefined) {
    console.error('[normalizeOrder: Futures] Failed to normalize order.', {
      raw,
      id, symbol, side, type, status, quantity, filledQuantity, createdAt
    });
    return null;
  }

  const cumQuote    = asNumber(raw.cumQuote);
  const averagePrice = filledQuantity > 0 && cumQuote !== undefined ? cumQuote / filledQuantity : undefined;

  return {
    id,
    clientOrderId: asString(raw.clientOrderId),
    symbol,
    side,
    type,
    status,
    quantity,
    filledQuantity,
    averagePrice,
    price: asOptionalPositiveNumber(raw.price),
    stopPrice: asOptionalPositiveNumber(raw.stopPrice),
    timeInForce: normalizeTimeInForce(raw.timeInForce),
    createdAt,
    updatedAt: asNumber(raw.updateTime),
  };
}

function normalizeTrade(raw: FuturesTradeResponse): TradeFill | null {
  const id       = asString(raw.id);
  const orderId  = asString(raw.orderId);
  const symbol   = asString(raw.symbol);
  const price    = asNumber(raw.price);
  const quantity = asNumber(raw.qty);
  const time     = asNumber(raw.time);

  if (!id || !orderId || !symbol || price === undefined || quantity === undefined || time === undefined) return null;

  const isBuyer = raw.buyer === true || raw.side === 'BUY';

  return {
    id,
    orderId,
    symbol,
    side: isBuyer ? 'buy' : 'sell',
    price,
    quantity,
    fee: asNumber(raw.commission),
    feeAsset: asString(raw.commissionAsset),
    time,
  };
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function createRejectedResult(mode: BinanceTradingConfig['mode'], errorMessage: string, rejectedReason: string): OrderResult {
  return { success: false, mode, errorMessage, rejectedReason };
}

function normalizeSide(value: unknown) {
  if (value === 'BUY') return 'buy' as const;
  if (value === 'SELL') return 'sell' as const;
  return null;
}

function normalizeOrderType(value: unknown) {
  if (value === 'MARKET') return 'market' as const;
  if (value === 'LIMIT') return 'limit' as const;
  if (value === 'STOP_MARKET' || value === 'STOP') return 'stop_market' as const;
  if (value === 'TAKE_PROFIT_MARKET' || value === 'TAKE_PROFIT') return 'stop_market' as const;
  if (value === 'STOP_LIMIT' || value === 'STOP_LOSS_LIMIT') return 'stop_limit' as const;
  return null;
}

function normalizeOrderStatus(value: unknown) {
  if (value === 'NEW') return 'open' as const;
  if (value === 'PARTIALLY_FILLED') return 'partially_filled' as const;
  if (value === 'FILLED') return 'filled' as const;
  if (value === 'CANCELED') return 'cancelled' as const;
  if (value === 'REJECTED') return 'rejected' as const;
  if (value === 'EXPIRED') return 'expired' as const;
  return null;
}

function normalizeTimeInForce(value: unknown) {
  if (value === 'GTC' || value === 'IOC' || value === 'FOK') return value;
  return undefined;
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
