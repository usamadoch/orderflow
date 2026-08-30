import { query } from '../db/timescale/client'

const ESTIMATED_BYTES_PER_FOOTPRINT = 150
const ESTIMATED_BYTES_PER_PROFILE = 180
const ESTIMATED_BYTES_PER_BUBBLE = 120

export interface DatabaseUsageInfo {
  usedMb: number
  totalMb: number
}

export interface DayStorageInfo {
  date: string
  sizeMb: number
}

export interface StorageSummaryResult {
  databases: {
    timescale: DatabaseUsageInfo
  }
  days: DayStorageInfo[]
}

export async function getStorageSummary(): Promise<StorageSummaryResult> {
  let dbUsedMb = 0

  try {
    const sizeResult = await query('SELECT pg_database_size(current_database()) as size')
    dbUsedMb = +(parseInt(sizeResult.rows[0].size || '0', 10) / (1024 * 1024)).toFixed(2)
  } catch (e) {
    console.warn('Could not read timescale db size', e)
  }

  const footprintAgg = await query(`
    SELECT to_char(time, 'YYYY-MM-DD') as _id, count(*) as count 
    FROM footprint_cells 
    GROUP BY _id
  `).catch(() => ({ rows: [] }))

  const profileAgg = await query(`
    SELECT to_char(time, 'YYYY-MM-DD') as _id, count(*) as count 
    FROM profile_rows 
    GROUP BY _id
  `).catch(() => ({ rows: [] }))

  const bubbleAgg = await query(`
    SELECT to_char(event_time, 'YYYY-MM-DD') as _id, count(*) as count 
    FROM aggregate_bubble_events 
    GROUP BY _id
  `).catch(() => ({ rows: [] }))

  const dailyUsage = new Map<string, { estMb: number }>()

  const getDay = (date: string) => {
    if (!dailyUsage.has(date)) {
      dailyUsage.set(date, { estMb: 0 })
    }
    return dailyUsage.get(date)!
  }

  footprintAgg.rows.forEach((row: unknown) => {
    const doc = row as { _id: string; count: string | number };
    if (!doc._id) return
    const day = getDay(String(doc._id))
    day.estMb += (parseInt(String(doc.count), 10) * ESTIMATED_BYTES_PER_FOOTPRINT) / (1024 * 1024)
  })

  profileAgg.rows.forEach((row: unknown) => {
    const doc = row as { _id: string; count: string | number };
    if (!doc._id) return
    const day = getDay(String(doc._id))
    day.estMb += (parseInt(String(doc.count), 10) * ESTIMATED_BYTES_PER_PROFILE) / (1024 * 1024)
  })

  bubbleAgg.rows.forEach((row: unknown) => {
    const doc = row as { _id: string; count: string | number };
    if (!doc._id) return
    const day = getDay(String(doc._id))
    day.estMb += (parseInt(String(doc.count), 10) * ESTIMATED_BYTES_PER_BUBBLE) / (1024 * 1024)
  })

  let totalEst = 0
  for (const size of dailyUsage.values()) {
    totalEst += size.estMb
  }

  const scale = totalEst > 0 ? (dbUsedMb / totalEst) : 1

  const days: DayStorageInfo[] = Array.from(dailyUsage.entries())
    .map(([date, size]) => ({
      date,
      sizeMb: +(size.estMb * scale).toFixed(2),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    databases: {
      timescale: { usedMb: dbUsedMb, totalMb: 10240 }, // Using 10GB total for Timescale display
    },
    days,
  }
}

export async function deleteStorageDays(dates: string[]): Promise<number> {
  let totalDeleted = 0

  for (const dateStr of dates) {
    const start = new Date(`${dateStr}T00:00:00.000Z`)
    const end = new Date(`${dateStr}T23:59:59.999Z`)

    const fpResult = await query('DELETE FROM footprint_cells WHERE time >= $1 AND time <= $2', [start, end]).catch(() => ({ rowCount: 0 }))
    totalDeleted += fpResult.rowCount ?? 0

    const prResult = await query('DELETE FROM profile_rows WHERE time >= $1 AND time <= $2', [start, end]).catch(() => ({ rowCount: 0 }))
    totalDeleted += prResult.rowCount ?? 0

    const bResult = await query('DELETE FROM aggregate_bubble_events WHERE event_time >= $1 AND event_time <= $2', [start, end]).catch(() => ({ rowCount: 0 }))
    totalDeleted += bResult.rowCount ?? 0
  }

  return totalDeleted
}
