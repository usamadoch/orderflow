I need to fix a serious regression in footprint persistence/restore after refresh.

Context:
Before the recent performance-rendering work, MongoDB time-series storage/restore was working correctly:
- candles were stored/restored from MongoDB
- footprint_cells_ts stored/restored canonical 1m/$5 footprint cells
- fine profile rows stored/restored
- after refresh or opening a fresh incognito tab, historical footprint data came back correctly

Now there is a regression:
After refresh or opening a new tab, some candles randomly lose footprint data even though I clearly saw footprint data on those same candles before refresh.

The missing data pattern is random:
- some candles restore correctly
- then 2–3 candles may be missing or half-filled
- then more candles restore correctly
- then another random gap appears
- it is not only the current open candle
- it happens on already visible/previously loaded candles

Goal:
Find whether the issue is:
1. footprint rows are not being written to MongoDB,
2. footprint rows are written but restore query does not fetch them,
3. rows are fetched but not hydrated into the footprint cache/engine,
4. hydrated rows exist but renderer is not using them,
5. recent cache cleanup/performance changes are deleting or skipping restored data incorrectly.

Important:
Do not refactor the app.
Do not change rendering optimization logic unless it is proven to be the cause.
Do not change chart visuals.
Do not change MongoDB schema unless absolutely necessary.
Do not guess-fix.
First prove where the chain breaks, then make the smallest fix.

Audit and trace this full chain:

live aggTrade
→ AggregationEngine / footprint base slice created
→ canonical 1m/$5 footprint rows queued for storage
→ footprint rows written to MongoDB footprint_cells_ts
→ /api/history/footprint restore query after refresh
→ rows fetched from MongoDB
→ rows hydrated into shared footprint cache / AggregationEngine
→ chart renders restored footprint cells

Add temporary focused diagnostics with prefix:

[FOOTPRINT_RESTORE_DEBUG]

Diagnostics needed:

1. Write diagnostics
For each closed 1m footprint slice:
- symbol
- contractType
- dataSourceMode
- timeframe used for storage
- bucketSize
- candleTime
- row count written
- min/max bucketPrice
- whether write was skipped
- skip reason

2. MongoDB write confirmation
Inside Mongo footprint write method:
- documents received
- documents inserted/skipped
- candleTime count
- min/max candleTime
- duplicate/existing count if adapter-level duplicate protection is used
- query key used for duplicate check

3. Restore API diagnostics
Inside /api/history/footprint:
- symbol
- contractType
- dataSourceMode
- requested timeframe
- storage timeframe
- start/end
- bucketSize
- rows fetched
- distinct candleTime count
- min/max candleTime
- list of candleTimes returned, or a compact sample

4. Hydration diagnostics
When restored footprint rows are inserted into cache/engine:
- rows received
- rows accepted
- rows rejected/skipped
- reason if skipped
- distinct candleTime count
- min/max candleTime

5. Renderer/candle coverage diagnostics
For the visible candle range after restore:
- visible candle count
- how many visible candles have footprint data
- which visible candleTimes are missing footprint data
- whether missing candleTimes exist in Mongo restore result
- whether missing candleTimes exist in shared footprint cache

6. Cleanup safety check
Inspect recent cache cleanup/performance changes and verify:
- active footprint cache is not trimming recent restored slices incorrectly
- cleanup does not delete slices inside visible range
- cleanup does not clear restored rows because loadedRanges/missingBaseSliceCount is wrong
- render throttling does not affect data hydration

Likely files:
- components/FeedProvider.tsx
- lib/aggregation/engine.ts
- lib/aggregation/footprintCache.ts
- lib/actions/storageActions.ts
- lib/db/mongo/marketStorageMongo.ts
- app/api/history/footprint/route.ts
- components/chart/drawFootprint.ts
- components/chart/ChartCanvas.tsx

Output after investigation:
1. State the root cause clearly.
2. Say whether rows are missing at write, restore, hydration, cache, or render stage.
3. List exact files/functions involved.
4. Implement the smallest fix only.
5. Confirm MongoDB footprint persistence/restore works again after refresh.
6. Confirm the fix does not touch unrelated rendering/performance code unless that was the proven cause.
7. Mention how I should test it visually and with debug logs.

Validation I will run:
- Open chart in footprint mode.
- Let 10–20 candles collect.
- Confirm footprint cells appear live.
- Refresh page.
- Confirm the same closed candles restore footprint cells.
- Open fresh incognito tab.
- Confirm footprint restore still works.
- Check MongoDB footprint_cells_ts has rows for those missing candleTimes.