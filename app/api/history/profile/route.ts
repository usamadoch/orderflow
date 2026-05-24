import { NextRequest, NextResponse } from 'next/server'
import { getMarketStorageAdapter } from '../../../../lib/db/storageAdapter'
import {
  FINE_PROFILE_STORAGE_TIMEFRAME,
  isAllowedContractType,
  isAllowedDataSourceMode,
  isAllowedSymbol,
  isAllowedTimeframe,
} from '../../../../lib/config/markets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const timeframe = searchParams.get('timeframe')
  const start = Number(searchParams.get('start'))
  const end = Number(searchParams.get('end'))
  const baseBucketSize = Number(searchParams.get('baseBucketSize'))
  const contractType = searchParams.get('contractType')
  const dataSourceMode = searchParams.get('dataSourceMode')

  if (
    !isAllowedSymbol(symbol)
    || !isAllowedTimeframe(timeframe)
    || !isAllowedContractType(contractType)
    || !isAllowedDataSourceMode(dataSourceMode)
  ) {
    return NextResponse.json({ error: 'Invalid symbol, timeframe, or source selection' }, { status: 400 })
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

  const rows = await getMarketStorageAdapter().getFineProfileRows(
    symbol,
    contractType,
    dataSourceMode,
    FINE_PROFILE_STORAGE_TIMEFRAME,
    start,
    end,
    baseBucketSize,
  )
  const candleTimes = rows.map((row) => row.candle_time)

  console.debug('[VPROFILE_DEBUG] Profile history API restore query', {
    symbol,
    contractType,
    dataSourceMode,
    requestedTimeframe: timeframe,
    storageTimeframe: FINE_PROFILE_STORAGE_TIMEFRAME,
    start,
    end,
    baseBucketSize,
    rowsFetched: rows.length,
    distinctCandleTimeCount: new Set(candleTimes).size,
    minCandleTime: candleTimes.length > 0 ? Math.min(...candleTimes) : null,
    maxCandleTime: candleTimes.length > 0 ? Math.max(...candleTimes) : null,
  })

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
