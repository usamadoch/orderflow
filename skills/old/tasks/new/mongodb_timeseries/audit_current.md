I want to migrate the market-data storage layer from current libSQL/Turso toward MongoDB time-series collections, but first I need a complete storage audit.

Goal:
Map the current database/storage architecture so we know exactly what must be migrated.

Inspect and document:

1. Current DB setup
- What database is currently used?
- Where connection/init happens?
- What env vars are used?
- What files own DB schema, migrations, reads, and writes?

2. Current tables/models
For each table/model, document:
- table name
- purpose
- key columns
- indexes/unique keys
- retention/cleanup behavior
- whether it is time-series data or normal metadata

Focus especially on:
- candles
- footprint_cells
- candle_delta
- fine_profile_rows
- raw_trades
- collector_meta

3. Write paths
For each market-data type, explain:
- where writes happen
- which function writes it
- which API/server action triggers it
- whether writes are batched or per-event

4. Read/restore paths
For each market-data type, explain:
- where restore happens
- which API route/function reads it
- query keys used
- range behavior
- source-scoping behavior

5. Migration classification
Classify each data type as:
- MongoDB time-series collection
- normal MongoDB collection
- should stay local/in-memory
- should be ignored/deprecated

6. Risks
Mention risks like:
- source identity mismatch
- old legacy rows
- raw_trades symbol-only behavior
- TTL differences
- decimal precision
- duplicate writes
- query performance

Output:
Create a markdown audit document at:
artifacts/storage_migration_audit.md

Sections:
# Storage Migration Audit
## 1. Current DB Setup
## 2. Current Tables and Purpose
## 3. Write Paths
## 4. Read/Restore Paths
## 5. Time-Series vs Normal Collection Classification
## 6. Migration Risks
## 7. Recommended MongoDB Migration Order

Do not implement MongoDB yet.
Do not change runtime behavior.