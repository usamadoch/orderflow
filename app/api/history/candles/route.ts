import { NextRequest, NextResponse } from 'next/server'
import { getStoredCandles } from '../../../../lib/db/storageAdapter'
import { isAllowedContractType, isAllowedSymbol, isAllowedTimeframe } from '../../../../lib/config/markets'
import type { MarketContractType } from '../../../../lib/config/markets'
import { fetchAndStoreBinanceCandles } from '../../../../lib/feeds/serverBinanceCandles'

import { timeframeToSeconds } from '../../../../lib/utils/format'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const timeframe = searchParams.get('timeframe')
  const contractType = searchParams.get('contractType')
  const since = Number(searchParams.get('since') ?? '0')
  const until = Number(searchParams.get('until') ?? '0')
  const limit = Number(searchParams.get('limit') ?? '500')

  if (!symbol || !timeframe) {
    return NextResponse.json({ error: 'Missing symbol or timeframe' }, { status: 400 })
  }

  if (!isAllowedSymbol(symbol) || !isAllowedTimeframe(timeframe)) {
    return NextResponse.json({ error: 'Invalid symbol or timeframe' }, { status: 400 })
  }

  if (contractType != null && !isAllowedContractType(contractType)) {
    return NextResponse.json({ error: 'Invalid contractType' }, { status: 400 })
  }

  if (!Number.isFinite(since) || !Number.isFinite(limit)) {
    return NextResponse.json({ error: 'Invalid since or limit' }, { status: 400 })
  }

  const requestedContractType: MarketContractType = (contractType as MarketContractType) ?? 'spot'
  let rows = await getStoredCandles({
    symbol,
    contractType: requestedContractType,
    timeframe,
    since,
    until,
    limit,
  })

  const nowSec = Math.floor(Date.now() / 1000)
  const tfSeconds = timeframeToSeconds(timeframe)
  const latestRowTime = rows.length > 0 ? rows[rows.length - 1].open_time : 0

  let hasInternalGap = false
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].open_time - rows[i - 1].open_time > Math.max(300, tfSeconds * 5)) {
      hasInternalGap = true
      break
    }
  }

  const isRequestingCurrent = until <= 0 || until >= nowSec - 3600
  const isCurrentStale = isRequestingCurrent && (rows.length === 0 || (nowSec - latestRowTime > Math.max(3600, tfSeconds * 5)))
  const isPastRangeGapped = !isRequestingCurrent && (rows.length === 0 || (until - latestRowTime > Math.max(7200, tfSeconds * 10)))

  if (isCurrentStale || isPastRangeGapped || hasInternalGap) {
    try {
      const freshRows = await fetchAndStoreBinanceCandles({
        symbol,
        contractType: requestedContractType,
        timeframe,
        since,
        until,
        limit,
      })
      if (freshRows.length > 0) {
        rows = freshRows
      }
    } catch (err) {
      console.warn('[history/candles] fetchAndStoreBinanceCandles failed, using stored rows:', err)
    }
  }

  const response = NextResponse.json(rows.map((row) => ([
    row.open_time,
    row.open,
    row.high,
    row.low,
    row.close,
    row.volume,
    row.trade_count,
  ])))

  const untilParam = searchParams.get('until')
  const isPastRange = untilParam !== null && Number(untilParam) < Math.floor(Date.now() / 1000) - 3600
  response.headers.set(
    'Cache-Control',
    isPastRange ? 'public, max-age=3600, stale-while-revalidate=86400' : 'no-store'
  )

  return response
}
