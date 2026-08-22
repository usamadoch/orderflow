Implement Aggregate Trade Bubble persistence using collector-only writes.

Context:

* Aggregate Trade bubbles currently work live-only in the frontend.
* The frontend/chart app must not write aggregate bubble history to the database.
* The background collector script is responsible for saving market data.
* Existing collector: `scripts/collector/btcusdtCollector.mjs`
* Existing Aggregate BubbleEvent includes:

  * time
  * price
  * side
  * volume
  * tradeCount
  * source
  * symbol
  * contractType
* Aggregate bubbles already support:

  * Market Source: Active / Spot / Futures / Both
  * Size By: Volume / Orders
  * Min Volume / Min Orders
  * Side Filter
  * Scale Mode
  * Min Radius / Max Radius

Goal:
Persist qualified Aggregate Trade bubble candidate events from the collector, restore them through a history API, and hydrate them into the frontend aggregate bubble buffer after refresh/reload.

Do not implement grouping/clustering, raw trade bubbles, iceberg logic, tooltip UI, or visual spot/futures split in this task.

Important database config:
Use these env variables for this aggregate bubble persistence database connection:

* `BUBBLES_MONGODB_URI`
* `BUBBLES_MONGODB_DB_NAME`

Do not use the normal/default Mongo URI for this feature unless these variables are missing and the existing project pattern already has a safe fallback. Prefer failing clearly with a helpful error if `BUBBLES_MONGODB_URI` or `BUBBLES_MONGODB_DB_NAME` is missing.

1. Add Aggregate Bubble persistence schema

Create a MongoDB collection:

`aggregate_bubble_events`

Prefer a regular MongoDB collection with TTL and unique index instead of time-series, because we need stable deduplication by aggregate trade id.

Document fields:

* symbol
* contractType: `spot` | `futures`
* aggregateTradeId
* eventTime
* eventTimeMs
* price
* side: `buy` | `sell`
* volume
* tradeCount
* firstTradeId
* lastTradeId
* createdAt
* storageVersion: 1
* qualifiedBy: array of `volume` / `tradeCount`
* minVolumeAtIngest
* minTradeCountAtIngest

Indexes:

* unique: `{ symbol: 1, contractType: 1, aggregateTradeId: 1 }`
* restore: `{ symbol: 1, contractType: 1, eventTime: 1 }`
* TTL: `{ eventTime: 1 }`

Use retention from `MARKET_DATA_RETENTION_DAYS`, default 7 days.

2. Candidate storage thresholds

Do not store every Binance `aggTrade`.

For BTCUSDT v1, use a stricter storage filter:

* `COLLECTOR_AGG_BUBBLE_MIN_VOLUME_BTC=15`
* `COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT=75`
* `COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC=3`

Qualification rule:

Store event if:

`volume >= 15 BTC`

OR

`tradeCount >= 75 AND volume >= 3 BTC`

Reason:

* 15 BTC keeps storage focused on meaningful aggressive execution events.
* The trade-count rule catches large participation bursts without saving too many tiny noisy events.
* Store both volume and tradeCount even if only one rule qualifies the event.

Make these thresholds configurable by env, with the above defaults.

3. Collector write path

In `scripts/collector/btcusdtCollector.mjs`, when spot/futures Binance `aggTrade` events are received:

Parse and store:

* symbol
* contractType: spot/futures
* aggregateTradeId
* eventTime / eventTimeMs
* price
* volume/quantity
* buyer-maker side:

  * buyerMaker false = aggressive buy
  * buyerMaker true = aggressive sell
* firstTradeId
* lastTradeId
* tradeCount = `lastTradeId - firstTradeId + 1`

Important:

* Store source events once per real market stream:

  * spot
  * futures
* Do not duplicate records per `dataSourceMode`.
* Do not align/rewrite price to another contract.
* Persist actual aggTrade event price.
* Skip events with missing/invalid aggregateTradeId in v1.

Use batching with the existing collector flush cycle. Do not write one database row per event synchronously.

4. Deduplication

Deduplicate by:

`symbol + contractType + aggregateTradeId`

Deduplication should happen:

* in memory before enqueue if practical
* during Mongo insert using unique index or unordered bulk insert with duplicate-key handling

Track metrics:

* received
* qualified
* skippedBelowThreshold
* skippedMissingAggregateTradeId
* duplicatesSkipped
* inserted
* insertFailed

5. Add storage module

Add a clean storage module for aggregate bubble events using:

* `BUBBLES_MONGODB_URI`
* `BUBBLES_MONGODB_DB_NAME`

Suggested methods:

* `storeAggregateBubbleEvents(events)`
* `getAggregateBubbleEvents({ symbol, contractTypes, startTime, endTime, limit })`

Keep this separate from footprint/profile storage if cleaner.

6. Add restore API

Create:

`/api/history/aggregate-bubbles`

It should accept:

* symbol
* contractType or marketSource
* startTime
* endTime
* optional limit

Rules:

* `spot` returns spot events
* `futures` returns futures events
* `both` returns both
* `active` should map to the current active contract type if passed clearly

Add safety guards:

* max range around 6 hours for v1
* max row limit to avoid huge responses

Return rows in BubbleEvent-compatible shape:

* time
* price
* side
* volume
* tradeCount
* source: `aggregateTrade`
* symbol
* contractType
* aggregateTradeId
* firstTradeId
* lastTradeId

7. Frontend restore / hydration

In `components/FeedProvider.tsx`, add aggregate bubble restore.

Requirements:

* frontend only fetches; it does not write
* fetch aggregate bubble events for the restored/history range
* hydrate them into the existing aggregate bubble buffer
* dedupe restored + live events
* preserve live appends
* keep existing buffer cap behavior safe

Rendering should still apply current UI filters:

* Market Source
* Size By Volume / Orders
* Min Volume / Min Orders
* Side Filter
* Scale Mode
* Min Radius / Max Radius

Persistence should not force bubbles to render. It only makes historical candidate events available.

8. Debug updates

Extend `window.__MARKET_DEBUG__.getSnapshot().aggregateBubbles` with:

* restored event count
* live event count
* total hydrated count
* duplicate skipped count
* restore query range
* restored spot count
* restored futures count
* min/max restored event time
* storage thresholds:

  * min volume
  * min trade count
  * min trade-count volume
* current rendered count after restore

9. Do not change existing systems

Do not change:

* Footprint Cell bubble rendering
* footprint aggregation
* footprint storage/restore
* volume profile storage/restore
* aggregate bubble source switching
* aggregate bubble market-source filtering
* Size By Volume / Orders logic
* Min Volume / Min Orders logic
* raw trade support
* grouping/clustering
* tooltip behavior
* iceberg logic

10. Validation

Run:

* `npx.cmd tsc --noEmit`

If lint has unrelated existing failures, mention them but do not fix unrelated files.

Expected result:

* Collector stores only qualified aggregate trade bubble candidates.
* Minimum volume threshold defaults to 15 BTC, not 5 BTC.
* Mongo connection uses `BUBBLES_MONGODB_URI` and `BUBBLES_MONGODB_DB_NAME`.
* Frontend restores aggregate bubbles after refresh/reload through API.
* Frontend remains read-only for aggregate bubble history.
* Live + restored aggregate events do not duplicate.
* Footprint Cells remain unchanged.
* Aggregate bubbles remain filterable by existing UI settings after restore.
