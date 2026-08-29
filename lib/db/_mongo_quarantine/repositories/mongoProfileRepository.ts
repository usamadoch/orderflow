import type { Collection, Db } from 'mongodb'
import type { FineProfileRow } from '../../database'
import type { StoreFineProfileRowsInput } from '../../storageAdapter'
import { getMongoDb } from '../client'

export const PROFILE_COLLECTION_NAME = 'profile_rows_ts'
const PROFILE_QUERY_INDEX = 'idx_profile_rows_source_time_price'

export interface MongoProfileRowDocument {
  time: Date
  meta: {
    symbol: string
    contractType: string
    dataSourceMode: string
    timeframe: string
    baseBucketSizeKey: string
  }
  candleTimeSec: number
  baseBucketSize: string
  bucketPrice: string
  bucketPriceKey: string
  bidVol: string
  askVol: string
  totalVol: string
  tradeCount: number
  storedAt: Date
}

let profileInitPromise: Promise<void> | null = null

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

function toNumberKey(value: number) {
  if (!Number.isFinite(value)) return '0'
  const fixed = value.toFixed(12).replace(/\.?0+$/, '')
  return fixed === '-0' || fixed === '' ? '0' : fixed
}

function toProfileRowDocuments(input: StoreFineProfileRowsInput): MongoProfileRowDocument[] {
  return input.rows.map((row) => {
    const time = toDateFromSeconds(row.candleTime)
    const baseBucketSizeKey = toNumberKey(row.baseBucketSize)
    const meta = {
      symbol: input.symbol,
      contractType: input.contractType,
      dataSourceMode: input.dataSourceMode,
      timeframe: input.timeframe,
      baseBucketSizeKey,
    }
    return {
      time,
      meta,
      candleTimeSec: row.candleTime,
      baseBucketSize: toStoredNumber(row.baseBucketSize),
      bucketPrice: toStoredNumber(row.bucketPrice),
      bucketPriceKey: toNumberKey(row.bucketPrice),
      bidVol: toStoredNumber(row.bidVol),
      askVol: toStoredNumber(row.askVol),
      totalVol: toStoredNumber(row.totalVol),
      tradeCount: row.tradeCount,
      storedAt: new Date(),
    }
  })
}

export async function ensureProfileCollection(db: Db): Promise<Collection<MongoProfileRowDocument>> {
  if (!profileInitPromise) {
    profileInitPromise = (async () => {
      const collections = await db.listCollections({ name: PROFILE_COLLECTION_NAME }).toArray()
      if (collections.length === 0) {
        await db.createCollection(PROFILE_COLLECTION_NAME, {
          timeseries: {
            timeField: 'time',
            metaField: 'meta',
            granularity: 'minutes',
          },
        })
      }
      const collection = db.collection<MongoProfileRowDocument>(PROFILE_COLLECTION_NAME)
      await collection.createIndex(
        { 'meta.symbol': 1, 'meta.contractType': 1, 'meta.dataSourceMode': 1, 'meta.timeframe': 1, 'meta.baseBucketSizeKey': 1, time: 1, bucketPriceKey: 1 },
        { name: PROFILE_QUERY_INDEX },
      )
    })()
  }
  await profileInitPromise
  return db.collection<MongoProfileRowDocument>(PROFILE_COLLECTION_NAME)
}

export async function storeMongoFineProfileRows(inputs: StoreFineProfileRowsInput[]): Promise<number> {
  const validInputs = inputs.filter((input) => input.rows.length > 0)
  if (validInputs.length === 0) return 0

  const db = await getMongoDb()
  const collection = await ensureProfileCollection(db)
  const docs = validInputs.flatMap(toProfileRowDocuments)
  if (docs.length === 0) return 0

  const result = await collection.insertMany(docs, { ordered: false })
  return result.insertedCount
}

export async function getMongoFineProfileRows(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  baseBucketSize: number,
): Promise<FineProfileRow[]> {
  const db = await getMongoDb()
  const collection = await ensureProfileCollection(db)
  const docs = await collection
    .find({
      'meta.symbol': symbol,
      'meta.contractType': contractType,
      'meta.dataSourceMode': dataSourceMode,
      'meta.timeframe': timeframe,
      'meta.baseBucketSizeKey': toNumberKey(baseBucketSize),
      time: { $gte: toDateFromSeconds(startTime), $lt: toDateFromSeconds(endTime) },
    })
    .sort({ time: 1, bucketPriceKey: 1 })
    .toArray()

  return docs.map((doc, idx) => ({
    id: idx + 1,
    symbol: doc.meta.symbol,
    contract_type: doc.meta.contractType,
    data_source_mode: doc.meta.dataSourceMode,
    timeframe: doc.meta.timeframe,
    candle_time: doc.candleTimeSec,
    base_bucket_size: toNumber(doc.baseBucketSize),
    bucket_price: toNumber(doc.bucketPrice),
    bid_vol: toNumber(doc.bidVol),
    ask_vol: toNumber(doc.askVol),
    total_vol: toNumber(doc.totalVol),
    trade_count: doc.tradeCount,
    stored_at: Math.floor((doc.storedAt ?? doc.time).getTime() / 1000),
  }))
}
