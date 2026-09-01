import { NextRequest, NextResponse } from 'next/server'
import { getStoredCandles } from '../../../../lib/db/storageAdapter'
import { isAllowedContractType, isAllowedSymbol, isAllowedTimeframe } from '../../../../lib/config/markets'
import type { MarketContractType } from '../../../../lib/config/markets'

export const dynamic = 'force-dynamic'

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
  const rows = await getStoredCandles({
    symbol,
    contractType: requestedContractType,
    timeframe,
    since,
    until,
    limit,
  })


  return NextResponse.json(rows.map((row) => ({
    time: row.open_time,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    tradeCount: row.trade_count,
    isClosed: true,
  })))
}
