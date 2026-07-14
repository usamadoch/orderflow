import 'server-only';

import type { BinanceServerTimeStatus, TradingHealthStatus } from '../../types/trading';
import type { BinanceTradingConfig } from './config';

async function checkBinanceServerTime(config: BinanceTradingConfig): Promise<BinanceServerTimeStatus> {
  if (!config.serverTimeUrl) {
    return {
      checked: false,
      ok: true,
    };
  }

  const startedAt = Date.now();

  try {
    const response = await fetch(config.serverTimeUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        checked: true,
        ok: false,
        latencyMs: Date.now() - startedAt,
        errorMessage: `Binance server time check failed with HTTP ${response.status}.`,
      };
    }

    const body = (await response.json()) as { serverTime?: unknown };

    return {
      checked: true,
      ok: typeof body.serverTime === 'number',
      serverTime: typeof body.serverTime === 'number' ? body.serverTime : undefined,
      latencyMs: Date.now() - startedAt,
      errorMessage: typeof body.serverTime === 'number' ? undefined : 'Binance server time response was missing serverTime.',
    };
  } catch (error) {
    return {
      checked: true,
      ok: false,
      latencyMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : 'Binance server time check failed.',
    };
  }
}

export async function getTradingHealthStatus(config: BinanceTradingConfig): Promise<TradingHealthStatus> {
  const serverTime = await checkBinanceServerTime(config);
  const connectionStatus = serverTime.ok ? 'connected' : 'degraded';

  return {
    mode: config.mode,
    modeBadge: config.modeBadge,
    connectionStatus,
    apiKeyConfigured: config.apiKeyConfigured,
    apiSecretConfigured: config.apiSecretConfigured,
    liveTradingEnabled: config.liveTradingEnabled,
    serverTime,
    checkedAt: new Date().toISOString(),
    errorMessage: serverTime.errorMessage,
  };
}
