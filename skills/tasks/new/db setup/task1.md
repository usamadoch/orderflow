# Turso Integration — Task 1 of 3
## Database Setup, Schema, and Client

---

## Goal for This Task Only

Install the Turso/libSQL client. Create the database module. Define all tables and indexes. Verify the database initializes correctly on startup. No storage logic yet — just the foundation.

---

## Why Turso / libSQL

Turso uses libSQL — a fork of SQLite. On the Pi it runs as a local embedded database (just a file, same as SQLite). The advantage over plain SQLite: if you later want to sync to Turso's cloud for remote access or backup, you change one config line. Same driver, same schema, same queries.

For now it runs fully local on the Pi — no cloud account needed to start.

---

## Install

```bash
pnpm add @libsql/client
```

No other database packages needed. `@libsql/client` handles local file mode and remote Turso cloud mode with the same API.

---

## Environment Variables

Add to `.env.local`:

```
# Local mode (Pi) — just a file path
TURSO_DATABASE_URL=file:./data/market.db

# Remote mode (optional, Turso cloud) — replace when ready
# TURSO_DATABASE_URL=libsql://your-db.turso.io
# TURSO_AUTH_TOKEN=your-token-here
```

The `file:` prefix tells the client to use embedded local mode. The `data/` directory will be created automatically.

---

## `lib/db/database.ts`

The single database module. Exports the client instance and all schema initialization.

### Client creation

Create the client once as a module-level singleton. Do not create a new client per request.

```ts
import { createClient } from '@libsql/client'

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,   // undefined in local mode — fine
})
```

### `initDatabase()`

Runs all `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` statements. Called once on server startup. Safe to call multiple times — idempotent.

Use `db.batch()` to run all DDL statements in one round trip.

---

## Schema

### Table: `candles`

Stores closed OHLCV candles. One row per symbol per timeframe per candle.

```sql
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
```

```sql
CREATE INDEX IF NOT EXISTS idx_candles_query
  ON candles(symbol, timeframe, open_time DESC)
```

---

### Table: `footprint_cells`

Stores per-bucket bid/ask volumes per closed candle. The bucket size used at storage time is also recorded — important because the website's bucket size is dynamic and can change.

```sql
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
```

```sql
CREATE INDEX IF NOT EXISTS idx_footprint_query
  ON footprint_cells(symbol, timeframe, candle_time DESC)
```

Storing `bucket_size` per row matters here: the existing app has dynamic bucket sizing (auto-adjust based on timeframe and settings). When the website queries historical footprint, it must match on the same bucket size that was active when the data was stored.

---

### Table: `candle_delta`

Per-candle aggregate summary. Avoids summing all cells every time the sidebar or signal engine needs session totals.

```sql
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
```

---

### Table: `collector_meta`

Tracks collector health — when data was last stored, how many rows exist, whether the collector is running. Used by a future health dashboard or status indicator.

```sql
CREATE TABLE IF NOT EXISTS collector_meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
)
```

Initial rows inserted on startup:
- `('collector_started', '<ISO timestamp>')`
- `('last_candle_stored', '<ISO timestamp>')`
- `('retention_hours', '<value from config>')`

---

## Retention Config

Add to `lib/db/database.ts` or import from the existing store config:

```ts
export const DB_CONFIG = {
  retentionHours: Number(process.env.DB_RETENTION_HOURS ?? '48'),
  cleanupIntervalMinutes: 30,
  maxCandlesPerQuery: 1000,
}
```

Add to `.env.local`:
```
DB_RETENTION_HOURS=48
```

---

## Helper Query Functions

Also export these from `lib/db/database.ts` — the storage module in Task 2 imports them.

**`insertCandle(symbol, timeframe, candle)`**
- `INSERT OR REPLACE INTO candles ...`
- Only called when `candle.isClosed === true`

**`insertFootprintBatch(symbol, timeframe, candleTime, cells, bucketSize)`**
- `cells` is `Map<number, { bidVol: number, askVol: number }>` — same type as `FootprintCandle.cells`
- Use `db.batch()` to insert all cells in one transaction
- `INSERT OR REPLACE` per cell

**`insertCandleDelta(symbol, timeframe, candleTime, delta, buyVol, sellVol)`**
- `INSERT OR REPLACE INTO candle_delta ...`

**`deleteOldData(retentionHours)`**
- Computes `cutoff = Math.floor(Date.now() / 1000) - retentionHours * 3600`
- Deletes from all three data tables where `open_time < cutoff` or `candle_time < cutoff`
- Returns total deleted count

**`getCandles(symbol, timeframe, sinceUnixSeconds, limit)`**
- `SELECT * FROM candles WHERE symbol = ? AND timeframe = ? AND open_time > ? ORDER BY open_time ASC LIMIT ?`
- Used by the website's API routes to serve historical data

**`getFootprintCells(symbol, timeframe, candleTime)`**
- Returns all cells for a specific candle
- `SELECT * FROM footprint_cells WHERE symbol = ? AND timeframe = ? AND candle_time = ?`

**`updateMeta(key, value)`**
- Updates a row in `collector_meta`

---

## How to Verify This Task is Done

Create a temporary test script `scripts/testDb.ts` (or `.js`):

```ts
import { db, initDatabase } from '../lib/db/database'

async function test() {
  await initDatabase()
  console.log('Tables created')

  // Insert a test candle
  await insertCandle('BTCUSDT', '1m', {
    open_time: 1700000000,
    open: 40000, high: 40100, low: 39900, close: 40050,
    volume: 12.5, close_time: 1700000059
  })

  // Query it back
  const rows = await getCandles('BTCUSDT', '1m', 1699999999, 10)
  console.log('Candles:', rows)
}

test()
```

Run with `npx tsx scripts/testDb.ts`.

Verify:
- `data/market.db` file created
- No errors thrown
- Test candle returned by query
- Run a second time — no duplicate, `INSERT OR REPLACE` handled it silently

Do not proceed to Task 2 until `initDatabase()` runs cleanly and the test candle round-trips correctly.