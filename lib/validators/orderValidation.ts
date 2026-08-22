import { NextRequest } from 'next/server'
import { isAllowedContractType, isAllowedSymbol } from '../config/markets'
import { BinanceRestClientError } from '../trading/binanceRestClient'
import { TradingConfigError } from '../trading/config'
import type {
  OrderCancelRequest,
  OrderContractType,
  OrderRequest,
  OrderResult,
  OrderSide,
  OrderTimeInForce,
  OrderType,
  TradingMode,
} from '../../types/trading'

type UnknownRecord = Record<string, unknown>

export async function readJsonBody(request: NextRequest): Promise<UnknownRecord> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as UnknownRecord) : {}
  } catch {
    return {}
  }
}

export async function readDeletePayload(request: NextRequest): Promise<UnknownRecord> {
  const body = await readJsonBody(request)
  const query: UnknownRecord = {}

  for (const key of ['symbol', 'contractType', 'orderId', 'clientOrderId']) {
    const value = request.nextUrl.searchParams.get(key)
    if (value !== null) query[key] = value
  }

  return {
    ...query,
    ...body,
  }
}

export function validateOrderRequest(
  payload: UnknownRecord,
): { ok: true; request: OrderRequest } | { ok: false; message: string; reason: string } {
  const symbol = normalizeSymbol(payload.symbol)
  if (!symbol) return { ok: false, message: 'A supported symbol is required.', reason: 'invalid_symbol' }

  const contractType = normalizeContractType(payload.contractType)
  if (!contractType) return { ok: false, message: 'Unsupported contract type selected.', reason: 'unsupported_contract_type' }

  const side = normalizeSide(payload.side)
  if (!side) return { ok: false, message: 'Order side must be buy or sell.', reason: 'invalid_order_side' }

  const type = normalizeOrderType(payload.type)
  if (!type) return { ok: false, message: 'Only market, limit, and stop orders are supported.', reason: 'unsupported_order_type' }

  const quantity = normalizePositiveNumber(payload.quantity)
  if (quantity === null) return { ok: false, message: 'Quantity must be greater than 0.', reason: 'invalid_quantity' }

  const price = type === 'limit' ? normalizePositiveNumber(payload.price) : undefined
  if (type === 'limit' && price === null) {
    return { ok: false, message: 'Limit price must be greater than 0.', reason: 'invalid_limit_price' }
  }

  const timeInForce = normalizeTimeInForce(payload.timeInForce)
  if (payload.timeInForce !== undefined && !timeInForce) {
    return { ok: false, message: 'Unsupported time-in-force selected.', reason: 'unsupported_time_in_force' }
  }

  return {
    ok: true,
    request: {
      symbol,
      contractType,
      side,
      type,
      quantity,
      price: price ?? undefined,
      estimatedPrice: normalizePositiveNumber(payload.estimatedPrice) ?? undefined,
      timeInForce,
      clientOrderId: normalizeOptionalId(payload.clientOrderId),
      reduceOnly: payload.reduceOnly === true,
      leverage: normalizePositiveNumber(payload.leverage) ?? undefined,
      confirmed: payload.confirmed === true,
    },
  }
}

export function validateCancelRequest(
  payload: UnknownRecord,
): { ok: true; request: OrderCancelRequest } | { ok: false; message: string; reason: string } {
  const symbol = normalizeSymbol(payload.symbol)
  if (!symbol) return { ok: false, message: 'A supported symbol is required.', reason: 'invalid_symbol' }

  const contractType = normalizeContractType(payload.contractType)
  if (!contractType) return { ok: false, message: 'Unsupported contract type selected.', reason: 'unsupported_contract_type' }

  const orderId = normalizeOptionalId(payload.orderId)
  const clientOrderId = normalizeOptionalId(payload.clientOrderId)
  if (!orderId && !clientOrderId) {
    return {
      ok: false,
      message: 'An orderId or clientOrderId is required to cancel an order.',
      reason: 'missing_cancel_order_id',
    }
  }

  return {
    ok: true,
    request: {
      symbol,
      contractType,
      orderId,
      clientOrderId,
    },
  }
}

export function getExecutionBlock(mode: TradingMode, liveTradingEnabled: boolean) {
  if (mode === 'binance_testnet' || mode === 'binance_futures_testnet') return null
  if (mode === 'binance_live' && !liveTradingEnabled) {
    return {
      message: 'Binance live trading mode is blocked because BINANCE_ENABLE_LIVE_TRADING is not true.',
      reason: 'live_trading_disabled',
    }
  }
  return {
    message: 'Only Binance testnet order execution is supported.',
    reason: 'unsupported_trading_mode',
  }
}

export function assertCredentials(apiKey: string | null, apiSecret: string | null) {
  if (!apiKey || !apiSecret) {
    throw new BinanceRestClientError(
      'Binance API key and secret are required for order execution.',
      'missing_credentials',
      401,
    )
  }
}

export function createOrderErrorResponse(error: unknown, fallback: string) {
  if (error instanceof TradingConfigError) {
    return Response.json(createRejectedResult(error.safeStatus.mode, error.message, error.code), {
      status: error.statusCode,
    })
  }

  if (error instanceof BinanceRestClientError) {
    return Response.json(createRejectedResult('binance_testnet', error.message, error.code), {
      status: error.statusCode,
    })
  }

  const message = error instanceof Error ? error.message : fallback
  return Response.json(createRejectedResult('binance_testnet', message, 'order_request_failed'), {
    status: 500,
  })
}

export function createRejectedResult(mode: TradingMode, errorMessage: string, rejectedReason: string): OrderResult {
  return {
    success: false,
    mode,
    errorMessage,
    rejectedReason,
  }
}

function normalizeSymbol(value: unknown) {
  if (typeof value !== 'string') return null
  const symbol = value.trim().toUpperCase()
  return isAllowedSymbol(symbol) ? symbol : null
}

function normalizeContractType(value: unknown): OrderContractType | null {
  if (value === undefined || value === null || value === '') return 'spot'
  if (typeof value !== 'string') return null
  const contractType = value.trim().toLowerCase()
  return isAllowedContractType(contractType) ? contractType : null
}

function normalizeSide(value: unknown): OrderSide | null {
  if (value === 'buy' || value === 'sell') return value
  return null
}

function normalizeOrderType(value: unknown): OrderType | null {
  if (value === 'market') return 'market'
  if (value === 'limit') return 'limit'
  if (value === 'stop_market') return 'stop_market'
  if (value === 'stop_limit') return 'stop_limit'
  return null
}

function normalizeTimeInForce(value: unknown): OrderTimeInForce | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (value === 'GTC' || value === 'IOC' || value === 'FOK') return value
  return undefined
}

function normalizePositiveNumber(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function normalizeOptionalId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value))
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return normalized.length > 0 && normalized.length <= 64 ? normalized : undefined
}
