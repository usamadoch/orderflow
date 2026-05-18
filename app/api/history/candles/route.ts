import { NextRequest, NextResponse } from 'next/server'
import { getCandles } from '../../../../lib/db/database'
import { isAllowedSymbol, isAllowedTimeframe } from '../../../../lib/config/markets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const timeframe = searchParams.get('timeframe')
  const since = Number(searchParams.get('since') ?? '0')
  const limit = Number(searchParams.get('limit') ?? '500')

  if (!isAllowedSymbol(symbol) || !isAllowedTimeframe(timeframe)) {
    return NextResponse.json({ error: 'Invalid symbol or timeframe' }, { status: 400 })
  }

  if (!Number.isFinite(since) || !Number.isFinite(limit)) {
    return NextResponse.json({ error: 'Invalid since or limit' }, { status: 400 })
  }

  const rows = await getCandles(symbol, timeframe, since, limit)

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
