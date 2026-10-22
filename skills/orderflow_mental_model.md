# OrderFlow Architecture & Conceptual Mental Model
> **Master Technical Interview Guide & System Walkthrough**

---

## Table of Contents
1. [Overall Mental Model & Data Flow](#1-overall-mental-model--data-flow)
2. [Frontend Canvas Architecture (The 3-Layer System)](#2-frontend-canvas-architecture)
3. [The Coordinate System (Time → X, Price → Y, Viewport)](#3-the-coordinate-system)
4. [Grid, Columns, Rows, and Footprint Cells](#4-grid-columns-rows-and-footprint-cells)
5. [Candlestick Construction & Viewport Scaling](#5-candlestick-construction--viewport-scaling)
6. [Footprint Chart Microstructure](#6-footprint-chart-microstructure)
7. [Indicator Architecture (CVD, Volume, Bubbles, VWAP, Profiles)](#7-indicator-architecture)
8. [Drawing Tools Architecture (Screen ↔ Market Projection)](#8-drawing-tools-architecture)
9. [Position Tool & Risk-Reward Evaluation](#9-position-tool--risk-reward-evaluation)
10. [Real-Time WebSocket Pipeline](#10-real-time-websocket-pipeline)
11. [Historical Data Storage & Chunked Lazy-Hydration](#11-historical-data-storage--chunked-lazy-hydration)
12. [Performance & Worker Architecture (Solving the UI Freeze)](#12-performance--worker-architecture)
13. [System Architecture Layers Summary](#13-system-architecture-layers-summary)
14. [Concrete Walkthrough 1: A New BTC Trade Arrives](#14-concrete-walkthrough-1-a-new-btc-trade-arrives)
15. [Concrete Walkthrough 2: User Moves the Mouse Over the Canvas](#15-concrete-walkthrough-2-user-moves-the-mouse-over-the-canvas)
16. [Interview Preparation Guide (60s Pitch, 3m Deep-Dive, 15 Q&As)](#16-interview-preparation-guide)

---

## 1. Overall Mental Model & Data Flow

At a high level, the application solves a fundamental financial visualization problem: **How do you ingest high-frequency, tick-by-tick financial market data (trades and orderbook depth) and render interactive, responsive, multi-layered orderflow charts in the browser without freezing the UI?**

```
┌────────────────────────────────────────────────────────────────────────┐
│                          REAL-TIME FLOW                                │
│                                                                        │
│  Binance WS (aggTrade / kline / depth)                                 │
│        │                                                               │
│        ▼                                                               │
│  Shared Feed Registry (ref-counted browser socket)                     │
│        │                                                               │
│        ▼                                                               │
│  In-Memory Aggregation Engine (FootprintBaseCache: 1m / $5 buckets)    │
│        │                                                               │
│        ▼                                                               │
│  Zustand Runtime Store (chartRuntimeStore - avoids React re-renders)   │
│        │                                                               │
│        ▼                                                               │
│  HTML5 Canvas Pipeline (requestAnimationFrame multi-layer redraw)      │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                         HISTORICAL FLOW                                │
│                                                                        │
│  24/7 Node.js Collector (scripts/collector/btcusdtCollector.mjs)       │
│        │ Ingests live Binance WS ticks & klines continuously           │
│        ▼ Pre-aggregates canonical 1m footprint slices & volume profile │
│  TimescaleDB (Hypertable storage: candle, footprint, profile, bubbles) │
│        │                                                               │
│        ▼ HTTP GET /api/history/* (capped 2h chunks, Cache-Control)     │
│  FeedProvider (scrolled window lazy-hydrator)                          │
│        │ Ingests missing ranges as user scrolls into history           │
│        ▼ Merges into BaseCache without blocking live streaming         │
│  Canvas Canvas Redraw                                                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Why Each Major Component Exists

1. **Exchange (Binance Spot & Futures)**: The source of truth for market events (individual trades, OHLCV candle intervals, and orderbook depth changes).
2. **Collector (`btcusdtCollector.mjs`)**: A standalone 24/7 Node.js daemon running outside the browser. It listens to raw market ticks, aggregates them into canonical 1-minute / $5 price buckets, and writes them to persistent storage. It exists so historical orderflow data is never lost when the user closes their browser.
3. **Storage (TimescaleDB / libSQL)**: High-performance time-series database. Hypertables partitioned by timestamp allow lightning-fast range queries over millions of historical footprint rows.
4. **History APIs (`/app/api/history/*`)**: Next.js route handlers that serve chunked, source-scoped historical candles, footprint cells, volume profiles, and trade bubbles with HTTP caching headers.
5. **Feed Registry (`lib/feeds/feedRegistry.ts`)**: A client-side ref-counted connection manager. If a user opens split panels (e.g. 5m chart and 1h chart for BTCUSDT), the feed registry maintains **only one shared WebSocket** to Binance and fans out events, saving network bandwidth and connection limits.
6. **In-Memory Aggregation Engine (`lib/aggregation/engine.ts`)**: Manages the active panel's footprint and candle data in memory. It holds canonical 1-minute base slices and dynamically combines them into higher display timeframes (e.g. 5m, 15m, 1h) or larger display bucket sizes ($10, $50).
7. **Zustand State Stores (`chart.ts` & `chartRuntime.ts`)**: Separates persistent user preferences (layout, active indicators, colors, drawing objects) from ultra-high-frequency ephemeral data (live candle ticks, orderbook depth, hover coordinates).
8. **HTML5 Canvas**: Native web graphics rendering surface. HTML DOM elements (divs, svgs) would crash the browser when rendering thousands of price cells and candles; canvas draws raw pixels directly to the GPU buffer.

---

## 2. Frontend Canvas Architecture

### Is the chart one canvas or multiple?
The main chart (`ChartCanvas.tsx`) uses **three stacked HTML5 canvases** arranged in a layered z-index sandwich inside a relative container. Additionally, split indicators like the CVD panel (`CvdPanel.tsx`) and the side-by-side Orderbook Heatmap (`HeatmapPanel.tsx`) have their own decoupled canvas surfaces.

```
┌────────────────────────────────────────────────────────┐
│  Layer 3: Top Interactive Canvas (z-20)                │  <canvas ref={canvasRef} />
│  - Receives mouse & keyboard events (tabIndex=0)       │
│  - Drawings (lines, rays, boxes, position tools)       │
│  - Crosshair lines & dynamic axis badges               │
│  - Current price line & countdown badge                │
│  - Interactive trading overlays (limit orders, TP/SL)  │
│  - Hover detection & active measurement tool           │
├────────────────────────────────────────────────────────┤
│  Layer 2: Middle Live Market Data Canvas (z-10)        │  <canvas ref={liveCanvasRef} />
│  - pointer-events: none (clicks pass through to L3)    │
│  - Candlesticks (hollow/solid with crisp half-pixels)  │
│  - Footprint clusters (bid/ask volume per price cell)  │
│  - Volume bubbles (large trade clusters)               │
│  - VWAP lines & standard deviation envelope bands      │
│  - Volume Profiles (session, developing POC, custom)   │
│  - Orderflow signals (Absorption, Exhaustion, Iceberg) │
├────────────────────────────────────────────────────────┤
│  Layer 1: Bottom Static Environment Canvas (z-0)       │  <canvas ref={bgCanvasRef} />
│  - pointer-events: none                                │
│  - Solid or gradient chart background                  │
│  - Horizontal price gridlines & vertical time gridlines│
│  - Trading session boxes (Asia, London, NY highlights) │
│  - Passive orderbook liquidity background shading      │
└────────────────────────────────────────────────────────┘
```

### Why Three Layers Instead of One?
1. **Performance & Frame Rate**: Moving the mouse to update the crosshair or dragging a drawing tool only requires redrawing **Layer 3**. It does not need to recompute or redraw heavy footprint cells, volume profiles, or session backgrounds.
2. **Selective Live Clipping**: When a new live trade arrives for the currently forming candle, `ChartCanvas` can use Canvas clipping (`liveCtx.rect(colStartX, 0, colWidth, height); liveCtx.clip();`) on **Layer 2** to erase and redraw **only the single forming candle column**, leaving hundreds of historical candles completely untouched.
3. **Decoupled Event Handling**: All mouse interaction (dragging, panning, clicking drawings, placing orders) happens on the top canvas without interfering with background rendering.

### Coordination
All three layers are coordinated by a single `redraw()` cycle driven by `requestAnimationFrame`. They share identical dimensions (`widthRef.current`, `heightRef.current`), identical device-pixel-ratio (DPR) scaling, and identical viewport coordinate bounds.

---

## 3. The Coordinate System

The most critical math in any trading canvas is converting between **Market Reality (Price & Time)** and **Screen Reality (X & Y Pixels)**.

```
       MARKET REALITY                              SCREEN REALITY
┌───────────────────────────┐                  ┌────────────────────┐
│ Time:  10:31:00 (Unix sec)│ ──[indexToX]───► │ X: 450 pixels      │
│ Price: $105,250.00        │ ──[priceToY]───► │ Y: 220 pixels      │
└───────────────────────────┘                  └────────────────────┘
              ▲                                           │
              │                                           │
              └───────── [xToIndex / yToPrice] ───────────┘
```

### 1. Price → Y Position (`priceToY`)
In HTML5 Canvas, coordinate `y = 0` is the **top edge**, and `y = canvasHeight` is the **bottom edge**.
In financial markets, **high prices are at the top**, and **low prices are at the bottom**.

* Let `priceMin` be the lowest price visible in the viewport.
* Let `priceMax` be the highest price visible in the viewport.
* Let `drawableHeight` be the height of the chart area in pixels.

**The Conceptual Mapping**:
$$\text{Ratio from Top} = \frac{\text{priceMax} - \text{price}}{\text{priceMax} - \text{priceMin}}$$
$$\text{Pixel } Y = \text{Ratio from Top} \times \text{drawableHeight}$$

* If price equals `priceMax`, $Y = 0$ (top of screen).
* If price equals `priceMin`, $Y = \text{drawableHeight}$ (bottom of screen).
* To convert a mouse pixel $Y$ back to price (`yToPrice`):
$$\text{Price} = \text{priceMax} - \left(\frac{Y}{\text{drawableHeight}}\right) \times (\text{priceMax} - \text{priceMin})$$

### 2. Time → X Position (`indexToX` & `timeToIndex`)
Trading charts **do NOT map timestamp directly to linear X pixels**.
*Why?* Because markets have gaps, weekends, halts, and illiquid periods. If time were linear, missing data would create giant blank voids.
Instead, trading charts use **Index-Based Bar Slots**:
1. Candles are stored in an ordered array `candles[0 ... N-1]` sorted by timestamp.
2. Each candle occupies a discrete slot with a width of `barWidth` pixels (e.g. 14px for candles, up to 120px when zoomed in for footprints).
3. The right edge of the chart (minus the price axis and volume profile width) serves as the anchor for the newest candle (`index = N - 1`).
4. `scrollOffset` is a pixel offset: $0$ means the newest candle is at the right edge; positive values pan into historical candles.

**The Conceptual Formula**:
$$\text{Pixel } X = \text{drawableWidth} - \frac{\text{barWidth}}{2} - (N - 1 - i) \times \text{barWidth} + \text{scrollOffset}$$

* To convert a timestamp to an X position:
  1. Use binary search (`timeToIndex`) or continuous fractional interpolation (`resolveIndexFromTime`) to find which candle index $i$ corresponds to that timestamp.
  2. Pass index $i$ into `indexToX` to get the pixel coordinate.
* To convert mouse pixel $X$ back to a candle index (`xToIndex`):
$$i = (N - 1) + \frac{X - \text{drawableWidth} + \frac{\text{barWidth}}{2} - \text{scrollOffset}}{\text{barWidth}}$$

### 3. Viewport & Visible Range (`getVisibleRange` & Auto-Scaling)
The application avoids wasting CPU cycles drawing off-screen bars:
* `getVisibleRange()` calculates the `firstIndex` and `lastIndex` visible within the current canvas width, plus a small overscan buffer (e.g. 2–10 bars) to ensure smooth panning.
* When auto-scale is active, `getVisiblePriceRange()` scans only those visible candles, finds their highest high and lowest low, and adds 8% vertical padding on top and bottom. This prevents price candles from pressing against the upper or lower canvas boundaries.

---

## 4. Grid, Columns, Rows, and Footprint Cells

To understand the footprint chart, think of the chart as a **2D Matrix of Market Activity**:
* **Columns** = Time intervals (Candles, e.g. 1 minute, 5 minutes, 1 hour).
* **Rows** = Price levels (Buckets, e.g. every $5 or $10 for BTC).
* **Cell** = The intersection of a Time Column and a Price Row.

```
                      TIME COLUMNS
               10:31:00          10:32:00
PRICE ROWS  ┌───────────────┬───────────────┐
$105,010    │  0.2  |  1.5  │  0.0  |  0.8  │  <-- Cell: [ Bid Vol | Ask Vol ]
            ├───────────────┼───────────────┤
$105,005    │  3.1  |  2.4  │  1.2  |  4.0  │  <-- High volume node (POC)
            ├───────────────┼───────────────┤
$105,000    │  5.0  |  0.1  │  2.5  |  1.1  │
            └───────────────┴───────────────┘
```

### What a Cell Actually Represents
A cell is an aggregated summary of every trade executed at that price level during that candle interval:
* **Ask Volume (`askVol`)**: Volume from **aggressive buyers** who crossed the spread and lifted the ask (taker buy).
* **Bid Volume (`bidVol`)**: Volume from **aggressive sellers** who crossed the spread and hit the bid (taker sell).
* **Delta**: Net aggressive pressure: $\text{Delta} = \text{AskVol} - \text{BidVol}$.
  - Positive delta $\rightarrow$ Aggressive buyers dominated that price level.
  - Negative delta $\rightarrow$ Aggressive sellers dominated that price level.

### Mapping a Trade to its Cell
When a trade occurs:
1. **Find the Column**: `candleTime = Math.floor((tradeTime / 1000) / timeframeSeconds) * timeframeSeconds`.
2. **Find the Row**: `bucketPrice = Math.floor(tradePrice / bucketSize) * bucketSize`.
3. **Classify the Side**:
   - If `trade.isBuyerMaker === false`: The buyer was the taker $\rightarrow$ `cell.askVol += trade.quantity`.
   - If `trade.isBuyerMaker === true`: The buyer was the maker (seller was taker) $\rightarrow$ `cell.bidVol += trade.quantity`.
4. **Update Candle Delta**: Add or subtract `trade.quantity` from candle total delta.

---

## 5. Candlestick Construction & Viewport Scaling

When the chart mode is set to standard candlesticks:
1. `getVisibleRange` retrieves the visible slice of `Candle` objects (`open, high, low, close, volume, time`).
2. For each visible candle:
   - Compute center X: `x = indexToX(i)`.
   - Compute candle width: `candleWidth = barWidth * 0.8` (leaving a 20% gap between bars).
   - Compute vertical pixel bounds using `priceToY`:
     - `yHigh = priceToY(candle.high)`
     - `yLow = priceToY(candle.low)`
     - `yOpen = priceToY(candle.open)`
     - `yClose = priceToY(candle.close)`
   - Candle body: Drawn from `min(yOpen, yClose)` to `max(yOpen, yClose)`.
   - Upper wick: Vertical line from `yHigh` to the top of the body.
   - Lower wick: Vertical line from `yLow` to the bottom of the body.
   - Color: Green if `close >= open`, Red if `close < open`.
   - Crisp rendering: Coordinates use `alignCoord()` (half-pixel offset `Math.floor(x) + 0.5`) to prevent blurry 1px canvas lines on high-DPI screens.
3. **Zooming**: Scrolling the mouse wheel changes `barWidth.current` (clamped between minimum width ~2px and maximum width ~200px).
4. **Horizontal Scrolling**: Dragging horizontally modifies `scrollOffset.current`.

---

## 6. Footprint Chart Microstructure

The Footprint chart uses the **exact same coordinate system** as the candlestick chart. It does not use a separate coordinate engine.
Instead, when the user zooms in far enough that `barWidth` has room to display text:
1. The candle column becomes a container for price cells.
2. For each visible candle, `drawFootprint` queries the candle's `cells` map (stored in `AggregationEngine`).
3. It iterates over each price bucket:
   - Top of cell: `yTop = priceToY(bucketPrice + bucketSize)`.
   - Bottom of cell: `yBottom = priceToY(bucketPrice)`.
   - Cell height: `cellHeight = Math.abs(yBottom - yTop)`.
4. It renders:
   - Left side: Bid volume text (sell aggressors).
   - Right side: Ask volume text (buy aggressors).
   - Background fill: Colored by delta or volume intensity (e.g. vibrant red for high sell delta, vibrant green for high buy delta).
   - **POC (Point of Control)**: The price bucket with the highest total volume inside the candle receives a prominent border highlight.
   - **Diagonal Imbalance**: Highlights price levels where ask volume at price $P$ was $3\times$ or $4\times$ greater than bid volume at price $P - \text{tick}$, revealing aggressive market sweep orders.

---

## 7. Indicator Architecture

Every indicator follows a clean separation of concerns:
**Calculation $\rightarrow$ Storage $\rightarrow$ Projection $\rightarrow$ Canvas Rendering**.

| Indicator | Who Calculates It? | Where Is It Stored? | Canvas Rendering |
|---|---|---|---|
| **Volume Bars** | Pre-calculated in OHLCV candle object | `chartRuntimeStore.panels[id].candles` | Rendered behind candles on Layer 2 (`drawVolumeBars.ts`) with height scaled relative to max visible volume. |
| **Delta & CVD** | `delta.ts` computes net delta per candle; running sum accumulates CVD | `chartRuntimeStore` or dedicated `CvdPanel` | Rendered as a separate docked canvas panel or bottom panel overlay (`drawCvd.ts`) with dedicated vertical auto-scaling. |
| **Volume Bubbles** | Collector (historical) or live trade stream (when single trade or tick burst exceeds threshold) | Stored in TimescaleDB hypertable `aggregate_bubbles`; cached in `bubbleRetentionCache` | Rendered on Layer 2 at `(indexToX(candle), priceToY(tradePrice))`; radius is scaled proportionally to volume via power/sqrt curve. |
| **VWAP** | `lib/utils/vwap.ts` computes $\frac{\sum (\text{typicalPrice} \times \text{vol})}{\sum \text{vol}}$ | Memoized in component ref (`vwapSeries`) | Rendered as continuous lines and standard deviation envelope bands on Layer 2 (`drawVwap.ts`). |
| **Volume Profile** | `profileEngine.ts` aggregates all volume across a selected time range into fine price buckets | `profileCache.ts` (cached 1m base rows) | Rendered horizontally as a volume distribution histogram spanning the profile's time range or right-side fixed strip (`drawVolumeProfile.ts`). |
| **Signals (Absorption, Exhaustion, Iceberg)** | Dedicated rule engines in `lib/absorption/`, `lib/exhaustion/`, `lib/iceberg/` evaluate closed and forming candles | Maps in `chartRuntimeStore` (`absorptionMap`, `exhaustionMap`, `icebergLevels`) | Rendered on Layer 2 as marker badges, triangles, or defense level lines (`drawAbsorption.ts`, etc.). |

---

## 8. Drawing Tools Architecture (Screen ↔ Market Projection)

A common interview question: **"When a user draws a trendline or box on a chart and then pans or zooms, how does the drawing stay pinned to the correct market location?"**

```
 USER CLICKS ON CANVAS
        │ (mouseX, mouseY) in screen pixels
        ▼
 CONVERSION TO MARKET COORDINATES
        │ price = yToPrice(mouseY)
        │ time  = candles[xToIndex(mouseX)].time
        ▼
 STORED AS REAL MARKET VALUES (types/chart.ts -> DrawnLine)
        │ {
        │   id: 'line-123',
        │   type: 'box',
        │   priceHigh: 105500,
        │   priceLow: 104800,
        │   startTime: 1716300000,
        │   endTime:   1716307200
        │ }
        ▼
 PERSISTED IN ZUSTAND STORE (useChartStore)
        │
        ▼ ON EVERY CANVAS REDRAW FRAME:
 PROJECTION BACK TO SCREEN PIXELS
        │ yTop   = priceToY(line.priceHigh)
        │ yBottom = priceToY(line.priceLow)
        │ xLeft  = indexToX(timeToIndex(line.startTime))
        │ xRight = indexToX(timeToIndex(line.endTime))
        ▼
 DRAWN ON TOP CANVAS (Layer 3)
```

1. **Drawings NEVER store raw screen pixels**. If they stored pixel values like `x: 400, y: 300`, scrolling or zooming would leave them floating in empty space.
2. They strictly store **market coordinates** (`price`, `startTime`, `endTime`).
3. On every single animation frame, `drawLines.ts` takes those market coordinates and dynamically recomputes their pixel locations using the current `priceMin`, `priceMax`, `scrollOffset`, and `barWidth`.
4. When the user pans or zooms, the stored drawing objects do not change at all—only the viewport projection changes.

---

## 9. Position Tool & Risk-Reward Evaluation

The position tool (`long-position` / `short-position` in `drawLines.ts`) operates on the same coordinate projection system with trading evaluation logic added:
1. **Creation**: The user clicks to set the entry price, then drags vertically to define the stop-loss and take-profit bounds.
2. **Stored State**: Stored with `value` (entry price), `targetPrice` (take-profit), `stopPrice` (stop-loss), and `startTime` (entry timestamp).
3. **Forward Outcome Evaluation (`evaluatePositionOutcome`)**:
   - The engine starts at the entry candle index and walks forward through subsequent historical and live candles.
   - In each candle, it checks whether `candle.high >= targetPrice` (TP hit) or `candle.low <= stopPrice` (SL hit).
   - If target was hit first, the tool is marked as `outcome: 'tp'` and records the exact exit candle index.
   - If stop was hit first, it is marked as `outcome: 'sl'`.
4. **Visual Rendering**:
   - Renders a green target box between entry and TP, and a red risk box between entry and SL.
   - Shows the exact Risk-to-Reward ratio (e.g. `1 : 2.5`).
   - Renders a directional excursion arrow showing price trajectory from entry to exit.
   - Shaded excursion bands darken the travel area up to the exit candle once resolved.

---

## 10. Real-Time WebSocket Pipeline

### Path of Live Market Data:
```
Binance Exchange WebSocket
      │ Raw JSON tick payload: { s: "BTCUSDT", p: "105000", q: "0.5", m: false, T: 1716304200000 }
      ▼
Feed Registry (lib/feeds/binance.ts & feedRegistry.ts)
      │ Normalizes to internal Trade object
      ▼
FeedProvider Callback (handleSpotTrade / handleFuturesTrade)
      │
      ├──► 1. Aggregation Engine (BaseCache.ingestTrade)
      │       - Updates 1m footprint cell [105000] askVol += 0.5
      │       - Updates candle delta and volume
      │
      ├──► 2. Bubble Detector
      │       - Checks if volume exceeds threshold -> buffers aggregate bubble
      │
      └──► 3. chartRuntimeStore (ephemeral state update)
              - Updates current live price and candle OHLC
              - Does NOT trigger full React component tree re-render!
              │
              ▼
requestAnimationFrame Redraw Loop (ChartCanvas.tsx)
      │ Woken up by dirty layer flag
      │ Erases and redraws forming candle on liveCanvasRef (Layer 2)
      │ Erases and updates price line badge on canvasRef (Layer 3)
      ▼
Canvas Screen Updated (60-120 FPS)
```

### Raw Trades vs. Pre-Aggregated
* **In the Browser**: The browser connects to Binance's `@aggTrade` stream (which groups fills occurring within 100ms at the same price) or raw trades. The browser's in-memory `AggregationEngine` processes these into footprint cells on the fly.
* **Avoid Full-Page Reloads / React Churn**: React state (`useState`) is **NOT** updated on every trade tick. If `useState` were updated 50 times per second, React's virtual DOM reconciliation would lock up the browser. Instead, trade ticks update an ephemeral Zustand store (`chartRuntimeStore`) and canvas refs. The canvas renders directly via `requestAnimationFrame`.

---

## 11. Historical Data Storage & Chunked Lazy-Hydration

### Why Historical Data is Handled Separately
Live data is a continuous stream of ephemeral ticks. If you open a chart, you cannot wait 8 hours for live data to accumulate before you can analyze the market—you need instant access to days or weeks of orderflow history.
However, storing and fetching raw ticks for 7 days would require downloading hundreds of millions of rows (gigabytes of JSON), crashing the browser.

### The Solution: Canonical 1-Minute Slices
The backend collector (`btcusdtCollector.mjs`) continuously aggregates raw ticks into **canonical base slices**:
* Timeframe: `1m` (1 minute).
* Bucket Size: `$5` (for BTCUSDT).
* Format: Compact rows containing `[candle_time, bucket_price, bid_vol, ask_vol, delta]`.

### Chunking & Lazy-Loading
1. **Initial Load**: When the chart opens, the frontend requests only the candles and footprint cells for the initial visible window (e.g. the last 300 bars) from `/api/history/footprint`.
2. **Chunk Limits**: The history API caps requests to a maximum of **2 hours** per query (`FOOTPRINT_RANGE_MAX_SECONDS = 7200`) to guarantee fast database query execution and lightweight HTTP payloads.
3. **Lazy Hydration on Scroll**:
   - When the user drags the chart left to view historical data, `FeedProvider` calculates the newly exposed time range (`getScrolledFootprintRestoreWindow`).
   - If missing from `FootprintBaseCache`, it fires an async background fetch for that chunk.
   - When the chunk arrives, `engine.hydrateBaseFootprintCandle()` injects the rows directly into the cache.
   - The canvas redraws seamlessly, filling in the historical footprints without freezing the live chart.

---

## 12. Performance & Worker Architecture (Solving the UI Freeze)

An essential architectural story to tell in an interview:

### The Problem
In early iterations, the browser was responsible for everything:
1. Connecting to high-frequency WebSocket streams.
2. Parsing thousands of JSON messages per second on the main thread.
3. Building orderbook depth structures and 2D heatmap grids.
4. Aggregating raw trades into footprint buckets and volume profiles.
5. Persisting data to storage via server actions.

During high-volatility events (e.g. Bitcoin moving $1,000 in a minute with 10,000+ trades), the browser's single JavaScript thread became saturated. `JSON.parse`, Garbage Collection (GC) pauses from millions of temporary objects, and heavy canvas drawing loops starved the UI, dropping frame rates to 0 FPS and completely freezing the chart.

### The Solution: Offloading Across Three Tiers

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: SERVER-SIDE BACKGROUND DAEMON (Outside Browser)                │
│ scripts/collector/btcusdtCollector.mjs                                 │
│ - 24/7 Node.js process running independently (e.g. via PM2)            │
│ - Consumes raw Binance WS ticks directly                               │
│ - Pre-aggregates canonical 1m footprint and volume profile rows        │
│ - Writes directly to TimescaleDB hypertables in SQL batches            │
│ RESULT: Browser never needs to collect, process, or store raw history! │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP GET chunked slices
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 2: OFF-THREAD WEB WORKERS (Browser Background Threads)            │
│ 1. lib/worker/heatmapWorker.ts                                         │
│    - Raw WebSocket JSON strings are sent directly to the worker        │
│    - Zero main-thread JSON.parse!                                      │
│    - Worker manages the B-tree orderbook and samples the 2D grid       │
│ 2. lib/worker/aggregationWorker.ts                                     │
│    - Computes custom multi-timeframe aggregations off the UI thread    │
│ RESULT: Heavy number crunching runs off the UI thread!                 │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ Render-ready display data
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 3: LEAN MAIN THREAD (Browser UI & Rendering)                      │
│ components/chart/ChartCanvas.tsx                                       │
│ - Only handles user input and canvas 2D rendering                      │
│ - 3-layer canvas sandwich with dirty-column clipping                   │
│ RESULT: Silky-smooth 60-120 FPS interaction with zero freezing!        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 13. System Architecture Layers Summary

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. DATA SOURCE       │ Binance Spot & Futures WebSockets & REST APIs   │
├──────────────────────┼─────────────────────────────────────────────────┤
│ 2. COLLECTION        │ Standalone Node.js daemon (btcusdtCollector.mjs)│
├──────────────────────┼─────────────────────────────────────────────────┤
│ 3. PROCESSING        │ 1m Slicing, Footprint Bucketing, Bubble Engine  │
├──────────────────────┼─────────────────────────────────────────────────┤
│ 4. STORAGE           │ TimescaleDB Hypertables (PostgreSQL)            │
├──────────────────────┼─────────────────────────────────────────────────┤
│ 5. DELIVERY          │ Next.js History APIs & Shared WS Feed Registry  │
├──────────────────────┼─────────────────────────────────────────────────┤
│ 6. APPLICATION STATE │ Zustand Stores (chart.ts & chartRuntimeStore)   │
├──────────────────────┼─────────────────────────────────────────────────┤
│ 7. RENDERING         │ 3-Layer HTML5 Canvas Sandwich (rAF Pipeline)    │
├──────────────────────┼─────────────────────────────────────────────────┤
│ 8. INTERACTION       │ Pan, Zoom, Drawing Tools, Trading Overlays      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Concrete Walkthrough 1: A New BTC Trade Arrives

**Scenario**: A taker buy trade of **0.75 BTC** occurs at **$105,250.00** at timestamp **10:31:25 AM**.

1. **Exchange**: Binance matches the trade and broadcasts an `@aggTrade` message over WebSocket:
   `{"s":"BTCUSDT", "p":"105250.00", "q":"0.75", "m":false, "T":1716304285000}`.
2. **Collector (Server)**:
   - `btcusdtCollector.mjs` receives the packet.
   - Floors time to the 1m slice: `10:31:00`.
   - Floors price to the $5 bucket: `105250`.
   - Adds `0.75` to `askVol` and `+0.75` to `delta` for that bucket.
   - Buffers the updated slice for batch insertion into TimescaleDB.
3. **Feed Registry (Client)**:
   - The browser's active WebSocket receives the trade packet.
   - Normalizes it into a typed `Trade` object.
4. **FeedProvider (Client)**:
   - Passes the trade to `engineRef.current.ingestTrade(trade)`.
   - The engine updates the in-memory `FootprintBaseCache` for candle `10:31:00`, bucket `105250`:
     `cell.askVol += 0.75`.
   - Updates the live forming candle in `chartRuntimeStore`: `candle.close = 105250`, `candle.high = max(high, 105250)`, `candle.volume += 0.75`.
5. **Canvas Redraw**:
   - `ChartCanvas` receives the dirty tick signal.
   - On the next `requestAnimationFrame`:
     - **Layer 2 (`liveCanvasRef`)**: Clears and redraws the forming candle column. The candle body height updates, and the footprint cell at $105,250 displays the increased ask volume and updated green delta bar.
     - **Layer 3 (`canvasRef`)**: Updates the market price line at $105,250 and updates the right price axis badge.

---

## 15. Concrete Walkthrough 2: User Moves the Mouse Over the Canvas

**Scenario**: The user hovers their cursor at pixel position `x = 520, y = 180`.

1. **Capture**: The top canvas (`canvasRef`, Layer 3) receives the DOM `mousemove` event.
2. **Coordinate Conversion**:
   - **X to Index/Time**:
     `index = xToIndex(520, ...)`.
     The system identifies that index `142` corresponds to the candle at timestamp `10:15:00 AM`.
   - **Y to Price**:
     `price = yToPrice(180, priceMin, priceMax, chartHeight)`.
     The system determines that pixel $Y = 180$ corresponds to price **$105,420.50**.
3. **Hit Testing (`chartCanvasHitTest.ts`)**:
   - Checks if the cursor is near any drawing tool lines, box handles, or TP/SL bracket orders.
   - If near a handle, switches the cursor style to `ns-resize` or `move`.
4. **Data Lookup**:
   - Retrieves `candle = candles[142]`.
   - If in footprint mode, queries `engine.getCells(candle.time)` to find the exact bid/ask volume for the bucket at $105,420.
5. **Crosshair & Tooltip Rendering**:
   - Layer 3 clears its overlay.
   - Draws dashed horizontal line at $Y = 180$ and dashed vertical line at $X = 520$.
   - Draws a rounded price badge on the right price axis showing `$105,420.50`.
   - Draws a rounded time badge on the bottom time axis showing `10:15 AM`.
   - Updates the top-left `IndicatorLabels` header showing OHLC values for that candle.
   - **Crucial**: Layers 1 and 2 do NOT redraw! The background, historical candles, and footprint cells remain untouched in their GPU buffers, ensuring a lag-free 120 FPS cursor experience.

---

## 16. Interview Preparation Guide

### A. 60-Second Elevator Pitch
> *"I built a high-performance orderflow charting platform designed to visualize market microstructure in real time—including footprint charts, cumulative volume delta, volume profiles, and trade bubbles. The core challenge was handling the velocity of tick-by-tick cryptocurrency data without freezing the browser.*
>
> *To solve this, I designed a multi-tiered architecture: A standalone Node.js daemon runs 24/7 on the server, ingesting high-frequency Binance WebSocket streams and pre-aggregating trades into canonical 1-minute, $5-bucket slices in TimescaleDB. In the frontend, rather than relying on heavy DOM trees or single-canvas repaints, I engineered a 3-layer HTML5 canvas architecture that decouples static environments, dynamic market data, and interactive drawings. Heavy orderbook depth parsing is offloaded to Web Workers, and live ticks update an ephemeral store that renders via requestAnimationFrame with dirty-column clipping. This keeps the chart buttery-smooth at 60 to 120 frames per second even during extreme market volatility."*

---

### B. 2–3 Minute Deep Dive
> *"When building this platform, I wanted to give traders deep visibility into orderflow—specifically bid/ask volume imbalance, absorption, and liquidity depth. In financial charting, off-the-shelf libraries often fail when you need to render tens of thousands of custom footprint cells and dynamic profiles, so I built the charting engine from scratch using HTML5 Canvas.*
>
> *The architecture spans four main areas:*
>
> *First, Data Ingestion and Processing. Rather than having the client ingest millions of raw trades, I built a server-side collector using Node.js and TimescaleDB. The collector ingests Binance Spot and Futures trades, groups them into canonical 1-minute slices with $5 price buckets, and writes them to hypertables. The frontend can then lazily request historical chunks as the user scrolls, while subscribing to a lightweight shared WebSocket feed for live updates.*
>
> *Second, Coordinate Mapping. The chart uses an index-based coordinate projection rather than linear time, which elegantly avoids blank gaps during market halts or low liquidity. A binary search converts timestamps to candle indices, which map to X pixels based on bar width and horizontal scroll offset. Price is linearly mapped to Y pixels based on the visible viewport min and max, with 8% vertical padding.*
>
> *Third, The 3-Layer Canvas System. To achieve high frame rates, I stacked three canvases: Layer 1 at the bottom renders static grids and session highlights. Layer 2 in the middle renders candlesticks, footprint cells, volume bubbles, and VWAP bands. Layer 3 on top handles user interaction—drawings, position tools, and the crosshair. When a user moves their mouse, only Layer 3 redraws. When a new trade arrives, Layer 2 clips strictly to the single forming candle column and updates its cells, leaving hundreds of historical candles untouched.*
>
> *Finally, Drawing and Position Persistence. When a user creates a drawing or risk-reward position tool, the tool stores pure market coordinates—price levels and Unix timestamps—never screen pixels. On every frame, the projection math translates those market coordinates back to screen pixels, meaning drawings stay perfectly locked to price action regardless of how much the user pans or zooms.*
>
> *This decoupled architecture eliminated UI freezes, kept memory usage bounded, and gave me an institutional-grade charting experience."*

---

### C. 15 Realistic Technical Interview Questions & Conceptual Points

#### Q1: Why did you use HTML5 Canvas instead of SVG or standard DOM elements (divs)?
* **Key Concept**: DOM nodes create retained-mode overhead; every div or SVG element requires memory, style recalculation, layout reflow, and paint cycles. A footprint chart with 300 visible candles and 50 price levels each would require over 15,000 DOM nodes. Updating that at 60 FPS would cripple the browser. HTML5 Canvas is immediate-mode graphics: it draws raw pixels directly to the GPU buffer with zero DOM overhead.

#### Q2: How do you prevent React re-renders from degrading canvas frame rates?
* **Key Concept**: Decoupling React state from the render loop. High-frequency trade ticks and mousemove events do **NOT** call React `useState` or `useReducer`. Instead, they update an ephemeral Zustand store (`chartRuntimeStore`) and canvas refs. The canvas renders via `requestAnimationFrame`. React only renders outer layout wrappers, toolbar modals, and settings dialogs.

#### Q3: Why is time mapped using candle indices rather than a linear Unix timestamp scale?
* **Key Concept**: Market discontinuity. If $X$ were proportional to continuous Unix time, weekends, market halts, or low-liquidity time gaps would show up as massive empty voids. By using index-based bar slots (`candles[i]`), every candle gets equal horizontal space regardless of elapsed time, matching industry standards like TradingView.

#### Q4: How does the chart stay responsive when a user scrolls through days of historical data?
* **Key Concept**: Windowing, chunking, and lazy hydration. The frontend only holds what it needs in memory. When the user pans into the past, `FeedProvider` calculates the missing time window and requests a capped 2-hour chunk from the TimescaleDB API. The data is hydrated into the cache asynchronously without interrupting the live streaming render loop.

#### Q5: What is the purpose of the 3-layer canvas architecture?
* **Key Concept**: Minimizing redraw surface area. Canvas `clearRect` and repaints have a fill-rate cost. Separating the static background (Layer 1), heavy market data (Layer 2), and high-frequency interactive overlays (Layer 3) means a mousemove event only redraws Layer 3, leaving Layer 2’s heavy footprint text and Layer 1’s grid completely cached in GPU memory.

#### Q6: How does footprint data aggregate from raw trades?
* **Key Concept**: The Bid/Ask rule (Taker side). In orderbook matching engines, trades occur when an aggressive market order hits a passive limit order. If `isBuyerMaker` is false, an aggressive buyer lifted the ask $\rightarrow$ credited to `askVol`. If true, an aggressive seller hit the bid $\rightarrow$ credited to `bidVol`. These are bucketed into price rows via `Math.floor(price / bucketSize) * bucketSize`.

#### Q7: What causes canvas lines to appear blurry on Retina / 4K monitors, and how did you solve it?
* **Key Concept**: Device Pixel Ratio (DPR) and half-pixel alignment. On high-DPI screens, 1 CSS pixel equals 2 or 3 physical device pixels. The canvas internal buffer must be scaled by `window.devicePixelRatio` while keeping its CSS style width and height constant. Furthermore, 1px lines must be drawn at integer $+ 0.5$ coordinates (`alignCoord`) so the stroke sits squarely in the center of a physical pixel rather than splitting across two pixels.

#### Q8: What was the main cause of browser freezes in earlier iterations of your app?
* **Key Concept**: Event-loop saturation on the single JavaScript UI thread. Parsing raw JSON WebSocket strings, maintaining orderbook data structures, computing footprint buckets, and executing heavy canvas render passes all competed for the same thread. High market volatility caused long tasks (>100ms), starving the browser's render pipeline and freezing user input.

#### Q9: How did moving data collection to a background Node.js process solve that problem?
* **Key Concept**: Architectural decoupling. The standalone collector (`btcusdtCollector.mjs`) runs in its own OS process outside the browser. It does the heavy lifting of continuous 24/7 ingestion, tick bucketing, and TimescaleDB persistence. The browser is freed from being a database writer and only acts as a consumer of pre-aggregated slices.

#### Q10: How do you handle orderbook depth updates without lagging the UI?
* **Key Concept**: Off-thread Web Worker (`heatmapWorker.ts`) and skipping main-thread `JSON.parse`. Raw WebSocket JSON strings are piped directly to the worker thread via `postMessage`. The worker parses the JSON, updates the orderbook, and samples a 2D time-price grid, sending back only compact, render-ready pixel slices to the main thread.

#### Q11: How do drawing tools survive viewport zooming and panning?
* **Key Concept**: Model-View separation. The drawing model strictly stores real market coordinates (`priceHigh`, `priceLow`, `startTime`, `endTime`). The view dynamically calculates screen pixels on every animation frame using `priceToY` and `indexToX`. Because the model is immune to zoom and pan, the drawings remain mathematically anchored to the candles.

#### Q12: How does the position tool evaluate trade outcomes?
* **Key Concept**: Forward candle iteration. Starting from the entry candle timestamp, `evaluatePositionOutcome` iterates forward through subsequent candles. It compares each candle's high and low against `targetPrice` (TP) and `stopPrice` (SL). Whichever threshold is breached first resolves the outcome (`tp` or `sl`) and locks the exit candle index and realized risk-reward metrics.

#### Q13: Why did you choose TimescaleDB over a standard relational or NoSQL database?
* **Key Concept**: TimescaleDB is built on PostgreSQL but introduces automatic time-based partitioning via **Hypertables**. Orderflow data is inherently time-series. Hypertables partition data into discrete time chunks, meaning range queries (e.g. "give me footprint cells between 10:00 and 12:00") only scan relevant chunk indexes, avoiding full-table scans over millions of historical rows.

#### Q14: What is the Feed Registry, and why is it necessary?
* **Key Concept**: Stream deduplication and connection ref-counting. If a user configures a split-screen view with two panels watching the same BTCUSDT symbol on different timeframes, naive components would open two separate WebSocket connections to Binance. The `feedRegistry` acts as a central singleton: it opens **one** shared connection, tracks active subscriber panels, and fans out incoming events. When all panels unsubscribe, it cleanly tears down the socket.

#### Q15: How does the chart handle multi-timeframe switching without re-downloading all data?
* **Key Concept**: Canonical base caching (`FootprintBaseCache` and `candleRetentionCache`). The application caches data in canonical 1-minute base slices. When the user switches from a 1-minute view to a 5-minute view, the client-side `AggregationEngine` rolls up five 1-minute slices into each 5-minute display bar in memory, updating the chart instantly without a round-trip network request.
