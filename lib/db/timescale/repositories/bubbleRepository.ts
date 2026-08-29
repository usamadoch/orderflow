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
}: GetAggregateBubbleEventsInput) {
  const boundedLimit = Math.max(1, Math.min(limit, 10000))
  const startMs = startTime < 10_000_000_000 ? startTime * 1000 : startTime
  const endMs = endTime < 10_000_000_000 ? endTime * 1000 : endTime

  // contractTypes is an array, we can use ANY($3) in postgres
  const sql = `
    SELECT * FROM aggregate_bubble_events
    WHERE symbol = $1
      AND event_time >= $2
      AND event_time <= $3
      AND contract_type = ANY($4::text[])
    ORDER BY event_time ASC, aggregate_trade_id ASC
    LIMIT $5
  `

  const result = await query(sql, [
    symbol,
    new Date(startMs),
    new Date(endMs),
    contractTypes,
    boundedLimit
  ])

  return result.rows.map((row) => ({
    id: Number(row.aggregate_trade_id),
    symbol: row.symbol,
    contractType: row.contract_type as BubbleEventContractType,
    time: Number(row.event_time_ms ?? row.event_time.getTime()),
    price: row.price,
    side: row.side as BubbleEventSide,
    volume: row.volume,
    tradeCount: row.trade_count,
    firstTradeId: Number(row.first_trade_id),
    lastTradeId: Number(row.last_trade_id),
    qualifiedBy: row.qualified_by,
  }))
}
