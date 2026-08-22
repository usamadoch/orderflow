import { NextRequest, NextResponse } from 'next/server'
import { getBinanceTradingConfig, TradingConfigError } from '../../../../lib/trading/config'
import { getBinanceUserDataStreamManager } from '../../../../lib/trading/userDataStreamManager'
import { createErrorStatus, normalizeLimit, normalizeSymbol } from '../../../../lib/utils/tradingApiUtils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const checkedAt = new Date().toISOString()

  try {
    const config = getBinanceTradingConfig()
    const streamManager = getBinanceUserDataStreamManager(config)
    const symbol = normalizeSymbol(request.nextUrl.searchParams.get('symbol'))
    const limit = normalizeLimit(request.nextUrl.searchParams.get('limit'))

    await streamManager.ensureStarted({ symbol, recentTradesLimit: limit })

    return NextResponse.json(streamManager.getStatus())
  } catch (error) {
    if (error instanceof TradingConfigError) {
      return NextResponse.json(
        createErrorStatus(error.safeStatus.mode, 'blocked', error.message, checkedAt),
        {
          status: error.statusCode,
        },
      )
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
    )
  }
}
