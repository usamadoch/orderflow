



# Order-Flow Trading Platform — System Design & Theory Reference

### How to use this document

You've already built a working, personal version of this: a Binance-fed order-flow platform with footprint charts, volume profile, custom sessions, bubbles, and a few signal indicators (absorption, exhaustion), running on a Node/MongoDB backend with a custom HTML5 canvas front end. This document doesn't re-teach that part. It's written for the next phase — turning a single-user tool into something 8, 20, or 100 people can use at the same time without it falling over, and going deeper on the theory behind the indicators than you needed to when you were the only user.

It covers five things, in this order: how market data gets into your system (ingestion), where it lives once it's there (storage), how it gets drawn on screen (rendering), what math actually produces each indicator (algorithms), and how the whole thing holds up under multiple concurrent users (caching and scaling). It deliberately leaves out hosting costs, licensing, and which language or framework to build the desktop/mobile shell in — those are separate decisions from how the system itself should be *designed*, and mixing them in muddies the architecture thinking.

Wherever the document introduces a technical term, it explains the plain-English idea first, and puts the formula or the precise mechanics in its own clearly separated part right after — not woven into the same paragraph. That way you can read the whole thing at the "understand it" level on a first pass, and come back to the formulas as a reference later.

---

## Part 1 — Data Ingestion and Pipeline Architecture

### 1.1 What "ingestion" actually means

Ingestion is everything that happens between "Binance sends a message" and "your system has a clean, internal, exchange-independent record of what happened." It sounds trivial but it's where most of the correctness bugs in a trading app come from — a missed message, a message applied out of order, or a reconnect that silently drops a chunk of data will quietly corrupt every indicator built on top of it. Footprint, CVD, and volume profile are all *cumulative* — they add up over time — so a single gap in the raw feed doesn't just cause one bad candle, it throws off every bar after it until something resets.

### 1.2 What Binance actually gives you

Three WebSocket streams matter for this kind of platform:

- **Trade stream (`aggTrade`)** — every executed trade, aggregated when multiple fills happen at the same price in the same event. Each message tells you the price, quantity, and — critically — whether the buyer was the "maker" (the resting limit order) or the "taker" (the aggressor). This single flag is what lets you classify every trade as buyer-initiated or seller-initiated, which is the raw input for CVD and footprint. You should build footprint and volume-profile bars from this raw trade stream yourself, not from Binance's own candle stream — the exchange's candles only give you OHLCV, not the price-by-price breakdown you need.
- **Order book diff stream (`depth`)** — incremental updates to the order book (price levels added, changed, removed), pushed every 100ms or 1000ms depending on which stream you subscribe to. This is *not* a full snapshot; it's a diff, and it only makes sense once you have a starting point.
- **Kline stream** — pre-built candles, updated roughly once a second. Useful as a sanity check or for simple price charts, but not the source of truth for anything order-flow-specific.

### 1.3 Snapshot-plus-diff: how you actually get a correct order book

Binance's own docs are explicit about this, and it's worth internalizing because it's the single most common source of "why does my depth data look wrong" bugs: you cannot build a correct order book from the diff stream alone. The correct sequence is:

1. Start buffering diff events from the WebSocket stream, but don't apply them yet.
2. Separately, call the REST endpoint for a full order book snapshot (up to 5,000 levels per side).
3. Discard any buffered diff events that are older than the snapshot.
4. Apply the remaining diffs, in order, on top of the snapshot.
5. From then on, apply every new diff as it arrives, maintaining your own in-memory book.

Each diff carries sequence numbers (a "first update ID" and "last update ID," and on futures streams a "previous update's last ID" as well) specifically so you can detect a gap — if the previous-update-ID on an incoming message doesn't match the last-update-ID you already applied, a message was lost somewhere, and your local book is now wrong. The correct response isn't to keep going; it's to throw away your in-memory book and re-run the snapshot-plus-diff process from step 2. This is a real scenario, not a theoretical one — connections drop, messages get delayed, and if you don't check for gaps, you'll get a book that silently drifts out of sync with reality and never tells you it happened.

### 1.4 The pipeline shape

In plain terms, data should flow through distinct, single-purpose stages rather than one function doing everything:

**Exchange connection → Normalizer → Event bus → Consumers.**

The **exchange connection** layer's only job is talking to Binance: opening the WebSocket, responding to the exchange's keep-alive pings (Binance's servers ping every few minutes and will drop you if you don't respond within a window — this needs an explicit health check, not an assumption that the connection stays open forever), and handling reconnects and resubscription.

The **normalizer** converts Binance's specific message shape into your own internal event format. This matters more than it looks like it does: today you're only pulling from Binance, but you've already said forex and other instruments are coming later, and those will come from a different exchange or broker with a completely different message format. If every downstream piece of your system (footprint builder, CVD calculator, persistence writer) is written against Binance's raw JSON shape, adding a second data source means touching all of them. If everything downstream only ever sees your own internal event shape, adding a second source means writing one more normalizer, and nothing else changes. This is the one piece of "future-proofing" worth doing early, because it's cheap now and expensive to retrofit later.

The **event bus** is an internal message queue that decouples "data arrived" from "data gets processed." Instead of the network code directly calling your footprint-builder function, it drops a normalized event onto a queue, and separate consumer processes read from that queue at their own pace. (Part 5 covers what technology should sit here — this is where Redis Streams comes in.)

**Consumers** read off the bus and each do one job: one consumer maintains the live in-memory order book, one builds the rolling footprint/CVD/volume-profile aggregates, one writes raw and aggregated data to the database, and one broadcasts processed updates out to connected clients. Splitting these apart means a slow database write never blocks the order book from updating, and a burst of trades never blocks the WebSocket broadcast to your users.

### 1.5 Terms worth knowing

**Backpressure** — what happens when data arrives faster than a consumer can process it. If you don't handle this explicitly, the usual failure mode is a queue that grows without bound until the process runs out of memory. The standard fix is a *bounded* queue: cap its size, and decide up front what happens when it's full (drop the oldest item, drop the newest, or slow down the producer). For market data, dropping old raw ticks is usually fine as long as your aggregates and persistence layer already captured what they needed from them before the drop.

**Multiplexed connections** — Binance allows subscribing to many streams over a single WebSocket connection (a "combined stream"). For a platform tracking several symbols, this means one connection carrying `btcusdt@aggTrade`, `ethusdt@aggTrade`, `btcusdt@depth`, etc., rather than opening a separate connection per stream. Fewer connections means less overhead and fewer things that can independently drop.

**Idempotency** — designing your write path so that processing the same message twice (which will happen occasionally, e.g. after a reconnect resends something you'd already handled) doesn't produce duplicate or corrupted data. Using the exchange's own trade ID or update ID as your storage key, rather than blindly appending, is the usual way to get this for free.

---

## Part 2 — Time-Series Storage and Databases

### 2.1 Why tick data doesn't behave like normal app data

Most of what you'd store in a typical app — user profiles, settings, a list of trades a user placed — is read far more often than it's written, and any single record gets updated occasionally. Market tick data is the opposite: it's write-heavy (potentially hundreds of events per second per symbol), almost never updated once written, almost always queried by a time range ("give me the last 15 minutes of trades for BTCUSDT"), and grows without bound unless you actively prune it. A database and schema that feel perfectly fine for user accounts can fall over under this pattern — not because the database is bad, but because it's optimized for a different shape of access.

### 2.2 Hot, warm, and cold — thinking in storage tiers

Not all your data needs to live in the same place. A useful mental model:

- **Hot** — the current order book state and the last few minutes of trades. This needs to be read and written with sub-millisecond latency because your UI is live. This tier typically lives in memory (Redis), not on disk.
- **Warm** — the last several days to weeks of tick and aggregated data. This needs to answer "give me a footprint for this specific hour" quickly, but doesn't need in-memory speed. This is where a proper database (MongoDB, TimescaleDB, etc.) does its main job.
- **Cold** — anything older than your active retention window. Users rarely query this interactively; when they do, a slower response is acceptable. This is where you compress aggressively or move data to cheaper storage.

Designing for this from the start — rather than dumping everything into one collection forever — is what keeps your warm-tier queries fast as the total dataset grows into the billions of rows.

### 2.3 Database options, honestly compared

You're already running MongoDB, so it's worth being precise about what that buys you and what it costs you, rather than assuming either "Mongo is fine for everything" or "Mongo is wrong for this."

**MongoDB**, used naively (one document per trade), performs noticeably worse for time-series workloads than a database built specifically for the job — independent benchmarks measuring this exact comparison have found purpose-built time-series databases inserting data faster and answering range/aggregation queries anywhere from several times to well over an order of magnitude faster, depending on the query shape and how MongoDB is configured. MongoDB has since added a proper **time-series collection** type specifically to close this gap: instead of one document per event, it internally buckets many readings for the same symbol into a single document per time window (you tell it which field identifies the symbol — the "meta field" — and roughly how large each time bucket should be), which dramatically improves compression and range-query speed compared to the naive approach, while keeping the document/query interface you already know. If you're staying on MongoDB, using a proper time-series collection for tick data — rather than a plain collection — is the single highest-leverage change available to you, because it fixes the biggest performance gap without introducing a second database technology.

**TimescaleDB** (a PostgreSQL extension) is purpose-built for exactly this workload: it automatically partitions data by time into "hypertables," and supports "continuous aggregates" — pre-computed rollups (e.g., 1-second or 1-minute volume-by-price bars) that update incrementally as new data arrives, so a query for "footprint over the last 10 minutes" reads a small pre-summed table instead of scanning raw ticks. Because it's built on Postgres, you also get the entire mature SQL ecosystem — proper joins, well-understood replication, tooling you can hire for. Independent benchmarks put it consistently ahead of MongoDB on both write throughput and time-range query speed for this kind of data.

**ClickHouse** is a columnar database — it stores each field (price, volume, timestamp) contiguously rather than storing whole rows together, which makes it extremely fast at scanning huge historical ranges (think "compute average volume by price bucket over the last year"). The trade-off is on the write side: ClickHouse is designed around batched inserts and by default buffers small incoming writes for a short window (on the order of a few hundred milliseconds) before committing them, so a tick-by-tick real-time feed needs to be batched before it lands in ClickHouse, or tuned carefully — it's not naturally suited to being written to one event at a time.

**Redis**, in this picture, isn't a competitor to the above — it's the hot tier. Redis Sorted Sets are a natural fit for representing a live order book (the "score" is the price, giving you the book already sorted for free), and Redis's dedicated time-series data structure (RedisTimeSeries) can hold the most recent window of data with extremely low latency. Nothing about Redis makes sense as your long-term historical store — it's in-memory, so anything not backed up elsewhere disappears if the process restarts.

**The practical read for you:** if you want to avoid running a second database technology, moving your tick storage into a MongoDB time-series collection (rather than a plain collection) closes most of the performance gap for a fraction of the operational cost of introducing TimescaleDB or ClickHouse. If, once you're at real multi-user scale, warm-tier queries are still the bottleneck, that's the point where a dedicated time-series database earns its added complexity — but it's not something you need to reach for on day one.

### 2.4 Schema design: don't make every query scan raw ticks

The single biggest storage-layer mistake for this kind of app is computing footprint, volume profile, and CVD by re-scanning raw trades every time a user requests them. At any real scale this is far too slow. The fix is the same idea TimescaleDB's continuous aggregates formalize, and you can implement it yourself regardless of which database you use: maintain **pre-aggregated tables** at a fine but fixed granularity — typically 1-second or 1-minute buckets of "volume traded at each price level, split by buy/sell side" — updated incrementally as each trade arrives. When a user asks for a 5-minute footprint, you sum six 1-minute buckets instead of scanning every underlying trade. When they ask for a full session's volume profile, you sum however many 1-minute buckets fall in that session. This is what makes interactive redraws (zooming, panning, changing timeframe) feel instant instead of triggering a fresh expensive computation every time.

### 2.5 Terms worth knowing

**Downsampling** — reducing data resolution as it ages (e.g., keep raw ticks for 7 days, then keep only 1-minute aggregates beyond that, then only hourly aggregates beyond 90 days). This is how you keep storage bounded without deleting information users actually need.

**TTL (time-to-live) index** — a database feature (native to MongoDB) that automatically deletes documents once they're older than a configured age. Useful for expiring raw tick data on a schedule without a manual cleanup job.

**Retention policy** — the explicit rule for how long each tier of data (raw, 1-min aggregate, 1-hour aggregate) is kept before being downsampled further or dropped.

**Bulk/batched writes** — inserting many records in a single database operation instead of one operation per record. This is the difference between a write path that can keep up with a busy market and one that can't; it's covered in more detail in Part 5, since it's really a scaling concern.

---

## Part 3 — GUI/UX Mapping: How the Rendering Actually Works

You've already solved the core of this — canvas-based rendering with `requestAnimationFrame`-driven updates and state kept out of your component re-render cycle (via Zustand) is exactly the right foundation, and it's why your platform doesn't fight the DOM the way a naive React-charts-in-divs implementation would. This section goes past that foundation into what changes when the data volume, the number of visible bars, and the number of simultaneous viewers all grow.

### 3.1 The core problem, in plain terms

A chart is, underneath everything, a coordinate transform: you have data that exists in "price and time" space, and you need to repeatedly convert it into "pixel" space, draw it, and do this fast enough — dozens of times a second — that it looks smooth rather than jerky. The reason this can't just be "redraw everything on every update" once your dataset gets large is that a full redraw's cost scales with how much is on screen, and a footprint chart with hundreds of visible bars, each with a dozen-plus price rows, each needing two numbers drawn, adds up to a lot of individual draw operations, every single time a new trade comes in.

### 3.2 The coordinate system

Every chart needs two conversion functions, and everything else (zoom, pan, tooltips, drawing) is built on top of them:

- **priceToY(price)** — converts a price into a vertical pixel position, based on the currently visible price range and the canvas height.
- **timeToX(timestamp)** — converts a time into a horizontal pixel position, based on the currently visible time range and the canvas width.

**Zooming** is changing the size of the visible price/time range that maps onto the fixed pixel dimensions of the canvas. **Panning** is shifting which range is currently visible, without changing its size. **Hit-testing** (figuring out what the user is hovering over for a tooltip) is running these two functions in reverse — converting a mouse pixel position back into a price and time, then looking up what data exists there. Getting this pair of functions right and consistent is what makes zoom/pan/tooltip behavior feel coherent instead of buggy at the edges.

### 3.3 Layering the canvas

Rather than one canvas redrawing everything on every frame, split the visual into separate canvas elements stacked on top of each other, each redrawn only when it actually needs to change:

- A **static/background layer** — grid lines, price axis, session boundaries — redrawn only when the visible range changes (zoom/pan), not on every tick.
- A **live data layer** — the footprint cells, bubbles, candle bodies — redrawn on new data.
- An **overlay layer** — crosshair, tooltips, the user's cursor position — redrawn constantly (every mouse move) but cheap, since it's just a few lines and a text label, not the whole chart.

This separation means a mouse moving around the chart (which needs to redraw constantly for a smooth crosshair) doesn't force you to also redraw hundreds of footprint cells sixty times a second — only the thin overlay layer pays that cost.

### 3.4 Only redraw what changed

**Viewport culling** means never even attempting to draw data that's outside the currently visible time/price range — if a bar is off-screen, skip it entirely rather than computing its pixel position and then discovering it's off-canvas. This sounds obvious but is easy to get wrong if your draw loop iterates over "all loaded data" instead of "only the data intersecting the current viewport."

**Dirty-rectangle rendering** takes this further: instead of clearing and redrawing the entire canvas on every update, track which specific regions changed (e.g., only the rightmost, currently-forming bar, when a new trade arrives) and only clear and redraw those pixels. For a chart where 90%+ of what's on screen is historical and unchanged between one frame and the next, this can cut rendering work dramatically — the general result from this technique in canvas-heavy applications is that when only a small fraction of the canvas changes per frame, redraw time drops by the same rough proportion.

### 3.5 Getting heavy work off the main thread

The browser has exactly one thread doing layout, painting, and running your JavaScript. If that thread is busy computing a footprint aggregation or running a large draw loop, user input (scrolling, clicking, even the crosshair) freezes until it's done — this is almost certainly the mechanism behind the freeze/crash issues you already fought at the single-user stage, and it gets *more* likely, not less, once multiple users are pulling on shared client-side resources.

**OffscreenCanvas** is the browser API that lets you hand a canvas's drawing surface to a Web Worker — a background JavaScript thread — so the actual pixel-pushing work happens off the main thread entirely, and the main thread stays free to handle scrolling, clicks, and other charts on the same page. The trade-off is real: the worker still ultimately competes for the same GPU as the main thread when it comes time to composite everything onto the screen, so this helps most when the *computation* driving the drawing (not just the drawing itself) is heavy — which is exactly the case for footprint/volume-profile aggregation on a busy symbol. The general pattern: keep raw event handling and simple UI on the main thread; move data aggregation and, where supported, canvas painting itself into a worker.

### 3.6 Drawing the specific visuals

**Footprint cells** — each price row within a bar needs two numbers (bid volume, ask volume) and often a background color intensity reflecting the imbalance between them. The efficient approach is to batch all the drawing commands for a single bar together (draw all the rectangles, then all the text) rather than alternating rectangle-then-text-then-rectangle, since switching between draw operation types has more overhead than doing many of the same type in a row.

**Bubbles** — sized by trade volume. Because trade sizes vary hugely (a small retail trade and a whale trade can differ by several orders of magnitude), mapping size directly to radius makes small trades invisible and lets one huge trade's bubble swallow the chart. The fix, covered with the formula in Part 4, is a non-linear scaling function with a clamped minimum and maximum radius.

**Heatmap/liquidity gradient** (relevant once you build out the liquidity feature you mentioned not having yet) — resting order size at each price level, over time, rendered as color opacity. This is computed the same way as footprint cells but from order-book depth data rather than executed-trade data, and needs its own layer since it updates on a different cadence than trades do.

---

## Part 4 — Indicators and Algorithms

### 4.1 The general pattern behind all of them

Before the individual indicators: almost every order-flow metric follows the same computational shape, and recognizing this pattern is more useful than memorizing each formula separately. You maintain a **running total** (or a small set of running totals, one per price level) and **update it incrementally** as each new trade arrives, rather than recomputing from the full history every time. This is why Part 2's pre-aggregated buckets matter so much — they're what let "recompute the last 5 minutes" mean "sum a handful of buckets" instead of "rescan every trade in that window."

### 4.2 VWAP (Volume Weighted Average Price)

**The idea.** A simple average price treats every trade equally, whether it was for 0.001 BTC or 10 BTC. VWAP weights each price by how much volume traded there, so it represents where the *money* actually changed hands, not just where the price happened to be. It's typically anchored to a session (resets at a defined start time) and updates continuously through the session.

**The mechanics.** Maintain two running totals: the sum of (price × volume) for every trade since the anchor point, and the sum of volume alone. VWAP at any moment is the first divided by the second:

`VWAP = Σ(price × volume) / Σ(volume)`

Because both sums are running totals, updating VWAP on a new trade is just adding one term to each sum and dividing — no need to touch any historical data.

### 4.3 CVD (Cumulative Volume Delta)

**The idea.** Delta, per trade, is simply "was this an aggressive buy or an aggressive sell." CVD is the running sum of that over a session — it tells you, cumulatively, whether buyers or sellers have been more aggressive so far. It's especially useful compared *against* price: if price is rising while CVD is falling, buyers are pushing price up on thinning aggressive-buy conviction (a classic early-warning divergence), and vice versa.

**The mechanics.** Binance's `aggTrade` stream includes a flag indicating whether the buyer was the market "maker" (the resting order) or not. If the buyer was the maker, the trade was initiated by an aggressive *seller* hitting a resting buy order — classify that trade's volume as sell volume. If the buyer was *not* the maker, the trade was initiated by an aggressive *buyer* — classify it as buy volume. Delta for a single trade is:

`delta = (buy volume) − (sell volume)`

and CVD is simply the running sum of delta since the session anchor:

`CVD = Σ(delta)`, reset at each session boundary, same as VWAP's anchor.

### 4.4 Volume Profile — Point of Control and Value Area

**The idea.** Group all traded volume, over a chosen period, into price buckets — the result is a horizontal histogram showing which prices attracted the most trading. The single busiest price bucket is the **Point of Control (POC)** — the price where the most business got done. The **Value Area** is the price range containing roughly 70% of the total traded volume, built out symmetrically around the POC — it's meant to represent "where most of the market agreed the price was fair," with everything outside it being comparatively rejected territory.

**The mechanics.** The 70% figure isn't arbitrary — it approximates one standard deviation of a normal distribution (68%), rounded to a number that's simple to compute against. The standard algorithm (the same method exchanges like the CME use for market profile) is a stepwise expansion, not a simple percentile cut:

1. Compute total volume across all price buckets in the period. Target = total × 0.70.
2. Start at the POC (the single highest-volume bucket). Set `accumulated = POC's volume`.
3. Look at the bucket immediately above the current value-area range and the bucket immediately below it. Add whichever one has *more* volume to the value area, and add its volume to `accumulated`.
4. Repeat step 3 — always comparing the next bucket above the current range against the next bucket below it, always taking the larger — until `accumulated ≥ target`.
5. Value Area High (VAH) = top of the highest bucket included. Value Area Low (VAL) = bottom of the lowest bucket included.

A small worked example makes this concrete. Suppose a session's volume by price bucket looks like this:

| Price | Volume |
|---|---|
| 118 | 4 |
| 119 | 10 |
| 120 | 22 |
| **121 (POC)** | **30** |
| 122 | 20 |
| 123 | 9 |
| 124 | 5 |

Total = 100, so target = 70. Start at POC (121, volume 30) → accumulated = 30. Compare the bucket above (122, volume 20) against the bucket below (120, volume 22): 120 is larger, so it's included → accumulated = 52, VAL now 120. Compare again: above is still 122 (20), below is now 119 (10): 122 is larger this time, so it's included → accumulated = 72, which is ≥ 70, so the expansion stops. Result: **POC = 121, VAH = 122, VAL = 120** — bucket 119 was never included, even though it has more volume than the untouched 124, because the expansion always compares the two *immediately adjacent* buckets, not the two largest remaining buckets overall. This adjacency rule is what makes the Value Area a contiguous price range rather than a scattered set of high-volume buckets.

### 4.5 Footprint Imbalances

**The idea.** Within a single bar, at each price row, you have both bid volume (aggressive selling into resting buyers) and ask volume (aggressive buying into resting sellers). An "imbalance" flags a row where one side dramatically outweighs the other — a visible sign that one side is being much more aggressive at that specific price than the other.

**The mechanics.** The comparison is diagonal, not same-row: a price row's ask volume is compared against the *bid* volume one tick *below* it (since a buyer lifting the offer at price P and a seller hitting the bid at price P-1 tick are the two things actually competing for the same liquidity as price moves through that zone). If one side exceeds the other by a set ratio — commonly 3:1 — that cell is flagged as an imbalance. A "stacked imbalance" is three or more consecutive price levels flagged in the same direction, which is a meaningfully stronger signal than a single isolated cell, since it suggests sustained one-sided pressure through a price range rather than a single noisy print.

### 4.6 Absorption (and its counterpart, Exhaustion)

**The idea, briefly** (you've already built a version of this): absorption is what it looks like when a large amount of aggressive volume hits a price level and the price *doesn't* move the way that volume would normally suggest — because passive limit orders sitting at that level are large enough to soak it up. It matters at support/resistance/POC-type levels and is largely noise everywhere else; the same "heavy volume, stalled price" pattern happening in the middle of nowhere isn't a meaningful signal.

**Where to take it further than a fixed threshold.** A common, simpler implementation flags absorption whenever volume at a cell exceeds some fixed number you picked by eye. The problem is that "unusually heavy" is relative — what's a huge print on a quiet altcoin at 3am is an ordinary print on BTC during a New York session open, and a fixed threshold either misses real absorption in quiet conditions or fires constantly during busy ones. The more robust approach is a **dynamic statistical threshold**: maintain a rolling mean and standard deviation of volume-per-cell over a trailing window (e.g., the last N bars, or the last N occurrences at that specific price zone), and flag a cell only when its volume exceeds the mean by some multiple of the standard deviation — commonly written as a **z-score** test:

`z = (cell volume − rolling mean) / rolling standard deviation`

Flag as a candidate when `z` exceeds a chosen threshold (commonly 2–3), combined with the requirement that price barely moved during that bar. This self-adjusts to the current regime and the specific instrument, instead of needing a manually-tuned number per symbol that goes stale as volatility changes. Requiring the location filter (near a prior significant level) on top of the statistical filter is what separates a genuinely useful signal from one that just relabels "the market was busy" as "absorption."

**Exhaustion**, the counterpart worth knowing even though you haven't asked to build more of it: instead of heavy volume with no price progress, it's aggressive volume *fading* right as price reaches an extreme — no big passive wall required, participants simply ran out of conviction. The two patterns are often distinguished using the same underlying inputs (volume, price range, CVD direction) but read in opposite ways: absorption is "a lot of volume, no progress"; exhaustion is "progress is happening, but the volume behind it is drying up."

### 4.7 Bubble Sizing

**The idea.** Trade size, mapped directly to bubble radius, doesn't work visually because trade sizes are extremely skewed — most trades are small, a few are enormous, and a linear mapping either makes the small trades invisible or lets one whale trade dominate the entire chart.

**The mechanics.** Use a monotonic but compressive scaling function — square root or logarithm are the standard choices — so that large differences in trade size produce visible but *proportionally smaller* differences in radius, and clamp the result to a sensible minimum and maximum pixel radius so nothing disappears or overflows the chart:

`radius = clamp( minRadius + scale × sqrt(tradeSize), minRadius, maxRadius )`

Color-coding by aggressor side (buy vs. sell, using the same maker-flag logic as CVD) turns the bubble layer into a quick visual read of where and how large the aggressive flow has been, independent of the footprint numbers underneath it.

---

## Part 5 — Caching and Scaling for Multiple Concurrent Users

This is the part of the system you haven't had to design for yet, since your platform so far has had exactly one user: you. Almost everything in this section exists to answer one question — how do you take a pipeline built for one viewer and make it correctly serve many viewers at once, without either duplicating the expensive work per user or letting one user's slow connection affect another's.

### 5.1 The core shift: one feed, many viewers

The critical realization is that ingestion and aggregation (Parts 1, 2, and 4) don't need to scale with your number of users at all — there's exactly one Binance connection per symbol and exactly one set of running footprint/CVD/volume-profile calculations per symbol, regardless of whether 1 person or 100 people are watching it. What *does* need to scale with user count is purely the **broadcast** layer — getting the already-computed updates out to every connected client. Keeping this separation explicit in your architecture (one ingestion/aggregation pipeline per symbol, feeding an independently-scalable fan-out layer) is what keeps costs and complexity from growing linearly with users; it's also exactly the "snapshot-plus-delta" idea from Part 1, reapplied at the broadcast layer instead of the exchange-connection layer.

### 5.2 Redis's several jobs in this architecture

Redis shows up in three distinct roles here, and it's worth keeping them mentally separate even though it's one piece of infrastructure:

**Hot state cache.** The current order book, the currently-forming bar's footprint data, the latest CVD value — anything a newly-connecting client needs *immediately*, before the next live update arrives, should be readable from Redis in under a millisecond rather than requiring a database query. This is what lets a new client's chart populate instantly instead of showing a blank canvas for a second while a query runs.

**Real-time fan-out.** When a new aggregated event is ready (a footprint cell updated, CVD ticked), it needs to reach every subscribed client. Redis offers two mechanisms here, and the choice matters: **Pub/Sub** broadcasts to whoever happens to be subscribed *right now* — it's fire-and-forget, nothing is stored, and a client that briefly disconnects simply misses whatever was published during the gap. **Streams** persist messages in an ordered, replayable log that consumers read from at their own pace and can resume from where they left off. For live tick-level fan-out where a brief miss during a reconnect is recoverable (the client just re-syncs from a fresh snapshot, same as the order-book resync logic from Part 1), Pub/Sub's simplicity and lower overhead are usually the better fit. Streams earn their extra complexity when you need guaranteed, ordered delivery with replay — for instance, if a downstream service must never miss an event even across a restart.

**Query-result caching.** If many users are all viewing the same symbol's footprint for the same time range (which will happen constantly — most users watching BTCUSDT at the same moment), cache the computed result for a short window (seconds) so the second, third, and fiftieth request for "footprint on BTCUSDT, last 5 minutes" reuses the first computation instead of redoing it. This is a classic and very cheap win once you have more than a handful of concurrent users on the same symbol.

### 5.3 Scaling the WebSocket layer itself

A single Node process handling WebSocket connections can comfortably serve a lot of users, but the moment you need more than one server process (for capacity or reliability), a subtlety appears: each server process only knows about *its own* connected clients. If User A is connected to server 1 and an update needs to reach them, but the update was generated on server 2, server 2 has no way to reach User A directly.

The standard fix is a **Redis adapter** sitting behind your WebSocket layer (Socket.IO, if that's what you're using, ships one built for exactly this): every server publishes outgoing events to a shared Redis channel, and every server subscribes to that same channel, so any server can effectively deliver a message to a client connected to *any* server in the cluster. This needs to be paired with **sticky sessions** at the load balancer — configuring the load balancer to consistently route a given client's requests to the same backend server — because a client's connection-level state (which symbols they've subscribed to, etc.) typically lives in that one server's memory; without stickiness, a reconnect or protocol fallback could land on a different server that has no idea what the client was previously subscribed to. (Using pure WebSocket rather than falling back to HTTP long-polling reduces how much this matters, but for a production deployment behind a standard load balancer, planning for sticky sessions from the start avoids a class of intermittent, hard-to-reproduce bugs later.)

### 5.4 Historical data: pagination, and loading only what's needed

When a user scrolls back through history, never send "everything from the beginning" — request and render data in bounded chunks as the user actually needs them, matching the viewport-culling idea from Part 3. The standard approach is **cursor-based pagination**: each request for historical data includes a reference point (a timestamp or an ID) and asks for "the next N bars before this point," rather than relying on page numbers that shift as new data streams in. As the user scrolls further back, fire off the next chunk request slightly before they hit the edge of what's currently loaded, so the data is ready by the time they get there.

The other half of this is **unloading** data that's scrolled far out of view — keeping every bar a user has ever scrolled past in memory indefinitely will eventually make the tab itself slow, independent of how well the server side scales. A simple windowing approach (keep, say, the visible range plus a buffer on each side in memory; discard anything further than that, re-fetching if the user scrolls back to it) keeps client-side memory bounded no matter how long a session runs.

### 5.5 Keeping the UI from freezing under load

Three separate techniques combine to prevent the freeze/hang behavior you already fought once, and they matter *more*, not less, in a multi-user context because a shared server-side bottleneck now affects everyone simultaneously rather than just you:

- **Move heavy computation off the main thread** wherever it's the client doing real work (not just receiving pre-computed updates) — the Web Worker / OffscreenCanvas approach from Part 3.
- **Batch and throttle state updates** rather than triggering a re-render or a redraw on every single incoming message. If trades are arriving faster than the display needs to update (60 times a second is already imperceptibly fast to a human), buffer incoming updates and flush them on the animation frame instead of processing each one the instant it arrives.
- **Never do synchronous heavy work in a request-handling path on the server.** A REST endpoint or WebSocket handler that computes a full aggregation inline, in the same call that's supposed to respond quickly, will make that one slow request block the event loop for everyone else being served by that process. Heavy aggregation belongs in the background consumer pipeline from Part 1, writing its results somewhere fast to read (the Redis hot cache), with the request handler doing nothing more than a quick read from there.

### 5.6 The write side: don't write one trade at a time

Writing every single trade to the database as its own individual write operation is one of the most common and most avoidable bottlenecks in this kind of system. **Batched (bulk) writes** — accumulating a short window of events (e.g., 100ms or a few hundred trades) in memory and writing them to the database in a single operation — dramatically reduce the per-write overhead compared to one round-trip per trade, and this is also exactly the access pattern MongoDB's time-series collections (from Part 2) are optimized around. This pattern is sometimes called **write-behind buffering**: the in-memory aggregation state is always up to date immediately (so live indicators never lag), while the durable database write happens slightly after, in efficient batches, rather than being on the critical path of every single incoming event.

### 5.7 What "scaling to 100 users" actually requires, concretely

Pulling the above together: the ingestion pipeline (Part 1) and the aggregation logic (Part 4) run once per symbol, full stop — they do not need to change at all as user count grows. What needs to scale is: the number of WebSocket-serving processes (horizontally, behind a load balancer with sticky sessions and a shared Redis adapter), the hot-cache layer that lets new connections populate instantly instead of waiting on a cold query, and the historical-data query path (which query-result caching and pre-aggregated buckets both protect). None of this requires the ingestion or algorithm layer to be duplicated per user — that would be the actual scaling failure mode to avoid.

---

## Part 6 — How the Pieces Fit Together

```
   Binance WebSocket (aggTrade, depth diff, kline)
                    │
                    ▼
        Ingestion Service  (per symbol; snapshot+diff
        book reconstruction; keep-alive/reconnect handling)
                    │
                    ▼
        Normalizer  (exchange-specific → internal event shape)
                    │
                    ▼
        Event Bus  (Redis Streams — durable, ordered)
                    │
        ┌───────────┼───────────────┬────────────────────┐
        ▼           ▼                ▼                    ▼
  Order-book    Aggregators    Persistence Writer     (future: second
  reconstructor (VWAP, CVD,    (batched writes to      exchange's
  (in-memory)   footprint,     MongoDB time-series      normalizer,
                volume profile, collection; pre-        feeding the
                absorption)    aggregated buckets)      same bus)
        │           │
        └─────┬─────┘
              ▼
      Redis (hot cache + Pub/Sub fan-out)
              │
              ▼
      WebSocket Server(s)  (horizontally scaled,
      sticky sessions + Redis adapter)
              │
              ▼
      Client (layered canvas: static / live-data /
      overlay, coordinate transform, Web Worker
      for heavy aggregation, viewport culling)
```

Read top to bottom, this is the whole system: raw exchange data comes in through a single, carefully-synced connection per symbol; gets normalized so a second data source later is a small addition, not a rewrite; flows through a durable internal bus so slow consumers never block fast ones; gets turned into the actual indicators using incremental, bucket-based math instead of expensive rescans; lands in tiered storage (hot in Redis, warm and pre-aggregated in the database, cold and compressed beyond that); and reaches however many simultaneous users are watching through a broadcast layer that's scaled independently of the single upstream pipeline feeding it. Every part of this document is really just filling in the detail behind one box in that diagram.

---

### Further reading

- Binance API docs — WebSocket streams and order book management: developers.binance.com
- Bookmap's learning center — absorption and exhaustion in order flow: bookmap.com/learning-center
- TigerData (Timescale) — MongoDB vs. TimescaleDB benchmarking for time-series data
- MongoDB documentation — time-series collections
- Socket.IO documentation — Redis adapter and horizontal scaling
- TradingView support — volume profile concepts (POC/Value Area calculation)
- web.dev — Canvas performance and OffscreenCanvas
