import { NextRequest, NextResponse } from 'next/server'
import { getFootprintCells, getFootprintCellsForRange } from '../../../../lib/db/database'
import { isAllowedSymbol, isAllowedTimeframe } from '../../../../lib/config/markets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const timeframe = searchParams.get('timeframe')
  const candleTime = Number(searchParams.get('candleTime'))
  const bucketSize = Number(searchParams.get('bucketSize'))
  const hasRange = searchParams.has('start') || searchParams.has('end')
  const start = Number(searchParams.get('start'))
  const end = Number(searchParams.get('end'))

  if (!isAllowedSymbol(symbol) || !isAllowedTimeframe(timeframe)) {
    return NextResponse.json({ error: 'Invalid symbol or timeframe' }, { status: 400 })
  }

  if (hasRange) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(bucketSize) || end <= start) {
      return NextResponse.json({ error: 'Invalid start, end, or bucketSize' }, { status: 400 })
    }

    const rows = await getFootprintCellsForRange(symbol, timeframe, start, end, bucketSize)

    return NextResponse.json(rows.map((row) => ({
      candleTime: row.candle_time,
      bucketPrice: row.bucket_price,
      bidVol: row.bid_vol,
      askVol: row.ask_vol,
      delta: row.delta,
    })))
  }

  if (!Number.isFinite(candleTime) || !Number.isFinite(bucketSize)) {
    return NextResponse.json({ error: 'Invalid candleTime or bucketSize' }, { status: 400 })
  }

  const rows = await getFootprintCells(symbol, timeframe, candleTime, bucketSize)

  return NextResponse.json(rows.map((row) => ({
    candleTime: row.candle_time,
    bucketPrice: row.bucket_price,
    bidVol: row.bid_vol,
    askVol: row.ask_vol,
    delta: row.delta,
  })))
}
