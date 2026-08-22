import type { AccountSnapshot, TradingConnectionStatus, TradingMode, TradingUserStreamStatusPayload } from '../../types/trading'

export function normalizeSymbol(value: string | null): string | undefined {
  if (!value) return undefined
  const normalized = value.trim().toUpperCase()
  if (!/^[A-Z0-9]{3,24}$/.test(normalized)) return undefined
  return normalized
}

export function normalizeLimit(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return Math.min(1000, Math.max(1, Math.trunc(parsed)))
}

export function createErrorSnapshot(
  mode: TradingMode,
  connectionStatus: TradingConnectionStatus,
  checkedAt: string,
  errorMessage: string,
  code: string,
): AccountSnapshot & { errorMessage: string; code: string } {
  return {
    mode,
    connectionStatus,
    checkedAt,
    balances: [],
    positions: [],
    openOrders: [],
    recentTrades: [],
    errorMessage,
    code,
  }
}

export function createErrorStatus(
  mode: TradingMode,
  streamStatus: TradingUserStreamStatusPayload['streamStatus'],
  message: string,
  checkedAt: string,
): TradingUserStreamStatusPayload {
  return {
    mode,
    streamStatus,
    connected: false,
    reconnecting: false,
    lastEventAt: null,
    reconnectCount: 0,
    lastErrorMessage: message,
    listenKeyActive: false,
    listenKeyLastKeepaliveAt: null,
    listenKeyExpiresAt: null,
    reconciliationLoading: false,
    lastReconciledAt: null,
    checkedAt,
  }
}
