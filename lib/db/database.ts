import { createClient } from '@libsql/client'
import { mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Candle } from '../../types/candle'
import type { FootprintCell } from '../../types/footprint'
import type { Trade } from '../../types/trade'

const databaseUrl = process.env.TURSO_DATABASE_URL ?? 'file:./data/market.db'
const localDatabasePath = databaseUrl.startsWith('file:')
  ? databaseUrl.slice('file:'.length)
  : null

export const DB_CONFIG = {
  retentionHours: Number(process.env.DB_RETENTION_HOURS ?? '48'),
  cleanupIntervalMinutes: 30,
  maxCandlesPerQuery: 1000,
  maxTradesPerQuery: 50000,
}

function ensureLocalDatabaseDirectory() {
  if (!databaseUrl.startsWith('file:')) return

  const dbDir = dirname(localDatabasePath!)

  if (dbDir && dbDir !== '.') {
    mkdirSync(dbDir, { recursive: true })
  }
}

ensureLocalDatabaseDirectory()

export const db = createClient({
  url: databaseUrl,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

export interface CandleRow {
  id: number
  symbol: string
  timeframe: string
  open_time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  close_time: number
  stored_at: number
}

export interface FootprintCellRow {
  id: number
  symbol: string
  contract_type: string
  data_source_mode: string
  timeframe: string
  candle_time: number
  bucket_price: number
  bucket_size: number
  bid_vol: number
  ask_vol: number
  delta: number
  stored_at: number
}

export type CandleInsertInput = Pick<Candle, 'open' | 'high' | 'low' | 'close' | 'volume'> & {
  time?: number
  open_time?: number
  close_time?: number
  isClosed?: boolean
}

export interface RawTradeRow {
  id: number
  symbol: string
  aggregate_trade_id: number
  trade_time: number
  price: number
  quantity: number
  is_buyer_maker: number
  stored_at: number
}

export interface FineProfileRow {
  id: number
  symbol: string
  timeframe: string
  candle_time: number
  base_bucket_size: number
  bucket_price: number
  bid_vol: number
  ask_vol: number
  total_vol: number
  trade_count: number
  stored_at: number
}

export interface FootprintCellWriteInput {
  bucketPrice: number
  bidVol: number
  askVol: number
}

export interface FineProfileRowWriteInput {
  candleTime: number
  baseBucketSize: number
  bucketPrice: number
  bidVol: number
  askVol: number
  totalVol: number
  tradeCount: number
}

export type RawTradeWriteInput = Trade

export interface ClosedCandleSnapshotInput {
  symbol: string
  contractType: string
  dataSourceMode: string
  timeframe: string
  candle: CandleInsertInput
  cells: FootprintCellWriteInput[]
  delta: number
  buyVol: number
  sellVol: number
  bucketSize: number
  storedAtIso?: string
}

export interface FootprintSnapshotInput {
  symbol: string
  contractType: string
  dataSourceMode: string
  timeframe: string
  candleTime: number
  cells: FootprintCellWriteInput[]
  bucketSize: number
}

export type RawTradeOrder = 'asc' | 'desc'

export interface RawTradeQueryOptions {
  limit?: number
  order?: RawTradeOrder
  cursorTimeMs?: number
  cursorTradeId?: number
}

const TRANSIENT_DB_ERROR_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
])

const DB_WRITE_MAX_ATTEMPTS = 2
const DB_WRITE_RETRY_DELAY_MS = 300

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isTransientDbWriteError(error: unknown) {
  const seen = new Set<object>()
  let current: unknown = error

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)

    const code = 'code' in current ? String(current.code ?? '') : ''
    const message = 'message' in current ? String(current.message ?? '').toLowerCase() : ''

    if (TRANSIENT_DB_ERROR_CODES.has(code)) return true

    if (
      message.includes('fetch failed')
      || message.includes('timed out')
      || message.includes('timeout')
      || message.includes('socket hang up')
      || message.includes('connection reset')
    ) {
      return true
    }

    current = 'cause' in current ? current.cause : null
  }

  return false
}

async function withDbWriteRetry<T>(label: string, operation: () => Promise<T>) {
  let lastError: unknown

  for (let attempt = 1; attempt <= DB_WRITE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      const shouldRetry = attempt < DB_WRITE_MAX_ATTEMPTS && isTransientDbWriteError(error)

      if (!shouldRetry) {
        throw error
      }

      console.warn(
        `[DB] ${label} failed (attempt ${attempt}/${DB_WRITE_MAX_ATTEMPTS}). Retrying in ${DB_WRITE_RETRY_DELAY_MS}ms...`,
        error,
      )
      await delay(DB_WRITE_RETRY_DELAY_MS)
    }
  }

  throw lastError
}

export async function initDatabase() {
  const nowIso = new Date().toISOString()

  await db.batch(
    [
      {
        sql: `
          CREATE TABLE IF NOT EXISTS candles (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol      TEXT    NOT NULL,
            timeframe   TEXT    NOT NULL,
            open_time   INTEGER NOT NULL,
            open        REAL    NOT NULL,
            high        REAL    NOT NULL,
            low         REAL    NOT NULL,
            close       REAL    NOT NULL,
            volume      REAL    NOT NULL,
            close_time  INTEGER NOT NULL,
            stored_at   INTEGER NOT NULL DEFAULT (unixepoch()),

            UNIQUE(symbol, timeframe, open_time)
          )
        `,
        args: [],
      },
      {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_candles_query
            ON candles(symbol, timeframe, open_time DESC)
        `,
        args: [],
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS footprint_cells (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol           TEXT    NOT NULL,
            contract_type    TEXT    NOT NULL,
            data_source_mode TEXT    NOT NULL,
            timeframe        TEXT    NOT NULL,
            candle_time      INTEGER NOT NULL,
            bucket_price     REAL    NOT NULL,
            bucket_size      REAL    NOT NULL,
            bid_vol          REAL    NOT NULL DEFAULT 0,
            ask_vol          REAL    NOT NULL DEFAULT 0,
            delta            REAL    NOT NULL DEFAULT 0,
            stored_at        INTEGER NOT NULL DEFAULT (unixepoch()),

            UNIQUE(symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size)
          )
        `,
        args: [],
      },
      {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_footprint_query
            ON footprint_cells(symbol, contract_type, data_source_mode, timeframe, bucket_size, candle_time ASC)
        `,
        args: [],
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS candle_delta (
            symbol       TEXT    NOT NULL,
            timeframe    TEXT    NOT NULL,
            candle_time  INTEGER NOT NULL,
            total_delta  REAL    NOT NULL,
            buy_vol      REAL    NOT NULL,
            sell_vol     REAL    NOT NULL,
            stored_at    INTEGER NOT NULL DEFAULT (unixepoch()),

            PRIMARY KEY(symbol, timeframe, candle_time)
          )
        `,
        args: [],
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS raw_trades (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol             TEXT    NOT NULL,
            aggregate_trade_id INTEGER NOT NULL,
            trade_time         INTEGER NOT NULL,
            price              REAL    NOT NULL,
            quantity           REAL    NOT NULL,
            is_buyer_maker     INTEGER NOT NULL,
            stored_at          INTEGER NOT NULL DEFAULT (unixepoch()),

            UNIQUE(symbol, aggregate_trade_id)
          )
        `,
        args: [],
      },
      {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_raw_trades_query
            ON raw_trades(symbol, trade_time ASC)
        `,
        args: [],
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS fine_profile_rows (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol           TEXT    NOT NULL,
            timeframe        TEXT    NOT NULL,
            candle_time      INTEGER NOT NULL,
            base_bucket_size REAL    NOT NULL,
            bucket_price     REAL    NOT NULL,
            bid_vol          REAL    NOT NULL DEFAULT 0,
            ask_vol          REAL    NOT NULL DEFAULT 0,
            total_vol        REAL    NOT NULL DEFAULT 0,
            trade_count      INTEGER NOT NULL DEFAULT 0,
            stored_at        INTEGER NOT NULL DEFAULT (unixepoch()),

            UNIQUE(symbol, timeframe, candle_time, base_bucket_size, bucket_price)
          )
        `,
        args: [],
      },
      {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_fine_profile_rows_query
            ON fine_profile_rows(symbol, timeframe, base_bucket_size, candle_time ASC)
        `,
        args: [],
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS collector_meta (
            key        TEXT PRIMARY KEY,
            value      TEXT NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
          )
        `,
        args: [],
      },
      {
        sql: `
          INSERT INTO collector_meta (key, value, updated_at)
          VALUES ('collector_started', ?, unixepoch())
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = unixepoch()
        `,
        args: [nowIso],
      },
      {
        sql: `
          INSERT OR IGNORE INTO collector_meta (key, value, updated_at)
          VALUES ('last_candle_stored', ?, unixepoch())
        `,
        args: [nowIso],
      },
      {
        sql: `
          INSERT INTO collector_meta (key, value, updated_at)
          VALUES ('retention_hours', ?, unixepoch())
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = unixepoch()
        `,
        args: [String(DB_CONFIG.retentionHours)],
      },
    ],
    'write',
  )

  await ensureSourceScopedFootprintCellsSchema()
}

async function ensureSourceScopedFootprintCellsSchema() {
  const tableInfo = await db.execute('PRAGMA table_info(footprint_cells)')
  const columnNames = new Set(tableInfo.rows.map((row) => String(row.name)))

  if (columnNames.has('contract_type') && columnNames.has('data_source_mode')) {
    return
  }

  console.warn('[DB] Migrating footprint_cells to source-scoped schema; legacy rows will be isolated under legacy/legacy source keys.')

  await db.batch(
    [
      {
        sql: 'DROP TABLE IF EXISTS footprint_cells_source_scoped',
        args: [],
      },
      {
        sql: `
          CREATE TABLE footprint_cells_source_scoped (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol           TEXT    NOT NULL,
            contract_type    TEXT    NOT NULL,
            data_source_mode TEXT    NOT NULL,
            timeframe        TEXT    NOT NULL,
            candle_time      INTEGER NOT NULL,
            bucket_price     REAL    NOT NULL,
            bucket_size      REAL    NOT NULL,
            bid_vol          REAL    NOT NULL DEFAULT 0,
            ask_vol          REAL    NOT NULL DEFAULT 0,
            delta            REAL    NOT NULL DEFAULT 0,
            stored_at        INTEGER NOT NULL DEFAULT (unixepoch()),

            UNIQUE(symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size)
          )
        `,
        args: [],
      },
      {
        sql: `
          INSERT OR IGNORE INTO footprint_cells_source_scoped (
            id, symbol, contract_type, data_source_mode, timeframe, candle_time,
            bucket_price, bucket_size, bid_vol, ask_vol, delta, stored_at
          )
          SELECT
            id, symbol, 'legacy', 'legacy', timeframe, candle_time,
            bucket_price, bucket_size, bid_vol, ask_vol, delta, stored_at
          FROM footprint_cells
        `,
        args: [],
      },
      {
        sql: 'DROP TABLE footprint_cells',
        args: [],
      },
      {
        sql: 'ALTER TABLE footprint_cells_source_scoped RENAME TO footprint_cells',
        args: [],
      },
      {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_footprint_query
            ON footprint_cells(symbol, contract_type, data_source_mode, timeframe, bucket_size, candle_time ASC)
        `,
        args: [],
      },
    ],
    'write',
  )
}

export async function insertCandle(symbol: string, timeframe: string, candle: CandleInsertInput) {
  if (candle.isClosed === false) return

  const openTime = candle.open_time ?? candle.time

  if (openTime == null) {
    throw new Error('insertCandle requires candle.open_time or candle.time')
  }

  await db.execute({
    sql: `
      INSERT OR REPLACE INTO candles (
        symbol, timeframe, open_time, open, high, low, close, volume, close_time
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      symbol,
      timeframe,
      openTime,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.close_time ?? openTime,
    ],
  })
}

export async function insertFootprintBatch(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  candleTime: number,
  cells: Map<number, FootprintCell>,
  bucketSize: number,
) {
  if (cells.size === 0) return

  await db.batch(
    Array.from(cells.entries()).map(([bucketPrice, cell]) => ({
      sql: `
        INSERT OR REPLACE INTO footprint_cells (
          symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size, bid_vol, ask_vol, delta
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        symbol,
        contractType,
        dataSourceMode,
        timeframe,
        candleTime,
        bucketPrice,
        bucketSize,
        cell.bidVol,
        cell.askVol,
        cell.askVol - cell.bidVol,
      ],
    })),
    'write',
  )
}

export async function persistClosedCandleSnapshot({
  symbol,
  contractType,
  dataSourceMode,
  timeframe,
  candle,
  cells,
  delta,
  buyVol,
  sellVol,
  bucketSize,
  storedAtIso = new Date().toISOString(),
}: ClosedCandleSnapshotInput) {
  if (candle.isClosed === false) return

  const openTime = candle.open_time ?? candle.time

  if (openTime == null) {
    throw new Error('persistClosedCandleSnapshot requires candle.open_time or candle.time')
  }

  const statements: Array<{ sql: string; args: Array<string | number> }> = [
    {
      sql: `
        INSERT OR REPLACE INTO candles (
          symbol, timeframe, open_time, open, high, low, close, volume, close_time
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        symbol,
        timeframe,
        openTime,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
        candle.close_time ?? openTime,
      ],
    },
  ]

  if (cells.length > 0) {
    statements.push(
      ...cells.map((cell) => ({
        sql: `
          INSERT OR REPLACE INTO footprint_cells (
            symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size, bid_vol, ask_vol, delta
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          symbol,
          contractType,
          dataSourceMode,
          timeframe,
          openTime,
          cell.bucketPrice,
          bucketSize,
          cell.bidVol,
          cell.askVol,
          cell.askVol - cell.bidVol,
        ],
      })),
    )

    statements.push({
      sql: `
        INSERT OR REPLACE INTO candle_delta (
          symbol, timeframe, candle_time, total_delta, buy_vol, sell_vol
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      args: [symbol, timeframe, openTime, delta, buyVol, sellVol],
    })
  }

  statements.push({
    sql: `
      INSERT INTO collector_meta (key, value, updated_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = unixepoch()
    `,
    args: ['last_candle_stored', storedAtIso],
  })

  await withDbWriteRetry('Closed candle snapshot write', async () => {
    await db.batch(statements, 'write')
  })
}

export async function persistFootprintSnapshot({
  symbol,
  contractType,
  dataSourceMode,
  timeframe,
  candleTime,
  cells,
  bucketSize,
}: FootprintSnapshotInput) {
  if (cells.length === 0) return

  await withDbWriteRetry('Footprint snapshot write', async () => {
    await db.batch(
      cells.map((cell) => ({
        sql: `
          INSERT OR REPLACE INTO footprint_cells (
            symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size, bid_vol, ask_vol, delta
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          symbol,
          contractType,
          dataSourceMode,
          timeframe,
          candleTime,
          cell.bucketPrice,
          bucketSize,
          cell.bidVol,
          cell.askVol,
          cell.askVol - cell.bidVol,
        ],
      })),
      'write',
    )
  })
}

export async function insertRawTradeBatch(symbol: string, trades: RawTradeWriteInput[]) {
  const rows = trades.filter((trade) => Number.isFinite(trade.id))
  if (rows.length === 0) return

  await withDbWriteRetry('Raw trade batch write', async () => {
    await db.batch(
      rows.map((trade) => ({
        sql: `
          INSERT OR IGNORE INTO raw_trades (
            symbol, aggregate_trade_id, trade_time, price, quantity, is_buyer_maker
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        args: [
          symbol,
          trade.id!,
          trade.time,
          trade.price,
          trade.quantity,
          trade.isBuyerMaker ? 1 : 0,
        ],
      })),
      'write',
    )
  })
}

export async function insertFineProfileRows(
  symbol: string,
  timeframe: string,
  rows: FineProfileRowWriteInput[],
) {
  const storableRows = rows.filter((row) =>
    Number.isFinite(row.candleTime)
    && row.baseBucketSize > 0
    && Number.isFinite(row.bucketPrice)
    && row.totalVol > 0
    && row.tradeCount > 0,
  )
  if (storableRows.length === 0) return

  await withDbWriteRetry('Fine profile row batch write', async () => {
    await db.batch(
      storableRows.map((row) => ({
        sql: `
          INSERT OR REPLACE INTO fine_profile_rows (
            symbol, timeframe, candle_time, base_bucket_size, bucket_price,
            bid_vol, ask_vol, total_vol, trade_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          symbol,
          timeframe,
          row.candleTime,
          row.baseBucketSize,
          row.bucketPrice,
          row.bidVol,
          row.askVol,
          row.totalVol,
          row.tradeCount,
        ],
      })),
      'write',
    )
  })
}

export async function insertCandleDelta(
  symbol: string,
  timeframe: string,
  candleTime: number,
  delta: number,
  buyVol: number,
  sellVol: number,
) {
  await db.execute({
    sql: `
      INSERT OR REPLACE INTO candle_delta (
        symbol, timeframe, candle_time, total_delta, buy_vol, sell_vol
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    args: [symbol, timeframe, candleTime, delta, buyVol, sellVol],
  })
}

export async function deleteOldData(retentionHours = DB_CONFIG.retentionHours) {
  const cutoff = Math.floor(Date.now() / 1000) - retentionHours * 3600

  const results = await db.batch(
    [
      {
        sql: 'DELETE FROM candles WHERE open_time < ?',
        args: [cutoff],
      },
      {
        sql: 'DELETE FROM footprint_cells WHERE candle_time < ?',
        args: [cutoff],
      },
      {
        sql: 'DELETE FROM candle_delta WHERE candle_time < ?',
        args: [cutoff],
      },
      {
        sql: 'DELETE FROM raw_trades WHERE trade_time < ?',
        args: [cutoff * 1000],
      },
      {
        sql: 'DELETE FROM fine_profile_rows WHERE candle_time < ?',
        args: [cutoff],
      },
    ],
    'write',
  )

  return results.reduce((total, result) => total + Number(result.rowsAffected ?? 0), 0)
}

export async function getRawTrades(
  symbol: string,
  startTimeMs: number,
  endTimeMs: number,
  options: number | RawTradeQueryOptions = DB_CONFIG.maxTradesPerQuery,
) {
  const queryOptions: RawTradeQueryOptions = typeof options === 'number'
    ? { limit: options }
    : options
  const limit = queryOptions.limit ?? DB_CONFIG.maxTradesPerQuery
  const order: RawTradeOrder = queryOptions.order === 'desc' ? 'desc' : 'asc'
  const boundedLimit = Math.max(1, Math.min(limit, DB_CONFIG.maxTradesPerQuery))
  const direction = order === 'desc' ? 'DESC' : 'ASC'
  const cursorTimeMs = queryOptions.cursorTimeMs
  const cursorTradeId = queryOptions.cursorTradeId
  const hasCursor = Number.isFinite(cursorTimeMs) && Number.isFinite(cursorTradeId)
  const cursorFilter = hasCursor
    ? order === 'desc'
      ? 'AND (trade_time < ? OR (trade_time = ? AND aggregate_trade_id < ?))'
      : 'AND (trade_time > ? OR (trade_time = ? AND aggregate_trade_id > ?))'
    : ''
  const args: Array<string | number> = [symbol, startTimeMs, endTimeMs]

  if (hasCursor) {
    args.push(cursorTimeMs!, cursorTimeMs!, cursorTradeId!)
  }

  args.push(boundedLimit)

  const result = await db.execute({
    sql: `
      SELECT *
      FROM raw_trades
      WHERE symbol = ? AND trade_time >= ? AND trade_time < ?
      ${cursorFilter}
      ORDER BY trade_time ${direction}, aggregate_trade_id ${direction}
      LIMIT ?
    `,
    args,
  })

  return result.rows as unknown as RawTradeRow[]
}

export async function getFootprintCellsForRange(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  bucketSize: number,
) {
  const result = await db.execute({
    sql: `
      SELECT *
      FROM footprint_cells
      WHERE symbol = ?
        AND contract_type = ?
        AND data_source_mode = ?
        AND timeframe = ?
        AND candle_time >= ?
        AND candle_time < ?
        AND bucket_size = ?
      ORDER BY candle_time ASC, bucket_price ASC
    `,
    args: [symbol, contractType, dataSourceMode, timeframe, startTime, endTime, bucketSize],
  })

  return result.rows as unknown as FootprintCellRow[]
}

export async function getFineProfileRows(
  symbol: string,
  timeframe: string,
  startTime: number,
  endTime: number,
  baseBucketSize: number,
) {
  const result = await db.execute({
    sql: `
      SELECT *
      FROM fine_profile_rows
      WHERE symbol = ?
        AND timeframe = ?
        AND candle_time >= ?
        AND candle_time < ?
        AND base_bucket_size = ?
      ORDER BY candle_time ASC, bucket_price ASC
    `,
    args: [symbol, timeframe, startTime, endTime, baseBucketSize],
  })

  return result.rows as unknown as FineProfileRow[]
}

export async function getCandles(
  symbol: string,
  timeframe: string,
  sinceUnixSeconds = 0,
  limit = DB_CONFIG.maxCandlesPerQuery,
) {
  const boundedLimit = Math.max(1, Math.min(limit, DB_CONFIG.maxCandlesPerQuery))

  if (sinceUnixSeconds <= 0) {
    const result = await db.execute({
      sql: `
        SELECT *
        FROM (
          SELECT *
          FROM candles
          WHERE symbol = ? AND timeframe = ?
          ORDER BY open_time DESC
          LIMIT ?
        )
        ORDER BY open_time ASC
      `,
      args: [symbol, timeframe, boundedLimit],
    })

    return result.rows as unknown as CandleRow[]
  }

  const result = await db.execute({
    sql: `
      SELECT *
      FROM candles
      WHERE symbol = ? AND timeframe = ? AND open_time > ?
      ORDER BY open_time ASC
      LIMIT ?
    `,
    args: [symbol, timeframe, sinceUnixSeconds, boundedLimit],
  })

  return result.rows as unknown as CandleRow[]
}

export async function getFootprintCells(
  symbol: string,
  contractType: string,
  dataSourceMode: string,
  timeframe: string,
  candleTime: number,
  bucketSize?: number,
) {
  const bucketFilter = bucketSize == null ? '' : 'AND bucket_size = ?'
  const args = bucketSize == null
    ? [symbol, contractType, dataSourceMode, timeframe, candleTime]
    : [symbol, contractType, dataSourceMode, timeframe, candleTime, bucketSize]

  const result = await db.execute({
    sql: `
      SELECT *
      FROM footprint_cells
      WHERE symbol = ?
        AND contract_type = ?
        AND data_source_mode = ?
        AND timeframe = ?
        AND candle_time = ?
      ${bucketFilter}
      ORDER BY bucket_price ASC
    `,
    args,
  })

  return result.rows as unknown as FootprintCellRow[]
}

export async function getCollectorMeta() {
  const result = await db.execute('SELECT key, value, updated_at FROM collector_meta')

  return result.rows.reduce<Record<string, string>>((meta, row) => {
    meta[String(row.key)] = String(row.value)
    return meta
  }, {})
}

export async function getCandleCount(symbol: string, timeframe: string) {
  const result = await db.execute({
    sql: 'SELECT COUNT(*) AS count FROM candles WHERE symbol = ? AND timeframe = ?',
    args: [symbol, timeframe],
  })

  return Number(result.rows[0]?.count ?? 0)
}

export function getDatabaseSizeMb() {
  if (!localDatabasePath) return null

  try {
    const stats = statSync(resolve(localDatabasePath))
    return Math.round((stats.size / 1024 / 1024) * 10) / 10
  } catch {
    return 0
  }
}

export async function updateMeta(key: string, value: string) {
  await db.execute({
    sql: `
      INSERT INTO collector_meta (key, value, updated_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = unixepoch()
    `,
    args: [key, value],
  })
}
