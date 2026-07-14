import { NextRequest, NextResponse } from 'next/server';
import { getBinanceTradingConfig, TradingConfigError } from '../../../../lib/trading/config';
import { getBinanceUserDataStreamManager } from '../../../../lib/trading/userDataStreamManager';
import type { TradingMode, TradingUserStreamStatusPayload } from '../../../../types/trading';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const checkedAt = new Date().toISOString();

  try {
    const config = getBinanceTradingConfig();
    const streamManager = getBinanceUserDataStreamManager(config);
    const symbol = normalizeSymbol(request.nextUrl.searchParams.get('symbol'));
    const limit = normalizeLimit(request.nextUrl.searchParams.get('limit'));

    await streamManager.ensureStarted({ symbol, recentTradesLimit: limit });

    return NextResponse.json(streamManager.getStatus());
  } catch (error) {
    if (error instanceof TradingConfigError) {
      return NextResponse.json(
        createErrorStatus(error.safeStatus.mode, 'blocked', error.message, checkedAt),
        {
          status: error.statusCode,
        },
      );
    }

    return NextResponse.json(
      createErrorStatus(
        'binance_testnet',
        'error',
        error instanceof Error ? error.message : 'Trading user stream status check failed.',
        checkedAt,
      ),
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

function createErrorStatus(
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
  };
}
