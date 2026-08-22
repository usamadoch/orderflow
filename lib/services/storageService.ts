import { getMongoDb } from '../db/mongo/client'
import { getAggregateBubbleMongoDb, AGGREGATE_BUBBLE_COLLECTION } from '../db/aggregateBubbleStorage'
import { MONGO_MARKET_COLLECTIONS } from '../db/mongo/marketStorageMongo'

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
  const db = await getMongoDb()
  let bubbleDb: Awaited<ReturnType<typeof getAggregateBubbleMongoDb>> | null = null
  try {
    bubbleDb = await getAggregateBubbleMongoDb()
  } catch (e) {
    console.warn('Bubble DB not accessible for storage summary', e)
  }

  const mainStats = await db.command({ dbStats: 1 })
  const mainUsedMb = +(mainStats.dataSize / (1024 * 1024)).toFixed(2)

  let bubbleUsedMb = 0
  if (bubbleDb) {
    const bubbleStats = await bubbleDb.command({ dbStats: 1 })
    bubbleUsedMb = +(bubbleStats.dataSize / (1024 * 1024)).toFixed(2)
  }

  const footprintAgg = await db.collection(MONGO_MARKET_COLLECTIONS.footprintCells).aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
        count: { $sum: 1 },
      },
    },
  ]).toArray()

  const profileAgg = await db.collection(MONGO_MARKET_COLLECTIONS.profileRows).aggregate([
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$time' } },
        count: { $sum: 1 },
      },
    },
  ]).toArray()

  let bubbleAgg: { _id: string; count: number }[] = []
  if (bubbleDb) {
    bubbleAgg = await bubbleDb.collection(AGGREGATE_BUBBLE_COLLECTION).aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$eventTime' } },
          count: { $sum: 1 },
        },
      },
    ]).toArray() as { _id: string; count: number }[]
  }

  const dailyUsage = new Map<string, { mainMb: number; bubbleMb: number }>()

  const getDay = (date: string) => {
    if (!dailyUsage.has(date)) {
      dailyUsage.set(date, { mainMb: 0, bubbleMb: 0 })
    }
    return dailyUsage.get(date)!
  }

  footprintAgg.forEach((doc) => {
    if (!doc._id) return
    const day = getDay(doc._id)
    day.mainMb += (doc.count * ESTIMATED_BYTES_PER_FOOTPRINT) / (1024 * 1024)
  })

  profileAgg.forEach((doc) => {
    if (!doc._id) return
    const day = getDay(doc._id)
    day.mainMb += (doc.count * ESTIMATED_BYTES_PER_PROFILE) / (1024 * 1024)
  })

  bubbleAgg.forEach((doc) => {
    if (!doc._id) return
    const day = getDay(doc._id)
    day.bubbleMb += (doc.count * ESTIMATED_BYTES_PER_BUBBLE) / (1024 * 1024)
  })

  let totalEstMain = 0
  let totalEstBubble = 0
  for (const sizes of dailyUsage.values()) {
    totalEstMain += sizes.mainMb
    totalEstBubble += sizes.bubbleMb
  }

  const mainScale = totalEstMain > 0 ? (mainUsedMb / totalEstMain) : 1
  const bubbleScale = totalEstBubble > 0 ? (bubbleUsedMb / totalEstBubble) : 1

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
  const db = await getMongoDb()

  let bubbleDb: Awaited<ReturnType<typeof getAggregateBubbleMongoDb>> | null = null
  if (targetSet.has('bubbles')) {
    try {
      bubbleDb = await getAggregateBubbleMongoDb()
    } catch (e) {
      console.warn('Bubble DB not accessible for deletion', e)
    }
  }

  let totalDeleted = 0

  for (const dateStr of dates) {
    const start = new Date(`${dateStr}T00:00:00.000Z`)
    const end = new Date(`${dateStr}T23:59:59.999Z`)

    if (targetSet.has('main')) {
      const fpResult = await db.collection(MONGO_MARKET_COLLECTIONS.footprintCells).deleteMany({
        time: { $gte: start, $lte: end },
      })
      totalDeleted += fpResult.deletedCount

      const prResult = await db.collection(MONGO_MARKET_COLLECTIONS.profileRows).deleteMany({
        time: { $gte: start, $lte: end },
      })
      totalDeleted += prResult.deletedCount
    }

    if (targetSet.has('bubbles') && bubbleDb) {
      const bResult = await bubbleDb.collection(AGGREGATE_BUBBLE_COLLECTION).deleteMany({
        eventTime: { $gte: start, $lte: end },
      })
      totalDeleted += bResult.deletedCount
    }
  }

  return totalDeleted
}
