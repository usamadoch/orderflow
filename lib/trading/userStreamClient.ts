import 'server-only'

import type {
  Balance,
  Order,
  OrderSide,
  OrderStatus,
  OrderTimeInForce,
  OrderType,
  TradeFill,
} from '../../types/trading'
import type { BinanceTradingConfig } from './config'
import { BinanceRestClientError } from './binanceRestClient'

export interface ListenKeyResponse {
  listenKey?: unknown
}

export interface BinanceExecutionReport {
  e?: unknown
  E?: unknown
  s?: unknown
  c?: unknown
  S?: unknown
  o?: unknown
  f?: unknown
  q?: unknown
  p?: unknown
  P?: unknown
  x?: unknown
  X?: unknown
  i?: unknown
  l?: unknown
  z?: unknown
  L?: unknown
  n?: unknown
  N?: unknown
  T?: unknown
  t?: unknown
  O?: unknown
  Z?: unknown
}

export type UnknownRecord = Record<string, unknown>

export async function createListenKey(config: BinanceTradingConfig): Promise<string> {
  const path = config.isFutures ? '/fapi/v1/listenKey' : '/api/v3/userDataStream'
  const response = await apiKeyRequest<ListenKeyResponse>(config, 'POST', path)
  const listenKey = typeof response?.listenKey === 'string' ? response.listenKey : null
  if (!listenKey) {
    throw new BinanceRestClientError('Binance user data stream did not return a listenKey.', 'listen_key_missing', 502)
  }
  return listenKey
}

export async function keepaliveListenKey(config: BinanceTradingConfig, listenKey: string): Promise<void> {
  const path = config.isFutures ? '/fapi/v1/listenKey' : '/api/v3/userDataStream'
  await apiKeyRequest<unknown>(config, 'PUT', path, { listenKey })
}

export async function apiKeyRequest<T>(
  config: BinanceTradingConfig,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  if (!config.restBaseUrl || !config.apiKey) {
    throw new BinanceRestClientError('Binance user stream REST endpoint is not configured.', 'endpoint_not_configured', 400)
  }

  const searchParams = new URLSearchParams(params)
  const query = searchParams.toString()
  const response = await fetch(`${config.restBaseUrl}${path}${query ? `?${query}` : ''}`, {
    method,
    cache: 'no-store',
    headers: {
      'X-MBX-APIKEY': config.apiKey,
    },
  })

  if (response.ok) {
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  }

  throw await createBinanceUserStreamError(response)
}

export async function createBinanceUserStreamError(response: Response) {
  let message = `Binance user data stream request failed with HTTP ${response.status}.`
  let binanceCode: number | undefined

  try {
    const body = (await response.json()) as { code?: unknown; msg?: unknown }
    if (typeof body.msg === 'string') {
      message = `Binance user data stream request failed: ${body.msg}`
    }
    if (typeof body.code === 'number') {
      binanceCode = body.code
    }
  } catch {
    // Keep generic HTTP message
  }

  return new BinanceRestClientError(message, 'binance_user_stream_request_failed', response.status, binanceCode)
}

export function parseEvent(data: unknown): UnknownRecord | null {
  if (typeof data !== 'string') return null
  try {
    const parsed = JSON.parse(data) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as UnknownRecord) : null
  } catch {
    return null
  }
}

export function normalizeStreamBalance(balance: UnknownRecord, eventTime: number): Balance | null {
  const asset = asString(balance.a)
  const free = asNumber(balance.f)
  const locked = asNumber(balance.l)
  if (!asset || free === undefined || locked === undefined) return null

  return {
    asset,
    free,
    locked,
    total: free + locked,
    updatedAt: eventTime,
  }
}

export function normalizeExecutionReportOrder(event: BinanceExecutionReport, eventTime: number): Order | null {
  const id = asString(event.i)
  const symbol = asString(event.s)
  const side = normalizeSide(event.S)
  const type = normalizeOrderType(event.o)
  const status = normalizeOrderStatus(event.X)
  const quantity = asNumber(event.q)
  const filledQuantity = asNumber(event.z)
  const createdAt = asNumber(event.O) ?? eventTime

  if (!id || !symbol || !side || !type || !status || quantity === undefined || filledQuantity === undefined) {
    return null
  }

  const quoteQuantity = asNumber(event.Z)
  const averagePrice = filledQuantity > 0 && quoteQuantity !== undefined ? quoteQuantity / filledQuantity : undefined

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
  }
}

export function normalizeExecutionReportFill(event: BinanceExecutionReport, eventTime: number): TradeFill | null {
  if (event.x !== 'TRADE') return null

  const tradeId = asString(event.t)
  const orderId = asString(event.i)
  const symbol = asString(event.s)
  const side = normalizeSide(event.S)
  const price = asNumber(event.L)
  const quantity = asNumber(event.l)
  const time = asNumber(event.T) ?? eventTime

  if (!tradeId || !orderId || !symbol || !side || price === undefined || quantity === undefined || quantity <= 0) {
    return null
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

export function getFillKey(fill: TradeFill) {
  return `${fill.symbol}:${fill.orderId}:${fill.id}:${fill.time}`
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

export function safeErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}
