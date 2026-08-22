import type { Collection, Db } from 'mongodb'
import type { FootprintCellRow } from '../../database'
import type { StoreBaseFootprintInput } from '../../storageAdapter'
import { getMongoDb } from '../client'

export const FOOTPRINT_COLLECTION_NAME = 'footprint_cells_ts'
const FOOTPRINT_QUERY_INDEX = 'idx_footprint_cells_source_time_price'

export interface MongoFootprintDocument {
  time: Date
  meta: {
    symbol: string
    contractType: string
    dataSourceMode: string
    timeframe: string
    bucketSize: number
  }
  candleTimeSec: number
  bucketPrice: string
  bucketPriceKey: string
  bidVol: string
  askVol: string
  totalVol: string
  delta: string
  storedAt: Date
}

let footprintInitPromise: Promise<void> | null = null

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

function toFootprintDocuments(input: StoreBaseFootprintInput): MongoFootprintDocument[] {
  const time = toDateFromSeconds(input.candleTime)
  const meta = {
    symbol: input.symbol,
    contractType: input.contractType,
    dataSourceMode: input.dataSourceMode,
    timeframe: '1m',
    bucketSize: 5,
  }

  return input.cells.map((cell) => {
    const bidVol = cell.bidVol
    const askVol = cell.askVol
    const totalVol = bidVol + askVol
    const delta = askVol - bidVol
    return {
      time,
      meta,
      candleTimeSec: input.candleTime,
      bucketPrice: toStoredNumber(cell.bucketPrice),
      bucketPriceKey: toNumberKey(cell.bucketPrice),
      bidVol: toStoredNumber(bidVol),
      askVol: toStoredNumber(askVol),
      totalVol: toStoredNumber(totalVol),
      delta: toStoredNumber(delta),
      storedAt: new Date(),
    }
  })
}

export async function ensureFootprintCollection(db: Db): Promise<Collection<MongoFootprintDocument>> {
  if (!footprintInitPromise) {
    footprintInitPromise = (async () => {
      const collections = await db.listCollections({ name: FOOTPRINT_COLLECTION_NAME }).toArray()
      if (collections.length === 0) {
        await db.createCollection(FOOTPRINT_COLLECTION_NAME, {
          timeseries: {
            timeField: 'time',
            metaField: 'meta',
            granularity: 'minutes',
          },
        })
      }
      const collection = db.collection<MongoFootprintDocument>(FOOTPRINT_COLLECTION_NAME)
      await collection.createIndex(
        { 'meta.symbol': 1, 'meta.contractType': 1, 'meta.dataSourceMode': 1, 'meta.timeframe': 1, 'meta.bucketSize': 1, time: 1, bucketPriceKey: 1 },
        { name: FOOTPRINT_QUERY_INDEX },
      )
    })()
  }
  await footprintInitPromise
  return db.collection<MongoFootprintDocument>(FOOTPRINT_COLLECTION_NAME)
}

export async function storeMongoBaseFootprints(inputs: StoreBaseFootprintInput[]): Promise<number> {
  const validInputs = inputs.filter((input) => input.cells.length > 0)
  if (validInputs.length === 0) return 0

  const db = await getMongoDb()
  const collection = await ensureFootprintCollection(db)
  const docs = validInputs.flatMap(toFootprintDocuments)
  if (docs.length === 0) return 0

  const result = await collection.insertMany(docs, { ordered: false })
  return result.insertedCount
}

export async function getMongoFootprintCellsForRange(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  bucketSize: number,
): Promise<FootprintCellRow[]> {
  const db = await getMongoDb()
  const collection = await ensureFootprintCollection(db)
  const docs = await collection
    .find({
      'meta.symbol': symbol,
      'meta.contractType': contractType,
      'meta.dataSourceMode': dataSourceMode,
      'meta.timeframe': timeframe,
      'meta.bucketSize': bucketSize,
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
    bucket_price: toNumber(doc.bucketPrice),
    bucket_size: doc.meta.bucketSize,
    bid_vol: toNumber(doc.bidVol),
    ask_vol: toNumber(doc.askVol),
    delta: toNumber(doc.delta),
    stored_at: Math.floor((doc.storedAt ?? doc.time).getTime() / 1000),
  }))
}
