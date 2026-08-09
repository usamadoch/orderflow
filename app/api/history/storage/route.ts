import { NextResponse } from 'next/server'
import { getMongoDb } from '../../../../lib/db/mongo/client'
import { getAggregateBubbleMongoDb } from '../../../../lib/db/aggregateBubbleStorage'
import { MONGO_MARKET_COLLECTIONS } from '../../../../lib/db/mongo/marketStorageMongo'
import { AGGREGATE_BUBBLE_COLLECTION } from '../../../../lib/db/aggregateBubbleStorage'

export const dynamic = 'force-dynamic'

// Rough estimates for document sizes in bytes to convert counts to MBs
const ESTIMATED_BYTES_PER_FOOTPRINT = 150
const ESTIMATED_BYTES_PER_PROFILE = 180
const ESTIMATED_BYTES_PER_BUBBLE = 120

export async function GET() {
  try {
    const db = await getMongoDb()
    let bubbleDb
    try {
      bubbleDb = await getAggregateBubbleMongoDb()
    } catch (e) {
      console.warn('Bubble DB not accessible for storage summary', e)
    }

    // Get DB Stats
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
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$time" } },
          count: { $sum: 1 }
        }
      }
    ]).toArray()

    const profileAgg = await db.collection(MONGO_MARKET_COLLECTIONS.profileRows).aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$time" } },
          count: { $sum: 1 }
        }
      }
    ]).toArray()

    let bubbleAgg: any[] = []
    if (bubbleDb) {
      bubbleAgg = await bubbleDb.collection(AGGREGATE_BUBBLE_COLLECTION).aggregate([
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$eventTime" } },
            count: { $sum: 1 }
          }
        }
      ]).toArray()
    }

    const dailyUsage = new Map<string, { mainMb: number, bubbleMb: number }>()

    const getDay = (date: string) => {
      if (!dailyUsage.has(date)) {
        dailyUsage.set(date, { mainMb: 0, bubbleMb: 0 })
      }
      return dailyUsage.get(date)!
    }

    footprintAgg.forEach(doc => {
      if (!doc._id) return
      const day = getDay(doc._id)
      day.mainMb += (doc.count * ESTIMATED_BYTES_PER_FOOTPRINT) / (1024 * 1024)
    })

    profileAgg.forEach(doc => {
      if (!doc._id) return
      const day = getDay(doc._id)
      day.mainMb += (doc.count * ESTIMATED_BYTES_PER_PROFILE) / (1024 * 1024)
    })

    bubbleAgg.forEach(doc => {
      if (!doc._id) return
      const day = getDay(doc._id)
      day.bubbleMb += (doc.count * ESTIMATED_BYTES_PER_BUBBLE) / (1024 * 1024)
    })

    // Calculate total estimated MBs to scale proportionally
    let totalEstMain = 0
    let totalEstBubble = 0
    for (const sizes of dailyUsage.values()) {
      totalEstMain += sizes.mainMb
      totalEstBubble += sizes.bubbleMb
    }

    const mainScale = totalEstMain > 0 ? (mainUsedMb / totalEstMain) : 1
    const bubbleScale = totalEstBubble > 0 ? (bubbleUsedMb / totalEstBubble) : 1

    const days = Array.from(dailyUsage.entries())
      .map(([date, sizes]) => {
        const scaledMain = sizes.mainMb * mainScale
        const scaledBubble = sizes.bubbleMb * bubbleScale
        return {
          date,
          mainMb: +scaledMain.toFixed(2),
          bubbleMb: +scaledBubble.toFixed(2),
          sizeMb: +(scaledMain + scaledBubble).toFixed(2)
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date)) // descending order

    return NextResponse.json({
      databases: {
        main: { usedMb: mainUsedMb, totalMb: 512 },
        bubbles: { usedMb: bubbleUsedMb, totalMb: 512 }
      },
      days
    })
  } catch (error: any) {
    console.error('Failed to get storage summary:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { dates, targets } = await request.json()
    if (!Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'dates array is required' }, { status: 400 })
    }
    
    // Default to both if targets not provided for backward compatibility
    const targetSet = new Set(Array.isArray(targets) ? targets : ['main', 'bubbles'])

    const db = await getMongoDb()
    let bubbleDb
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
          time: { $gte: start, $lte: end }
        })
        totalDeleted += fpResult.deletedCount

        const prResult = await db.collection(MONGO_MARKET_COLLECTIONS.profileRows).deleteMany({
          time: { $gte: start, $lte: end }
        })
        totalDeleted += prResult.deletedCount
      }

      if (targetSet.has('bubbles') && bubbleDb) {
        const bResult = await bubbleDb.collection(AGGREGATE_BUBBLE_COLLECTION).deleteMany({
          eventTime: { $gte: start, $lte: end }
        })
        totalDeleted += bResult.deletedCount
      }
    }

    return NextResponse.json({ success: true, deletedCount: totalDeleted })
  } catch (error: any) {
    console.error('Failed to delete storage data:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
