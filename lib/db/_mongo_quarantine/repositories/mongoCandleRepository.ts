import type { Collection, Db } from 'mongodb'
import type { CandleRow } from '../../database'
import type { StoreClosedCandleInput } from '../../storageAdapter'
import { getMongoDb } from '../client'

export const CANDLE_COLLECTION_NAME = 'market_candles_ts'
const CANDLE_QUERY_INDEX = 'idx_market_candles_source_time'

export interface MongoCandleDocument {
  time: Date
  meta: {
    symbol: string
    contractType: string
    timeframe: string
  }
  open: string
  high: string
  low: string
  close: string
  volume: string
  closeTime: Date
  timeSec: number
  openTimeSec: number
  closeTimeSec: number
  tradeCount?: number
  storedAt: Date
}

let candleInitPromise: Promise<void> | null = null

function toStoredNumber(value: number) {
  return Number.isFinite(value) ? String(value) : '0'
}

function toNumber(value: string | number | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function toDateFromSeconds(seconds: number) {
  return new Date(seconds * 1000)
}

function toCandleDocument(input: StoreClosedCandleInput): MongoCandleDocument {
  const openTimeSec = input.candle.time
  return {
    time: toDateFromSeconds(openTimeSec),
    meta: {
      symbol: input.symbol,
      contractType: input.contractType,
      timeframe: input.timeframe,
    },
    open: toStoredNumber(input.candle.open),
    high: toStoredNumber(input.candle.high),
    low: toStoredNumber(input.candle.low),
    close: toStoredNumber(input.candle.close),
    volume: toStoredNumber(input.candle.volume),
    closeTime: toDateFromSeconds(openTimeSec),
    timeSec: openTimeSec,
    openTimeSec,
    closeTimeSec: openTimeSec,
    tradeCount: input.candle.tradeCount ?? 0,
    storedAt: new Date(),
  }
}

export async function ensureCandleCollection(db: Db): Promise<Collection<MongoCandleDocument>> {
  if (!candleInitPromise) {
    candleInitPromise = (async () => {
      const collections = await db.listCollections({ name: CANDLE_COLLECTION_NAME }).toArray()
      if (collections.length === 0) {
        await db.createCollection(CANDLE_COLLECTION_NAME, {
          timeseries: {
            timeField: 'time',
            metaField: 'meta',
            granularity: 'minutes',
          },
        })
      }
      const collection = db.collection<MongoCandleDocument>(CANDLE_COLLECTION_NAME)
      await collection.createIndex(
        { 'meta.symbol': 1, 'meta.contractType': 1, 'meta.timeframe': 1, time: 1 },
        { name: CANDLE_QUERY_INDEX },
      )
    })()
  }
  await candleInitPromise
  return db.collection<MongoCandleDocument>(CANDLE_COLLECTION_NAME)
}

export async function storeMongoClosedCandles(inputs: StoreClosedCandleInput[]): Promise<number> {
  const validInputs = inputs.filter((input) => input.candle.isClosed !== false)
  if (validInputs.length === 0) return 0

  const db = await getMongoDb()
  const collection = await ensureCandleCollection(db)
  const docs = validInputs.map(toCandleDocument)
  const result = await collection.insertMany(docs, { ordered: false })
  return result.insertedCount
}

export async function getMongoCandles(
  symbol: string,
  contractType: string,
  timeframe: string,
  sinceUnixSeconds = 0,
  untilUnixSeconds = 0,
  limit = 1000,
): Promise<CandleRow[]> {
  const db = await getMongoDb()
  const collection = await ensureCandleCollection(db)
  const filter: Record<string, unknown> = {
    'meta.symbol': symbol,
    'meta.contractType': contractType,
    'meta.timeframe': timeframe,
  }

  if (sinceUnixSeconds > 0 && untilUnixSeconds > 0) {
    filter.time = { $gt: toDateFromSeconds(sinceUnixSeconds), $lte: toDateFromSeconds(untilUnixSeconds) }
  } else if (sinceUnixSeconds > 0) {
    filter.time = { $gt: toDateFromSeconds(sinceUnixSeconds) }
  } else if (untilUnixSeconds > 0) {
    filter.time = { $lte: toDateFromSeconds(untilUnixSeconds) }
  }

  const boundedLimit = Math.max(1, Math.min(limit, 50000))
  let docs: MongoCandleDocument[]

  if (sinceUnixSeconds <= 0) {
    const rawDocs = await collection.find(filter).sort({ time: -1 }).limit(boundedLimit).toArray()
    docs = rawDocs.reverse()
  } else {
    docs = await collection.find(filter).sort({ time: 1 }).limit(boundedLimit).toArray()
  }

  return docs.map((doc, idx) => ({
    id: idx + 1,
    symbol: doc.meta.symbol,
    timeframe: doc.meta.timeframe,
    open_time: doc.openTimeSec ?? doc.timeSec,
    open: toNumber(doc.open),
    high: toNumber(doc.high),
    low: toNumber(doc.low),
    close: toNumber(doc.close),
    volume: toNumber(doc.volume),
    trade_count: doc.tradeCount ?? 0,
    close_time: doc.closeTimeSec ?? doc.timeSec,
    stored_at: Math.floor((doc.storedAt ?? doc.time).getTime() / 1000),
  }))
}

export async function getMongoCandleCount(symbol: string, contractType: string, timeframe: string): Promise<number> {
  const db = await getMongoDb()
  const collection = await ensureCandleCollection(db)
  return collection.countDocuments({
    'meta.symbol': symbol,
    'meta.contractType': contractType,
    'meta.timeframe': timeframe,
  })
}
