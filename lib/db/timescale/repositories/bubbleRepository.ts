import { query, type QueryParam } from '../client'
import type { BubbleEventContractType, BubbleEventSide } from '../../../../types/bubble'

export interface AggregateBubbleEventWriteInput {
  symbol: string
  contractType: BubbleEventContractType
  aggregateTradeId: number
  eventTimeMs: number
  price: number
  side: BubbleEventSide
  volume: number
  tradeCount: number
  firstTradeId: number
  lastTradeId: number
  qualifiedBy: ('volume' | 'tradeCount')[]
  minVolumeAtIngest: number
  minTradeCountAtIngest: number
}

export interface GetAggregateBubbleEventsInput {
  symbol: string
  contractTypes: BubbleEventContractType[]
  startTime: number
  endTime: number
  limit?: number
  order?: 'ASC' | 'DESC'
  minVolume?: number
}

export interface StoreAggregateBubbleEventsResult {
  inserted: number
  duplicatesSkipped: number
}

export async function storeAggregateBubbleEvents(
  inputs: AggregateBubbleEventWriteInput[]
): Promise<StoreAggregateBubbleEventsResult> {
  if (inputs.length === 0) return { inserted: 0, duplicatesSkipped: 0 }

  const values: QueryParam[] = []
  const placeholders: string[] = []
  let paramIndex = 1

  for (const input of inputs) {
    placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`)
    
    values.push(
      new Date(input.eventTimeMs),
      input.symbol,
      input.contractType,
      input.aggregateTradeId,
      input.eventTimeMs,
      input.price || 0,
      input.side,
      input.volume || 0,
      input.tradeCount || 1,
      input.firstTradeId,
      input.lastTradeId,
      input.qualifiedBy,
      input.minVolumeAtIngest || 0,
      input.minTradeCountAtIngest || 0
    )
  }

  const sql = `
    INSERT INTO aggregate_bubble_events (
      event_time, symbol, contract_type, aggregate_trade_id, event_time_ms, price, side, 
      volume, trade_count, first_trade_id, last_trade_id, qualified_by, min_volume_at_ingest, min_trade_count_at_ingest
    ) VALUES ${placeholders.join(', ')}
    ON CONFLICT (symbol, contract_type, aggregate_trade_id, event_time) DO NOTHING
  `

  const result = await query(sql, values)
  const inserted = result.rowCount ?? 0
  
  return { 
    inserted, 
    duplicatesSkipped: inputs.length - inserted 
  }
}

export async function getAggregateBubbleEvents({
  symbol,
  contractTypes,
  startTime,
  endTime,
  limit = 5000,
  order = 'ASC',
  minVolume,
}: GetAggregateBubbleEventsInput) {
  const boundedLimit = Math.max(1, Math.min(limit, 50000))
  const startMs = startTime < 10_000_000_000 ? startTime * 1000 : startTime
  const endMs = endTime < 10_000_000_000 ? endTime * 1000 : endTime
  const sortOrder = order === 'DESC' ? 'DESC' : 'ASC'

  // Query indexed event_time directly without secondary column in SQL to avoid Incremental Sort
  const sql = `
    SELECT 
      aggregate_trade_id,
      symbol,
      contract_type,
      event_time,
      event_time_ms,
      price,
      side,
      volume,
      trade_count,
      first_trade_id,
      last_trade_id,
      qualified_by
    FROM aggregate_bubble_events
    WHERE symbol = $1
      AND event_time >= $2
      AND event_time <= $3
      AND contract_type = ANY($4::text[])
      AND volume >= $6
    ORDER BY event_time ${sortOrder}
    LIMIT $5
  `

  const params: QueryParam[] = [
    symbol,
    new Date(startMs),
    new Date(endMs),
    contractTypes,
    boundedLimit,
  ]
  params.push(minVolume ?? 15) // $6

  const result = await query(sql, params)

  // If queried DESC to fetch newest rows, reverse back to chronological ASC for the client
  const rawRows = sortOrder === 'DESC' ? result.rows.reverse() : result.rows

  // Sort deterministically in memory (tie-break on aggregate_trade_id for identical timestamps)
  rawRows.sort((a, b) => {
    const timeA = Number(a.event_time_ms ?? (a.event_time instanceof Date ? a.event_time.getTime() : new Date(a.event_time).getTime()))
    const timeB = Number(b.event_time_ms ?? (b.event_time instanceof Date ? b.event_time.getTime() : new Date(b.event_time).getTime()))
    if (timeA !== timeB) return timeA - timeB
    return Number(a.aggregate_trade_id) - Number(b.aggregate_trade_id)
  })

  return rawRows.map((row) => ({
    id: Number(row.aggregate_trade_id),
    symbol: row.symbol,
    contractType: row.contract_type as BubbleEventContractType,
    time: Number(row.event_time_ms ?? (row.event_time instanceof Date ? row.event_time.getTime() : new Date(row.event_time).getTime())),
    price: Number(row.price),
    side: row.side as BubbleEventSide,
    volume: Number(row.volume),
    tradeCount: row.trade_count,
    firstTradeId: Number(row.first_trade_id),
    lastTradeId: Number(row.last_trade_id),
    qualifiedBy: row.qualified_by,
    source: 'aggregateTrade' as const,
  }))
}
