import {
  AGGREGATE_BUBBLE_COLLECTION,
  ensureAggregateBubbleCollection,
  getAggregateBubbleEvents,
  getAggregateBubbleMongoClient,
  getAggregateBubbleMongoDb,
  storeAggregateBubbleEvents,
} from './mongo/repositories/mongoBubbleRepository'
import type {
  AggregateBubbleEventDocument,
  AggregateBubbleEventWriteInput,
  AggregateBubbleThresholds,
  GetAggregateBubbleEventsInput,
  StoreAggregateBubbleEventsResult,
} from './mongo/repositories/mongoBubbleRepository'

export {
  AGGREGATE_BUBBLE_COLLECTION,
  ensureAggregateBubbleCollection,
  getAggregateBubbleEvents,
  getAggregateBubbleMongoClient,
  getAggregateBubbleMongoDb,
  storeAggregateBubbleEvents,
}

export type {
  AggregateBubbleEventDocument,
  AggregateBubbleEventWriteInput,
  AggregateBubbleThresholds,
  GetAggregateBubbleEventsInput,
  StoreAggregateBubbleEventsResult,
}

export const DEFAULT_AGGREGATE_BUBBLE_RESTORE_LIMIT = 5000
export const MAX_AGGREGATE_BUBBLE_RESTORE_LIMIT = 10000
export const MAX_AGGREGATE_BUBBLE_RESTORE_RANGE_SECONDS = 6 * 60 * 60


function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  return Math.floor(getPositiveNumberEnv(name, fallback))
}

export function getAggregateBubbleThresholds(): AggregateBubbleThresholds {
  return {
    minVolume: getPositiveNumberEnv('COLLECTOR_AGG_BUBBLE_MIN_VOLUME_BTC', 15),
    minTradeCount: getPositiveIntegerEnv('COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT', 75),
    minTradeCountVolume: getPositiveNumberEnv('COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC', 3),
  }
}
