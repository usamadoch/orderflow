# Node Collector Design

Scope: design only. Do not implement yet. Do not change website writes yet.

## Goal

Create a standalone Node.js collector that persists only canonical footprint rows and fine Volume Profile rows into the existing MongoDB storage model. The website will continue rendering and restoring data, but later it should stop producing these persistence writes.

Non-goals:

- No raw trade persistence.
- No candle collector migration.
- No heatmap/liquidity work.
- No UI/rendering changes.

## 1. Collector file/module structure

Proposed structure:

```text
scripts/collector/
  index.ts                    # process entrypoint, config load, lifecycle, signals
  config.ts                   # env parsing, symbol/source validation, bucket constants
  streams/
    binanceSpotAggTrade.ts    # spot aggTrade WebSocket client
    binanceFuturesAggTrade.ts # futures aggTrade WebSocket client
    binanceKlineRef.ts        # contract-price reference stream for alignment
    reconnect.ts              # shared reconnect/backoff/heartbeat behavior
  core/
    tradeTypes.ts             # collector trade/source/key types
    sourceRuntime.ts          # one symbol/contractType/dataSourceMode runtime
    dedupe.ts                 # bounded source+trade-id dedupe
    alignment.ts              # current cross-source contract-price alignment rule
    footprintAggregator.ts    # canonical 1m/$5 row aggregation
    profileAggregator.ts      # canonical 1m fine profile row aggregation
    sliceClock.ts             # first-full-slice and both-source close rules
  mongo/
    client.ts                 # reuse Mongo env semantics from lib/db/mongo/client.ts
    writers.ts                # footprint/profile document mapping and batched inserts
    status.ts                 # collector_meta updates and status reads
  logging/
    logger.ts                 # structured console logs
    metrics.ts                # counters and periodic status snapshots
```

Implementation should prefer sharing small pure helpers from existing code where practical:

- `normalizePriceToBucket` and 1m time flooring from `lib/utils/aggregation.ts`.
- canonical constants from `lib/aggregation/footprintCache.ts` and `lib/config/markets.ts`.
- Mongo document shape/key normalization from `lib/db/mongo/marketStorageMongo.ts`, or a refactor that exposes those mappers without pulling in Next.js/server-action code.

## 2. Env vars needed

Required:

- `MONGODB_URI`
- `MONGODB_DB`
- `COLLECTOR_SYMBOLS=BTCUSDT,ETHUSDT`
- `COLLECTOR_CONTRACT_TYPES=spot,futures`
- `COLLECTOR_DATA_SOURCE_MODES=spot,futures,both`

Optional:

- `MARKET_DATA_RETENTION_DAYS` to match the existing Mongo adapter TTL setting.
- `COLLECTOR_LOG_LEVEL=info|debug`
- `COLLECTOR_STATUS_INTERVAL_MS=30000`
- `COLLECTOR_RECONNECT_MIN_MS=1000`
- `COLLECTOR_RECONNECT_MAX_MS=30000`
- `COLLECTOR_FLUSH_INTERVAL_MS=1000`
- `COLLECTOR_MAX_DEDUPE_KEYS=100000`
- `COLLECTOR_DRY_RUN=false`
- `COLLECTOR_ENABLE_WRITES=false` for initial shadow testing.

Constants:

- footprint timeframe: `1m`
- footprint bucket size: `5`
- profile timeframe: `1m`
- profile base bucket size: `max(1.5, tickSize)`

Tick size must come from a trusted config or exchange metadata lookup. For the current allowed symbols, the effective Binance BTCUSDT/ETHUSDT tick size is expected to keep profile base bucket size at `1.5` unless the configured tick size is larger.

## 3. Stream subscription plan

For each configured `(symbol, contractType, dataSourceMode)` runtime:

- `dataSourceMode=spot`: subscribe to Binance spot aggTrade stream.
- `dataSourceMode=futures`: subscribe to Binance futures aggTrade stream.
- `dataSourceMode=both`: subscribe to both spot and futures aggTrade streams.

Each incoming trade is normalized to:

```ts
{
  source: 'spot' | 'futures',
  id: number | undefined,
  time: number,       // ms
  price: number,
  quantity: number,
  isBuyerMaker: boolean
}
```

Cross-source contract-price alignment needs an additional contract reference price:

- If `trade.source === contractType`, aggregate at the trade price.
- If `trade.source !== contractType`, aggregate at the latest known price from the `contractType` market.
- To match the website most closely, this reference should be the latest close/last price from the contract market stream. The website currently uses the latest candle close from the contract candle stream.
- Design recommendation: subscribe to a lightweight 1m kline or miniTicker reference for the selected `contractType` per symbol. Do not persist those candles in this collector.
- If no reference price is available yet, skip cross-source trades until initialized, matching the website behavior.

Connection behavior:

- One WebSocket per concrete exchange/source/symbol stream can be shared across runtimes in-process.
- Reconnect with bounded exponential backoff.
- On reconnect, mark the currently open 1m slice as partial for affected runtimes unless replay/backfill is implemented. This avoids persisting incomplete slices after stream gaps.

## 4. Aggregation state model

Runtime key:

```text
symbol:contractType:dataSourceMode:profileBaseBucketSize
```

Per runtime state:

```ts
type RuntimeState = {
  symbol: string
  contractType: 'spot' | 'futures'
  dataSourceMode: 'spot' | 'futures' | 'both'
  activeSources: Array<'spot' | 'futures'>
  profileBaseBucketSize: number
  contractReferencePrice: number | null
  firstFullyCoveredBaseTimeBySource: Record<'spot' | 'futures', number | null>
  latestBaseTimeBySource: Record<'spot' | 'futures', number | null>
  processedTradeKeys: BoundedSet<string>
  footprintSlices: Map<number, Map<number, FootprintCell>>
  profileSlices: Map<number, Map<number, FineProfileRow>>
  pendingClosedSlices: Set<number>
  persistedSlices: BoundedSet<string>
}
```

Footprint row aggregation:

- base time: `floor(trade.time / 1000 / 60) * 60`
- bucket price: `floor(alignedPrice / 5) * 5`
- buyer maker:
  - `false`: aggressive buy, add quantity to `askVol`
  - `true`: aggressive sell, add quantity to `bidVol`

Profile row aggregation:

- base time: same canonical 1m base time.
- bucket price: `floor(alignedPrice / profileBaseBucketSize) * profileBaseBucketSize`
- row fields: `candleTime`, `baseBucketSize`, `bucketPrice`, `bidVol`, `askVol`, `totalVol`, `tradeCount`

The collector should maintain footprint and profile slices from the same aligned trade event so both persistence paths close on the same source timing.

## 5. Closed-slice timing rules

The collector must persist only fully covered, closed 1m slices.

Per source:

1. Compute `baseTime` for every accepted trade.
2. If `firstFullyCoveredBaseTimeBySource[source]` is null, set it to `baseTime + 60`.
3. Update `latestBaseTimeBySource[source] = max(previous, baseTime)`.

Runtime coverage start:

- For `spot` mode: `coverageStart = firstFullyCoveredBaseTimeBySource.spot`.
- For `futures` mode: `coverageStart = firstFullyCoveredBaseTimeBySource.futures`.
- For `both` mode: `coverageStart = max(firstFullyCovered spot, firstFullyCovered futures)`.
- If any required source has no coverage start, do not persist.

Runtime closed-before time:

- For `spot` mode: latest spot base time.
- For `futures` mode: latest futures base time.
- For `both` mode: `min(latest spot base time, latest futures base time)`.
- A slice is persistable only when `sliceTime >= coverageStart` and `sliceTime < closedBeforeTime`.

On reconnect/gap:

- Treat the current slice for the affected source as partial.
- Advance its first fully covered time to the next observed base time plus 60.
- Do not persist any slice where any required source may have missing trades.

## 6. Mongo write strategy

Use existing collections and schema:

- `footprint_cells_ts`
- `profile_rows_ts`
- `collector_meta`

Footprint document shape must match the current adapter:

- `time = new Date(candleTime * 1000)`
- `meta.symbol`
- `meta.contractType`
- `meta.dataSourceMode`
- `meta.timeframe = '1m'`
- `meta.bucketSize = 5`
- `candleTimeSec`
- `bucketPrice`
- `bucketPriceKey`
- `bidVol`
- `askVol`
- `totalVol`
- `delta`
- `storedAt`

Profile document shape must match the current adapter:

- `time = new Date(candleTime * 1000)`
- `meta.symbol`
- `meta.contractType`
- `meta.dataSourceMode`
- `meta.timeframe = '1m'`
- `meta.baseBucketSizeKey`
- `candleTimeSec`
- `baseBucketSize`
- `bucketPrice`
- `bucketPriceKey`
- `bidVol`
- `askVol`
- `totalVol`
- `tradeCount`
- `storedAt`

Write flow per closed 1m slice:

1. Clone footprint/profile rows for the slice.
2. Validate rows are finite and positive-volume.
3. Preflight existing documents for the same identity keys.
4. Insert missing footprint rows.
5. Insert missing profile rows.
6. Update `collector_meta`:
   - `last_footprint_stored`
   - `last_profile_rows_stored`
   - collector heartbeat/status keys.
7. Remove the in-memory slice after successful write, or keep it queued for retry on transient failures.

The current Mongo adapter skips existing rows rather than updating them. The collector should follow that behavior initially to preserve compatibility.

## 7. Duplicate/partial-write safety

In-memory safety:

- Dedupe incoming trades by `source:id`; fallback to `source:time:price:quantity:isBuyerMaker`.
- Bounded dedupe set, default 100000 keys.
- Keep a bounded persisted-slice set keyed by `symbol:contractType:dataSourceMode:1m:candleTime`.
- Never write a slice before it satisfies the closed-slice timing rules.
- Drop partial slices introduced by startup/reconnect/gap.

Mongo safety:

- Query existing keys before inserting, using the same identity as the restore path.
- Treat duplicate insert errors as non-fatal if they happen despite preflight.
- Do not replace existing rows in the first implementation; replacement can hide partial-write mistakes.
- Log rows received, rows inserted, rows skipped, and distinct candle times.

Operational safety:

- Initial runs should use `COLLECTOR_ENABLE_WRITES=false` and log intended writes only.
- Do not run collector as an authoritative writer while website writes are still enabled unless the team accepts duplicate race risk.
- The clean cutover is: start collector dry-run, verify logs, enable collector writes in a short overlap window, then disable website writes immediately after confirming collector coverage.

Important risk:

- Existing time-series collections do not currently enforce a unique identity constraint in the code path. Application-level duplicate checks are not a full race-proof guarantee when website and collector write the same rows concurrently.

## 8. How website persistence will later be disabled

Later, after collector validation:

- Remove or gate `FeedProvider` calls to `storeBaseFootprintAction`.
- Remove or gate fine profile storage state in `FeedProvider`:
  - `liveFineProfileRowsRef`
  - `fineProfileQueueRef`
  - `aggregateFineProfileTrade`
  - `persistEligibleFineProfileRows`
  - `flushFineProfileRows`
  - `storeFineProfileRowsAction`
- Keep live website aggregation for rendering unless a separate live-data architecture replaces it.
- Keep `/api/history/footprint` and `/api/history/profile`; they should restore collector-produced rows without route changes.
- Keep closed candle writes unless a separate candle collector is designed.
- Keep raw trade behavior unchanged in this migration.

Recommended cutover flag:

- Add a future env/config flag such as `WEBSITE_MARKET_PERSISTENCE=on|off`.
- First implementation can gate only footprint/profile writes, not candles/raw trades.

## 9. Test plan

Unit tests:

- Trade normalization for spot and futures aggTrade payloads.
- Dedupe by `source:id` and fallback key.
- 1m base-time flooring.
- Footprint `$5` bucket math and bid/ask side mapping.
- Profile `max(1.5, tickSize)` bucket math and row accumulation.
- Cross-source alignment: mismatched source uses current contract reference price.
- First partial slice skip.
- `both` mode does not close until both source streams advance past the slice.

Integration tests with mocked streams:

- Single source spot runtime writes one closed 1m footprint slice and profile slice.
- Single source futures runtime writes source-scoped futures rows.
- Both mode with staggered streams waits for the slower source.
- Reconnect/gap marks affected slices partial and prevents writes.
- Duplicate trade events do not change row totals.
- Replayed already-written slice is skipped by Mongo preflight.

Mongo tests:

- Documents match `footprint_cells_ts` and `profile_rows_ts` schema used by restore APIs.
- `bucketPriceKey` and `baseBucketSizeKey` match existing adapter normalization.
- `/api/history/footprint` restores collector-written rows.
- `/api/history/profile` restores collector-written rows for exact base bucket size.

Manual validation:

- Run dry-run collector for one symbol/source and compare intended row counts against website debug logs.
- Enable writes in a local/test MongoDB.
- Refresh the website and verify footprint/profile restore without relying on browser-side persistence.
- Test `spot`, `futures`, and `both` for `contractType=spot` and `contractType=futures`.
- After cutover, confirm no new footprint/profile storage diagnostics originate from website actions.
