import { NextResponse } from 'next/server'
import { getMarketStorageAdapter } from '../../../../lib/db/storageAdapter'

export const dynamic = 'force-dynamic'

export async function GET() {
  const status = await getMarketStorageAdapter().getStatus()

  return NextResponse.json({
    candleCounts: status.candleCounts,
    lastStored: status.lastStored,
    retentionHours: Math.round(status.retentionSeconds / 3600),
    dbSizeMb: status.dbSizeMb,
  })
}
