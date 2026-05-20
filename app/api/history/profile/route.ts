import { NextRequest, NextResponse } from 'next/server'
import { getFineProfileRows } from '../../../../lib/db/database'
import { isAllowedSymbol, isAllowedTimeframe } from '../../../../lib/config/markets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const timeframe = searchParams.get('timeframe')
  const start = Number(searchParams.get('start'))
  const end = Number(searchParams.get('end'))
  const baseBucketSize = Number(searchParams.get('baseBucketSize'))

  if (!isAllowedSymbol(symbol) || !isAllowedTimeframe(timeframe)) {
    return NextResponse.json({ error: 'Invalid symbol or timeframe' }, { status: 400 })
  }

  if (
    !Number.isFinite(start)
    || !Number.isFinite(end)
    || !Number.isFinite(baseBucketSize)
    || end <= start
    || baseBucketSize <= 0
  ) {
    return NextResponse.json({ error: 'Invalid start, end, or baseBucketSize' }, { status: 400 })
  }

  const rows = await getFineProfileRows(symbol, timeframe, start, end, baseBucketSize)

  return NextResponse.json(rows.map((row) => ({
    candleTime: row.candle_time,
    baseBucketSize: row.base_bucket_size,
    bucketPrice: row.bucket_price,
    bidVol: row.bid_vol,
    askVol: row.ask_vol,
    totalVol: row.total_vol,
    tradeCount: row.trade_count,
  })))
}
