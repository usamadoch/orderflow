import { NextRequest, NextResponse } from 'next/server';
import { BinanceRestClientError } from '../../../../lib/trading/binanceRestClient';
import { getBinanceTradingConfig, createBlockedTradingHealth, TradingConfigError } from '../../../../lib/trading/config';
import { getBinanceUserDataStreamManager } from '../../../../lib/trading/userDataStreamManager';
import type { AccountSnapshot, TradingConnectionStatus, TradingMode } from '../../../../types/trading';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const checkedAt = new Date().toISOString();
  let mode: TradingMode = 'binance_testnet';

  try {
    const config = getBinanceTradingConfig();
    mode = config.mode;
    const symbol = normalizeSymbol(request.nextUrl.searchParams.get('symbol'));
    const limit = normalizeLimit(request.nextUrl.searchParams.get('limit'));
    const streamManager = getBinanceUserDataStreamManager(config);
    await streamManager.ensureStarted({ symbol, recentTradesLimit: limit });
    const snapshot = await streamManager.reconcile(symbol, limit);

    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof TradingConfigError) {
      const health = createBlockedTradingHealth(error, checkedAt);
      return NextResponse.json(
        createErrorSnapshot(health.mode, health.connectionStatus, checkedAt, health.errorMessage ?? error.message, error.code),
        {
          status: error.statusCode,
        },
      );
    }

    if (error instanceof BinanceRestClientError) {
      return NextResponse.json(
        createErrorSnapshot(mode, 'degraded', checkedAt, error.message, error.code),
        {
          status: error.statusCode,
        },
      );
    }

    const message = error instanceof Error ? error.message : 'Trading account snapshot sync failed.';
    return NextResponse.json(
      createErrorSnapshot('binance_testnet', 'degraded', checkedAt, message, 'snapshot_sync_failed'),
      {
        status: 500,
      },
    );
  }
}

function normalizeSymbol(value: string | null) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,24}$/.test(normalized)) return undefined;
  return normalized;
}

function normalizeLimit(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(1000, Math.max(1, Math.trunc(parsed)));
}

function createErrorSnapshot(
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
  };
}
