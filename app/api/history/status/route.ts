import { NextResponse } from 'next/server'
import {
  DB_CONFIG,
  getCandleCount,
  getCollectorMeta,
  getDatabaseSizeMb,
} from '../../../../lib/db/database'
import { ALLOWED_SYMBOLS, ALLOWED_TIMEFRAMES } from '../../../../lib/config/markets'

export const dynamic = 'force-dynamic'

export async function GET() {
  const meta = await getCollectorMeta()
  const candleCounts: Record<string, number> = {}

  await Promise.all(
    ALLOWED_SYMBOLS.flatMap((symbol) =>
      ALLOWED_TIMEFRAMES.map(async (timeframe) => {
        candleCounts[`${symbol}_${timeframe}`] = await getCandleCount(symbol, timeframe)
      }),
    ),
  )

  return NextResponse.json({
    candleCounts,
    lastStored: meta.last_candle_stored ?? null,
    retentionHours: Number(meta.retention_hours ?? DB_CONFIG.retentionHours),
    dbSizeMb: getDatabaseSizeMb(),
  })
}
