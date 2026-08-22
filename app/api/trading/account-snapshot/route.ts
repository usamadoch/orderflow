import { NextRequest, NextResponse } from 'next/server'
import { BinanceRestClientError } from '../../../../lib/trading/binanceRestClient'
import { createBlockedTradingHealth, getBinanceTradingConfig, TradingConfigError } from '../../../../lib/trading/config'
import { getBinanceUserDataStreamManager } from '../../../../lib/trading/userDataStreamManager'
import { createErrorSnapshot, normalizeLimit, normalizeSymbol } from '../../../../lib/utils/tradingApiUtils'
import type { TradingMode } from '../../../../types/trading'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const checkedAt = new Date().toISOString()
  let mode: TradingMode = 'binance_testnet'

  try {
    const config = getBinanceTradingConfig()
    mode = config.mode
    const symbol = normalizeSymbol(request.nextUrl.searchParams.get('symbol'))
    const limit = normalizeLimit(request.nextUrl.searchParams.get('limit'))
    const streamManager = getBinanceUserDataStreamManager(config)
    await streamManager.ensureStarted({ symbol, recentTradesLimit: limit })
    const snapshot = await streamManager.reconcile(symbol, limit)

    return NextResponse.json(snapshot)
  } catch (error) {
    if (error instanceof TradingConfigError) {
      const health = createBlockedTradingHealth(error, checkedAt)
      return NextResponse.json(
        createErrorSnapshot(health.mode, health.connectionStatus, checkedAt, health.errorMessage ?? error.message, error.code),
        {
          status: error.statusCode,
        },
      )
    }

    if (error instanceof BinanceRestClientError) {
      return NextResponse.json(
        createErrorSnapshot(mode, 'degraded', checkedAt, error.message, error.code),
        {
          status: error.statusCode,
        },
      )
    }

    const message = error instanceof Error ? error.message : 'Trading account snapshot sync failed.'
    return NextResponse.json(
      createErrorSnapshot('binance_testnet', 'degraded', checkedAt, message, 'snapshot_sync_failed'),
      {
        status: 500,
      },
    )
  }
}
