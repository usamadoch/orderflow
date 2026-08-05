import 'server-only';

import type { OrderRequest, TradingMode, TradingRiskStatusPayload } from '../../types/trading';
import { getSafeTradingConfigStatus } from './config';

const DEFAULT_MAX_ORDER_NOTIONAL = 1000;
const DEFAULT_MAX_ORDER_QTY = 1;
const DEFAULT_MAX_DAILY_ORDER_COUNT = 20;
const DEFAULT_MAX_DAILY_LOSS = 0;

interface RiskConfig {
  maxOrderNotional: number;
  maxOrderQty: number;
  maxDailyOrderCount: number;
  maxDailyLoss: number;
  requireConfirmation: boolean;
  killSwitch: boolean;
  valid: boolean;
}

interface DailyRiskCounters {
  dayKey: string;
  placedOrderCount: number;
  estimatedNotional: number;
  blockedOrderCount: number;
  failedOrderCount: number;
  lastRiskRejectionReason: string | null;
}

interface RiskDecision {
  allowed: boolean;
  message: string | null;
  reason: string | null;
  status: TradingRiskStatusPayload;
}

const globalRiskState = globalThis as typeof globalThis & {
  __ORDERFLOW_TRADING_RISK_COUNTERS__?: DailyRiskCounters;
};

export function getTradingRiskStatus(checkedAt = new Date().toISOString()): TradingRiskStatusPayload {
  const safeStatus = getSafeTradingConfigStatus();
  const riskConfig = getRiskConfig();
  const counters = getDailyRiskCounters();
  const blockReasons = getRiskBlockReasons(safeStatus.mode, riskConfig, safeStatus.liveTradingEnabled, safeStatus.apiKeyConfigured, safeStatus.apiSecretConfigured);

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
  };
}

export function evaluateOrderRisk(request: OrderRequest): RiskDecision {
  const status = getTradingRiskStatus();
  const reasons = [...status.blockReasons];
  const notional = getEstimatedOrderNotional(request);

  if (status.mode !== 'binance_testnet' && status.mode !== 'binance_futures_testnet') {
    reasons.push(status.mode === 'binance_live' ? 'Live order execution is still locked.' : 'Only Binance testnet order execution is supported.');
  }

  if (status.requireConfirmation && request.confirmed !== true) {
    reasons.push('Order confirmation is required before placement.');
  }

  if (request.contractType !== 'spot' && request.contractType !== 'futures') {
    reasons.push('Unsupported contract type.');
  }

  if (request.quantity > status.maxOrderQty) {
    reasons.push(`Order quantity exceeds max quantity ${status.maxOrderQty}.`);
  }

  if (notional !== null && notional > status.maxOrderNotional) {
    reasons.push(`Order notional exceeds max notional ${status.maxOrderNotional}.`);
  }

  if (status.dailyOrderCountUsed >= status.dailyOrderCountLimit) {
    reasons.push(`Daily order count limit ${status.dailyOrderCountLimit} has been reached.`);
  }

  const message = reasons[0] ?? null;
  if (message) {
    recordRiskRejection(message);
  }

  return {
    allowed: !message,
    message,
    reason: message ? normalizeRiskReason(message) : null,
    status,
  };
}

export function evaluateCancelRisk(mode: TradingMode, contractType: OrderRequest['contractType']): RiskDecision {
  const status = getTradingRiskStatus();
  const reasons = [...status.blockReasons.filter((reason) => !reason.toLowerCase().includes('kill switch'))];

  if (status.mode !== 'binance_testnet' && status.mode !== 'binance_futures_testnet') {
    reasons.push('Only Binance testnet order cancellation is supported.');
  }

  if (contractType !== 'spot' && contractType !== 'futures') {
    reasons.push('Unsupported contract type.');
  }

  const message = reasons[0] ?? null;
  if (message) {
    recordRiskRejection(message);
  }

  return {
    allowed: !message,
    message,
    reason: message ? normalizeRiskReason(message) : null,
    status,
  };
}

export function recordPlacedOrder(request: OrderRequest) {
  const counters = getDailyRiskCounters();
  counters.placedOrderCount += 1;
  counters.estimatedNotional += getEstimatedOrderNotional(request) ?? 0;
}

export function recordRiskFailure(reason: string) {
  const counters = getDailyRiskCounters();
  counters.failedOrderCount += 1;
  counters.lastRiskRejectionReason = reason;
}

function getRiskConfig(): RiskConfig {
  const maxOrderNotional = parsePositiveNumber(process.env.TRADING_MAX_ORDER_NOTIONAL, DEFAULT_MAX_ORDER_NOTIONAL);
  const maxOrderQty = parsePositiveNumber(process.env.TRADING_MAX_ORDER_QTY, DEFAULT_MAX_ORDER_QTY);
  const maxDailyOrderCount = parsePositiveInteger(process.env.TRADING_MAX_DAILY_ORDER_COUNT, DEFAULT_MAX_DAILY_ORDER_COUNT);
  const maxDailyLoss = parseNonNegativeNumber(process.env.TRADING_MAX_DAILY_LOSS, DEFAULT_MAX_DAILY_LOSS);
  const requireConfirmation = parseBoolean(process.env.TRADING_REQUIRE_CONFIRMATION, true);
  const killSwitch = parseBoolean(process.env.TRADING_KILL_SWITCH, false);

  return {
    maxOrderNotional,
    maxOrderQty,
    maxDailyOrderCount,
    maxDailyLoss,
    requireConfirmation,
    killSwitch,
    valid: maxOrderNotional > 0 && maxOrderQty > 0 && maxDailyOrderCount > 0 && maxDailyLoss >= 0,
  };
}

function getRiskBlockReasons(
  mode: TradingMode,
  riskConfig: RiskConfig,
  liveTradingEnabled: boolean,
  apiKeyConfigured: boolean,
  apiSecretConfigured: boolean,
) {
  const reasons: string[] = [];

  if (riskConfig.killSwitch) reasons.push('Trading kill switch is active.');
  if (!riskConfig.valid) reasons.push('Trading risk config is invalid.');

  if (mode === 'binance_live') {
    if (!liveTradingEnabled) reasons.push('Binance live trading mode is blocked because BINANCE_ENABLE_LIVE_TRADING is not true.');
    if (!apiKeyConfigured || !apiSecretConfigured) reasons.push('Required Binance live credentials are not configured.');
  }

  return reasons;
}

function getDailyRiskCounters() {
  const dayKey = new Date().toISOString().slice(0, 10);
  const current = globalRiskState.__ORDERFLOW_TRADING_RISK_COUNTERS__;
  if (current?.dayKey === dayKey) return current;

  const next: DailyRiskCounters = {
    dayKey,
    placedOrderCount: 0,
    estimatedNotional: 0,
    blockedOrderCount: 0,
    failedOrderCount: 0,
    lastRiskRejectionReason: null,
  };
  globalRiskState.__ORDERFLOW_TRADING_RISK_COUNTERS__ = next;
  return next;
}

function recordRiskRejection(reason: string) {
  const counters = getDailyRiskCounters();
  counters.blockedOrderCount += 1;
  counters.lastRiskRejectionReason = reason;
}

function getEstimatedOrderNotional(request: OrderRequest) {
  const price = request.type === 'limit' ? request.price : request.estimatedPrice;
  if (!Number.isFinite(price) || price === undefined || price <= 0) return null;
  return request.quantity * price;
}

function parsePositiveNumber(value: string | undefined, fallback: number) {
  const parsed = value === undefined || value.trim() === '' ? fallback : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveInteger(value: string | undefined, fallback: number) {
  return Math.trunc(parsePositiveNumber(value, fallback));
}

function parseNonNegativeNumber(value: string | undefined, fallback: number) {
  const parsed = value === undefined || value.trim() === '' ? fallback : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === '') return fallback;
  return value.toLowerCase() === 'true';
}

function normalizeRiskReason(message: string) {
  return message.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'risk_rejected';
}
