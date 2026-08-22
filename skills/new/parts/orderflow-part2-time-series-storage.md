# Order Flow Platform — Part 2: Time-Series Data Storage

*Continuation of the system design reference (Part 1: ingestion, canvas rendering, indicators, caching). This part covers the storage layer in depth, independent of any specific database.*

## Why this layer needs its own design

Footprint, volume profile, CVD, and VWAP are all derived from the same raw material: a high-frequency stream of trades (price, size, side, timestamp) that gets bucketed into price levels and time intervals. The storage layer has to serve two very different access patterns at once:

- **Write path**: near-continuous ingestion from Binance, potentially thousands of trades per second across symbols during volatile periods.
- **Read path**: range queries bounded by *time* and *symbol* — "give me the last 500 candles for BTCUSDT at 5m" or "give me every trade for this footprint cell" — almost never a lookup by a single record's ID.

That access pattern is the whole reason this deserves its own document. It's a different shape of problem than the rest of the app (which is mostly CRUD-shaped: users, sessions, settings, watchlists).

## Where a general-purpose document store struggles

MongoDB isn't wrong for this app overall, but it's the wrong tool specifically for tick/candle data at volume, for a few concrete reasons:

- No native concept of time-bucketed partitioning. Every range query is a collection scan bounded by an index, not a partition prune — so as the collection grows, scan cost grows with it even with a good index on `{symbol, timestamp}`.
- No built-in downsampling. Rolling up ticks into 1m/5m/1h candles either happens in application code on every read, or via a separate scheduled job that writes duplicate rollup collections you now have to keep in sync.
- Document overhead per trade is real overhead. A single trade is maybe 4-5 fields. Storing one document per trade means the storage engine's per-document bookkeeping (BSON headers, index entries) dwarfs the actual data for high-frequency symbols.
- Aggregation pipelines for anything resembling VWAP-over-a-range or CVD-over-a-range are expensive compared to databases built around exactly that kind of columnar aggregation.

None of this means Mongo "can't" do it — plenty of systems bolt a bucket pattern onto Mongo (pack N trades into one document per symbol per minute) and get acceptable results. It just means you're re-implementing, by hand, most of what a purpose-built time-series engine already gives you.

## The real options

**TimescaleDB** (a Postgres extension). Tables are declared as "hypertables" and the engine handles time-based partitioning transparently — you query it like a normal SQL table. Continuous aggregates let you declare "maintain a 1m/5m/1h candle view derived from the raw trades table" and Timescale keeps it updated incrementally instead of you recomputing rollups on every request. Older chunks can be compressed automatically once they're not being actively queried, which keeps storage costs down for history you rarely touch. Since it's Postgres, the Node driver situation is mature and well-documented — no new client ecosystem to learn. Self-hosting is free, and there's a usable free tier on Timescale's managed cloud if you want to skip ops early on.

**ClickHouse**. A column-oriented store built for exactly this kind of aggregation-heavy read pattern, and it's genuinely faster than Timescale at very large scale (billions of rows, multi-symbol, long history). The tradeoff is operational weight — it's not designed for lots of small, low-latency individual writes the way an OLTP database is, so you'd typically batch trades in memory and flush in chunks rather than writing trade-by-trade. Worth planning for later, probably not the right starting point at your current scale (8-100 users).

**QuestDB**. Purpose-built for time series specifically, SQL-like query surface, and benchmarks very well on ingestion throughput with a comparatively light footprint. The catch is a smaller community and ecosystem than Postgres or ClickHouse — fewer Stack Overflow answers, fewer battle-tested patterns to lean on when something goes wrong.

**InfluxDB**. The "classic" time-series database, but worth flagging two friction points before you invest time in it: the query language changed significantly between major versions (Flux getting deprecated in favor of SQL again in v3), and licensing/hosting terms have shifted enough between versions that it's easy to build against docs for the wrong one. Not a dealbreaker, just something to verify current-state on before committing.

**Mongo with a bucket pattern**. Viable as a stopgap, not a destination. If you wanted to ship something this week without adding a new database to your stack, this is how you'd do it — but it doesn't solve the aggregation-speed problem the way a real time-series engine does, and you'd be migrating off it eventually anyway.

## Recommendation for where you are right now

**TimescaleDB.** The reasoning specific to your situation:

- You're staying in a JS/Node environment by choice — the `pg` driver ecosystem for Postgres is as mature as it gets, so there's no new client paradigm to learn.
- Continuous aggregates solve your VWAP/candle-rollup problem directly — you stop hand-rolling rollup logic in application code, which is one less place for the kind of bug that causes silent data drift.
- It's SQL. If you ever bring someone else onto this project (which you said is the actual goal — other people using this, not just you), SQL is a much lower onboarding cost than a bespoke query language.
- It scales into ClickHouse-territory problems gracefully — you don't have to rip it out later if usage grows past what a single Postgres instance handles well; you'd add ClickHouse alongside it for historical analytics while Timescale keeps serving live/recent data.

## How Redis fits in front of this

Redis isn't a replacement for the time-series database — it's a cache in front of it, and it's the piece that most directly fixes your current hang/freeze symptoms.

- Recent data (today, or the last N hours per symbol) lives in Redis — sorted sets keyed by timestamp, or Redis Streams if you want built-in consumer-group semantics for downstream processing.
- Ingestion writes to Redis first (fast, in-memory, non-blocking) and asynchronously persists to Timescale in the background. This decouples "a burst of trades just arrived" from "the UI is waiting on a database write" — which is very likely part of what's causing the freeze under load today.
- Chart reads for "recent" data hit Redis. Reads for anything older fall through to Timescale. The app never needs to know which one it hit; that logic lives in one data-access layer.
- On restart or cache miss, Redis rehydrates from Timescale — it's a cache, not a source of truth, so losing it isn't a data-loss event.

## Pagination and the freeze, tied together

Your pagination problem and your freeze problem are very likely the same root cause: the app is fetching more than the canvas can currently render and processing it eagerly. The fix that falls naturally out of the storage design above is **viewport-driven fetching** — the canvas's visible time range determines the query window, not "load a large page and filter client-side." Combined with Redis serving the hot recent range and Timescale serving everything older in properly bounded windows, both symptoms should improve without either one being treated as its own separate fix.

## What carries over from 1.0 and what doesn't

Because the schema shape changes meaningfully (hypertables and continuous aggregates vs. Mongo collections), the storage layer itself isn't something to port — it gets rebuilt against this design. What *does* carry over from your 1.0 codebase, per your map.md/logs plan:

- Binance WebSocket connection handling — reconnect/backoff logic, symbol normalization, rate-limit handling. This is independent of where the data ends up.
- Anything in the ingestion pipeline that parses and validates incoming trade data before it's written anywhere.
- UI, session/header/sidebar logic, and indicator *calculation* logic (as opposed to indicator *storage/retrieval*) — these don't care what database is underneath them, only that the data-access layer returns the right shape.
