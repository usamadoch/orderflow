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

interface BinanceBalance {
  asset?: unknown;
  free?: unknown;
  locked?: unknown;
}

interface BinanceAccountResponse {
  balances?: unknown;
  updateTime?: unknown;
}

interface BinanceOrderResponse {
  symbol?: unknown;
  orderId?: unknown;
  clientOrderId?: unknown;
  price?: unknown;
  origQty?: unknown;
  executedQty?: unknown;
  cummulativeQuoteQty?: unknown;
  status?: unknown;
  timeInForce?: unknown;
  type?: unknown;
  side?: unknown;
  stopPrice?: unknown;
  time?: unknown;
  transactTime?: unknown;
  updateTime?: unknown;
}

interface BinanceTradeResponse {
  id?: unknown;
  orderId?: unknown;
  symbol?: unknown;
  price?: unknown;
  qty?: unknown;
  commission?: unknown;
  commissionAsset?: unknown;
  time?: unknown;
  isBuyer?: unknown;
}

export class BinanceBrokerAdapter implements BrokerAdapter {
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

  async getOpenOrders(): Promise<Order[]> {
    const response = await this.client.signedGet<BinanceOrderResponse[]>('/api/v3/openOrders');
    console.log('[DEBUG] Binance openOrders response:', JSON.stringify(response, null, 2));
    const normalized = response.map(normalizeOrder);
    console.log('[DEBUG] Normalized openOrders:', JSON.stringify(normalized, null, 2));
    return normalized.filter((order): order is Order => Boolean(order));
  }

  async getPositions(): Promise<Position[]> {
    return [];
  }

  async getBalances(): Promise<Balance[]> {
    const response = await this.client.signedGet<BinanceAccountResponse>('/api/v3/account');
    const balances = Array.isArray(response.balances) ? response.balances : [];
    const updatedAt = asNumber(response.updateTime);

    return balances
      .map((balance) => normalizeBalance(balance as BinanceBalance, updatedAt))
      .filter((balance): balance is Balance => Boolean(balance))
      .filter((balance) => balance.total > 0);
  }

  async getRecentTrades(symbol?: string, limit = 50): Promise<TradeFill[]> {
    if (!symbol) return [];

    const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 50;
    const boundedLimit = Math.min(1000, Math.max(1, normalizedLimit));
    const response = await this.client.signedGet<BinanceTradeResponse[]>('/api/v3/myTrades', {
      symbol: symbol.toUpperCase(),
      limit: boundedLimit,
    });

    return response.map(normalizeTradeFill).filter((fill): fill is TradeFill => Boolean(fill));
  }

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    const unsupportedReason = getUnsupportedExecutionReason(this.config.mode, request.contractType);
    if (unsupportedReason) {
      return createRejectedOrderResult(this.config.mode, unsupportedReason.message, unsupportedReason.reason);
    }

    if (request.reduceOnly) {
      return createRejectedOrderResult(this.config.mode, 'Reduce-only is only supported for futures orders.', 'reduce_only_not_supported_for_spot');
    }

    if (request.type !== 'market' && request.type !== 'limit') {
      return createRejectedOrderResult(this.config.mode, 'Only market and limit orders are supported.', 'unsupported_order_type');
    }

    const params: Record<string, string | number | undefined> = {
      symbol: request.symbol.toUpperCase(),
      side: request.side === 'buy' ? 'BUY' : 'SELL',
      type: request.type === 'market' ? 'MARKET' : 'LIMIT',
      quantity: request.quantity,
      newClientOrderId: request.clientOrderId,
      newOrderRespType: 'RESULT',
    };

    if (request.type === 'limit') {
      params.price = request.price;
      params.timeInForce = request.timeInForce ?? 'GTC';
    }

    const response = await this.client.signedPost<BinanceOrderResponse>('/api/v3/order', params);
    const order = normalizeOrder(response);

    return {
      success: Boolean(order),
      mode: this.config.mode,
      order: order ?? undefined,
      errorMessage: order ? undefined : 'Binance order response could not be normalized.',
      rejectedReason: order ? undefined : 'order_response_normalization_failed',
    };
  }

  async cancelOrder(request: OrderCancelRequest): Promise<OrderResult> {
    const unsupportedReason = getUnsupportedExecutionReason(this.config.mode, request.contractType);
    if (unsupportedReason) {
      return createRejectedOrderResult(this.config.mode, unsupportedReason.message, unsupportedReason.reason);
    }

    const response = await this.client.signedDelete<BinanceOrderResponse>('/api/v3/order', {
      symbol: request.symbol.toUpperCase(),
      orderId: request.orderId,
      origClientOrderId: request.clientOrderId,
    });
    const order = normalizeOrder(response);

    return {
      success: Boolean(order),
      mode: this.config.mode,
      order: order ?? undefined,
      errorMessage: order ? undefined : 'Binance cancel response could not be normalized.',
      rejectedReason: order ? undefined : 'cancel_response_normalization_failed',
    };
  }
}

export function createBinanceBrokerAdapter(config: BinanceTradingConfig): BrokerAdapter {
  return new BinanceBrokerAdapter(config);
}

function normalizeBalance(balance: BinanceBalance, updatedAt?: number): Balance | null {
  const asset = asString(balance.asset);
  const free = asNumber(balance.free);
  const locked = asNumber(balance.locked);
  if (!asset || free === undefined || locked === undefined) return null;

  return {
    asset,
    free,
    locked,
    total: free + locked,
    updatedAt,
  };
}

function normalizeOrder(order: BinanceOrderResponse): Order | null {
  const id = asString(order.orderId);
  const symbol = asString(order.symbol);
  const side = normalizeSide(order.side);
  const type = normalizeOrderType(order.type);
  const status = normalizeOrderStatus(order.status);
  const quantity = asNumber(order.origQty);
  const filledQuantity = asNumber(order.executedQty);
  const createdAt = asNumber(order.time) ?? asNumber(order.transactTime);

  if (!id || !symbol || !side || !type || !status || quantity === undefined || filledQuantity === undefined || createdAt === undefined) {
    return null;
  }

  const quoteQuantity = asNumber(order.cummulativeQuoteQty);
  const averagePrice = filledQuantity > 0 && quoteQuantity !== undefined ? quoteQuantity / filledQuantity : undefined;

  return {
    id,
    clientOrderId: asString(order.clientOrderId),
    symbol,
    side,
    type,
    status,
    quantity,
    filledQuantity,
    averagePrice,
    price: asOptionalPositiveNumber(order.price),
    stopPrice: asOptionalPositiveNumber(order.stopPrice),
    timeInForce: normalizeTimeInForce(order.timeInForce),
    createdAt,
    updatedAt: asNumber(order.updateTime),
  };
}

function getUnsupportedExecutionReason(
  mode: BinanceTradingConfig['mode'],
  contractType: OrderRequest['contractType'],
): { message: string; reason: string } | null {
  if (mode !== 'binance_testnet') {
    return {
      message: 'Only Binance testnet order execution is supported.',
      reason: 'unsupported_trading_mode',
    };
  }

  if (contractType === 'futures') {
    return {
      message: 'Futures testnet order placement is not implemented yet.',
      reason: 'futures_order_placement_not_implemented',
    };
  }

  if (contractType && contractType !== 'spot') {
    return {
      message: 'Unsupported contract type selected.',
      reason: 'unsupported_contract_type',
    };
  }

  return null;
}

function createRejectedOrderResult(
  mode: BinanceTradingConfig['mode'],
  errorMessage: string,
  rejectedReason: string,
): OrderResult {
  return {
    success: false,
    mode,
    errorMessage,
    rejectedReason,
  };
}

function normalizeTradeFill(trade: BinanceTradeResponse): TradeFill | null {
  const id = asString(trade.id);
  const orderId = asString(trade.orderId);
  const symbol = asString(trade.symbol);
  const price = asNumber(trade.price);
  const quantity = asNumber(trade.qty);
  const time = asNumber(trade.time);

  if (!id || !orderId || !symbol || price === undefined || quantity === undefined || time === undefined) {
    return null;
  }

  return {
    id,
    orderId,
    symbol,
    side: trade.isBuyer === true ? 'buy' : 'sell',
    price,
    quantity,
    fee: asNumber(trade.commission),
    feeAsset: asString(trade.commissionAsset),
    time,
  };
}

function normalizeSide(value: unknown) {
  if (value === 'BUY') return 'buy';
  if (value === 'SELL') return 'sell';
  return null;
}

function normalizeOrderType(value: unknown) {
  if (value === 'MARKET') return 'market';
  if (value === 'LIMIT') return 'limit';
  if (value === 'STOP_LOSS' || value === 'TAKE_PROFIT' || value === 'STOP_MARKET') return 'stop_market';
  if (value === 'STOP_LOSS_LIMIT' || value === 'TAKE_PROFIT_LIMIT') return 'stop_limit';
  return null;
}

function normalizeOrderStatus(value: unknown) {
  if (value === 'NEW') return 'open';
  if (value === 'PARTIALLY_FILLED') return 'partially_filled';
  if (value === 'FILLED') return 'filled';
  if (value === 'CANCELED') return 'cancelled';
  if (value === 'REJECTED') return 'rejected';
  if (value === 'EXPIRED') return 'expired';
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
