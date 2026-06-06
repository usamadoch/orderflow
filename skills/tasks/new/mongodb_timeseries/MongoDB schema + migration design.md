

candles must be source-scoped in MongoDB with contractType, because the audit showed current candles are not source-scoped.

Design only. Do not implement MongoDB yet.

Based on artifacts/storage_migration_audit.md, create a MongoDB migration design for the market-data storage layer.

Goal:
Design MongoDB collections, schemas, indexes, TTL policy, and adapter strategy before implementation.

Design MongoDB collections for:

1. Candles
Collection: market_candles_ts
Type: MongoDB time-series
Must support:
- symbol
- contractType
- timeframe
- candle time
- OHLCV
- source-safe restore by symbol/contractType/timeframe/time range

2. Footprint cells
Collection: footprint_cells_ts
Type: MongoDB time-series
Canonical base only:
- timeframe = 1m
- bucketSize = 5
Must support:
- symbol
- contractType
- dataSourceMode
- candle time
- bucket price
- bid/ask/total/delta fields
- restore by symbol/source/time range

3. Volume Profile fine rows
Collection: profile_rows_ts
Type: MongoDB time-series
Canonical base only:
- timeframe = 1m
- baseBucketSize = tickSize
Must support:
- symbol
- contractType
- dataSourceMode
- candle time
- bucket price
- bid/ask/total/tradeCount
- restore by symbol/source/baseBucketSize/time range

4. Candle delta
Collection: candle_delta_ts or embedded candle field
Decide whether candle_delta should be separate or merged into candles.

5. Collector/meta
Collection: collector_meta
Normal MongoDB collection.

6. raw_trades
Do not migrate yet unless clearly needed.
Design future schema only.

Important design requirements:
- Use timeField and metaField correctly for MongoDB time-series.
- Put stable source identity inside meta.
- Avoid putting high-cardinality changing values in bad places.
- Define indexes needed for restore queries.
- Define TTL expiration strategy for 7 days by default, configurable later.
- Explain how decimal prices should be stored safely.
- Explain how to avoid duplicate writes.
- Explain whether old libSQL remains fallback during transition.

Also design a storage adapter interface:
- common read/write methods
- libSQL implementation remains current fallback
- MongoDB implementation added behind env flag:
  MARKET_DB_DRIVER=libsql | mongodb

Output:
Create:
artifacts/mongodb_storage_design.md

Sections:
# MongoDB Storage Design
## 1. Migration Strategy
## 2. Collections
## 3. Time-Series Collection Options
## 4. Meta Fields
## 5. Indexes
## 6. TTL / Retention
## 7. Storage Adapter Interface
## 8. Migration Order
## 9. Risks and Decisions

Do not implement code yet.