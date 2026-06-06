# Collector Persistence Audit

Scope: audit only. Runtime code was not changed.

## 1. Current footprint save flow

- `components/FeedProvider.tsx` owns website-side trade ingestion, aggregation, and persistence triggering.
- Source key setup:
  - Candle stream follows `contractType`.
  - Trade streams follow `dataSourceMode`: `spot`, `futures`, or both.
  - Shared footprint cache key is `symbol:contractType:dataSourceMode`.
- Live trade handling:
  - Per-panel dedupe uses `source:id`, falling back to `source:time:price:quantity:isBuyerMaker`.
  - If trade source does not match `contractType`, the trade price is replaced with the latest contract candle close before aggregation. Quantity and `isBuyerMaker` are preserved.
  - Trade time is floored to a canonical 1m base candle with `getCandleTimeForTrade(..., 60)`.
- Footprint aggregation:
  - `AggregationEngine` writes into `FootprintBaseCache`.
  - Canonical base timeframe is `1m`.
  - Canonical footprint bucket size is `$5`.
  - Bucket price is `Math.floor(price / 5) * 5`.
  - `isBuyerMaker === false` adds to `askVol`; `true` adds to `bidVol`.
  - Delta is `askVol - bidVol`.
- Closed/full-slice timing:
  - The first observed 1m slice per active trade source is treated as partial.
  - `firstFullyCoveredCandleTime[source] = firstTradeBaseTime + 60`.
  - For `dataSourceMode=both`, coverage starts at the max first-covered time across spot and futures.
  - On each closed chart candle, footprint persistence is allowed only when `candle.time >= coverageStart`.
  - The website then saves every canonical 1m base footprint in `[candle.time, candle.time + selectedTimeframeSeconds)`.
  - On 5m/15m/1h charts this means canonical 1m footprint writes are delayed until the selected chart candle closes.
- Storage action:
  - `storeBaseFootprintAction(symbol, contractType, dataSourceMode, candleTime, cells)`.
  - Client duplicate guard key: `symbol:contractType:dataSourceMode:1m:candleTime:5`.

## 2. Current Volume Profile save flow

- `components/FeedProvider.tsx` also owns website-side fine Volume Profile row generation.
- Source key setup:
  - Shared profile cache key is `symbol::contractType::dataSourceMode::baseBucketSize`.
  - Storage timeframe is always `1m`.
  - Base bucket size is `getFineProfileBaseBucketSize(tickSize)`, currently `max(1.5, tickSize)`.
- Live trade handling:
  - Uses the same source selection, dedupe, and cross-source contract-price alignment as footprint.
  - Each aligned trade is ingested into the profile engine for live rendering.
  - Separately, `aggregateFineProfileTrade` builds pending closed-row storage data in `liveFineProfileRowsRef`.
- Fine row aggregation:
  - Base candle time is canonical 1m.
  - Bucket price is `Math.floor(price / baseBucketSize) * baseBucketSize`.
  - `isBuyerMaker === false` adds to `askVol`; `true` adds to `bidVol`.
  - Row fields: `candleTime`, `baseBucketSize`, `bucketPrice`, `bidVol`, `askVol`, `totalVol`, `tradeCount`.
- Closed/full-slice timing:
  - First observed 1m slice is skipped as partial using the same coverage-start rule.
  - `latestTradeBaseCandleTime` is tracked per active trade source.
  - For `dataSourceMode=both`, a fine row slice is closed only before `min(latest spot base time, latest futures base time)`.
  - `persistEligibleFineProfileRows` persists rows where `candleTime >= coverageStart` and `candleTime < closedBeforeTime`.
  - It runs when trade streams advance into a new 1m slice, on selected chart candle close, on the 2s flush interval, and during feed cleanup.
  - Eligible rows are also hydrated back into the local profile cache with origin `closed-1m`.
- Storage action:
  - `storeFineProfileRowsAction(symbol, contractType, dataSourceMode, '1m', rows)`.
  - Client duplicate guard key: `symbol:contractType:dataSourceMode:1m:candleTime:baseBucketSize:bucketPrice`.
  - Batches flush at 1000 rows or every 2 seconds.

## 3. MongoDB collections involved

- `footprint_cells_ts`
  - Time-series collection for canonical 1m/$5 footprint rows.
  - Meta: `symbol`, `contractType`, `dataSourceMode`, `timeframe`, `bucketSize`.
  - Time field: `time`, equal to candle time.
- `profile_rows_ts`
  - Time-series collection for canonical 1m fine Volume Profile rows.
  - Meta: `symbol`, `contractType`, `dataSourceMode`, `timeframe`, `baseBucketSizeKey`.
  - Time field: `time`, equal to candle time.
- Adjacent collections:
  - `market_candles_ts` is still used for closed candle storage.
  - `collector_meta` stores last stored timestamps and retention metadata.
  - `raw_trades_ts` is declared in the Mongo adapter but raw trade storage/restore is not implemented there.
- LibSQL fallback equivalents:
  - `footprint_cells`
  - `fine_profile_rows`
  - `raw_trades` remains the current raw-trade fallback path for spot/spot only.

## 4. Required canonical keys and bucket sizes

- Footprint canonical identity:
  - `symbol`
  - `contractType`
  - `dataSourceMode`
  - `timeframe = '1m'`
  - `candleTime`
  - `bucketSize = 5`
  - `bucketPrice`
- Volume Profile canonical identity:
  - `symbol`
  - `contractType`
  - `dataSourceMode`
  - `timeframe = '1m'`
  - `candleTime`
  - `baseBucketSize = max(1.5, tickSize)`
  - `bucketPrice`
- Restore APIs expect:
  - `/api/history/footprint` reads only canonical `1m/$5` rows, even if a larger chart timeframe is requested.
  - `/api/history/profile` reads only canonical `1m` fine rows and filters by exact `baseBucketSize`.
  - Valid symbols/timeframes/sources must pass `lib/config/markets.ts` validation.

## 5. What logic must move to collector

- Subscribe to the same live trade sources needed for each persisted key: spot, futures, and combined `both`.
- Reproduce source-scoped keys exactly: `symbol`, `contractType`, `dataSourceMode`.
- Reproduce current cross-source price alignment if `dataSourceMode` includes a source different from `contractType`.
- Dedupe live trades by source and aggregate trade id, with the current fallback key for missing ids.
- Build canonical closed 1m footprint slices at `$5` buckets.
- Build canonical closed 1m fine Volume Profile rows at `max(1.5, tickSize)`.
- Preserve closed-slice timing:
  - Skip initially partial 1m slices.
  - For combined mode, close a 1m slice only after all active trade sources have advanced past it.
- Call the same storage adapter shape or write documents with the same Mongo schema and key normalization.
- Continue duplicate protection at DB-write level, not only in memory.

## 6. What website code should later stop doing

- Stop `FeedProvider` footprint persistence calls:
  - `storeBaseFootprintAction(...)`
  - base footprint client duplicate claim for storage writes.
- Stop `FeedProvider` fine Volume Profile persistence:
  - `liveFineProfileRowsRef`
  - `fineProfileQueueRef`
  - `aggregateFineProfileTrade`
  - `persistEligibleFineProfileRows`
  - `flushFineProfileRows`
  - `storeFineProfileRowsAction(...)`
- Keep website live aggregation for rendering unless replaced by collector-fed live data.
- Keep restore APIs and hydration paths, because the website still needs to read collector-produced rows.
- Do not stop closed candle writes as part of this footprint/profile move unless a separate candle collector migration is planned.
- Raw trade writes are separate legacy fallback behavior. Decide separately whether the collector should own raw trades before disabling `storeRawTradesAction`.

## 7. Risks before implementation

- Current website persistence is chart-timeframe dependent for footprint. On larger selected timeframes, canonical 1m rows are delayed until the larger candle closes.
- If the browser disconnects before cleanup/flush, pending fine profile rows can be lost.
- Running website writes and collector writes at the same time can produce duplicate races in MongoDB because duplicate protection is application-level lookup-before-insert, not a unique index.
- Mongo duplicate protection skips existing rows rather than replacing them. If a partial or incorrect row is written first, later corrected collector data may not repair it.
- Combined `dataSourceMode=both` depends on exact spot/futures advancement timing. Closing a slice too early will create incomplete rows.
- Cross-source contract-price alignment is non-obvious but affects both footprint and profile prices. A collector using raw source prices would not match current website data.
- Profile restore filters by exact `baseBucketSize`; a collector bucket-size mismatch will make rows invisible to the website.
- Existing Mongo raw trade methods are not implemented, so after website fine-row writes stop, Volume Profile restore depends on collector-produced `profile_rows_ts` coverage.
