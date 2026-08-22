
Implement the first real MongoDB market-data migration: candles/OHLCV only.

Before implementing, read and follow:
- artifacts/mongodb_storage_design.md

Use these documents as the source of truth for collection names, schema shape, indexes, adapter strategy, env flags, and migration order. Do not invent a different MongoDB structure unless the document is clearly wrong; if something conflicts, stop and explain before coding.

Goal:
When MARKET_DB_DRIVER=mongodb, candle/OHLCV storage and restore should use MongoDB. When MARKET_DB_DRIVER is unset or libsql, existing libSQL behavior must remain unchanged.

Important constraints:
- Migrate candles only in this task.
- Do not migrate footprint_cells yet.
- Do not migrate fine_profile_rows yet.
- Do not migrate raw_trades.
- Do not change chart UI.
- Do not change feed registry behavior.
- Do not change footprint/profile caches.
- Do not remove libSQL code.
- Keep libSQL as default fallback.

MongoDB candle collection:
Use the design document’s candle collection, likely:
- market_candles_ts
- MongoDB time-series collection
- timeField: ts
- metaField: meta

Candle identity must be source-scoped:
- meta.symbol
- meta.contractType
- meta.timeframe
- ts/openTime

This is important because the audit showed current candles are not source-scoped. MongoDB migration should fix that.

Implement:
1. MongoDB candle collection initialization
- Create collection if missing.
- Create time-series collection with correct timeField/metaField.
- Add required indexes for restore/query by meta.symbol, meta.contractType, meta.timeframe, and ts range.
- Add duplicate protection/update strategy for same symbol/contractType/timeframe/openTime.

2. Mongo adapter candle methods
Implement MongoDB versions of:
- write/insert/upsert candles
- batch candle writes if existing storage supports it
- restore/read candles by symbol + contractType + timeframe + time range or limit
- any candle history method used by app routes/actions

3. Storage adapter routing
Wire only candle-related read/write paths through the selected storage adapter.
- MARKET_DB_DRIVER=mongodb → Mongo candles
- default/libsql → existing libSQL candles

4. Keep existing app behavior
The chart should still load historical candles, merge live candles, and update normally.

5. Metrics/debug
Add small diagnostics if useful:
- Mongo candle writes
- Mongo candle rows/documents restored
- collection/index init status

Validation:
- With MARKET_DB_DRIVER unset/libsql, app works as before.
- With MARKET_DB_DRIVER=mongodb, candles are written to MongoDB.
- Refresh restores candles from MongoDB.
- Spot and futures candles do not mix.
- 1m and 5m candles do not mix.
- Split panels with same candle key still work.
- TypeScript passes.
- Targeted lint passes.

Output:
1. Explain files changed.
2. Confirm libSQL remains default.
3. Confirm Mongo candle collection/options/indexes.
4. Confirm candle writes use Mongo only when MARKET_DB_DRIVER=mongodb.
5. Confirm candle restores use Mongo only when MARKET_DB_DRIVER=mongodb.
6. Mention limitations and what is still on libSQL.