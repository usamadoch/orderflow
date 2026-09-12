# btcusdtCollector.mjs — File Navigation & Context Map

## Overview

- **Source File**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Total Lines**: ~1,669 lines
- **Primary Responsibility**: Standalone 24/7 background Node.js daemon for ingesting live BTCUSDT Spot and Futures market data into TimescaleDB. Handles high-frequency WebSocket streams, 1m canonical slice aggregation (footprint cells and fine Volume Profiles), candidate aggregate trade bubbles, gap detection and audit recording, memory buffer caps, and historical REST backfills.
- **Runtime Environment**: Designed to run independently of Next.js (e.g. systemd/PM2 on AWS EC2 or Linux VPS) with zero runtime dependencies except `pg` and `ws`.

---

## Quick Navigation Index

| Feature / Task Area | Section | Approximate Line Range |
|---|---|---|
| Zero-Dependency Pino Logger & Burst Collapsing | [Section 1: Standalone Logger](#section-1-standalone-logger) | Lines 1–195 |
| Configuration, Env Variables & Buffer Thresholds | [Section 2: Config & Buffer Thresholds](#section-2-config--buffer-thresholds) | Lines 196–268 |
| Process Bootstrap & TimescaleDB Client Init | [Section 3: Process Bootstrap & DB Init](#section-3-process-bootstrap--db-init) | Lines 269–382 |
| Runtime Factory & WebSocket Stream Client | [Section 4: Runtime Factory & WebSocket Client](#section-4-runtime-factory--websocket-client) | Lines 383–513 |
| Stream Message Ingestion & Bubble Extraction | [Section 5: Stream Ingestion & Bubbles](#section-5-stream-ingestion--bubbles) | Lines 514–639 |
| 1m Slice Aggregation (Footprint & Profile) | [Section 6: Real-Time 1m Slicing](#section-6-real-time-1m-slicing) | Lines 640–732 |
| Slice Persistence Engine & Write Triggers | [Section 7: Slice Persistence Engine](#section-7-slice-persistence-engine) | Lines 733–894 |
| Bubble Persistence & Payload Formatters | [Section 8: Bubble Persistence & Formatters](#section-8-bubble-persistence--formatters) | Lines 895–1032 |
| TimescaleDB Batch SQL Ingestion Queries | [Section 9: Direct TimescaleDB SQL Ingestion](#section-9-direct-timescaledb-sql-ingestion) | Lines 1033–1166 |
| Gap Detection, Tainted Ranges & Slice Purging | [Section 10: Gap Tracking & Tainted Ranges](#section-10-gap-tracking--tainted-ranges) | Lines 1167–1281 |
| Health Metrics, Memory Stats & Status Logging | [Section 11: Health Monitoring & Status Logs](#section-11-health-monitoring--status-logs) | Lines 1282–1407 |
| Graceful Shutdown & Price Normalization Math | [Section 12: Shutdown & Math Utilities](#section-12-shutdown--math-utilities) | Lines 1408–1476 |
| Historical Backfill Engine (REST Pagination) | [Section 13: Historical Backfill Engine](#section-13-historical-backfill-engine) | Lines 1477–1586 |
| Bounded Memory Collections & Error Utilities | [Section 14: Bounded Sets & Error Pipeline](#section-14-bounded-sets--error-pipeline) | Lines 1587–1669 |

---

## Logical Section Breakdowns

### Section 1: Standalone Logger
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 1–195
- **What It Does**:
  - Implements a self-contained, high-performance logger matching Pino JSON format without requiring npm dependencies.
  - Burst-collapsing engine (`handleBurstLog`): aggregates identical repeating log messages across a sliding window to prevent disk saturation during high-volatility events.
  - Periodic flush loop (`flush`) and formatted stdout/stderr stream writers.
- **When an Agent Should Read This**:
  - When modifying collector log formats, tuning log noise reduction, or debugging log output in systemd journals.

---

### Section 2: Config & Buffer Thresholds
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 196–268
- **What It Does**:
  - Declares system constants: `BASE_BUCKET_SIZE` (10 for BTCUSDT = $1.00 ticks), `SLICE_INTERVAL_MS` (60,000ms = 1m).
  - Buffer safety limits: `PENDING_SLICES_ALERT_AGE_MS` (2 hours), `BUFFER_DROP_CAP` (maximum pending slices allowed before oldest are purged).
  - Reconnect jitter ranges, ping/pong timeouts, and gap tolerance thresholds.
- **When an Agent Should Read This**:
  - When tuning buffer limits, adjusting tick resolution, or configuring heartbeat timers.

---

### Section 3: Process Bootstrap & DB Init
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 269–382
- **What It Does**:
  - `main()`: Entry point that loads configuration, verifies runtime Node version, starts TimescaleDB connection pool, launches stream clients, and registers shutdown signal hooks.
  - `loadConfig()`: Reads environment variables (`DATABASE_URL`, `BINANCE_SPOT_WS_URL`, etc.).
  - `initTimescale()`: Creates `pg.Pool` instance and checks database connectivity.
- **Relevant Dependencies**:
  - Database schema: [scripts/collector/migrations/001_collector_gaps.sql](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/migrations/001_collector_gaps.sql)
- **When an Agent Should Read This**:
  - When investigating startup failures, database connection pooling parameters, or configuration validation.

---

### Section 4: Runtime Factory & WebSocket Client
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 383–513
- **What It Does**:
  - `createRuntime(target)`: Instantiates in-memory state for a stream target (`spot` or `futures`), holding pending slices, dedup sets, and gap trackers.
  - `createBinanceStreamClient(source)`: Resilient WebSocket client wrapper featuring:
    - Auto-reconnect with exponential backoff and jitter.
    - Application-level heartbeat ping/pong monitoring.
    - Connection state lifecycle reporting.
- **When an Agent Should Read This**:
  - When troubleshooting WebSocket disconnects, reconnect loops, or socket heartbeat deadlocks.

---

### Section 5: Stream Ingestion & Bubbles
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 514–639
- **What It Does**:
  - `handleStreamMessage(source, raw)`: Parses Binance `@aggTrade` payloads.
  - Validates trade structure and normalizes timestamps.
  - `queueAggregateBubbleCandidate(trade)`: Evaluates trade size against bubble volume thresholds and buffers candidate events for batch persistence.
- **When an Agent Should Read This**:
  - When modifying trade payload parsing, bubble filtering logic, or trade deduplication.

---

### Section 6: Real-Time 1m Slicing
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 640–732
- **What It Does**:
  - `ingestTrade(runtime, trade)`: Determines the 1m time slice (`baseTime`) for each trade.
  - `aggregateFootprint`: updates buy/sell volume and delta clusters at price levels.
  - `aggregateProfile`: updates Volume Profile total volume, trade counts, and buying volume per price row.
  - Checks if older 1m slices are complete and queues persistence triggers.
- **Intra-file Dependencies**:
  - Feeds structured slices into Section 7 for database insertion.
- **When an Agent Should Read This**:
  - When debugging footprint/profile accumulation math, bid/ask attribution, or 1m slice boundary alignment.

---

### Section 7: Slice Persistence Engine
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 733–894
- **What It Does**:
  - `persistAllEligibleSlices`, `persistRuntimeEligibleSlices`: scans in-memory slices that have closed (older than current minute - safety buffer).
  - Formats footprint cells and profile rows into database documents.
  - `writeClosedSlice`: transactional write coordinator with retry logic.
  - Deletes persisted slices from memory to prevent RAM accumulation.
- **When an Agent Should Read This**:
  - When troubleshooting pending slice backlogs, database write timeouts, or slice eviction rules.

---

### Section 8: Bubble Persistence & Formatters
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 895–1032
- **What It Does**:
  - `persistAggregateBubbleEvents`: batches and flushes queued bubble candidates.
  - `toFootprintDocuments`: converts footprint price map to SQL hypertable records.
  - `toProfileDocuments`: converts profile rows to SQL hypertable records.
- **When an Agent Should Read This**:
  - When changing document schemas, SQL column mappings, or bubble candidate batch sizes.

---

### Section 9: Direct TimescaleDB SQL Ingestion
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 1033–1166
- **What It Does**:
  - High-throughput parameterized SQL `INSERT` statements with `ON CONFLICT DO NOTHING`:
    - `insertMissingFootprintDocuments`: inserts into `market_footprint`.
    - `insertMissingProfileDocuments`: inserts into `market_profile`.
    - `insertAggregateBubbleDocuments`: inserts into `market_aggregate_bubbles`.
    - `updateCollectorMeta`: records collector heartbeat and watermark timestamps in `collector_meta`.
- **When an Agent Should Read This**:
  - When altering database table structures, indexing, conflict handling, or SQL query performance.

---

### Section 10: Gap Tracking & Tainted Ranges
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 1167–1281
- **What It Does**:
  - `markSourceGap`: tracks disconnects and sequence gaps in live WebSocket feeds.
  - `insertGapRecord`: logs structured gap records into `collector_gaps` table for historical auditability.
  - `hasActiveTaintedRanges`, `getAllTaintedRanges`: ensures data slices overlapping unrecoverable gaps are flagged or isolated.
- **When an Agent Should Read This**:
  - When inspecting data reliability, gap logging, or tainted slice isolation logic.

---

### Section 11: Health Monitoring & Status Logs
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 1282–1407
- **What It Does**:
  - `getPersistenceHealth`: evaluates pending slice count, oldest slice age, and memory usage.
  - `logStatus`: periodic status logger (every 60s) printing throughput (trades/sec), pending slices, database latency, and RAM consumption.
- **When an Agent Should Read This**:
  - When diagnosing collector memory leaks, pending write bottlenecks, or health metric reporting.

---

### Section 12: Shutdown & Math Utilities
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 1408–1476
- **What It Does**:
  - `shutdown`: intercepts `SIGINT`/`SIGTERM`, flushes pending slices to database, closes WebSocket connections, and drains pg connection pool.
  - Numeric utilities: `normalizePriceToBucket`, `getBaseTimeForTradeMs`, `toStoredNumber`.
- **When an Agent Should Read This**:
  - When adjusting process termination safety, ensuring zero data loss on restart, or modifying price bucket rounding.

---

### Section 13: Historical Backfill Engine
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 1477–1586
- **What It Does**:
  - `runBackfill`: fetches historical aggTrades via Binance REST API (`/api/v3/aggTrades` or `/fapi/v1/aggTrades`) to patch detected gaps.
  - Paginates trades across specified time intervals and feeds them through slicing and persistence pipelines.
- **When an Agent Should Read This**:
  - When configuring gap backfilling, tuning REST rate limit delays, or running historical data backfills.

---

### Section 14: Bounded Sets & Error Pipeline
- **File Path**: [scripts/collector/btcusdtCollector.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/scripts/collector/btcusdtCollector.mjs)
- **Line Range**: Lines 1587–1669
- **What It Does**:
  - `BoundedSet`: LRU-style set with fixed capacity to prevent trade ID deduplication cache from exhausting memory.
  - Helper functions for formatting socket errors and pipe failures.
- **When an Agent Should Read This**:
  - When reviewing memory bounds for deduplication sets or unhandled exception handling.
