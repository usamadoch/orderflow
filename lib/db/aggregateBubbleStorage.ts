import { MongoClient, type Collection, type Db } from 'mongodb'
import type { BubbleEventContractType, BubbleEventSide } from '../../types/bubble'

export const AGGREGATE_BUBBLE_COLLECTION = 'aggregate_bubble_events'
export const DEFAULT_AGGREGATE_BUBBLE_RESTORE_LIMIT = 5000
export const MAX_AGGREGATE_BUBBLE_RESTORE_LIMIT = 10000
export const MAX_AGGREGATE_BUBBLE_RESTORE_RANGE_SECONDS = 6 * 60 * 60

const DEFAULT_RETENTION_DAYS = 7
const UNIQUE_INDEX_NAME = 'uniq_aggregate_bubbles_source_id'
const RESTORE_INDEX_NAME = 'idx_aggregate_bubbles_restore'
const TTL_INDEX_NAME = 'ttl_aggregate_bubbles_event_time'
const RESTORE_INDEX_SPEC = { symbol: 1, contractType: 1, eventTime: 1, aggregateTradeId: 1 } as const

type QualifiedBy = 'volume' | 'tradeCount'

interface GlobalAggregateBubbleMongoState {
  clientPromise?: Promise<MongoClient>
  uri?: string
}

declare global {
  // eslint-disable-next-line no-var
  var __orderflowAggregateBubbleMongo: GlobalAggregateBubbleMongoState | undefined
}

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

interface MongoIndexInfo {
  name?: string
  key?: unknown
  unique?: boolean
  originalSpec?: {
    key?: unknown
  }
}

export interface StoreAggregateBubbleEventsResult {
  inserted: number
  duplicatesSkipped: number
}

function getRequiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required for aggregate bubble persistence`)
  }
  return value
}

function getBubbleMongoUri() {
  return getRequiredEnv('BUBBLES_MONGODB_URI')
}

function getBubbleMongoDbName() {
  return getRequiredEnv('BUBBLES_MONGODB_DB_NAME')
}

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  return Math.floor(getPositiveNumberEnv(name, fallback))
}

function getRetentionSeconds() {
  const days = getPositiveNumberEnv('MARKET_DATA_RETENTION_DAYS', DEFAULT_RETENTION_DAYS)
  return Math.floor(days * 24 * 60 * 60)
}

export function getAggregateBubbleThresholds(): AggregateBubbleThresholds {
  return {
    minVolume: getPositiveNumberEnv('COLLECTOR_AGG_BUBBLE_MIN_VOLUME_BTC', 15),
    minTradeCount: getPositiveIntegerEnv('COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT', 75),
    minTradeCountVolume: getPositiveNumberEnv('COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC', 3),
  }
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
    minTradeCountAtIngest: Math.max(1, Math.floor(input.minTradeCountAtIngest)),
  }
}

function getComparableIndexKey(index: MongoIndexInfo) {
  return index.originalSpec?.key ?? index.key
}

export function toAggregateBubbleEvent(document: AggregateBubbleEventDocument) {
  return {
    time: document.eventTimeMs,
    price: toNumber(document.price),
    side: document.side,
    volume: toNumber(document.volume),
    tradeCount: document.tradeCount,
    source: 'aggregateTrade' as const,
    symbol: document.symbol,
    contractType: document.contractType,
    aggregateTradeId: document.aggregateTradeId,
    firstTradeId: document.firstTradeId,
    lastTradeId: document.lastTradeId,
    origin: 'restored' as const,
  }
}

async function getAggregateBubbleMongoClient() {
  const uri = getBubbleMongoUri()
  const globalState = globalThis.__orderflowAggregateBubbleMongo ?? {}

  if (!globalState.clientPromise || globalState.uri !== uri) {
    const client = new MongoClient(uri)
    globalState.clientPromise = client.connect()
    globalState.uri = uri
    globalThis.__orderflowAggregateBubbleMongo = globalState
  }

  return globalState.clientPromise
}

export async function getAggregateBubbleMongoDb(): Promise<Db> {
  const client = await getAggregateBubbleMongoClient()
  return client.db(getBubbleMongoDbName())
}

async function ensureTtlIndex(collection: Collection<AggregateBubbleEventDocument>) {
  const retentionSeconds = getRetentionSeconds()
  const indexes = await collection.indexes()
  const existing = indexes.find((index) => index.name === TTL_INDEX_NAME)

  if (existing && existing.expireAfterSeconds !== retentionSeconds) {
    await collection.dropIndex(TTL_INDEX_NAME)
  }

  await collection.createIndex(
    { eventTime: 1 },
    { expireAfterSeconds: retentionSeconds, name: TTL_INDEX_NAME },
  )
}

async function ensureAggregateBubbleRestoreIndex(collection: Collection<AggregateBubbleEventDocument>) {
  const indexes = await collection.indexes() as MongoIndexInfo[]
  const existing = indexes.find((index) => index.name === RESTORE_INDEX_NAME)

  if (existing && JSON.stringify(getComparableIndexKey(existing)) === JSON.stringify(RESTORE_INDEX_SPEC)) {
    return
  }

  if (existing) {
    await collection.dropIndex(RESTORE_INDEX_NAME)
  }

  await collection.createIndex(
    RESTORE_INDEX_SPEC,
    { name: RESTORE_INDEX_NAME, background: true },
  )
}

async function ensureAggregateBubbleUniqueIndex(collection: Collection<AggregateBubbleEventDocument>) {
  const key = { symbol: 1, contractType: 1, aggregateTradeId: 1 } as const
  const indexes = await collection.indexes() as MongoIndexInfo[]
  const existing = indexes.find((index) => index.name === UNIQUE_INDEX_NAME)

  if (
    existing
    && JSON.stringify(getComparableIndexKey(existing)) === JSON.stringify(key)
    && existing.unique === true
  ) {
    return
  }

  if (existing) {
    await collection.dropIndex(UNIQUE_INDEX_NAME)
  }

  await collection.createIndex(
    key,
    { unique: true, name: UNIQUE_INDEX_NAME, background: true },
  )
}

async function ensureAggregateBubbleCollection() {
  const db = await getAggregateBubbleMongoDb()
  const existing = await db.listCollections({ name: AGGREGATE_BUBBLE_COLLECTION }).toArray()

  if (existing.length === 0) {
    await db.createCollection(AGGREGATE_BUBBLE_COLLECTION)
  } else if (existing[0].type === 'timeseries') {
    throw new Error(`${AGGREGATE_BUBBLE_COLLECTION} must be a regular MongoDB collection for aggregate trade id deduplication`)
  }

  const collection = db.collection<AggregateBubbleEventDocument>(AGGREGATE_BUBBLE_COLLECTION)

  await ensureAggregateBubbleUniqueIndex(collection)
  await ensureAggregateBubbleRestoreIndex(collection)
  await ensureTtlIndex(collection)

  return collection
}

function getDuplicateKeyCount(error: unknown) {
  const maybeBulkError = error as {
    writeErrors?: Array<{ code?: number }>
    result?: { insertedCount?: number }
    insertedCount?: number
  }
  const writeErrors = Array.isArray(maybeBulkError.writeErrors)
    ? maybeBulkError.writeErrors
    : []

  return {
    duplicateCount: writeErrors.filter((writeError) => writeError.code === 11000).length,
    writeErrorCount: writeErrors.length,
    insertedCount: Number(maybeBulkError.result?.insertedCount ?? maybeBulkError.insertedCount ?? 0),
  }
}

export async function storeAggregateBubbleEvents(
  events: AggregateBubbleEventWriteInput[],
): Promise<StoreAggregateBubbleEventsResult> {
  const documents = events
    .filter((event) => (
      event.symbol
      && (event.contractType === 'spot' || event.contractType === 'futures')
      && Number.isFinite(event.aggregateTradeId)
      && Number.isFinite(event.eventTimeMs)
      && Number.isFinite(event.price)
      && Number.isFinite(event.volume)
      && event.volume > 0
      && (event.side === 'buy' || event.side === 'sell')
      && Number.isFinite(event.tradeCount)
      && Number.isFinite(event.firstTradeId)
      && Number.isFinite(event.lastTradeId)
    ))
    .map(toDocument)

  if (documents.length === 0) {
    return { inserted: 0, duplicatesSkipped: 0 }
  }

  const collection = await ensureAggregateBubbleCollection()

  try {
    const result = await collection.insertMany(documents, { ordered: false })
    return {
      inserted: result.insertedCount,
      duplicatesSkipped: 0,
    }
  } catch (error) {
    const { duplicateCount, writeErrorCount, insertedCount } = getDuplicateKeyCount(error)
    if (writeErrorCount > 0 && duplicateCount === writeErrorCount) {
      return {
        inserted: insertedCount,
        duplicatesSkipped: duplicateCount,
      }
    }
    throw error
  }
}

export async function getAggregateBubbleEvents({
  symbol,
  contractTypes,
  startTime,
  endTime,
  limit = DEFAULT_AGGREGATE_BUBBLE_RESTORE_LIMIT,
}: GetAggregateBubbleEventsInput) {
  const collection = await ensureAggregateBubbleCollection()
  const boundedLimit = Math.max(1, Math.min(MAX_AGGREGATE_BUBBLE_RESTORE_LIMIT, Math.floor(limit)))

  // By executing a separate query for each contractType, we turn the `$in` query 
  // into exact equality matches for both `symbol` and `contractType`. This allows 
  // MongoDB to perfectly use the index for the `{ eventTime: -1, aggregateTradeId: -1 }` sort
  // without needing any in-memory sorting (which fails on Atlas Shared tiers).
  const queries = contractTypes.map(contractType =>
    collection
      .find({
        symbol,
        contractType,
        eventTime: {
          $gte: new Date(startTime),
          $lt: new Date(endTime),
        },
      })
      .sort({ eventTime: -1, aggregateTradeId: -1 })
      .limit(boundedLimit)
      .toArray()
  )

  const results = await Promise.all(queries)
  const rows = results
    .flat()
    .sort((a, b) => b.eventTime.getTime() - a.eventTime.getTime() || b.aggregateTradeId - a.aggregateTradeId)
    .slice(0, boundedLimit)

  return rows.map(toAggregateBubbleEvent).reverse()
}
