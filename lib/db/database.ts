import { createClient } from '@libsql/client'
import { mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { Candle } from '../../types/candle'
import type { FootprintCell } from '../../types/footprint'

const databaseUrl = process.env.TURSO_DATABASE_URL ?? 'file:./data/market.db'
const localDatabasePath = databaseUrl.startsWith('file:')
  ? databaseUrl.slice('file:'.length)
  : null

export const DB_CONFIG = {
  retentionHours: Number(process.env.DB_RETENTION_HOURS ?? '48'),
  cleanupIntervalMinutes: 30,
  maxCandlesPerQuery: 1000,
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

export interface FootprintCellWriteInput {
  bucketPrice: number
  bidVol: number
  askVol: number
}

export interface ClosedCandleSnapshotInput {
  symbol: string
  timeframe: string
  candle: CandleInsertInput
  cells: FootprintCellWriteInput[]
  delta: number
  buyVol: number
  sellVol: number
  bucketSize: number
  storedAtIso?: string
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
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol       TEXT    NOT NULL,
            timeframe    TEXT    NOT NULL,
            candle_time  INTEGER NOT NULL,
            bucket_price REAL    NOT NULL,
            bucket_size  REAL    NOT NULL,
            bid_vol      REAL    NOT NULL DEFAULT 0,
            ask_vol      REAL    NOT NULL DEFAULT 0,
            delta        REAL    NOT NULL DEFAULT 0,
            stored_at    INTEGER NOT NULL DEFAULT (unixepoch()),

            UNIQUE(symbol, timeframe, candle_time, bucket_price, bucket_size)
          )
        `,
        args: [],
      },
      {
        sql: `
          CREATE INDEX IF NOT EXISTS idx_footprint_query
            ON footprint_cells(symbol, timeframe, candle_time DESC)
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
          symbol, timeframe, candle_time, bucket_price, bucket_size, bid_vol, ask_vol, delta
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        symbol,
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
            symbol, timeframe, candle_time, bucket_price, bucket_size, bid_vol, ask_vol, delta
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          symbol,
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
    ],
    'write',
  )

  return results.reduce((total, result) => total + Number(result.rowsAffected ?? 0), 0)
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
  timeframe: string,
  candleTime: number,
  bucketSize?: number,
) {
  const bucketFilter = bucketSize == null ? '' : 'AND bucket_size = ?'
  const args = bucketSize == null
    ? [symbol, timeframe, candleTime]
    : [symbol, timeframe, candleTime, bucketSize]

  const result = await db.execute({
    sql: `
      SELECT *
      FROM footprint_cells
      WHERE symbol = ? AND timeframe = ? AND candle_time = ?
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
