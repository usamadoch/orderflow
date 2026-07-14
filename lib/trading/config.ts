import 'server-only';

import type { TradingHealthStatus, TradingMode, TradingModeBadge } from '../../types/trading';

export const DEFAULT_TRADING_MODE: TradingMode = 'binance_testnet';

const BINANCE_TESTNET_REST_URL = 'https://testnet.binance.vision/api/v3';
const BINANCE_LIVE_REST_URL = 'https://api.binance.com/api/v3';
const BINANCE_TESTNET_WS_URL = 'wss://stream.testnet.binance.vision/ws';
const BINANCE_LIVE_WS_URL = 'wss://stream.binance.com:9443/ws';

export interface SafeTradingConfigStatus {
  mode: TradingMode;
  modeBadge: TradingModeBadge;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  liveTradingEnabled: boolean;
}

export interface BinanceTradingConfig extends SafeTradingConfigStatus {
  apiKey: string | null;
  apiSecret: string | null;
  restBaseUrl: string | null;
  serverTimeUrl: string | null;
  userStreamWsBaseUrl: string | null;
}

export class TradingConfigError extends Error {
  code: string;
  statusCode: number;
  safeStatus: SafeTradingConfigStatus;

  constructor(message: string, code: string, safeStatus: SafeTradingConfigStatus, statusCode = 400) {
    super(message);
    this.name = 'TradingConfigError';
    this.code = code;
    this.statusCode = statusCode;
    this.safeStatus = safeStatus;
  }
}

function parseTradingMode(value: string | undefined): TradingMode {
  if (!value) return DEFAULT_TRADING_MODE;

  if (value === 'binance_testnet' || value === 'binance_live' || value === 'local_paper') {
    return value;
  }

  return DEFAULT_TRADING_MODE;
}

function parseEnabled(value: string | undefined) {
  return value?.toLowerCase() === 'true';
}

export function getTradingModeBadge(mode: TradingMode): TradingModeBadge {
  if (mode === 'binance_live') return 'live';
  if (mode === 'local_paper') return 'paper';
  return 'testnet';
}

function getApiCredentials(mode: TradingMode) {
  if (mode === 'binance_live') {
    return {
      apiKey: process.env.BINANCE_LIVE_API_KEY ?? null,
      apiSecret: process.env.BINANCE_LIVE_API_SECRET ?? null,
    };
  }

  if (mode === 'binance_testnet') {
    return {
      apiKey: process.env.BINANCE_TESTNET_API_KEY ?? null,
      apiSecret: process.env.BINANCE_TESTNET_API_SECRET ?? null,
    };
  }

  return {
    apiKey: null,
    apiSecret: null,
  };
}

function createSafeStatus(
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
  };
}

export function getBinanceTradingConfig(): BinanceTradingConfig {
  const mode = parseTradingMode(process.env.BINANCE_TRADING_MODE);
  const liveTradingEnabled = parseEnabled(process.env.BINANCE_ENABLE_LIVE_TRADING);
  const { apiKey, apiSecret } = getApiCredentials(mode);
  const safeStatus = createSafeStatus(mode, apiKey, apiSecret, liveTradingEnabled);

  if (mode === 'binance_live' && !liveTradingEnabled) {
    throw new TradingConfigError(
      'Binance live trading mode is blocked because BINANCE_ENABLE_LIVE_TRADING is not true.',
      'live_trading_disabled',
      safeStatus,
    );
  }

  if (mode === 'local_paper') {
    return {
      ...safeStatus,
      apiKey,
      apiSecret,
      restBaseUrl: null,
      serverTimeUrl: null,
      userStreamWsBaseUrl: null,
    };
  }

  const restBaseUrl = mode === 'binance_live' ? BINANCE_LIVE_REST_URL : BINANCE_TESTNET_REST_URL;
  const userStreamWsBaseUrl = mode === 'binance_live' ? BINANCE_LIVE_WS_URL : BINANCE_TESTNET_WS_URL;

  return {
    ...safeStatus,
    apiKey,
    apiSecret,
    restBaseUrl,
    serverTimeUrl: `${restBaseUrl}/time`,
    userStreamWsBaseUrl,
  };
}

export function getSafeTradingConfigStatus(): SafeTradingConfigStatus {
  const mode = parseTradingMode(process.env.BINANCE_TRADING_MODE);
  const liveTradingEnabled = parseEnabled(process.env.BINANCE_ENABLE_LIVE_TRADING);
  const { apiKey, apiSecret } = getApiCredentials(mode);
  return createSafeStatus(mode, apiKey, apiSecret, liveTradingEnabled);
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
  };
}
