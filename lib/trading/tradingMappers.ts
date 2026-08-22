import 'server-only'

import type {
  Balance,
  Order,
  OrderRequest,
  OrderResult,
  OrderSide,
  OrderStatus,
  OrderTimeInForce,
  OrderType,
  Position,
  TradeFill,
  TradingMode,
} from '../../types/trading'

export interface BinanceBalance {
  asset?: unknown
  free?: unknown
  locked?: unknown
}

export interface BinanceAccountResponse {
  balances?: unknown
  updateTime?: unknown
}

export interface FuturesBalance {
  asset?: unknown
  availableBalance?: unknown
  walletBalance?: unknown
  unrealizedProfit?: unknown
  updateTime?: unknown
}

export interface FuturesAccountResponse {
  assets?: unknown
  updateTime?: unknown
}

export interface FuturesPositionRisk {
  symbol?: unknown
  positionSide?: unknown
  positionAmt?: unknown
  entryPrice?: unknown
  markPrice?: unknown
  unrealizedProfit?: unknown
  liquidationPrice?: unknown
  leverage?: unknown
  marginType?: unknown
  notional?: unknown
  updateTime?: unknown
}

export interface BinanceOrderResponse {
  symbol?: unknown
  orderId?: unknown
  clientOrderId?: unknown
  price?: unknown
  origQty?: unknown
  executedQty?: unknown
  cummulativeQuoteQty?: unknown
  cumQuote?: unknown
  status?: unknown
  timeInForce?: unknown
  type?: unknown
  side?: unknown
  stopPrice?: unknown
  time?: unknown
  transactTime?: unknown
  updateTime?: unknown
}

export interface BinanceTradeResponse {
  id?: unknown
  orderId?: unknown
  symbol?: unknown
  price?: unknown
  qty?: unknown
  commission?: unknown
  commissionAsset?: unknown
  time?: unknown
  isBuyer?: unknown
  buyer?: unknown
  side?: unknown
}

export function getUnsupportedExecutionReason(mode: TradingMode, contractType: OrderRequest['contractType']) {
  if (mode !== 'binance_testnet' && mode !== 'binance_futures_testnet') {
    return {
      message: mode === 'binance_live' ? 'Live order execution is locked.' : 'Only Binance testnet order execution is supported.',
      reason: 'live_trading_locked',
    }
  }
  if (contractType !== 'spot' && contractType !== 'futures') {
    return {
      message: 'Unsupported contract type.',
      reason: 'unsupported_contract_type',
    }
  }
  return null
}

export function createRejectedOrderResult(mode: TradingMode, message: string, reason: string): OrderResult {
  return {
    success: false,
    mode,
    errorMessage: message,
    rejectedReason: reason,
  }
}

export function normalizeBalance(balance: BinanceBalance, updatedAt?: number): Balance | null {
  const asset = asString(balance.asset)
  const free = asNumber(balance.free)
  const locked = asNumber(balance.locked)
  if (!asset || free === undefined || locked === undefined) return null

  return {
    asset,
    free,
    locked,
    total: free + locked,
    updatedAt: updatedAt ?? Date.now(),
  }
}

export function normalizeFuturesBalance(raw: FuturesBalance, updatedAt?: number): Balance | null {
  const asset = asString(raw.asset)
  const free = asNumber(raw.availableBalance) ?? asNumber(raw.walletBalance) ?? 0
  const unrealized = asNumber(raw.unrealizedProfit) ?? 0
  if (!asset) return null

  return {
    asset,
    free,
    locked: unrealized,
    total: free + unrealized,
    updatedAt: updatedAt ?? Date.now(),
  }
}

export function normalizePosition(raw: FuturesPositionRisk): Position | null {
  const symbol = asString(raw.symbol)
  if (!symbol) return null

  const positionAmt = asNumber(raw.positionAmt) ?? 0
  const absQty = Math.abs(positionAmt)

  if (absQty < 1e-9) {
    return { symbol, side: 'flat', quantity: 0 }
  }

  const rawSide = asString(raw.positionSide)
  let side: Position['side'] = positionAmt > 0 ? 'long' : 'short'
  if (rawSide === 'LONG') side = 'long'
  if (rawSide === 'SHORT') side = 'short'

  return {
    symbol,
    side,
    quantity: absQty,
    entryPrice: asOptionalPositiveNumber(raw.entryPrice),
    markPrice: asOptionalPositiveNumber(raw.markPrice),
    unrealizedPnl: asNumber(raw.unrealizedProfit),
    liquidationPrice: asOptionalPositiveNumber(raw.liquidationPrice),
    leverage: asOptionalPositiveNumber(raw.leverage),
    marginType: asString(raw.marginType)?.toLowerCase() as Position['marginType'],
    notional: asOptionalPositiveNumber(raw.notional),
    updatedAt: asNumber(raw.updateTime),
  }
}

export function normalizeOrder(order: BinanceOrderResponse): Order | null {
  const id = asString(order.orderId)
  const symbol = asString(order.symbol)
  const side = normalizeSide(order.side)
  const type = normalizeOrderType(order.type)
  const status = normalizeOrderStatus(order.status)
  const quantity = asNumber(order.origQty)
  const filledQuantity = asNumber(order.executedQty)

  if (!id || !symbol || !side || !type || !status || quantity === undefined || filledQuantity === undefined) {
    return null
  }

  const quoteQuantity = asNumber(order.cummulativeQuoteQty) ?? asNumber(order.cumQuote)
  const averagePrice = filledQuantity > 0 && quoteQuantity !== undefined ? quoteQuantity / filledQuantity : undefined
  const createdAt = asNumber(order.time) ?? asNumber(order.transactTime) ?? Date.now()
  const updatedAt = asNumber(order.updateTime) ?? createdAt

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
    updatedAt,
  }
}

export function normalizeTradeFill(trade: BinanceTradeResponse): TradeFill | null {
  const id = asString(trade.id)
  const orderId = asString(trade.orderId)
  const symbol = asString(trade.symbol)
  const price = asNumber(trade.price)
  const quantity = asNumber(trade.qty)
  const time = asNumber(trade.time)

  if (!id || !orderId || !symbol || price === undefined || quantity === undefined || time === undefined) {
    return null
  }

  const isBuyer = typeof trade.isBuyer === 'boolean' ? trade.isBuyer : typeof trade.buyer === 'boolean' ? trade.buyer : undefined
  const rawSide = normalizeSide(trade.side)
  const side: OrderSide = rawSide ?? (isBuyer === true ? 'buy' : 'sell')

  return {
    id: `${symbol}:${id}`,
    orderId,
    symbol,
    side,
    price,
    quantity,
    fee: asNumber(trade.commission),
    feeAsset: asString(trade.commissionAsset),
    time,
  }
}

export function normalizeSide(value: unknown): OrderSide | null {
  if (value === 'BUY') return 'buy'
  if (value === 'SELL') return 'sell'
  return null
}

export function normalizeOrderType(value: unknown): OrderType | null {
  if (value === 'MARKET') return 'market'
  if (value === 'LIMIT') return 'limit'
  if (value === 'STOP_LOSS' || value === 'TAKE_PROFIT' || value === 'STOP_MARKET') return 'stop_market'
  if (value === 'STOP_LOSS_LIMIT' || value === 'TAKE_PROFIT_LIMIT') return 'stop_limit'
  return null
}

export function normalizeOrderStatus(value: unknown): OrderStatus | null {
  if (value === 'NEW') return 'open'
  if (value === 'PARTIALLY_FILLED') return 'partially_filled'
  if (value === 'FILLED') return 'filled'
  if (value === 'CANCELED') return 'cancelled'
  if (value === 'REJECTED') return 'rejected'
  if (value === 'EXPIRED') return 'expired'
  return null
}

export function normalizeTimeInForce(value: unknown): OrderTimeInForce | undefined {
  if (value === 'GTC' || value === 'IOC' || value === 'FOK') return value
  return undefined
}

export function asString(value: unknown) {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

export function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function asOptionalPositiveNumber(value: unknown) {
  const parsed = asNumber(value)
  return parsed !== undefined && parsed > 0 ? parsed : undefined
}
