# Turso Integration — Task 2 of 3
## Storage Integration Into Existing Feed and Engine

---

## Goal for This Task Only

Hook into the existing `FeedProvider` and `AggregationEngine` to capture data at the right moment and persist it to Turso. No new data pipelines — use what already exists. Storage happens as a side effect of the normal live feed flow. Verify rows appear in the database on candle close.

Task 1 must be complete before starting this.

---

## Where Storage Happens

The existing `FeedProvider` (`components/FeedProvider.tsx`) already:
- Receives candle callbacks from the Binance adapter
- Ingests trades into the `AggregationEngine`
- Knows when a candle closes (`candle.isClosed === true`)

This is the exact right place to add storage. When a candle closes, the `AggregationEngine` has the complete footprint for that candle. That is the moment to write to Turso.

No changes needed to:
- `BinanceAdapter`
- `AggregationEngine`
- Zustand store
- Any draw functions
- Any UI components

Only `FeedProvider.tsx` needs a new import and a few new lines in the existing candle callback.

---

## `lib/db/marketStorage.ts`

A thin orchestration module. Imports from `lib/db/database.ts` and the existing engine types. Exposes one main function that `FeedProvider` calls.

### `storeClosedCandle(symbol, timeframe, candle, engine, bucketSize)`

This is the only function `FeedProvider` needs to call. Everything else is internal to this module.

**Parameters:**
- `symbol` — e.g. `'BTCUSDT'`
- `timeframe` — e.g. `'1m'`
- `candle` — the `Candle` object from `types/feed.ts`
- `engine` — the `AggregationEngine` instance from `lib/aggregation/engine.ts`
- `bucketSize` — current bucket size from the Zustand store at the time of storage

**What it does — in order:**

1. Call `insertCandle(symbol, timeframe, candle)` — store OHLCV

2. Call `engine.getFootprintCandle(candle.time)` — get the completed footprint
   - If null: log a warning and skip footprint storage for this candle — do not throw

3. If footprint exists:
   - Call `insertFootprintBatch(symbol, timeframe, candle.time, footprintCandle.cells, bucketSize)`
   - Call `insertCandleDelta(symbol, timeframe, candle.time, footprintCandle.delta, totalBuyVol, totalSellVol)`
   - Compute `totalBuyVol` and `totalSellVol` from the cells map: iterate all cells, sum `askVol` into buy, `bidVol` into sell

4. Call `updateMeta('last_candle_stored', new Date().toISOString())`

5. Log: `[Storage] BTCUSDT 1m 12:34 stored — 42 cells, delta: +184.2`

**Error handling:**
Wrap the entire function in try/catch. If storage fails, log the error but do not throw. A database write failure must never crash the feed or affect the live chart. Storage is best-effort.

---

## Changes to `FeedProvider.tsx`

This is the only existing file that changes in this task.

### Add imports at top

```ts
import { storeClosedCandle } from '@/lib/db/marketStorage'
import { useChartStore } from '@/lib/store/chart'
```

### Add inside the component, reading from store

```ts
const bucketSize = useChartStore((s) => s.bucketSize)
```

### Modify the existing candle callback

Find the existing `feedAdapter.subscribeCandles(pair, timeframe, (candle) => {...})` call.

Inside the callback, after the existing `engine.ingestCandle(candle)` line, add:

```ts
if (candle.isClosed) {
  // Fire and forget — do not await, do not block the callback
  storeClosedCandle(pair, timeframe, candle, engine, bucketSize).catch(err => {
    console.error('[Storage] Failed to store candle:', err)
  })
}
```

**Why fire-and-forget:** The candle callback is synchronous in the feed flow. Awaiting a database write here would stall the next incoming message. Storage runs async in the background — the live chart is unaffected.

---

## Multi-Timeframe Storage

The existing `FeedProvider` subscribes to one pair and one timeframe at a time (controlled by `pair` and `timeframe` from the store). It re-subscribes when either changes.

This means storage naturally follows the same pattern — whatever the user is currently viewing gets stored. When the user switches from `1m` to `5m`, the feed re-subscribes to `5m` and storage switches to `5m`.

**For multi-timeframe collection** (storing 1m, 5m, and 15m simultaneously regardless of what the user is viewing): this requires running multiple feed subscriptions in parallel. This is a separate concern — do not implement it in this task. Start with single-timeframe storage matching the active view. Add multi-timeframe in a follow-up if needed.

---

## Server-Side Initialization

The database must be initialized before the first candle callback fires. In Next.js App Router, the right place for server-side startup initialization is `instrumentation.ts`.

### `instrumentation.ts` (create in project root)

This file is Next.js 14's official hook for server startup code. It runs once when the Node.js process starts, before any requests are handled.

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDatabase } = await import('./lib/db/database')
    await initDatabase()
    console.log('[DB] Database initialized on server startup')
  }
}
```

The `process.env.NEXT_RUNTIME === 'nodejs'` guard prevents this from running in the Edge runtime.

Enable instrumentation in `next.config.ts`:

```ts
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  }
}
```

---

## Important: Storage Only Runs Server-Side

`lib/db/marketStorage.ts` and `lib/db/database.ts` must only run on the server. The `@libsql/client` package and file system access are not available in the browser.

`FeedProvider` is a client component (`'use client'`). This means it cannot directly import server-side modules.

**Solution: use a Server Action or API route to proxy the storage call.**

Instead of importing `storeClosedCandle` directly in `FeedProvider`, call a Next.js Server Action:

**Create `lib/actions/storageActions.ts`:**

```ts
'use server'

import { storeClosedCandle } from '@/lib/db/marketStorage'
import type { Candle } from '@/types/feed'

export async function storeClosedCandleAction(
  symbol: string,
  timeframe: string,
  candle: Candle,
  cells: Array<{ bucketPrice: number, bidVol: number, askVol: number }>,
  delta: number,
  buyVol: number,
  sellVol: number,
  bucketSize: number
) {
  await storeClosedCandle(symbol, timeframe, candle, cells, delta, buyVol, sellVol, bucketSize)
}
```

Note: Server Actions cannot accept class instances like `AggregationEngine` across the server/client boundary. Instead, extract the data from the engine in `FeedProvider` first and pass serializable values.

**Update `storeClosedCandle` signature** to accept extracted data instead of the engine instance:

```ts
storeClosedCandle(
  symbol, timeframe, candle,
  cells,      // serialized from engine.getFootprintCandle().cells
  delta,
  buyVol,
  sellVol,
  bucketSize
)
```

**In FeedProvider**, extract before calling the action:

```ts
if (candle.isClosed && engine) {
  const fp = engine.getFootprintCandle(candle.time)
  if (fp) {
    const cells = Array.from(fp.cells.entries()).map(([price, cell]) => ({
      bucketPrice: price,
      bidVol: cell.bidVol,
      askVol: cell.askVol,
    }))
    let buyVol = 0, sellVol = 0
    fp.cells.forEach(c => { buyVol += c.askVol; sellVol += c.bidVol })

    storeClosedCandleAction(
      pair, timeframe, candle,
      cells, fp.delta, buyVol, sellVol, bucketSize
    ).catch(err => console.error('[Storage]', err))
  }
}
```

---

## How to Verify This Task is Done

Start the dev server: `pnpm dev`

Open the chart in the browser. Watch both the browser console and the terminal running Next.js.

After one minute (first 1m candle close):
- Terminal should show: `[Storage] BTCUSDT 1m HH:MM stored — N cells, delta: +/-X`
- No errors in either console

Query the database from terminal:
```bash
npx tsx -e "
const { createClient } = require('@libsql/client')
const db = createClient({ url: 'file:./data/market.db' })
db.execute('SELECT COUNT(*) as count FROM candles').then(r => console.log(r.rows))
"
```

Or use sqlite3 CLI directly: `sqlite3 data/market.db "SELECT * FROM candles ORDER BY open_time DESC LIMIT 3"`

Verify:
- Candle rows appear after each 1m close
- `footprint_cells` rows appear alongside them
- `candle_delta` has matching rows
- Changing timeframe to `5m` in the UI — next candle stored is a 5m candle
- Storage errors do not affect chart rendering — kill the DB file mid-session, chart continues working, errors log silently

Do not proceed to Task 3 until rows consistently appear on candle close.