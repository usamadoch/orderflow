import 'server-only'

import type { TradingMode, TradingModeBadge } from '../../types/trading'

export const DEFAULT_TRADING_MODE: TradingMode = 'binance_testnet'

export const BINANCE_TESTNET_REST_URL = 'https://testnet.binance.vision'
export const BINANCE_LIVE_REST_URL = 'https://api.binance.com'
export const BINANCE_TESTNET_WS_URL = 'wss://stream.testnet.binance.vision/ws'
export const BINANCE_LIVE_WS_URL = 'wss://stream.binance.com:9443/ws'

export const BINANCE_FUTURES_TESTNET_REST_URL = 'https://testnet.binancefuture.com'
export const BINANCE_FUTURES_TESTNET_WS_URL = 'wss://stream.binancefuture.com/ws'

export interface SafeTradingConfigStatus {
  mode: TradingMode
  modeBadge: TradingModeBadge
  apiKeyConfigured: boolean
  apiSecretConfigured: boolean
  liveTradingEnabled: boolean
}

export interface BinanceTradingConfig extends SafeTradingConfigStatus {
  apiKey: string | null
  apiSecret: string | null
  restBaseUrl: string | null
  serverTimeUrl: string | null
  userStreamWsBaseUrl: string | null
  isFutures: boolean
}

export class TradingConfigError extends Error {
  code: string
  statusCode: number
  safeStatus: SafeTradingConfigStatus

  constructor(message: string, code: string, safeStatus: SafeTradingConfigStatus, statusCode = 400) {
    super(message)
    this.name = 'TradingConfigError'
    this.code = code
    this.statusCode = statusCode
    this.safeStatus = safeStatus
  }
}

export function parseTradingMode(value: string | undefined): TradingMode {
  if (!value) return DEFAULT_TRADING_MODE
  if (value === 'binance_testnet' || value === 'binance_futures_testnet' || value === 'binance_live' || value === 'local_paper') {
    return value
  }
  return DEFAULT_TRADING_MODE
}

export function parseEnabled(value: string | undefined): boolean {
  return value?.toLowerCase() === 'true'
}

export function getTradingModeBadge(mode: TradingMode): TradingModeBadge {
  if (mode === 'binance_live') return 'live'
  if (mode === 'local_paper') return 'paper'
  if (mode === 'binance_futures_testnet') return 'futures'
  return 'testnet'
}

export function getApiCredentials(mode: TradingMode) {
  if (mode === 'binance_live') {
    return {
      apiKey: process.env.BINANCE_LIVE_API_KEY ?? null,
      apiSecret: process.env.BINANCE_LIVE_API_SECRET ?? null,
    }
  }
  if (mode === 'binance_futures_testnet') {
    return {
      apiKey: process.env.BINANCE_FUTURES_TESTNET_API_KEY ?? null,
      apiSecret: process.env.BINANCE_FUTURES_TESTNET_API_SECRET ?? null,
    }
  }
  if (mode === 'binance_testnet') {
    return {
      apiKey: process.env.BINANCE_TESTNET_API_KEY ?? null,
      apiSecret: process.env.BINANCE_TESTNET_API_SECRET ?? null,
    }
  }
  return { apiKey: null, apiSecret: null }
}

export function createSafeStatus(
  mode: TradingMode,
  apiKey: string | null,
  apiSecret: string | null,
  liveTradingEnabled: boolean,
): SafeTradingConfigStatus {
  return {
    mode,
    modeBadge: getTradingModeBadge(mode),
    apiKeyConfigured: Boolean(apiKey),
    apiSecretConfigured: Boolean(apiSecret),
    liveTradingEnabled,
  }
}
