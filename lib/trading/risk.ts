import 'server-only'

import type { OrderRequest, TradingMode, TradingRiskStatusPayload } from '../../types/trading'
import { getSafeTradingConfigStatus } from './config'
import {
  getDailyRiskCounters,
  getEstimatedOrderNotional,
  getRiskConfig,
  normalizeRiskReason,
  recordRiskRejection,
  type RiskConfig,
} from './riskState'

interface RiskDecision {
  allowed: boolean
  message: string | null
  reason: string | null
  status: TradingRiskStatusPayload
}

export function getTradingRiskStatus(checkedAt = new Date().toISOString()): TradingRiskStatusPayload {
  const safeStatus = getSafeTradingConfigStatus()
  const riskConfig = getRiskConfig()
  const counters = getDailyRiskCounters()
  const blockReasons = getRiskBlockReasons(safeStatus.mode, riskConfig, safeStatus.liveTradingEnabled, safeStatus.apiKeyConfigured, safeStatus.apiSecretConfigured)

  return {
    mode: safeStatus.mode,
    modeBadge: safeStatus.modeBadge,
    liveTradingEnabled: safeStatus.liveTradingEnabled,
    liveBlocked: safeStatus.mode === 'binance_live' && blockReasons.length > 0,
    killSwitchActive: riskConfig.killSwitch,
    requireConfirmation: riskConfig.requireConfirmation,
    riskConfigValid: riskConfig.valid,
    maxOrderNotional: riskConfig.maxOrderNotional,
    maxOrderQty: riskConfig.maxOrderQty,
    dailyOrderCountUsed: counters.placedOrderCount,
    dailyOrderCountLimit: riskConfig.maxDailyOrderCount,
    dailyEstimatedNotionalUsed: counters.estimatedNotional,
    dailyLossUsed: null,
    dailyLossLimit: riskConfig.maxDailyLoss,
    blockReasons,
    lastRiskRejectionReason: counters.lastRiskRejectionReason,
    counterStorage: 'memory',
    checkedAt,
  }
}

export function evaluateOrderRisk(request: OrderRequest): RiskDecision {
  const status = getTradingRiskStatus()
  const reasons = [...status.blockReasons]
  const notional = getEstimatedOrderNotional(request)

  if (status.mode !== 'binance_testnet' && status.mode !== 'binance_futures_testnet') {
    reasons.push(status.mode === 'binance_live' ? 'Live order execution is still locked.' : 'Only Binance testnet order execution is supported.')
  }

  if (status.requireConfirmation && request.confirmed !== true) {
    reasons.push('Order confirmation is required before placement.')
  }

  if (request.contractType !== 'spot' && request.contractType !== 'futures') {
    reasons.push('Unsupported contract type.')
  }

  if (request.quantity > status.maxOrderQty) {
    reasons.push(`Order quantity exceeds max quantity ${status.maxOrderQty}.`)
  }

  if (notional !== null && notional > status.maxOrderNotional) {
    reasons.push(`Order notional exceeds max notional ${status.maxOrderNotional}.`)
  }

  if (status.dailyOrderCountUsed >= status.dailyOrderCountLimit) {
    reasons.push(`Daily order count limit ${status.dailyOrderCountLimit} has been reached.`)
  }

  const message = reasons[0] ?? null
  if (message) {
    recordRiskRejection(message)
  }

  return {
    allowed: !message,
    message,
    reason: message ? normalizeRiskReason(message) : null,
    status,
  }
}

export function evaluateCancelRisk(mode: TradingMode, contractType: OrderRequest['contractType']): RiskDecision {
  const status = getTradingRiskStatus()
  const reasons = [...status.blockReasons.filter((reason) => !reason.toLowerCase().includes('kill switch'))]

  if (status.mode !== 'binance_testnet' && status.mode !== 'binance_futures_testnet') {
    reasons.push('Only Binance testnet order cancellation is supported.')
  }

  if (contractType !== 'spot' && contractType !== 'futures') {
    reasons.push('Unsupported contract type.')
  }

  const message = reasons[0] ?? null
  if (message) {
    recordRiskRejection(message)
  }

  return {
    allowed: !message,
    message,
    reason: message ? normalizeRiskReason(message) : null,
    status,
  }
}

export function recordPlacedOrder(request: OrderRequest) {
  const counters = getDailyRiskCounters()
  counters.placedOrderCount += 1
  counters.estimatedNotional += getEstimatedOrderNotional(request) ?? 0
}

export function recordRiskFailure(reason: string) {
  const counters = getDailyRiskCounters()
  counters.failedOrderCount += 1
  counters.lastRiskRejectionReason = reason
}

function getRiskBlockReasons(
  mode: TradingMode,
  riskConfig: RiskConfig,
  liveTradingEnabled: boolean,
  apiKeyConfigured: boolean,
  apiSecretConfigured: boolean,
) {
  const reasons: string[] = []

  if (riskConfig.killSwitch) reasons.push('Trading kill switch is active.')
  if (!riskConfig.valid) reasons.push('Trading risk config is invalid.')

  if (mode === 'binance_live') {
    if (!liveTradingEnabled) reasons.push('Binance live trading mode is blocked because BINANCE_ENABLE_LIVE_TRADING is not true.')
    if (!apiKeyConfigured || !apiSecretConfigured) reasons.push('Required Binance live credentials are not configured.')
  }

  return reasons
}
