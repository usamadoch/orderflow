import { MongoClient, type Collection, type Db } from 'mongodb'
import type { BubbleEventContractType, BubbleEventSide } from '../../../../types/bubble'

export const AGGREGATE_BUBBLE_COLLECTION = 'aggregate_bubble_events'
const UNIQUE_INDEX_NAME = 'uniq_aggregate_bubbles_source_id'
const RESTORE_INDEX_NAME = 'idx_aggregate_bubbles_restore'

type QualifiedBy = 'volume' | 'tradeCount'

export interface AggregateBubbleThresholds {
  minVolume: number
  minTradeCount: number
  minTradeCountVolume: number
}

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
  qualifiedBy: QualifiedBy[]
  minVolumeAtIngest: number
  minTradeCountAtIngest: number
}

export interface AggregateBubbleEventDocument {
  symbol: string
  contractType: BubbleEventContractType
  aggregateTradeId: number
  eventTime: Date
  eventTimeMs: number
  price: string
  side: BubbleEventSide
  volume: string
  tradeCount: number
  firstTradeId: number
  lastTradeId: number
  createdAt: Date
  storageVersion: 1
  qualifiedBy: QualifiedBy[]
  minVolumeAtIngest: string
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

interface GlobalAggregateBubbleMongoState {
  clientPromise?: Promise<MongoClient>
  uri?: string
}

declare global {
  // eslint-disable-next-line no-var
  var __orderflowAggregateBubbleMongo: GlobalAggregateBubbleMongoState | undefined
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for aggregate bubble persistence`)
  return value
}

function getBubbleMongoUri() {
  return getRequiredEnv('BUBBLES_MONGODB_URI')
}

function getBubbleMongoDbName() {
  return getRequiredEnv('BUBBLES_MONGODB_DB_NAME')
}

function toStoredNumber(value: number) {
  return Number.isFinite(value) ? String(value) : '0'
}

function toNumber(value: string | number | undefined) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function toDocument(input: AggregateBubbleEventWriteInput): AggregateBubbleEventDocument {
  return {
    symbol: input.symbol,
    contractType: input.contractType,
    aggregateTradeId: Math.floor(input.aggregateTradeId),
    eventTime: new Date(input.eventTimeMs),
    eventTimeMs: input.eventTimeMs,
    price: toStoredNumber(input.price),
    side: input.side,
    volume: toStoredNumber(input.volume),
    tradeCount: Math.max(1, Math.floor(input.tradeCount)),
    firstTradeId: Math.floor(input.firstTradeId),
    lastTradeId: Math.floor(input.lastTradeId),
    createdAt: new Date(),
    storageVersion: 1,
    qualifiedBy: input.qualifiedBy,
    minVolumeAtIngest: toStoredNumber(input.minVolumeAtIngest),
    minTradeCountAtIngest: Math.floor(input.minTradeCountAtIngest),
  }
}

export async function getAggregateBubbleMongoClient(): Promise<MongoClient> {
  const uri = getBubbleMongoUri()
  const state = globalThis.__orderflowAggregateBubbleMongo ?? {}

  if (!state.clientPromise || state.uri !== uri) {
    const client = new MongoClient(uri, { appName: 'orderflow-aggregate-bubbles' })
    state.uri = uri
    state.clientPromise = client.connect()
    globalThis.__orderflowAggregateBubbleMongo = state
  }
  return state.clientPromise
}

export async function getAggregateBubbleMongoDb(): Promise<Db> {
  const client = await getAggregateBubbleMongoClient()
  return client.db(getBubbleMongoDbName())
}

export async function ensureAggregateBubbleCollection(): Promise<Collection<AggregateBubbleEventDocument>> {
  const db = await getAggregateBubbleMongoDb()
  const collection = db.collection<AggregateBubbleEventDocument>(AGGREGATE_BUBBLE_COLLECTION)

  await collection.createIndex(
    { symbol: 1, aggregateTradeId: 1 },
    { name: UNIQUE_INDEX_NAME, unique: true },
  )
  await collection.createIndex(
    { symbol: 1, contractType: 1, eventTime: 1, aggregateTradeId: 1 },
    { name: RESTORE_INDEX_NAME },
  )
  return collection
}

export async function storeAggregateBubbleEvents(
  inputs: AggregateBubbleEventWriteInput[],
): Promise<StoreAggregateBubbleEventsResult> {
  if (inputs.length === 0) return { inserted: 0, duplicatesSkipped: 0 }

  const collection = await ensureAggregateBubbleCollection()
  const docs = inputs.map(toDocument)

  try {
    const result = await collection.insertMany(docs, { ordered: false })
    return { inserted: result.insertedCount, duplicatesSkipped: inputs.length - result.insertedCount }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'insertedCount' in error) {
      const inserted = Number((error as { insertedCount?: number }).insertedCount ?? 0)
      return { inserted, duplicatesSkipped: inputs.length - inserted }
    }
    throw error
  }
}

export async function getAggregateBubbleEvents({
  symbol,
  contractTypes,
  startTime,
  endTime,
  limit = 5000,
}: GetAggregateBubbleEventsInput) {
  const collection = await ensureAggregateBubbleCollection()
  const boundedLimit = Math.max(1, Math.min(limit, 10000))
  const startMs = startTime < 10_000_000_000 ? startTime * 1000 : startTime
  const endMs = endTime < 10_000_000_000 ? endTime * 1000 : endTime

  const filter = {
    symbol,
    contractType: { $in: contractTypes },
    eventTime: { $gte: new Date(startMs), $lte: new Date(endMs) },
  }

  const docs = await collection
    .find(filter)
    .sort({ eventTime: 1, aggregateTradeId: 1 })
    .limit(boundedLimit)
    .toArray()

  return docs.map((doc) => ({
    id: doc.aggregateTradeId,
    symbol: doc.symbol,
    contractType: doc.contractType,
    time: doc.eventTimeMs ?? doc.eventTime.getTime(),
    price: toNumber(doc.price),
    side: doc.side,
    volume: toNumber(doc.volume),
    tradeCount: doc.tradeCount,
    firstTradeId: doc.firstTradeId,
    lastTradeId: doc.lastTradeId,
    qualifiedBy: doc.qualifiedBy,
  }))
}
