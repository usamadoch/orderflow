Audit the current collector/history architecture before implementing Aggregate Trade Bubble persistence.

Do not implement changes yet. Only inspect and report.

Context:

* The chart app itself should not write market data to the database.
* The app should only:

  * consume live data for display
  * fetch historical/restored data from database/API
* The background collector script is responsible for writing/saving market data.
* Existing saved data includes footprint and/or volume profile data.
* Aggregate Trade Bubbles currently work live-only inside the app.
* We now want to persist aggregate trade bubble events, but the write path should belong to the collector, not the frontend/chart app.

Audit goals:

1. Collector architecture

* Find the collector script(s) responsible for saving footprint/volume profile/history data.
* Explain how the collector connects to Binance data streams.
* Explain what markets/symbols it collects:

  * spot
  * futures
  * both
* Explain whether it already consumes Binance `aggTrade` streams.
* Explain how it batches/writes data to the database.

2. Existing database/storage model

* Identify current DB tables/schema/models used for:

  * footprint history
  * volume profile history
  * trade/aggTrade data if any
* Explain whether aggregate trade events are already stored anywhere.
* Explain current deduplication strategy, if any.
* Explain current retention/cleanup strategy, if any.

3. Restore/API path

* Find how the frontend requests historical footprint/volume profile data.
* Identify API routes involved.
* Explain how restored data is hydrated into chart state.
* Explain where aggregate bubble history should plug into this restore flow later.

4. Aggregate bubble current architecture

* Identify where live Aggregate BubbleEvents are created.
* Identify whether this is frontend-only or shared with collector/feed code.
* Explain whether the same event model can be reused by collector storage.
* Confirm that chart Aggregate Trade bubbles currently use live in-memory buffer only.

5. Recommended persistence design
   Recommend the safest design for aggregate bubble persistence using collector-only writes.

Specifically answer:

* Should collector store all aggTrade events or only qualified candidate events?
* What minimum storage threshold should be used initially for BTCUSDT?
* Should threshold be based on volume, orders/tradeCount, or both?
* How to avoid DB explosion on busy BTC streams?
* What unique key should be used for deduplication?
* What indexes are needed for fast restore?
* What retention policy should be used initially?

6. Proposed schema
   Suggest a table/schema for persisted aggregate bubble events with fields like:

* symbol
* contractType
* aggregateTradeId
* eventTime
* price
* side
* volume
* tradeCount
* firstTradeId
* lastTradeId
* createdAt

Also suggest indexes.

7. Implementation plan
   Give a phased implementation plan, but do not code:

* collector write path
* DB schema/migration
* restore API
* frontend hydration
* debug updates

Important restrictions:

* Do not make frontend/chart app write aggregate bubble history.
* Do not change footprint storage yet.
* Do not implement grouping/clustering.
* Do not implement raw trade bubbles.
* Do not implement iceberg logic.
* Do not build tooltip UI.

Output format:

* Short summary
* Files/scripts involved
* Current write path
* Current restore path
* Recommended aggregate bubble persistence model
* Proposed schema/indexes
* Risks/performance notes
* Next implementation prompt outline
