# Collector 48-Hour Backfill Analysis

## 1. Current State
The project runs a standalone Node.js collector (`scripts/collector/btcusdtCollector.mjs`) that connects to Binance spot and futures WebSocket streams (`@aggTrade`, `@kline_1m`). It aggregates live trades in memory and flushes closed 1-minute `footprint_cells_ts`, `profile_rows_ts`, and `aggregate_bubble_events` to MongoDB.

Because this script is strictly live-stream based, stopping it or starting it fresh on a VPS means it only collects data from that exact second forward. The chart will be missing the previous 48 hours.

## 2. The Requirement
When the collector starts (e.g., via PM2 on a VPS), it should automatically fetch ("take back") the last two whole days (48 hours) of data before seamlessly transitioning into live websocket collection. This ensures the UI has full historical context for volume profiles, footprints, and sessions.

## 3. Analysis of Backfilling Approaches

To backfill canonical 1m footprint cells (at $5 buckets) and fine Volume Profile rows (at 1.5/tickSize buckets), we must replay raw aggregate trades (`aggTrades`) from the exact same sources (spot and futures).

### Option A: Binance Data Vision Archives (Daily CSVs)
- **Pros:** Fast download for massive amounts of data.
- **Cons:** Data is updated daily, meaning the most recent 24 hours are usually missing until the next day's generation. This creates a gap between the historical CSV and the live WebSocket feed.

### Option B: Binance REST API Pagination (`/api/v3/aggTrades` & `/fapi/v1/aggTrades`)
- **Pros:** Up-to-the-second real-time historical data. We can seamlessly connect the end of the backfill to the start of the live WebSocket stream.
- **Cons:** Rate limits. Binance allows 1000 trades per request. A heavy day for BTCUSDT might have ~1M trades (spot) + ~2M trades (futures). 
  - 3M trades / 1000 = 3,000 requests per day.
  - At a safe limit of 10 requests/second, backfilling 2 days (6,000 requests) takes roughly **10 minutes**. This is very acceptable for a 24/7 VPS script that runs on startup.

**Winner:** Option B (REST API Pagination) is required to avoid the 24-hour gap.

## 4. Proposed Implementation Architecture

We should create a dedicated backfill module or enhance the existing collector to run a `backfill` phase before `connect()`.

### Step 1: Determine the Backfill Range
- Query the database (`mongoDb.collection('footprint_cells_ts')`) to find the latest stored timestamp for the symbol.
- If no timestamp exists, or it's older than 48 hours, default the `startTime` to `Date.now() - (48 * 60 * 60 * 1000)`.
- If the latest stored timestamp is within 48 hours, use that timestamp as the `startTime` (this acts as a fast catch-up if the VPS restarts).

### Step 2: Fetch First Trade IDs
- Request the first trade on or after `startTime` for both Spot and Futures to get the starting `fromId`.
- Spot: `GET /api/v3/aggTrades?symbol=BTCUSDT&startTime=<timestamp>&limit=1`
- Futures: `GET /fapi/v1/aggTrades?symbol=BTCUSDT&startTime=<timestamp>&limit=1`

### Step 3: Paginate Forward
- Loop requests using `fromId = lastTradeId + 1` with `limit=1000`.
- For each batch of trades fetched:
  - Map the REST JSON schema to the internal `trade` object format.
  - Pipe them directly into the existing `ingestTrade(runtime, trade)` function.
  - Call `persistAllEligibleSlices('backfill')` exactly as the live stream does to save closed 1m slices.
- Stop paginating when the trade's `time` reaches `Date.now()`.

### Step 4: Hand-off to WebSocket
- Once the REST loops catch up to the current timestamp, immediately open the Binance WebSockets (`@aggTrade`, `@kline_1m`).
- The existing deduplication logic (`runtime.processedTradeKeys`) will naturally handle any minor overlap between the last REST batch and the first WSS messages.

## 5. Impact on Existing Code
- **`btcusdtCollector.mjs`**: Needs a new async function `runBackfillPhase()` called in `main()` before `streamClients.forEach(c => c.connect())`.
- **Database Schema**: No changes. The backfilled rows will perfectly match the canonical 1m `$5` bucket requirement.
- **Memory**: We must ensure the `BoundedSet` sizes for deduplication (`config.maxDedupeKeys`) don't overflow during a heavy 48h backfill, though since we flush closed 1m slices to the DB continuously, memory pressure will remain low.
