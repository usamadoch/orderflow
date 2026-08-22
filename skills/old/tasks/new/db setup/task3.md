# Turso Integration — Task 3 of 3
## Cleanup Job, API Routes, and Pi Deployment

---

## Goal for This Task Only

Add automatic data retention cleanup. Expose API routes so the frontend can query historical data from the database. Deploy the whole website as a persistent 24/7 process on the Pi using pm2. Verify the full end-to-end flow including cleanup and Pi reboot survival.

Tasks 1 and 2 must be complete before starting this.

---

## `lib/db/cleanupJob.ts`

Manages automatic deletion of old data. Runs on a timer inside the server process.

### `startCleanupJob()`

Starts a recurring interval that calls `deleteOldData` from `database.ts`.

- Interval: every `DB_CONFIG.cleanupIntervalMinutes` minutes (default 30)
- Also runs once immediately on startup — handles leftover data if the Pi was offline and came back with stale rows

```ts
export function startCleanupJob() {
  const runCleanup = async () => {
    try {
      const deleted = await deleteOldData(DB_CONFIG.retentionHours)
      if (deleted > 0) {
        console.log(`[Cleanup] Removed ${deleted} rows older than ${DB_CONFIG.retentionHours}h`)
      }
    } catch (err) {
      console.error('[Cleanup] Failed:', err)
    }
  }

  // Run immediately on start
  runCleanup()

  // Then on interval
  setInterval(runCleanup, DB_CONFIG.cleanupIntervalMinutes * 60 * 1000)

  console.log(`[Cleanup] Job started — runs every ${DB_CONFIG.cleanupIntervalMinutes}m, retention: ${DB_CONFIG.retentionHours}h`)
}
```

### Wire into `instrumentation.ts`

Update the existing `instrumentation.ts` from Task 2 to also start the cleanup job:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initDatabase } = await import('./lib/db/database')
    const { startCleanupJob } = await import('./lib/db/cleanupJob')
    await initDatabase()
    startCleanupJob()
    console.log('[DB] Database initialized, cleanup job started')
  }
}
```

---

## API Routes for Historical Data

The frontend currently fetches live data from Binance. When the Pi has historical stored data, the frontend should use it to pre-populate the chart on load — no more waiting for candles to trickle in.

### `app/api/history/candles/route.ts`

```
GET /api/history/candles?symbol=BTCUSDT&timeframe=1m&since=1700000000&limit=500
```

Returns the most recent N candles from the database.

Handler:
- Reads query params
- Validates `symbol` is in the allowed list (from config)
- Calls `getCandles(symbol, timeframe, since, limit)`
- Returns JSON array of candle objects

Response shape matches the `Candle` type already used by the frontend — `{ time, open, high, low, close, volume, isClosed: true }`.

Map `open_time` from the database → `time` field. All stored candles are closed so `isClosed: true` always.

### `app/api/history/footprint/route.ts`

```
GET /api/history/footprint?symbol=BTCUSDT&timeframe=1m&candleTime=1700000000&bucketSize=25
```

Returns all footprint cells for a specific candle.

Handler:
- Reads `candleTime` and `bucketSize` from query
- Calls `getFootprintCells(symbol, timeframe, candleTime, bucketSize)` — add `bucketSize` filter to this query in `database.ts`
- Returns array of `{ bucketPrice, bidVol, askVol, delta }`

### `app/api/history/status/route.ts`

```
GET /api/history/status
```

Returns collector health info:

```json
{
  "candleCounts": {
    "BTCUSDT_1m": 1440,
    "BTCUSDT_5m": 288,
    "ETHUSDT_1m": 1438
  },
  "lastStored": "2024-01-15T12:34:00Z",
  "retentionHours": 48,
  "dbSizeMb": 18.4
}
```

Reads from `collector_meta` table and calls `getCandleCount` per pair/timeframe. Useful for a small status indicator in the UI.

---

## Frontend: Load Historical Data on Connect

Update `FeedProvider.tsx` to fetch stored candles on connect before starting the live feed.

In the existing `useEffect` that subscribes to the feed, add a history fetch at the start:

```ts
useEffect(() => {
  // 1. Fetch stored history first
  fetch(`/api/history/candles?symbol=${pair}&timeframe=${timeframe}&limit=500`)
    .then(r => r.json())
    .then(historicalCandles => {
      if (historicalCandles.length > 0) {
        pushAllCandles(historicalCandles)   // existing store action from Phase 8
        console.log(`[History] Loaded ${historicalCandles.length} stored candles`)
      }
    })
    .catch(err => console.warn('[History] Could not load stored candles:', err))

  // 2. Then start live feed as normal
  setConnected(false)
  feedAdapter.disconnect()
  // ... rest of existing subscription logic unchanged
}, [pair, timeframe])
```

The history fetch is fire-and-forget relative to the feed subscription — both start simultaneously. Historical candles populate the chart immediately. Live candles append as they arrive. The `pushCandle` logic already handles deduplication (same `time` = replace in place).

---

## Suggested File Structure (Final)

```
lib/
├── db/
│   ├── database.ts        — client, schema, query helpers
│   ├── marketStorage.ts   — orchestrates storage per candle close
│   └── cleanupJob.ts      — retention timer

lib/actions/
└── storageActions.ts      — Server Action wrapper for client-side calls

app/api/history/
├── candles/route.ts       — GET historical candles
├── footprint/route.ts     — GET footprint cells for a candle
└── status/route.ts        — GET collector health

instrumentation.ts         — startup hook (project root)

data/
└── market.db              — created automatically, add to .gitignore
```

Add `data/` to `.gitignore`:
```
# Database
data/
```

---

## Pi Deployment

### Install pm2 globally on the Pi

```bash
npm install -g pm2
```

### Build the Next.js app

```bash
pnpm build
```

### Start with pm2

```bash
pm2 start "pnpm start" --name orderflow-app
```

Using `pnpm start` runs the production Next.js server. This is important — `pnpm dev` is not stable for 24/7 Pi operation. Always deploy the built production version.

### Enable startup on Pi reboot

```bash
pm2 save
pm2 startup
```

Run the command that `pm2 startup` prints. It looks like:
```
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u pi --hp /home/pi
```

Copy and run that exact output — it differs per Pi user and Node.js installation. This is the step most people skip and then wonder why pm2 doesn't restart after reboot.

### Rebuild and restart after code changes

```bash
pnpm build && pm2 restart orderflow-app
```

### Useful pm2 commands

```bash
pm2 status                         # is it running?
pm2 logs orderflow-app             # tail live logs
pm2 logs orderflow-app --lines 500 # recent history
pm2 restart orderflow-app          # after code change
pm2 monit                          # CPU/RAM live monitor
```

---

## Pi Resource Considerations

**RAM:** Next.js production build uses ~150–200MB. The database client adds negligible overhead. Pi 3B (1GB RAM) or Pi 4 is fine. Pi Zero 2W (512MB) is tight but workable.

**CPU:** Idle between candle closes. Spikes briefly on candle close (storage write + cleanup if running). Not a concern on any Pi model with a heat sink.

**SD Card writes:** The cleanup job prevents unbounded growth. At 48h retention with 2 pairs and 3 timeframes, daily writes are roughly 5–15MB. Well within SD card endurance. If concerned, point `DB_PATH` to a USB drive instead.

**Network:** Two WebSocket connections to Binance. Keep-alive, minimal bandwidth. Stable on any Pi with ethernet. WiFi is fine but ethernet preferred for 24/7 operation.

---

## Environment Variables Summary

Final `.env.local` for Pi production:

```
# Database
TURSO_DATABASE_URL=file:./data/market.db
DB_RETENTION_HOURS=48

# Optional: Turso cloud sync (future)
# TURSO_DATABASE_URL=libsql://your-db.turso.io
# TURSO_AUTH_TOKEN=your-token-here

# Next.js
NODE_ENV=production
```

---
