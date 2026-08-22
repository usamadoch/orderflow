import 'server-only'
import type { OrderRequest } from '../../types/trading'

const DEFAULT_MAX_ORDER_NOTIONAL = 1000
const DEFAULT_MAX_ORDER_QTY = 1
const DEFAULT_MAX_DAILY_ORDER_COUNT = 20
const DEFAULT_MAX_DAILY_LOSS = 0

export interface RiskConfig {
  maxOrderNotional: number
  maxOrderQty: number
  maxDailyOrderCount: number
  maxDailyLoss: number
  requireConfirmation: boolean
  killSwitch: boolean
  valid: boolean
}

export interface DailyRiskCounters {
  dayKey: string
  placedOrderCount: number
  estimatedNotional: number
  blockedOrderCount: number
  failedOrderCount: number
  lastRiskRejectionReason: string | null
}

const globalRiskState = globalThis as typeof globalThis & {
  __ORDERFLOW_TRADING_RISK_COUNTERS__?: DailyRiskCounters
}

export function getRiskConfig(): RiskConfig {
  const maxOrderNotional = parsePositiveNumber(process.env.TRADING_MAX_ORDER_NOTIONAL, DEFAULT_MAX_ORDER_NOTIONAL)
  const maxOrderQty = parsePositiveNumber(process.env.TRADING_MAX_ORDER_QTY, DEFAULT_MAX_ORDER_QTY)
  const maxDailyOrderCount = parsePositiveInteger(process.env.TRADING_MAX_DAILY_ORDER_COUNT, DEFAULT_MAX_DAILY_ORDER_COUNT)
  const maxDailyLoss = parseNonNegativeNumber(process.env.TRADING_MAX_DAILY_LOSS, DEFAULT_MAX_DAILY_LOSS)
  const requireConfirmation = parseBoolean(process.env.TRADING_REQUIRE_CONFIRMATION, true)
  const killSwitch = parseBoolean(process.env.TRADING_KILL_SWITCH, false)

  return {
    maxOrderNotional,
    maxOrderQty,
    maxDailyOrderCount,
    maxDailyLoss,
    requireConfirmation,
    killSwitch,
    valid: maxOrderNotional > 0 && maxOrderQty > 0 && maxDailyOrderCount > 0 && maxDailyLoss >= 0,
  }
}

export function getDailyRiskCounters(): DailyRiskCounters {
  const dayKey = new Date().toISOString().slice(0, 10)
  const current = globalRiskState.__ORDERFLOW_TRADING_RISK_COUNTERS__
  if (current?.dayKey === dayKey) return current

  const next: DailyRiskCounters = {
    dayKey,
    placedOrderCount: 0,
    estimatedNotional: 0,
    blockedOrderCount: 0,
    failedOrderCount: 0,
    lastRiskRejectionReason: null,
  }
  globalRiskState.__ORDERFLOW_TRADING_RISK_COUNTERS__ = next
  return next
}

export function recordRiskRejection(reason: string) {
  const counters = getDailyRiskCounters()
  counters.blockedOrderCount += 1
  counters.lastRiskRejectionReason = reason
}

export function getEstimatedOrderNotional(request: OrderRequest): number | null {
  const price = request.type === 'limit' ? request.price : request.estimatedPrice
  if (!Number.isFinite(price) || price === undefined || price <= 0) return null
  return request.quantity * price
}

export function normalizeRiskReason(message: string): string {
  return message.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'risk_rejected'
}

function parsePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = value === undefined || value.trim() === '' ? fallback : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  return Math.trunc(parsePositiveNumber(value, fallback))
}

function parseNonNegativeNumber(value: string | undefined, fallback: number) {
  const parsed = value === undefined || value.trim() === '' ? fallback : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === '') return fallback
  return value.toLowerCase() === 'true'
}
