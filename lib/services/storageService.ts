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
  mainMb: number
  bubbleMb: number
  sizeMb: number
}

export interface StorageSummaryResult {
  databases: {
    main: DatabaseUsageInfo
    bubbles: DatabaseUsageInfo
  }
  days: DayStorageInfo[]
}

export async function getStorageSummary(): Promise<StorageSummaryResult> {
  let mainUsedMb = 0
  let bubbleUsedMb = 0

  try {
    const sizeResult = await query('SELECT pg_database_size(current_database()) as size')
    mainUsedMb = +(parseInt(sizeResult.rows[0].size || '0', 10) / (1024 * 1024)).toFixed(2)
    bubbleUsedMb = 0 // In timescale, bubbles and main are in the same DB. We'll just put total size in main.
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

  const dailyUsage = new Map<string, { mainMb: number; bubbleMb: number }>()

  const getDay = (date: string) => {
    if (!dailyUsage.has(date)) {
      dailyUsage.set(date, { mainMb: 0, bubbleMb: 0 })
    }
    return dailyUsage.get(date)!
  }

  footprintAgg.rows.forEach((doc: any) => {
    if (!doc._id) return
    const day = getDay(doc._id)
    day.mainMb += (parseInt(doc.count, 10) * ESTIMATED_BYTES_PER_FOOTPRINT) / (1024 * 1024)
  })

  profileAgg.rows.forEach((doc: any) => {
    if (!doc._id) return
    const day = getDay(doc._id)
    day.mainMb += (parseInt(doc.count, 10) * ESTIMATED_BYTES_PER_PROFILE) / (1024 * 1024)
  })

  bubbleAgg.rows.forEach((doc: any) => {
    if (!doc._id) return
    const day = getDay(doc._id)
    day.bubbleMb += (parseInt(doc.count, 10) * ESTIMATED_BYTES_PER_BUBBLE) / (1024 * 1024)
  })

  let totalEstMain = 0
  let totalEstBubble = 0
  for (const sizes of dailyUsage.values()) {
    totalEstMain += sizes.mainMb
    totalEstBubble += sizes.bubbleMb
  }

  const mainScale = totalEstMain > 0 ? (mainUsedMb / (totalEstMain + totalEstBubble)) : 1
  const bubbleScale = mainScale // Same database, same scale factor

  const days: DayStorageInfo[] = Array.from(dailyUsage.entries())
    .map(([date, sizes]) => {
      const scaledMain = sizes.mainMb * mainScale
      const scaledBubble = sizes.bubbleMb * bubbleScale
      return {
        date,
        mainMb: +scaledMain.toFixed(2),
        bubbleMb: +scaledBubble.toFixed(2),
        sizeMb: +(scaledMain + scaledBubble).toFixed(2),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    databases: {
      main: { usedMb: mainUsedMb, totalMb: 512 },
      bubbles: { usedMb: bubbleUsedMb, totalMb: 512 },
    },
    days,
  }
}

export async function deleteStorageDays(dates: string[], targets?: string[]): Promise<number> {
  const targetSet = new Set(Array.isArray(targets) ? targets : ['main', 'bubbles'])
  let totalDeleted = 0

  for (const dateStr of dates) {
    const start = new Date(`${dateStr}T00:00:00.000Z`)
    const end = new Date(`${dateStr}T23:59:59.999Z`)

    if (targetSet.has('main')) {
      const fpResult = await query('DELETE FROM footprint_cells WHERE time >= $1 AND time <= $2', [start, end]).catch(() => ({ rowCount: 0 }))
      totalDeleted += fpResult.rowCount ?? 0

      const prResult = await query('DELETE FROM profile_rows WHERE time >= $1 AND time <= $2', [start, end]).catch(() => ({ rowCount: 0 }))
      totalDeleted += prResult.rowCount ?? 0
    }

    if (targetSet.has('bubbles')) {
      const bResult = await query('DELETE FROM aggregate_bubble_events WHERE event_time >= $1 AND event_time <= $2', [start, end]).catch(() => ({ rowCount: 0 }))
      totalDeleted += bResult.rowCount ?? 0
    }
  }

  return totalDeleted
}
