Implement the next MongoDB market-data migration: footprint_cells and fine_profile_rows only.

Before implementing, read and follow:
- artifacts/mongodb_storage_design.md

Also review the candle Mongo migration already implemented and follow the same adapter/driver pattern.

Goal:
When MARKET_DB_DRIVER=mongodb, canonical footprint and Volume Profile base rows should use MongoDB. When MARKET_DB_DRIVER is unset or libsql, existing libSQL behavior must remain unchanged.

Important constraints:
- Do not migrate raw_trades in this task.
- Do not migrate candle_delta unless absolutely required.
- Do not change chart UI.
- Do not change feed registry behavior.
- Do not change cache architecture.
- Do not remove libSQL code.
- Keep libSQL as default fallback.

Part A: Footprint cells Mongo migration

Use MongoDB time-series collection from the design document, likely:
- footprint_cells_ts
- timeField: ts
- metaField: meta

Canonical identity:
- meta.symbol
- meta.contractType
- meta.dataSourceMode
- meta.timeframe = 1m
- meta.bucketSize = 5
- ts = candle time
- bucketPrice / price level

Must preserve current behavior:
- footprint storage is canonical 1m/$5
- selected chart timeframe derives from 1m base
- selected display bucket size aggregates from $5 base
- source modes remain isolated

Implement Mongo methods for:
- write/upsert footprint rows
- batch write footprint rows
- restore footprint rows by symbol + contractType + dataSourceMode + time range
- duplicate protection for same source/time/bucketPrice

Part B: Volume Profile fine rows Mongo migration

Use MongoDB time-series collection from the design document, likely:
- profile_rows_ts
- timeField: ts
- metaField: meta

Canonical identity:
- meta.symbol
- meta.contractType
- meta.dataSourceMode
- meta.timeframe = 1m
- meta.baseBucketSize = tickSize/fine profile base step
- ts = candle time
- bucketPrice / price level

Must preserve current behavior:
- profile rows are canonical 1m fine rows
- profile display row size aggregates in memory
- refresh persistence works
- timeframe switch stability works
- source modes remain isolated

Implement Mongo methods for:
- write/upsert fine profile rows
- batch write fine profile rows
- restore profile rows by symbol + contractType + dataSourceMode + baseBucketSize + time range
- duplicate protection for same source/time/bucketPrice/baseBucketSize

Storage adapter routing:
- MARKET_DB_DRIVER=mongodb → Mongo footprint/profile rows
- default/libsql → existing libSQL footprint/profile rows

TTL:
If the design document specifies TTL for these time-series collections, implement it carefully.
Default target retention: 7 days if not otherwise configured.
Make retention configurable by env if design says so.
Do not accidentally delete data immediately in dev.

Validation:
- With libSQL/default, app still works exactly as before.
- With MARKET_DB_DRIVER=mongodb:
  - footprint data persists after refresh.
  - 5m/15m footprint derives from 1m/$5 Mongo-restored base.
  - bucket-size changes do not trigger DB-specific restores.
  - volume profile persists after refresh.
  - volume profile row-size changes still re-aggregate instantly.
  - source isolation works.
  - split-panel reuse still works through caches.
- TypeScript passes.
- Targeted lint passes.

Output:
1. Explain files changed.
2. Confirm libSQL remains default.
3. Confirm Mongo collection/options/indexes for footprint/profile.
4. Confirm footprint writes/restores use Mongo only when MARKET_DB_DRIVER=mongodb.
5. Confirm profile writes/restores use Mongo only when MARKET_DB_DRIVER=mongodb.
6. Confirm raw_trades are still not migrated.
7. Mention limitations and risks.