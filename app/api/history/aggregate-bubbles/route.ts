import { NextRequest, NextResponse } from 'next/server'
import {
  DEFAULT_AGGREGATE_BUBBLE_RESTORE_LIMIT,
  MAX_AGGREGATE_BUBBLE_RESTORE_LIMIT,
  MAX_AGGREGATE_BUBBLE_RESTORE_RANGE_SECONDS,
  getAggregateBubbleEvents,
  getAggregateBubbleThresholds,
} from '../../../../lib/db/aggregateBubbleStorage'
import {
  isAllowedContractType,
  isAllowedDataSourceMode,
  isAllowedSymbol,
  type MarketContractType,
} from '../../../../lib/config/markets'

export const dynamic = 'force-dynamic'

function normalizeTimeParam(value: number) {
  if (!Number.isFinite(value)) return NaN

  // Existing history routes mostly use seconds, while BubbleEvent.time uses ms.
  return value < 10_000_000_000 ? value * 1000 : value
}

function resolveContractTypes(
  marketSource: string | null,
  contractType: string | null,
  activeContractType: string | null,
): MarketContractType[] | null {
  const requestedSource = marketSource ?? contractType

  if (requestedSource === 'both') return ['spot', 'futures']

  if (requestedSource === 'active') {
    if (isAllowedContractType(activeContractType)) return [activeContractType]
    if (isAllowedContractType(contractType)) return [contractType]
    return null
  }

  if (isAllowedContractType(requestedSource)) return [requestedSource]

  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const marketSource = searchParams.get('marketSource')
  const contractType = searchParams.get('contractType')
  const activeContractType = searchParams.get('activeContractType')
  const startTime = normalizeTimeParam(Number(searchParams.get('startTime') ?? searchParams.get('start')))
  const endTime = normalizeTimeParam(Number(searchParams.get('endTime') ?? searchParams.get('end')))
  const limit = Number(searchParams.get('limit') ?? DEFAULT_AGGREGATE_BUBBLE_RESTORE_LIMIT)
  const contractTypes = resolveContractTypes(marketSource, contractType, activeContractType)

  if (!isAllowedSymbol(symbol) || contractTypes === null) {
    return NextResponse.json({ error: 'Invalid symbol or aggregate bubble market source' }, { status: 400 })
  }

  if (marketSource != null && marketSource !== 'active' && !isAllowedDataSourceMode(marketSource)) {
    return NextResponse.json({ error: 'Invalid aggregate bubble market source' }, { status: 400 })
  }

  if (
    !Number.isFinite(startTime)
    || !Number.isFinite(endTime)
    || !Number.isFinite(limit)
    || endTime <= startTime
  ) {
    return NextResponse.json({ error: 'Invalid startTime, endTime, or limit' }, { status: 400 })
  }

  if ((endTime - startTime) / 1000 > MAX_AGGREGATE_BUBBLE_RESTORE_RANGE_SECONDS) {
    return NextResponse.json(
      { error: 'Aggregate bubble history range is too large; request it in smaller chunks' },
      { status: 413 },
    )
  }

  const thresholds = getAggregateBubbleThresholds()

  try {
    const rows = await getAggregateBubbleEvents({
      symbol,
      contractTypes,
      startTime,
      endTime,
      limit: Math.min(limit, MAX_AGGREGATE_BUBBLE_RESTORE_LIMIT),
    })

    return NextResponse.json(rows, {
      headers: {
        'x-aggregate-bubble-min-volume': String(thresholds.minVolume),
        'x-aggregate-bubble-min-trade-count': String(thresholds.minTradeCount),
        'x-aggregate-bubble-min-trade-count-volume': String(thresholds.minTradeCountVolume),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.includes('BUBBLES_MONGODB_') ? 503 : 500

    return NextResponse.json({ error: message }, { status })
  }
}
