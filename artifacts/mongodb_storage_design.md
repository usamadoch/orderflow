# MongoDB Storage Design

## 1. Migration Strategy

This is a design-only migration plan. The current runtime remains on Turso/libSQL until a MongoDB adapter is implemented and selected explicitly.

- Keep libSQL as the default driver and fallback during the transition.
- Add MongoDB behind an environment flag: `MARKET_DB_DRIVER=libsql | mongodb`.
- Introduce a storage adapter boundary before swapping route handlers or server actions to MongoDB.
- Migrate collection-by-collection, starting with source-safe candle restore because current stored candles are keyed only by `symbol/timeframe`.
- Use MongoDB time-series collections for append-heavy market data and a normal collection for small metadata.
- Store all time-series `timeField` values as BSON `Date`; convert existing app seconds/milliseconds at the adapter boundary.
- Use stable source identity in `meta`; keep changing or high-cardinality measurement values in the document body.
- Default retention should become 7 days (`604800` seconds), with a later env override such as `MARKET_DATA_RETENTION_DAYS`.

MongoDB time-series references used for this design:
- Time-series collections require a date-valued `timeField` and optionally use a stable `metaField`: https://www.mongodb.com/docs/v7.0/core/timeseries/timeseries-procedures/
- Newer MongoDB versions automatically create a compound index on `metaField` and `timeField` for new time-series collections: https://www.mongodb.com/docs/manual/core/timeseries/timeseries-secondary-index/
- Time-series TTL is configured with `expireAfterSeconds`: https://www.mongodb.com/docs/v8.0/core/timeseries/timeseries-automatic-removal/

## 2. Collections

### `market_candles_ts`

Type: MongoDB time-series.

Purpose: durable OHLCV candle history for source-safe chart restore.

Collection options:

```ts
{
  timeseries: {
    timeField: "time",
    metaField: "meta",
    granularity: "seconds"
  },
  expireAfterSeconds: 604800
}
```

Document shape:

```ts
{
  time: Date, // candle open time
  meta: {
    symbol: "BTCUSDT",
    contractType: "spot" | "futures",
    timeframe: "1m" | "5m" | "15m" | "1h" | "4h"
  },
  open: Decimal128 | string,
  high: Decimal128 | string,
  low: Decimal128 | string,
  close: Decimal128 | string,
  volume: Decimal128 | string,
  closeTime: Date,
  timeSec: number,
  closeTimeSec: number,
  totalDelta?: Decimal128 | string,
  buyVol?: Decimal128 | string,
  sellVol?: Decimal128 | string,
  storedAt: Date
}
```

Decision: merge `candle_delta` into candle documents as optional derived fields. This keeps candle restore source-safe and avoids a second source-scoping problem. If CVD later needs independent delta retention, add a separate `candle_delta_ts` after candles are source-scoped.

Duplicate-write policy: upsert by logical identity `{ "meta.symbol", "meta.contractType", "meta.timeframe", time }`. MongoDB time-series collections are not a drop-in replacement for libSQL unique constraints, so the adapter should use deterministic filters and `bulkWrite`/upsert behavior rather than blind inserts.

### `footprint_cells_ts`

Type: MongoDB time-series.

Purpose: canonical base footprint rows for footprint/CVD restore and display-timeframe aggregation.

Canonical base only:
- `timeframe = "1m"`
- `bucketSize = 5`

Collection options:

```ts
{
  timeseries: {
    timeField: "time",
    metaField: "meta",
    granularity: "seconds"
  },
  expireAfterSeconds: 604800
}
```

Document shape:

```ts
{
  time: Date, // base candle open time
  meta: {
    symbol: "BTCUSDT",
    contractType: "spot" | "futures",
    dataSourceMode: "spot" | "futures" | "both",
    timeframe: "1m",
    bucketSize: 5
  },
  candleTimeSec: number,
  bucketPrice: Decimal128 | string,
  bucketPriceKey: string,
  bidVol: Decimal128 | string,
  askVol: Decimal128 | string,
  totalVol: Decimal128 | string,
  delta: Decimal128 | string,
  storedAt: Date
}
```

Duplicate-write policy: upsert by `{ meta, time, bucketPriceKey }`. The adapter should compute `totalVol = bidVol + askVol` at write time so restore does not need to recalculate it.

### `profile_rows_ts`

Type: MongoDB time-series.

Purpose: canonical 1m fine Volume Profile rows for default/custom profile restore.

Canonical base only:
- `timeframe = "1m"`
- `baseBucketSize = tickSize`

Collection options:

```ts
{
  timeseries: {
    timeField: "time",
    metaField: "meta",
    granularity: "seconds"
  },
  expireAfterSeconds: 604800
}
```

Document shape:

```ts
{
  time: Date, // base candle open time
  meta: {
    symbol: "BTCUSDT",
    contractType: "spot" | "futures",
    dataSourceMode: "spot" | "futures" | "both",
    timeframe: "1m",
    baseBucketSizeKey: string
  },
  candleTimeSec: number,
  baseBucketSize: Decimal128 | string,
  bucketPrice: Decimal128 | string,
  bucketPriceKey: string,
  bidVol: Decimal128 | string,
  askVol: Decimal128 | string,
  totalVol: Decimal128 | string,
  tradeCount: number,
  storedAt: Date
}
```

Duplicate-write policy: upsert by `{ meta, time, bucketPriceKey }`. Use `baseBucketSizeKey` in `meta` because it is part of the stable restore identity for a profile cache; keep numeric/display representation in the document body.

### `collector_meta`

Type: normal MongoDB collection.

Purpose: small operational metadata and migration state.

Document shape:

```ts
{
  key: string,
  value: string | number | boolean | object,
  updatedAt: Date
}
```

Indexes:

```ts
db.collector_meta.createIndex({ key: 1 }, { unique: true })
```

Suggested keys:
- `collector_started`
- `last_candle_stored`
- `retention_seconds`
- `market_db_driver`
- `migration_backfill_checkpoint`

### Future `raw_trades_ts`

Do not migrate raw trades in the first MongoDB step. Current raw trades are spot-only and symbol-only, which is useful as a fallback but unsafe as the primary source for spot/futures/both restore.

Future type: MongoDB time-series.

Future document shape:

```ts
{
  time: Date, // trade time
  meta: {
    symbol: "BTCUSDT",
    contractType: "spot" | "futures",
    tradeSource: "spot" | "futures"
  },
  tradeTimeMs: number,
  aggregateTradeId: number,
  price: Decimal128 | string,
  priceKey: string,
  quantity: Decimal128 | string,
  isBuyerMaker: boolean,
  storedAt: Date
}
```

Future duplicate-write policy: upsert by `{ meta.symbol, meta.tradeSource, aggregateTradeId }`. Only enable this after source-scoped raw-trade identity is added to the current write path.

## 3. Time-Series Collection Options

Use these initial options:

```ts
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60

db.createCollection("market_candles_ts", {
  timeseries: { timeField: "time", metaField: "meta", granularity: "seconds" },
  expireAfterSeconds: SEVEN_DAYS_SECONDS,
})

db.createCollection("footprint_cells_ts", {
  timeseries: { timeField: "time", metaField: "meta", granularity: "seconds" },
  expireAfterSeconds: SEVEN_DAYS_SECONDS,
})

db.createCollection("profile_rows_ts", {
  timeseries: { timeField: "time", metaField: "meta", granularity: "seconds" },
  expireAfterSeconds: SEVEN_DAYS_SECONDS,
})
```

Notes:
- `time` must be a BSON `Date`, not a Unix number.
- `granularity: "seconds"` fits 1m candles, 1m base footprint/profile rows, and future trade-level data.
- If using MongoDB 6.3 or newer and a future workload needs exact 1m bucket alignment, consider `bucketMaxSpanSeconds: 60` and `bucketRoundingSeconds: 60`; do not use both those options and `granularity`.
- Do not include `bucketPrice`, `tradeCount`, OHLCV, or other frequently changing/high-cardinality measurement values in `meta`.

## 4. Meta Fields

Stable `meta` identities:

```ts
// market_candles_ts
{
  symbol: string,
  contractType: "spot" | "futures",
  timeframe: string
}

// footprint_cells_ts
{
  symbol: string,
  contractType: "spot" | "futures",
  dataSourceMode: "spot" | "futures" | "both",
  timeframe: "1m",
  bucketSize: 5
}

// profile_rows_ts
{
  symbol: string,
  contractType: "spot" | "futures",
  dataSourceMode: "spot" | "futures" | "both",
  timeframe: "1m",
  baseBucketSizeKey: string
}
```

Rationale:
- `symbol`, `contractType`, `dataSourceMode`, `timeframe`, and base resolution are stable source identity fields used by restore queries and shared cache keys.
- `bucketPrice` belongs outside `meta`; it changes for every row and would produce sparse buckets.
- Store `baseBucketSizeKey` as a normalized string such as `"0.01"` or `"5"` to avoid floating-point equality problems in metadata filters.

## 5. Indexes

Restore queries primarily filter by `meta` and `time` ranges. MongoDB creates an automatic compound index on `meta` and `time` for new time-series collections in supported versions, but create explicit secondary indexes for row-level range restores and duplicate-safe upserts where needed.

Suggested indexes:

```ts
db.market_candles_ts.createIndex({
  "meta.symbol": 1,
  "meta.contractType": 1,
  "meta.timeframe": 1,
  time: 1,
})

db.footprint_cells_ts.createIndex({
  "meta.symbol": 1,
  "meta.contractType": 1,
  "meta.dataSourceMode": 1,
  "meta.timeframe": 1,
  "meta.bucketSize": 1,
  time: 1,
  bucketPriceKey: 1,
})

db.profile_rows_ts.createIndex({
  "meta.symbol": 1,
  "meta.contractType": 1,
  "meta.dataSourceMode": 1,
  "meta.timeframe": 1,
  "meta.baseBucketSizeKey": 1,
  time: 1,
  bucketPriceKey: 1,
})
```

Future raw-trade indexes:

```ts
db.raw_trades_ts.createIndex({
  "meta.symbol": 1,
  "meta.tradeSource": 1,
  time: 1,
  aggregateTradeId: 1,
})
```

Do not rely on `_id` for restore ordering. Always sort by `time` plus row-specific tie-breakers such as `bucketPriceKey` or `aggregateTradeId`.

## 6. TTL / Retention

Default retention:

```ts
expireAfterSeconds: 604800 // 7 days
```

Adapter/env policy:
- Add `MARKET_DATA_RETENTION_DAYS`, defaulting to `7`, when MongoDB implementation begins.
- Keep libSQL `DB_RETENTION_HOURS` unchanged until libSQL is no longer the active driver.
- Store effective retention in `collector_meta.retention_seconds`.
- Expect TTL deletion to be eventual, not immediate; caches and restore code must tolerate recently expired or partially expired ranges.

Collection-specific policy:
- `market_candles_ts`: 7 days.
- `footprint_cells_ts`: 7 days.
- `profile_rows_ts`: 7 days.
- future `raw_trades_ts`: likely shorter than 7 days unless raw replay becomes a primary restore requirement.
- `collector_meta`: no TTL.

## 7. Storage Adapter Interface

Add one server-side adapter boundary before implementing MongoDB.

```ts
export type MarketDbDriver = "libsql" | "mongodb"

export interface MarketStorageAdapter {
  init(): Promise<void>
  getStatus(): Promise<{
    retentionSeconds: number
    dbSizeMb: number | null
    lastStored: string | null
    candleCounts: Record<string, number>
  }>

  storeClosedCandle(input: StoreClosedCandleInput): Promise<void>
  storeBaseFootprint(input: StoreBaseFootprintInput): Promise<void>
  storeFineProfileRows(input: StoreFineProfileRowsInput): Promise<void>
  storeRawTrades(input: StoreRawTradesInput): Promise<void>

  getCandles(query: {
    symbol: string
    contractType: "spot" | "futures"
    timeframe: string
    since?: number
    limit?: number
  }): Promise<Candle[]>

  getFootprintCellsForRange(query: {
    symbol: string
    contractType: "spot" | "futures"
    dataSourceMode: "spot" | "futures" | "both"
    start: number
    end: number
  }): Promise<FootprintHistoryRow[]>

  getFineProfileRows(query: {
    symbol: string
    contractType: "spot" | "futures"
    dataSourceMode: "spot" | "futures" | "both"
    baseBucketSize: number
    start: number
    end: number
  }): Promise<FineProfileRow[]>

  getRawTrades(query: RawTradeHistoryQuery): Promise<Trade[]>
}
```

Implementation strategy:
- `LibsqlMarketStorageAdapter` wraps the existing `lib/db/database.ts` and `lib/db/marketStorage.ts` functions.
- `MongoMarketStorageAdapter` maps app inputs to MongoDB documents and converts MongoDB decimals/dates back to current frontend shapes.
- `getMarketStorageAdapter()` chooses based on `MARKET_DB_DRIVER`, defaulting to `libsql`.
- During transition, server actions and API routes call only the adapter, not driver-specific modules.
- MongoDB candle reads must require `contractType`; for libSQL fallback, the adapter can continue reading current symbol/timeframe rows and mark the fallback source as legacy.

Decimal/price policy:
- Do not store price-like values as JavaScript floats only.
- Preferred: store a normalized string key for equality/range identity (`bucketPriceKey`, `baseBucketSizeKey`, `priceKey`) and a `Decimal128` or string value for display/math conversion.
- Keep volume values as `Decimal128` or normalized strings if exact persisted precision matters; convert to numbers only at the adapter boundary for current chart code.

## 8. Migration Order

1. Add the adapter interface and libSQL adapter with no behavior change.
2. Add MongoDB connection/config and collection initialization behind `MARKET_DB_DRIVER=mongodb`.
3. Implement `market_candles_ts` writes and reads first, including `contractType` in all candle restore calls.
4. Implement `footprint_cells_ts` for canonical source-scoped 1m/$5 rows.
5. Implement `profile_rows_ts` for source-scoped canonical 1m fine profile rows.
6. Merge candle delta into `market_candles_ts` optional fields or leave it deprecated if no active restore path needs it.
7. Keep raw trades on libSQL/legacy fallback until source-scoped raw-trade identity is designed in the live write path.
8. Run a short dual-read validation period: write MongoDB, read MongoDB when enabled, and keep libSQL fallback available for missing ranges.
9. After confidence, disable libSQL fallback for market-data reads and remove old schema only in a separate cleanup task.

## 9. Risks and Decisions

- Candles must become source-scoped by `contractType`; otherwise spot and futures candle history can collide.
- Current libSQL candle rows are legacy because they lack `contractType`. Backfill them only as `contractType: "spot"` if that assumption is explicitly accepted.
- Footprint and profile rows already use source identity; MongoDB should preserve that identity in `meta`.
- Raw trades are currently spot-only and symbol-only. Do not use them as a primary MongoDB restore source for futures or combined modes.
- Time-series TTL is eventual. Restore code must handle gaps near retention boundaries.
- Duplicate writes need deterministic adapter-level upserts because time-series collections are not a drop-in replacement for libSQL unique constraints.
- Decimal precision must not depend on JavaScript float equality for bucket identity.
- High-cardinality values such as `bucketPrice` should remain measurement fields, not `meta` fields.
- Existing in-memory cache dedupe and loaded-range state should stay local/in-memory, not persisted as MongoDB documents.
- The migration should avoid changing chart rendering, cache behavior, feed routing, or aggregation semantics in the first MongoDB adapter step.
