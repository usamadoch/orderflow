# Aggregate Bubble Persistence Audit

## Short Summary

Aggregate Trade bubbles are currently live-only chart state. The frontend creates `BubbleEvent` objects from live Binance `aggTrade` messages, appends them to a capped in-memory Zustand buffer, and renders them with user-side filters. No restore API or storage adapter currently hydrates aggregate bubble history.

The standalone BTCUSDT collector already consumes Binance spot and futures `aggTrade` streams, but it only persists derived canonical footprint rows and fine Volume Profile rows. The safest persistence design is to extend the collector with a candidate aggregate-bubble write path and keep the chart app read-only for this data.

Recommendation: store only qualified aggregate-bubble candidates, not every aggregate trade. For BTCUSDT v1, start with `volume >= 5 BTC OR tradeCount >= 25`, store both fields, dedupe by `(symbol, contractType, aggregateTradeId)`, and restore by `(symbol, contractType, eventTime)` range. Keep retention aligned with the existing MongoDB market-data TTL, initially 7 days.

## Files/Scripts Involved

- `scripts/collector/btcusdtCollector.mjs` - standalone BTCUSDT collector. It connects to Binance spot/futures streams, aggregates `aggTrade` messages into footprint/profile rows, and writes closed `1m` slices to MongoDB.
- `lib/db/database.ts` - libSQL schema and helper functions for candles, footprint cells, fine profile rows, and `raw_trades`.
- `lib/db/mongo/marketStorageMongo.ts` - MongoDB adapter for candles, footprint cells, and profile rows. It declares `raw_trades_ts`, but raw trade methods are intentionally not implemented.
- `lib/db/storageAdapter.ts` - storage adapter interface and selected-driver routing.
- `lib/actions/storageActions.ts` - server-action write bridge used by the frontend path.
- `app/api/history/candles/route.ts` - stored candle restore API.
- `app/api/history/footprint/route.ts` - stored footprint restore API.
- `app/api/history/profile/route.ts` - stored fine Volume Profile restore API.
- `app/api/history/trades/route.ts` - libSQL raw-trade restore API.
- `components/FeedProvider.tsx` - frontend live-feed orchestration, browser-side restore, current aggregate bubble event creation, and live buffer flushing.
- `lib/feeds/binance.ts` and `lib/feeds/binanceFutures.ts` - frontend Binance spot/futures adapters that parse `aggTrade` payloads into `Trade`.
- `lib/feeds/feedRegistry.ts` - shared frontend `aggTrade` stream registry.
- `lib/store/chart.ts` - persisted panel settings plus capped live aggregate-bubble buffer.
- `components/chart/drawBubbles.ts` - aggregate-bubble renderer and filter/debug logic.
- `types/bubble.ts` and `types/trade.ts` - live aggregate-bubble and trade shapes.

## Current Write Path

### Collector Architecture

The collector is `scripts/collector/btcusdtCollector.mjs`. It is wired through `package.json` as `collector:btc`.

It is hard-coded to `BTCUSDT`, `1m`, a `$5` footprint bucket, and a fine profile base bucket of at least `1.5` or the configured tick size. `TARGETS` builds six aggregation identities:

- `contractType=spot`, `dataSourceMode=spot`
- `contractType=spot`, `dataSourceMode=futures`
- `contractType=spot`, `dataSourceMode=both`
- `contractType=futures`, `dataSourceMode=spot`
- `contractType=futures`, `dataSourceMode=futures`
- `contractType=futures`, `dataSourceMode=both`

The collector opens two Binance combined WebSocket clients:

- spot: `wss://stream.binance.com:9443/stream`
- futures: `wss://fstream.binance.com/market/stream`

Each client subscribes to:

- `btcusdt@aggTrade`
- `btcusdt@kline_1m`

The `kline_1m` stream is used as a price reference for cross-source alignment. The `aggTrade` stream is converted to an internal trade object with source, aggregate id, event time, price, quantity, and buyer-maker side.

For every valid aggregate trade, the collector:

- dedupes within each runtime with `processedTradeKeys`;
- aligns price to the runtime contract if the trade source differs from the runtime contract;
- assigns the trade to a canonical `1m` base slice;
- aggregates footprint cells by `$5` bucket;
- aggregates fine profile rows by configured base bucket;
- writes only closed slices after all active sources have fully covered the slice.

The write loop runs on `COLLECTOR_FLUSH_INTERVAL_MS`, default `1000ms`. `writeClosedSlice()` converts the slice to footprint/profile MongoDB documents and calls `insertMissingFootprintDocuments()` and `insertMissingProfileDocuments()`. Both functions pre-query existing rows and insert only missing rows.

The collector already consumes `aggTrade` streams, but it does not persist aggregate trade events as events. It persists only derived footprint/profile rows.

### Existing Frontend Write Paths

The chart app has existing storage action bridges in `lib/actions/storageActions.ts`. Browser footprint/profile writes are guarded behind `NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES` in `components/FeedProvider.tsx`; this is already described in `skills/map.md` as default-off browser persistence.

There is also an existing raw-trade path in `FeedProvider` for spot/spot trades: `claimRawTradeStorage()` queues aggregate trades and `flushRawTrades()` calls `storeRawTradesAction()`. That writes to libSQL `raw_trades` through `insertRawTradeBatch()`. This path stores spot aggregate trade payloads, not aggregate-bubble events, and it is not source-scoped for futures or MongoDB. It should not be used as the new aggregate-bubble persistence path.

## Existing Database/Storage Model

### libSQL

`lib/db/database.ts` creates:

- `candles`
- `footprint_cells`
- `candle_delta`
- `raw_trades`
- `fine_profile_rows`
- `collector_meta`

Relevant current uniqueness:

- `footprint_cells`: `UNIQUE(symbol, contract_type, data_source_mode, timeframe, candle_time, bucket_price, bucket_size)`
- `raw_trades`: `UNIQUE(symbol, aggregate_trade_id)`
- `fine_profile_rows`: `UNIQUE(symbol, contract_type, data_source_mode, timeframe, candle_time, base_bucket_size, bucket_price)`

Relevant query indexes:

- `idx_footprint_query` on `(symbol, contract_type, data_source_mode, timeframe, bucket_size, candle_time ASC)`
- `idx_raw_trades_query` on `(symbol, trade_time ASC)`
- `idx_fine_profile_rows_query` on `(symbol, contract_type, data_source_mode, timeframe, base_bucket_size, candle_time ASC)`

`raw_trades` is the only current table that stores aggregate-trade-like rows. It stores `aggregate_trade_id`, `trade_time`, `price`, `quantity`, and `is_buyer_maker`, but not `contract_type`, `tradeCount`, `firstTradeId`, or `lastTradeId`. It is therefore not a complete aggregate bubble history model.

### MongoDB

`lib/db/mongo/marketStorageMongo.ts` currently manages:

- `market_candles_ts`
- `footprint_cells_ts`
- `profile_rows_ts`
- `collector_meta`

It also declares `raw_trades_ts`, but both `storeRawTrades()` and `getRawTrades()` throw `notImplemented()`.

MongoDB footprint/profile collections are time-series collections with TTL from `MARKET_DATA_RETENTION_DAYS`, default 7 days. Inserts are deduped by pre-querying existing row identities before `insertMany()`. The adapter does not use a unique index for those time-series rows.

### Deduplication

Current dedupe exists at three levels:

- collector trade ingestion: bounded in-memory `processedTradeKeys` per runtime;
- collector slice writes: bounded in-memory `persistedSlices`;
- DB row writes: pre-query existing footprint/profile row identities before insert.

libSQL `raw_trades` also has `UNIQUE(symbol, aggregate_trade_id)`.

### Retention/Cleanup

- libSQL retention is `DB_RETENTION_HOURS`, default `48`, enforced by `lib/db/cleanupJob.ts` through `deleteOldData()`.
- MongoDB retention is `MARKET_DATA_RETENTION_DAYS`, default `7`, enforced by collection TTL.
- The standalone collector applies `MARKET_DATA_RETENTION_DAYS` to its MongoDB footprint/profile time-series collections.

Aggregate bubble events have no current retention policy because they are not currently stored.

## Current Restore Path

The frontend restore sequence lives in `components/FeedProvider.tsx`.

1. `fetchStoredHistory()` calls `/api/history/candles`.
2. Recent exchange candles are fetched and merged with stored candles.
3. Stored fine Volume Profile rows are restored through `/api/history/profile`.
4. Spot/spot raw trades can be restored through `/api/history/trades`.
5. Stored footprints are restored through `/api/history/footprint`.
6. Restored footprint rows are hydrated with `engineRef.current.hydrateBaseFootprintCandle()`.
7. Restored fine profile rows are hydrated with `volumeProfileEngineRef.current.hydrateProfileRows()`.
8. Restored raw trades are re-ingested into the footprint engine and profile engine.

There is no `/api/history/aggregate-bubbles` route, no storage-adapter method for aggregate bubble events, and no hydration step that appends restored aggregate events into `aggregateBubbleEvents`.

Later aggregate-bubble restore should plug into this flow after candles are available and before the restore status moves to complete. It should use the same history window as the visible candle restore, request source-scoped candidate events, convert them to `BubbleEvent`, and append/hydrate them into chart state without writing anything from the frontend.

## Aggregate Bubble Current Architecture

Live aggregate bubble events are created in `components/FeedProvider.tsx`:

- `getAggregateTradeCount()` derives `tradeCount` from `firstTradeId` and `lastTradeId`.
- `createAggregateBubbleEvent()` converts a live `Trade` into a `BubbleEvent`.
- The event is pushed into `pendingAggregateBubbleEventsRef`.
- A 100ms interval drains pending events into Zustand with `appendAggregateBubbleEvents()`.

`lib/store/chart.ts` caps the buffer at `MAX_AGGREGATE_BUBBLE_EVENTS = 20000`. The buffer is cleared on pair, contract type, and data-source changes, and reset during persisted state hydration.

`components/chart/drawBubbles.ts` renders aggregate events from that in-memory buffer. It filters by aggregate market source, side, visible time range, size mode, min volume/orders, and scale mode.

The live event model is close enough to reuse for restored chart hydration, but it is not complete enough as a DB model because it lacks `aggregateTradeId`, `firstTradeId`, `lastTradeId`, and a DB-created timestamp.

## Recommended Aggregate Bubble Persistence Model

### Store Candidates, Not All `aggTrade` Events

The collector should not store every `aggTrade` event. BTCUSDT is too busy, and the chart only needs events that can plausibly become aggregate bubbles. Storing every event would duplicate much of a raw trade archive without supporting the stated goal.

Store only qualified candidate events in the collector:

- valid `aggregateTradeId`;
- valid event time, price, side, and positive volume;
- `volume >= minVolume` OR `tradeCount >= minTradeCount`.

Store both volume and tradeCount even when only one threshold qualified the event. This preserves frontend flexibility for Volume mode and Orders mode.

### Initial BTCUSDT Threshold

Start with:

- `COLLECTOR_AGG_BUBBLE_MIN_VOLUME_BTC=5`
- `COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT=25`
- qualification: `volume >= 5 OR tradeCount >= 25`

Rationale:

- `5 BTC` is far below the current default chart bubble volume threshold of `50`, so restored history can still support lower user settings.
- `25` trades catches high-participation aggregate events where volume is split across many smaller fills.
- The OR rule avoids missing distinct event types while still avoiding raw-stream-sized storage.

The collector should log per-source candidate counts and skip counts. If row counts are too high on BTCUSDT, raise thresholds before adding adaptive logic.

### Avoiding DB Explosion

Use all of these controls:

- candidate-only storage;
- bounded flush batches;
- source-level dedupe before enqueue;
- DB-level or pre-query dedupe by aggregate id;
- API restore range limits, similar to the profile route's 6-hour guard;
- TTL retention aligned to market data retention;
- metrics for received, qualified, inserted, duplicate, and skipped events.

Do not store duplicate copies per `dataSourceMode`. Aggregate events should be stored once per real market stream:

- `contractType=spot`
- `contractType=futures`

The frontend can compose Active/Spot/Futures/Both at restore time.

### Deduplication Key

Use:

```text
symbol + contractType + aggregateTradeId
```

For Binance, `aggregateTradeId` is unique within a symbol stream, but spot and futures ids are separate namespaces. `contractType` must be part of the key.

Fallback dedupe for missing aggregate ids should not be stored in v1. If an event lacks `aggregateTradeId`, skip it and count it in metrics. The schema and API are simpler and safer if restore keys are stable.

### Restore Indexes

Minimum indexes:

- unique/dedupe: `(symbol, contractType, aggregateTradeId)`
- restore: `(symbol, contractType, eventTime)`
- TTL: `eventTime` with `expireAfterSeconds`

If the MongoDB implementation uses a time-series collection and unique indexes are constrained, keep the restore index on the time-series collection and do pre-query dedupe before insert. If strict unique enforcement is required, use a regular collection with a TTL index instead of time-series for aggregate bubble events.

### Retention

Initial retention should match MongoDB market history:

- default 7 days via `MARKET_DATA_RETENTION_DAYS`;
- configurable separately later if aggregate bubble volume proves materially different.

Do not use indefinite retention until observed candidate row rates are known.

## Proposed Schema/Indexes

### MongoDB Collection

Recommended collection name:

```text
aggregate_bubble_events
```

Recommended document shape:

```ts
interface AggregateBubbleEventDocument {
  symbol: string
  contractType: 'spot' | 'futures'
  aggregateTradeId: number
  eventTime: Date
  eventTimeMs: number
  price: string
  side: 'buy' | 'sell'
  volume: string
  tradeCount: number
  firstTradeId: number
  lastTradeId: number
  createdAt: Date
}
```

Optional but useful fields:

```ts
interface AggregateBubbleEventDocument {
  storageVersion?: 1
  qualifiedBy?: Array<'volume' | 'tradeCount'>
  minVolumeAtIngest?: string
  minTradeCountAtIngest?: number
}
```

Recommended indexes for a regular MongoDB collection:

```js
db.aggregate_bubble_events.createIndex(
  { symbol: 1, contractType: 1, aggregateTradeId: 1 },
  { unique: true, name: 'uniq_aggregate_bubbles_source_id' }
)

db.aggregate_bubble_events.createIndex(
  { symbol: 1, contractType: 1, eventTime: 1 },
  { name: 'idx_aggregate_bubbles_restore' }
)

db.aggregate_bubble_events.createIndex(
  { eventTime: 1 },
  { expireAfterSeconds: MARKET_DATA_RETENTION_DAYS * 24 * 60 * 60, name: 'ttl_aggregate_bubbles_event_time' }
)
```

If the project keeps the same time-series style as footprint/profile, use:

```ts
{
  time: Date,
  meta: {
    symbol: string
    contractType: 'spot' | 'futures'
  },
  aggregateTradeId: number,
  eventTimeMs: number,
  price: string,
  side: 'buy' | 'sell',
  volume: string,
  tradeCount: number,
  firstTradeId: number,
  lastTradeId: number,
  createdAt: Date
}
```

Then create a restore index on:

```js
{ 'meta.symbol': 1, 'meta.contractType': 1, time: 1 }
```

and perform insert-missing dedupe with pre-query by aggregate ids.

### libSQL Table

If libSQL support is added for local parity:

```sql
CREATE TABLE IF NOT EXISTS aggregate_bubble_events (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol             TEXT    NOT NULL,
  contract_type      TEXT    NOT NULL,
  aggregate_trade_id INTEGER NOT NULL,
  event_time         INTEGER NOT NULL,
  price              REAL    NOT NULL,
  side               TEXT    NOT NULL,
  volume             REAL    NOT NULL,
  trade_count        INTEGER NOT NULL,
  first_trade_id     INTEGER NOT NULL,
  last_trade_id      INTEGER NOT NULL,
  created_at         INTEGER NOT NULL DEFAULT (unixepoch()),

  UNIQUE(symbol, contract_type, aggregate_trade_id)
);

CREATE INDEX IF NOT EXISTS idx_aggregate_bubbles_restore
  ON aggregate_bubble_events(symbol, contract_type, event_time ASC);
```

Use `event_time` in milliseconds to match existing live `BubbleEvent.time`.

## Risks/Performance Notes

- Candidate thresholds are the main safety valve. Too-low thresholds can turn aggregate-bubble persistence into raw trade persistence.
- Store source events once per real source, not per combined identity. `dataSourceMode=both` should be assembled at query/hydration time.
- Current raw-trade storage is libSQL spot-only and frontend-originated. Reusing it would violate the collector-only write goal and would not support futures/Both restore.
- MongoDB time-series collections are good for TTL and range queries, but strict unique constraints can be awkward. A regular collection with TTL may be simpler for id-based dedupe.
- Restored aggregate bubbles must still respect user filters at render time. The API should return stored candidates in a bounded time range, not pre-rendered bubbles.
- The frontend live buffer cap of 20,000 is reasonable for live display, but restored candidates may need a separate append strategy so a large restore does not immediately evict all live events.
- The API should cap restore range and row count. A 6-hour max range, matching profile restore, is a reasonable v1 guard.

## Next Implementation Prompt Outline

1. Collector write path
   - Add aggregate-bubble candidate thresholds to `scripts/collector/btcusdtCollector.mjs`.
   - Include `aggregateTradeId`, `firstTradeId`, `lastTradeId`, `tradeCount`, side, source, event time, price, and volume in collector trade parsing.
   - Add per-source candidate queues and flush them with the existing collector flush cycle.
   - Deduplicate by `symbol:contractType:aggregateTradeId`.
   - Add collector metrics for received, qualified, duplicate, inserted, skipped, and failed aggregate bubble events.

2. DB schema/migration
   - Add `aggregate_bubble_events` storage to MongoDB first.
   - Prefer a regular collection with TTL and unique id index unless time-series constraints are acceptable.
   - Optionally add libSQL parity table later.
   - Do not alter footprint/profile schema.

3. Restore API
   - Add `/api/history/aggregate-bubbles`.
   - Validate symbol, contractType/market source, start/end, and max range.
   - Query one or both source contract types by `(symbol, contractType, eventTime)`.
   - Return `BubbleEvent`-compatible rows plus id fields if needed for debug.

4. Frontend hydration
   - Add a restore step in `FeedProvider` after candle restore and before complete status.
   - Hydrate returned rows into `aggregateBubbleEvents` only when Bubble Source is Aggregate Trades, or hydrate lazily when the user switches to Aggregate Trades.
   - Keep all writes out of the chart app.
   - Preserve live event appends and user-side renderer filtering.

5. Debug updates
   - Extend restore diagnostics with aggregate-bubble rows fetched, rows hydrated, source counts, min/max event time, and threshold metadata.
   - Extend `window.__MARKET_DEBUG__` aggregate bubble snapshot to distinguish live vs restored candidate counts if needed.

Do not implement grouping/clustering, raw trade bubbles, iceberg logic, or tooltip UI in this phase.
