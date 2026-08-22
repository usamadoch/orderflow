import 'server-only'

import type { TradingHealthStatus } from '../../types/trading'
import {
  BINANCE_FUTURES_TESTNET_REST_URL,
  BINANCE_FUTURES_TESTNET_WS_URL,
  BINANCE_LIVE_REST_URL,
  BINANCE_LIVE_WS_URL,
  BINANCE_TESTNET_REST_URL,
  BINANCE_TESTNET_WS_URL,
  createSafeStatus,
  DEFAULT_TRADING_MODE,
  getApiCredentials,
  getTradingModeBadge,
  parseEnabled,
  parseTradingMode,
  TradingConfigError,
  type BinanceTradingConfig,
  type SafeTradingConfigStatus,
} from './tradingConfigParser'

export { DEFAULT_TRADING_MODE, getTradingModeBadge, TradingConfigError, type BinanceTradingConfig, type SafeTradingConfigStatus }

export function isTradingDisabled(): boolean {
  return process.env.NEXT_PUBLIC_DISABLE_TRADING === 'true'
}

export function getBinanceTradingConfig(): BinanceTradingConfig {
  const mode = parseTradingMode(process.env.BINANCE_TRADING_MODE)
  const liveTradingEnabled = parseEnabled(process.env.BINANCE_ENABLE_LIVE_TRADING)
  const { apiKey, apiSecret } = getApiCredentials(mode)
  const safeStatus = createSafeStatus(mode, apiKey, apiSecret, liveTradingEnabled)

  if (mode === 'binance_live' && !liveTradingEnabled) {
    throw new TradingConfigError(
      'Binance live trading mode is blocked because BINANCE_ENABLE_LIVE_TRADING is not true.',
      'live_trading_disabled',
      safeStatus,
    )
  }

  if (mode === 'local_paper') {
    return {
      ...safeStatus,
      apiKey,
      apiSecret,
      restBaseUrl: null,
      serverTimeUrl: null,
      userStreamWsBaseUrl: null,
      isFutures: false,
    }
  }

  if (mode === 'binance_futures_testnet') {
    return {
      ...safeStatus,
      apiKey,
      apiSecret,
      restBaseUrl: BINANCE_FUTURES_TESTNET_REST_URL,
      serverTimeUrl: `${BINANCE_FUTURES_TESTNET_REST_URL}/fapi/v1/time`,
      userStreamWsBaseUrl: BINANCE_FUTURES_TESTNET_WS_URL,
      isFutures: true,
    }
  }

  const restBaseUrl = mode === 'binance_live' ? BINANCE_LIVE_REST_URL : BINANCE_TESTNET_REST_URL
  const userStreamWsBaseUrl = mode === 'binance_live' ? BINANCE_LIVE_WS_URL : BINANCE_TESTNET_WS_URL

  return {
    ...safeStatus,
    apiKey,
    apiSecret,
    restBaseUrl,
    serverTimeUrl: `${restBaseUrl}/api/v3/time`,
    userStreamWsBaseUrl,
    isFutures: false,
  }
}

export function getSafeTradingConfigStatus(): SafeTradingConfigStatus {
  const mode = parseTradingMode(process.env.BINANCE_TRADING_MODE)
  const liveTradingEnabled = parseEnabled(process.env.BINANCE_ENABLE_LIVE_TRADING)
  const { apiKey, apiSecret } = getApiCredentials(mode)
  return createSafeStatus(mode, apiKey, apiSecret, liveTradingEnabled)
}

export function createBlockedTradingHealth(
  error: TradingConfigError,
  checkedAt = new Date().toISOString(),
): TradingHealthStatus {
  return {
    ...error.safeStatus,
    connectionStatus: 'blocked',
    serverTime: {
      checked: false,
      ok: false,
      errorMessage: error.message,
    },
    checkedAt,
    errorMessage: error.message,
  }
}
