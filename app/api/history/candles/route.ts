import { NextRequest, NextResponse } from 'next/server'
import { getMarketDbDriver, getStoredCandles } from '../../../../lib/db/storageAdapter'
import { isAllowedContractType, isAllowedSymbol, isAllowedTimeframe } from '../../../../lib/config/markets'
import type { MarketContractType } from '../../../../lib/config/markets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const timeframe = searchParams.get('timeframe')
  const contractType = searchParams.get('contractType')
  const driver = getMarketDbDriver()
  const since = Number(searchParams.get('since') ?? '0')
  const limit = Number(searchParams.get('limit') ?? '500')

  if (!isAllowedSymbol(symbol) || !isAllowedTimeframe(timeframe)) {
    return NextResponse.json({ error: 'Invalid symbol or timeframe' }, { status: 400 })
  }

  if (contractType != null && !isAllowedContractType(contractType)) {
    return NextResponse.json({ error: 'Invalid contractType' }, { status: 400 })
  }

  if (driver === 'libsql' && contractType != null && contractType !== 'spot') {
    return NextResponse.json([])
  }

  if (!Number.isFinite(since) || !Number.isFinite(limit)) {
    return NextResponse.json({ error: 'Invalid since or limit' }, { status: 400 })
  }

  const requestedContractType: MarketContractType = contractType ?? 'spot'
  const rows = await getStoredCandles({
    symbol,
    contractType: requestedContractType,
    timeframe,
    since,
    limit,
  })

  return NextResponse.json(rows.map((row) => ({
    time: row.open_time,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    isClosed: true,
  })))
}
