import { NextRequest, NextResponse } from 'next/server'
import { getMarketStorageAdapter } from '../../../../lib/db/storageAdapter'
import {
  isAllowedContractType,
  isAllowedDataSourceMode,
  isAllowedSymbol,
  isAllowedTimeframe,
} from '../../../../lib/config/markets'
import {
  BASE_FOOTPRINT_BUCKET_SIZE,
  BASE_FOOTPRINT_TIMEFRAME,
} from '../../../../lib/aggregation/engine'

export const dynamic = 'force-dynamic'

const FOOTPRINT_RANGE_CANDLE_LIMIT = 500
const TIMEFRAME_SECONDS = {
  '1m': 60,
  '5m': 5 * 60,
  '15m': 15 * 60,
  '1h': 60 * 60,
  '4h': 4 * 60 * 60,
} as const

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const timeframe = searchParams.get('timeframe')
  const contractType = searchParams.get('contractType')
  const dataSourceMode = searchParams.get('dataSourceMode')
  const candleTime = Number(searchParams.get('candleTime'))
  const requestedBucketSize = Number(searchParams.get('bucketSize'))
  const hasRange = searchParams.has('start') || searchParams.has('end')
  const start = Number(searchParams.get('start'))
  const end = Number(searchParams.get('end'))

  if (
    !isAllowedSymbol(symbol)
    || !isAllowedTimeframe(timeframe)
    || !isAllowedContractType(contractType)
    || !isAllowedDataSourceMode(dataSourceMode)
  ) {
    return NextResponse.json({ error: 'Invalid symbol, source, or timeframe' }, { status: 400 })
  }

  if (hasRange) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(requestedBucketSize) || requestedBucketSize < BASE_FOOTPRINT_BUCKET_SIZE || end <= start) {
      return NextResponse.json({ error: 'Invalid start, end, or bucketSize' }, { status: 400 })
    }

    const maxRangeSeconds = FOOTPRINT_RANGE_CANDLE_LIMIT * TIMEFRAME_SECONDS[timeframe]
    if (end - start > maxRangeSeconds) {
      return NextResponse.json(
        {
          error: `Footprint range is too large. Maximum range is ${maxRangeSeconds} seconds for ${timeframe}.`,
          maxRangeSeconds,
          maxCandles: FOOTPRINT_RANGE_CANDLE_LIMIT,
        },
        { status: 400 },
      )
    }

    const rows = await getMarketStorageAdapter().getFootprintCellsForRange(
      symbol,
      contractType,
      dataSourceMode,
      BASE_FOOTPRINT_TIMEFRAME,
      start,
      end,
      BASE_FOOTPRINT_BUCKET_SIZE,
    )

    return NextResponse.json(rows.map((row) => ({
      candleTime: row.candle_time,
      bucketPrice: row.bucket_price,
      bidVol: row.bid_vol,
      askVol: row.ask_vol,
      delta: row.delta,
    })))
  }

  if (!Number.isFinite(candleTime) || !Number.isFinite(requestedBucketSize) || requestedBucketSize < BASE_FOOTPRINT_BUCKET_SIZE) {
    return NextResponse.json({ error: 'Invalid candleTime or bucketSize' }, { status: 400 })
  }

  const rows = await getMarketStorageAdapter().getFootprintCells(
    symbol,
    contractType,
    dataSourceMode,
    BASE_FOOTPRINT_TIMEFRAME,
    candleTime,
    BASE_FOOTPRINT_BUCKET_SIZE,
  )

  return NextResponse.json(rows.map((row) => ({
    candleTime: row.candle_time,
    bucketPrice: row.bucket_price,
    bidVol: row.bid_vol,
    askVol: row.ask_vol,
    delta: row.delta,
  })))
}
