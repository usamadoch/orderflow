import { createClient } from '@libsql/client'
import { mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const databaseUrl = process.env.TURSO_DATABASE_URL ?? 'file:./data/market.db'
export const localDatabasePath = databaseUrl.startsWith('file:')
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
  return new Promise((r) => setTimeout(r, ms))
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

export async function withDbWriteRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= DB_WRITE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      const shouldRetry = attempt < DB_WRITE_MAX_ATTEMPTS && isTransientDbWriteError(error)
      if (!shouldRetry) throw error
      console.warn(`[DB] ${label} failed (attempt ${attempt}/${DB_WRITE_MAX_ATTEMPTS}). Retrying in ${DB_WRITE_RETRY_DELAY_MS}ms...`, error)
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
            trade_count INTEGER DEFAULT 0,
            close_time  INTEGER NOT NULL,
            stored_at   INTEGER NOT NULL DEFAULT (unixepoch()),
            UNIQUE(symbol, timeframe, open_time)
          )
        `,
        args: [],
      },
      {
        sql: 'CREATE INDEX IF NOT EXISTS idx_candles_query ON candles(symbol, timeframe, open_time DESC)',
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
        sql: 'CREATE INDEX IF NOT EXISTS idx_footprint_query ON footprint_cells(symbol, contract_type, data_source_mode, timeframe, bucket_size, candle_time ASC)',
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
        sql: 'CREATE INDEX IF NOT EXISTS idx_raw_trades_query ON raw_trades(symbol, trade_time ASC)',
        args: [],
      },
      {
        sql: `
          CREATE TABLE IF NOT EXISTS fine_profile_rows (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol           TEXT    NOT NULL,
            contract_type    TEXT    NOT NULL,
            data_source_mode TEXT    NOT NULL,
            timeframe        TEXT    NOT NULL,
            candle_time      INTEGER NOT NULL,
            base_bucket_size REAL    NOT NULL,
            bucket_price     REAL    NOT NULL,
            bid_vol          REAL    NOT NULL DEFAULT 0,
            ask_vol          REAL    NOT NULL DEFAULT 0,
            total_vol        REAL    NOT NULL DEFAULT 0,
            trade_count      INTEGER NOT NULL DEFAULT 0,
            stored_at        INTEGER NOT NULL DEFAULT (unixepoch()),
            UNIQUE(symbol, contract_type, data_source_mode, timeframe, candle_time, base_bucket_size, bucket_price)
          )
        `,
        args: [],
      },
      {
        sql: 'CREATE INDEX IF NOT EXISTS idx_fine_profile_rows_query ON fine_profile_rows(symbol, contract_type, data_source_mode, timeframe, base_bucket_size, candle_time ASC)',
        args: [],
      },
      {
        sql: 'CREATE TABLE IF NOT EXISTS collector_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))',
        args: [],
      },
      {
        sql: "INSERT INTO collector_meta (key, value, updated_at) VALUES ('collector_started', ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
        args: [nowIso],
      },
      {
        sql: "INSERT OR IGNORE INTO collector_meta (key, value, updated_at) VALUES ('last_candle_stored', ?, unixepoch())",
        args: [nowIso],
      },
      {
        sql: "INSERT INTO collector_meta (key, value, updated_at) VALUES ('retention_hours', ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()",
        args: [String(DB_CONFIG.retentionHours)],
      },
    ],
    'write',
  )

  await ensureSourceScopedFootprintCellsSchema()
  await ensureSourceScopedFineProfileRowsSchema()
  await ensureCandleTradeCountColumn()
}

async function ensureCandleTradeCountColumn() {
  const tableInfo = await db.execute('PRAGMA table_info(candles)')
  if (tableInfo.rows.some((row) => row.name === 'trade_count')) return
  await db.execute('ALTER TABLE candles ADD COLUMN trade_count INTEGER DEFAULT 0')
}

async function ensureSourceScopedFootprintCellsSchema() {
  const tableInfo = await db.execute('PRAGMA table_info(footprint_cells)')
  const columnNames = new Set(tableInfo.rows.map((row) => String(row.name)))
  if (columnNames.has('contract_type') && columnNames.has('data_source_mode')) return

  console.warn('[DB] Migrating footprint_cells to source-scoped schema...')
  await db.batch(
    [
      { sql: 'DROP TABLE IF EXISTS footprint_cells_source_scoped', args: [] },
      {
        sql: `
          CREATE TABLE footprint_cells_source_scoped (
            id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, contract_type TEXT NOT NULL,
            data_source_mode TEXT NOT NULL, timeframe TEXT NOT NULL, candle_time INTEGER NOT NULL,
            bucket_price REAL NOT NULL, bucket_size REAL NOT NULL, bid_vol REAL NOT NULL DEFAULT 0,
            ask_vol REAL NOT NULL DEFAULT 0, delta REAL NOT NULL DEFAULT 0, stored_at INTEGER NOT NULL DEFAULT (unixepoch()),
            UNIQUE(symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size)
          )
        `,
        args: [],
      },
      {
        sql: "INSERT OR IGNORE INTO footprint_cells_source_scoped SELECT id, symbol, 'legacy', 'legacy', timeframe, candle_time, bucket_price, bucket_size, bid_vol, ask_vol, delta, stored_at FROM footprint_cells",
        args: [],
      },
      { sql: 'DROP TABLE footprint_cells', args: [] },
      { sql: 'ALTER TABLE footprint_cells_source_scoped RENAME TO footprint_cells', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_footprint_query ON footprint_cells(symbol, contract_type, data_source_mode, timeframe, bucket_size, candle_time ASC)', args: [] },
    ],
    'write',
  )
}

async function recreateFineProfileRowsQueryIndex() {
  await db.batch(
    [
      { sql: 'DROP INDEX IF EXISTS idx_fine_profile_rows_query', args: [] },
      { sql: 'CREATE INDEX idx_fine_profile_rows_query ON fine_profile_rows(symbol, contract_type, data_source_mode, timeframe, base_bucket_size, candle_time ASC)', args: [] },
    ],
    'write',
  )
}

async function ensureSourceScopedFineProfileRowsSchema() {
  const tableInfo = await db.execute('PRAGMA table_info(fine_profile_rows)')
  const columnNames = new Set(tableInfo.rows.map((row) => String(row.name)))

  if (columnNames.has('contract_type') && columnNames.has('data_source_mode')) {
    await recreateFineProfileRowsQueryIndex()
    return
  }

  console.warn('[DB] Migrating fine_profile_rows to source-scoped schema...')
  await db.batch(
    [
      { sql: 'DROP TABLE IF EXISTS fine_profile_rows_source_scoped', args: [] },
      {
        sql: `
          CREATE TABLE fine_profile_rows_source_scoped (
            id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, contract_type TEXT NOT NULL,
            data_source_mode TEXT NOT NULL, timeframe TEXT NOT NULL, candle_time INTEGER NOT NULL,
            base_bucket_size REAL NOT NULL, bucket_price REAL NOT NULL, bid_vol REAL NOT NULL DEFAULT 0,
            ask_vol REAL NOT NULL DEFAULT 0, total_vol REAL NOT NULL DEFAULT 0, trade_count INTEGER NOT NULL DEFAULT 0,
            stored_at INTEGER NOT NULL DEFAULT (unixepoch()),
            UNIQUE(symbol, contract_type, data_source_mode, timeframe, candle_time, base_bucket_size, bucket_price)
          )
        `,
        args: [],
      },
      {
        sql: "INSERT OR IGNORE INTO fine_profile_rows_source_scoped SELECT id, symbol, 'legacy', 'legacy', timeframe, candle_time, base_bucket_size, bucket_price, bid_vol, ask_vol, total_vol, trade_count, stored_at FROM fine_profile_rows",
        args: [],
      },
      { sql: 'DROP TABLE fine_profile_rows', args: [] },
      { sql: 'ALTER TABLE fine_profile_rows_source_scoped RENAME TO fine_profile_rows', args: [] },
      { sql: 'CREATE INDEX IF NOT EXISTS idx_fine_profile_rows_query ON fine_profile_rows(symbol, contract_type, data_source_mode, timeframe, base_bucket_size, candle_time ASC)', args: [] },
    ],
    'write',
  )
}

export async function getCollectorMeta() {
  const result = await db.execute('SELECT key, value, updated_at FROM collector_meta')
  return result.rows.reduce<Record<string, string>>((meta, row) => {
    meta[String(row.key)] = String(row.value)
    return meta
  }, {})
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
    sql: 'INSERT INTO collector_meta (key, value, updated_at) VALUES (?, ?, unixepoch()) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = unixepoch()',
    args: [key, value],
  })
}

export async function deleteOldData(retentionHours = DB_CONFIG.retentionHours) {
  const cutoff = Math.floor(Date.now() / 1000) - retentionHours * 3600
  const results = await db.batch(
    [
      { sql: 'DELETE FROM candles WHERE open_time < ?', args: [cutoff] },
      { sql: 'DELETE FROM footprint_cells WHERE candle_time < ?', args: [cutoff] },
      { sql: 'DELETE FROM candle_delta WHERE candle_time < ?', args: [cutoff] },
      { sql: 'DELETE FROM raw_trades WHERE trade_time < ?', args: [cutoff * 1000] },
      { sql: 'DELETE FROM fine_profile_rows WHERE candle_time < ?', args: [cutoff] },
    ],
    'write',
  )
  return results.reduce((total, result) => total + Number(result.rowsAffected ?? 0), 0)
}
