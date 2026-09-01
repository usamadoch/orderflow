import { NextRequest, NextResponse } from 'next/server'
import {
  FINE_PROFILE_STORAGE_TIMEFRAME,
  isAllowedContractType,
  isAllowedDataSourceMode,
  isAllowedSymbol,
  isAllowedTimeframe,
} from '../../../../lib/config/markets'
import { getMarketStorageAdapter } from '../../../../lib/db/storageAdapter'

export const dynamic = 'force-dynamic'

const MAX_PROFILE_RESTORE_RANGE_SECONDS = 6 * 60 * 60

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const timeframe = searchParams.get('timeframe')
  const start = Number(searchParams.get('start'))
  const end = Number(searchParams.get('end'))
  const baseBucketSize = Number(searchParams.get('baseBucketSize'))
  const contractType = searchParams.get('contractType')
  const dataSourceMode = searchParams.get('dataSourceMode')

  if (!isAllowedSymbol(symbol) || !isAllowedTimeframe(timeframe) || !isAllowedContractType(contractType) || !isAllowedDataSourceMode(dataSourceMode)) {
    return NextResponse.json({ error: 'Invalid symbol, timeframe, or source selection' }, { status: 400 })
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(baseBucketSize) || end <= start || baseBucketSize <= 0) {
    return NextResponse.json({ error: 'Invalid start, end, or baseBucketSize' }, { status: 400 })
  }

  if (end - start > MAX_PROFILE_RESTORE_RANGE_SECONDS) {
    return NextResponse.json({ error: 'Profile history range is too large; request it in smaller chunks' }, { status: 413 })
  }

  try {
    const rows = await getMarketStorageAdapter().getFineProfileRows(
      symbol, contractType, dataSourceMode, FINE_PROFILE_STORAGE_TIMEFRAME, start, end, baseBucketSize,
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

    return NextResponse.json(rows.map((row) => {
      const r = row as unknown as Record<string, unknown>;
      return {
        candleTime: r.candle_time,
        baseBucketSize: r.base_bucket_size,
        bucketPrice: r.bucket_price,
        bidVol: r.bid_vol,
        askVol: r.ask_vol,
        totalVol: r.total_vol,
        tradeCount: r.trade_count,
        orderCount: r.order_count,
      };
    }))
  } catch (error: unknown) {
    console.error('[API:Profile] Error fetching fine profile rows:', error)
    const message = error instanceof Error ? error.message : 'Unknown database error'
    return NextResponse.json({ error: 'Database unavailable or timed out', details: message }, { status: 503 })
  }
}
