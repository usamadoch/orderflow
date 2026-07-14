import { NextResponse } from 'next/server';
import { getBinanceTradingConfig, createBlockedTradingHealth, TradingConfigError } from '../../../../lib/trading/config';
import { getTradingHealthStatus } from '../../../../lib/trading/health';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const config = getBinanceTradingConfig();
    const health = await getTradingHealthStatus(config);

    return NextResponse.json(health);
  } catch (error) {
    if (error instanceof TradingConfigError) {
      return NextResponse.json(createBlockedTradingHealth(error), {
        status: error.statusCode,
      });
    }

    return NextResponse.json(
      {
        mode: 'binance_testnet',
        modeBadge: 'testnet',
        connectionStatus: 'degraded',
        apiKeyConfigured: false,
        apiSecretConfigured: false,
        liveTradingEnabled: false,
        serverTime: {
          checked: false,
          ok: false,
          errorMessage: error instanceof Error ? error.message : 'Trading health check failed.',
        },
        checkedAt: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'Trading health check failed.',
      },
      {
        status: 500,
      },
    );
  }
}
