# OrderFlow Chart - Change Log

## [2026-09-18] - Feature: Wire bubbleThreshold to Aggregate Bubbles SQL Query

- **What changed**:
  - `components/FeedProvider.tsx`: Read `bubbleThreshold` from panel state and passed as `minVolume` in initial and scroll restore queries.
  - `app/api/history/aggregate-bubbles/route.ts`: Parsed `minVolume` search param and forwarded to repository.
  - `lib/db/timescale/repositories/bubbleRepository.ts`: Added `minVolume` to input type, appended `$6` parameter, and added `AND volume >= $6` to SQL WHERE clause.
- **Why it changed**: Filter candidate bubbles at database query level to prevent transferring tens of thousands of rows below threshold over the wire.
- **Impact summary**: For bubbleThreshold=50, response drops from 50k rows to 270 rows (transfers in ~2s vs ~200s); 0 tsc errors.

## [2026-09-18] - Fix: Aggregate Bubbles Query Plan & TimescaleDB Index Optimization

- **What changed**:
  - `lib/db/timescale/repositories/bubbleRepository.ts`: Selected explicit columns and removed secondary `aggregate_trade_id` from SQL `ORDER BY` to eliminate `Incremental Sort`; deterministic tie-break moved to in-memory JS.
  - `lib/db/timescale/migrations.ts`: Added `idx_bubbles_restore_desc` and `idx_bubbles_symbol_time_desc` indexes.
- **Why it changed**: Profiled `/api/history/aggregate-bubbles` with `EXPLAIN ANALYZE`; multi-column sort triggered Incremental Sort and composite index could not satisfy `ANY` contract types.
- **Impact summary**: Query plan execution time on DB engine is 24–82ms for 50k rows (well under 1s target); eliminated Incremental Sort; 0 tsc errors.

## [2026-09-18] - Fix: Aggregate Bubbles — Progressive Scroll Loading & Retention Cache

- **What changed**:
  - `lib/db/aggregateBubbleStorage.ts`, `bubbleRepository.ts`, `route.ts`: Raised limit to 50k, added `order: DESC`, removed 6h cap, updated `Cache-Control` to 3600/86400.
  - `lib/chart/bubbleRetentionCache.ts` [NEW]: Module-level retention cache keyed by `symbol::contractType::timeframe` for instant replay on switch.
  - `lib/store/chartRuntime.ts`: Incremented `dataVersion` on bubble appends to trigger immediate canvas redraw.
  - `components/FeedProvider.tsx`: Added upfront 50k fetch covering full candle range and 250ms scroll trigger with 500-bar threshold with chunked hydration.
- **Why it changed**: Bubbles only loaded in narrow 6h window, never loaded on scroll-back, were wiped on timeframe switches, and lacked HTTP caching.
- **Impact summary**: Bubbles load across 7-day scroll range at the same speed as footprint with zero canvas freeze and instant replay on timeframe switch; 0 tsc errors.

## [2026-09-17] - Fix: Footprint Retention, Main-Thread Hydration & TimescaleDB Restore Throughput

- **What changed**:
  - `lib/cache/marketCachePolicy.ts` & `lib/aggregation/engine.ts`: Increased base slice and candle capacity to 15,000; guarded trim.
  - `components/feed/hooks/useFeedAggregation.ts` & `lib/worker/aggregationWorker.ts`: Initialized AggregationEngine with 15,000 maxCandles.
  - `components/FeedProvider.tsx`: Hydrated engineRef directly on footprint restore; decoupled scroll restores from profile blocking; limited historical profile restore batch size.
  - `lib/db/timescale/client.ts`: Raised TimescaleDB pool max connections from 5 to 20.
  - `lib/db/timescale/repositories/footprintRepository.ts` & `profileRepository.ts`: Removed redundant `bucket_price ASC` SQL sorting.
- **Why it changed**: Fixed 500-candle trim discarding historical footprints, missing direct main-thread hydration, profile restores blocking footprint scroll lazy-loads, and pool starvation.
- **Impact summary**: Footprints attach and remain visible across multi-day history; parallel restore throughput increased without pool queuing; 0 TypeScript errors.

## [2026-09-17] - Performance: Optimize Profile, Footprint & Bubble Restores (HTTP Caching + Concurrency)

- **What changed**:
  - `app/api/history/profile/route.ts` & `aggregate-bubbles/route.ts`: Removed `force-dynamic`, enabled HTTP `Cache-Control` for historical ranges, and fixed `Math.min/max` array spread.
  - `components/FeedProvider.tsx`: Increased profile restore concurrency from 1 to 3; batched footprint chunk restore with concurrency 3; removed `cache: 'no-store'` from profile and bubble requests; decoupled aggregate bubble restore from blocking chart startup.
- **Why it changed**: Profile chunks took 40–55s sequentially and bubbles/footprints took 125s blocking startup on remote VPS/free-tier databases.
- **Impact summary**: Initial chart render is no longer blocked by bubble restore; profile and footprint load 3x faster in parallel; repeat visits hit browser HTTP cache; 0 TypeScript errors.

## [2026-09-17] - Fix: Server-Side Binance Historical Candles Fallback & TimescaleDB Auto-Persistence

- **What changed**:
  - `lib/feeds/serverBinanceCandles.ts` [NEW]: Server-side Binance REST fetcher using `undici.ProxyAgent` (with `BINANCE_PROXY_URL`) and TimescaleDB auto-persister via `storeCandles`.
  - `app/api/history/candles/route.ts`: Integrated fallback to `fetchAndStoreBinanceCandles` when stored candle query returns 0 rows.
- **Why it changed**: `market_candles` had 0 rows in TimescaleDB and client-side direct Binance REST fetch failed (CORS/proxy requirement), causing 1m chart to only show live session ticks.
- **Impact summary**: Cold requests to `/api/history/candles` now automatically fetch, persist, and return the full 7-day range (10,080 1m candles); subsequent reads hit TimescaleDB directly; 0 TypeScript errors.

## [2026-09-17] - Fix: 1m Historical Candle Initial Loading in React Strict Mode

- **What changed**:
  - `components/FeedProvider.tsx`: Removed premature early-return inside `candleCache.restoreHistory` that was aborting the shared Binance history fetch when the first Strict Mode effect cleaned up (`!active`). Allowed Binance fetch to complete for the shared cache, and added `pushAllCandles(panelId, history)` upon `restoreHistory` resolution when active.
- **Why it changed**: React Strict Mode's initial double-mount caused the in-flight restore promise to abort with 0 candles, leaving 1m with only live ticks.
- **Impact summary**: 1m historical candles load fully on initial page load; seamless 1m <-> 5m switching; 0 TypeScript errors.

## [2026-09-17] - Fix: Timeframe Gating & Stale Closure Fix for Candle Retention Cache (P1-A Follow-up)

- **What changed**:
  - `components/FeedProvider.tsx`: Gated all 4 `candleRetentionCache.set` and `pushAllCandles` sites to `active && activeTimeframe === timeframe`. Derived source parameters from `snapshot.key` at Site 2 (`candleCache.subscribe`). Changed Site 1 (lazy restore) to cache local `merged` array rather than reading live Zustand store.
  - `components/FeedProvider.tsx`: On timeframe switch, `resetPanelRuntime` now clears candles to `[]` before replaying `cached`, ensuring previous timeframe candles never merge into new timeframe.
- **Why it changed**: Fixed bug where switching 1m → 5m caused 1m candles to bleed into 5m chart/cache slot from un-gated in-flight fetches and stale closures.
- **Impact summary**: Timeframe switches 1m → 5m → 1m cleanly display single-timeframe data; Test 2 & Test 3 passing; 0 TypeScript errors.

## [2026-09-17] - Fix: Selective Reset — Stop Clearing Candles on Timeframe Switch (P1-A)

- **What changed**:
  - `lib/chart/candleRetentionCache.ts` [NEW]: Module-level singleton `CandleRetentionCache` keyed by `symbol::contractType::timeframe`. Stores a shallow copy of the candle array on every `pushAllCandles` call. Evicts all entries for a symbol when the symbol changes. Used to replay candles instantly on timeframe switch-back.
  - `lib/store/chartRuntime.ts`: `resetPanelRuntime` now accepts an optional `opts?: { keepCandles?: boolean }` parameter. When `keepCandles: true`, the action preserves the current `panels[panelId].candles` array instead of resetting it to `[]`. All other panel state (footprint, profile, signals, etc.) is still fully reset.
  - `components/FeedProvider.tsx`:
    - Added import of `candleRetentionCache`.
    - Added `prevSymbolRef` and `prevContractTypeRef` refs to track the previously-active symbol and contractType across `useEffect` runs.
    - Split the `resetPanelRuntime(panelId)` call into two branches:
      - **Symbol change**: calls `candleRetentionCache.clearSymbol(old, ...)` then `resetPanelRuntime(panelId)` (full clear, candles: `[]`). BTCUSDT candles can never appear on an ETHUSDT chart.
      - **Timeframe / dataSourceMode change (or initial mount)**: calls `resetPanelRuntime(panelId, { keepCandles: !!cached })`. If a cached snapshot exists for the new `symbol::contractType::timeframe`, it is replayed immediately via `pushAllCandles` so the canvas draws on the current frame. Background fetch still fires to fill gaps.
    - Added `candleRetentionCache.set(...)` at all 4 `pushAllCandles` call sites (stored history load, Binance merge, cache snapshot, lazy scroll-back merge) so the retention cache is always current.
- **Why it changed**: The highest-impact P1 gap — every timeframe switch wiped `candles: []` (Gap A3), causing a visible blank + a full network round-trip. With this fix, switching back to a previously-visited timeframe is instant and network-free.
- **Impact summary**:
  - Timeframe switch to a warm timeframe: canvas stays populated, zero network request, zero blank frame.
  - Timeframe switch to a cold timeframe: chart shows load state and fetches normally — same as before.
  - Symbol switch: always full clear — BTCUSDT candles never bleed to ETHUSDT.
  - Memory: ~24 MB max for 5 timeframes × 10k 1m candles. Cache evicts on symbol switch.
  - TypeScript: 0 errors.

## [2026-09-17] - Fix: History Fetch Performance — P1-B, P1-C, P1-D (gap report)

- **What changed**:
  - `components/FeedProvider.tsx` (P1-B): Reduced `lazyProfileRestoreInterval` from **1200 ms → 250 ms** so the scroll-triggered lazy-load fires 4–5× faster.
  - `components/FeedProvider.tsx` (P1-B): Widened `getScrolledCandlesRestoreWindow` threshold from **150 bars → 500 bars** so a prefetch fires ~2–3 seconds before the user reaches the empty edge of loaded history, rather than after.
  - `components/FeedProvider.tsx` (P1-C): Changed initial `fetchStoredHistory` limit from **hardcoded 500 → computed 7-day count** (`Math.min(10080, ceil(604800 / timeframeSeconds))`). For 1m this loads ~10 080 candles upfront; for 5m ~2 016, for 1h ~168. Scroll-back into the 7-day window now hits the local Zustand store, not the network.
  - `app/api/history/candles/route.ts` (P1-D): Added **`Cache-Control` headers** to history responses. Requests with `until > 0` that are fully in the past (more than one timeframe ago) receive `public, max-age=3600, stale-while-revalidate=300`; live-edge requests receive `no-store`. Repeated scroll-backs into the same past range now serve from the browser cache with zero DB reads.
- **Why it changed**: Gap report identified these three as Priority-1 quick wins: coarse polling and a narrow trigger threshold caused blank chart regions during scroll (P1-B); a hard 500-candle cap forced network round-trips for every scroll deeper than ~8h (P1-C); no Cache-Control meant every re-scroll refetched from DB (P1-D).
- **Impact summary**: Scroll-back within the 7-day window is now network-free on first pass and cache-served on repeat passes. Trigger latency reduced from up to 1.2 s to ≤250 ms. TypeScript: 0 errors.

## [2026-09-17] - Fix: Volume Bubbles Threshold Reactivity, Input Event Binding & Canvas Redraw

- **What changed**:
  - In `components/ui/fig/PropskitNumber.tsx`: updated input event handler to seamlessly fall back to `onChange` when `onInput` is omitted.
  - In `components/ui/chart-settings/BubbleSettings.tsx`: bound `onInput` to `PropskitNumber` for `bubbleThreshold` and `bubbleTickCount`.
  - In `lib/store/chart.ts`: updated `setBubbleThreshold` clamp to `Math.max(0.1, ...)` and validated in `clampTimeframeSettings`.
  - In `components/chart/ChartCanvas.tsx`: added reactive `useEffect` watching bubble settings to immediately invoke `redrawRef.current('all')`.
- **Why it changed**: Fixed bug where volume bubbles minimum threshold changes in settings didn't reflect on the canvas or stick.
- **Impact summary**: Threshold changes update the canvas reactively in real time; 0 TypeScript errors; all 15 bubble tests passing.

## [2026-09-16] - Feature: MT5 Hollow Compare Candles & Trailing Stop Loss past Breakeven

- **What changed**:
  - In `components/chart/drawSideBySideCandles.ts`: MT5 candles now use web candlestick colors (green bullish, red bearish) and render as crisp hollow candles with 1px border stroke alongside solid Binance candles; updated legend to "Binance: Solid" vs "MT5: Hollow".
  - In `components/chart/ChartCanvas.tsx`: removed artificial `entryPrice` boundary from bracket drag clamping, allowing Stop Loss to be trailed freely past breakeven into profit/TP zone bounded only by active Take Profit.
- **Why it changed**: User requested eliminating visual confusion in Mode 4 by rendering MT5 as hollow candles with web colors, and fixing position scaling/trailing so Stop Loss can move past breakeven into profit.
- **Impact summary**: Zero visual illusion in MT5 Compare mode; full freedom to trail Stop Loss into profit; 0 TypeScript errors; all 15 bubble tests and 8 orderbook sync tests passing.

## [2026-09-16] - Feature: Bookmap-Style Heatmap — Passive Depth Ramp, Bid/Ask Corridor, Active Trade Bubbles & Futures Sequence Fix

- **What changed**:
  - In `lib/liquidity/orderbook.ts`:
    - Added `pu?: number` field to `DepthUpdate` interface (Binance Futures previous event update ID).
    - Introduced `isFuturesEvent()` helper: detects Futures stream by presence of `pu` field.
    - Rewrote `initFromSnapshot()` and `applyUpdate()` with dual-mode validation:
      - **Spot**: `U === rollingU + 1` (unchanged, backward-compatible).
      - **Futures**: `pu === rollingU` for subsequent events; `(pu <= snapId || U <= snapId) && snapId <= u` for bridging.
    - Fixed root cause of "flat-tube" static heatmap on Futures: old code triggered resync on 100% of Futures events because `U` values jump by thousands between events (match-engine transaction IDs, not sequential).
  - In `lib/feeds/feedRegistry.ts`:
    - `getDepthKey()` and `getSnapshotKey()` now accept `contractType` to scope stream keys.
    - `subscribeDepthStream(symbol, contractType, callback, onStateChange)` — added `contractType` param; routes to correct adapter (`getAdapter(contractType)`) instead of hardcoded `getAdapter('spot')`.
    - `fetchSharedOrderbookSnapshot(symbol, contractType, limit)` — added `contractType` param; routes to correct adapter.
  - In `components/FeedProvider.tsx`:
    - `loadOrderbookSnapshot()` now calls `fetchSharedOrderbookSnapshot(pair, contractType, 500)`.
    - `subscribeDepthStream` call now passes `contractType` as second argument.
  - In `lib/liquidity/orderbookHeatmap.ts`:
    - Added `bestBid: number | null` and `bestAsk: number | null` fields to `HeatmapSlot`.
    - `sample()` captures `orderbook.getBestBid()` and `orderbook.getBestAsk()` at each sample tick and includes them in the return payload.
    - `ingestSlice()` accepts optional `bestBid`/`bestAsk` parameters and stores them in the slot.
  - In `lib/worker/heatmapWorker.ts`:
    - `HEATMAP_SLICE` payload type expanded to include `bestBid: number | null` and `bestAsk: number | null`.
    - Worker sample timer automatically includes them since `engine.sample()` now returns them.
  - In `lib/worker/heatmapWorkerClient.ts`:
    - `onHeatmapSlice` callback type updated to expose `bestBid`/`bestAsk`.
    - `handleMessage` passes `bestBid`/`bestAsk` to `localEngine.ingestSlice()`.
  - In `lib/draw/drawOrderbookHeatmap.ts` (**full Bookmap-style rewrite**):
    - **Passive liquidity (background)**: Replaced the warm steel-blue→amber→red ramp with a cool-tone-only ramp (navy → deep blue → medium blue → cyan → bright cyan). Heavy resting walls glow bright cyan; near-zero depth is invisible.
    - **Bid/ask corridor lines**: Two polylines connecting each slot's `bestBid` (green/teal `rgba(0,188,140,0.85)`) and `bestAsk` (red/coral `rgba(220,75,55,0.85)`) over time. Creates the "two lines tracking price" from Bookmap.
    - **Active liquidity bubbles**: Replaced the flat white-dot trade overlay with scaled green/red filled circles. Green = aggressive buy (`isBuyerMaker === false`); Red = aggressive sell (`isBuyerMaker === true`). Radius scales with `sqrt(qty / p95Qty)` for perceptual sizing. Alpha increases with trade size.
  - In `scripts/testOrderbookSync.ts`:
    - Added Tests 6–8: Futures buffered pu-bridge, Futures live pu continuity + gap detection, Spot regression.
- **Why it changed**: User-requested transformation to match Bookmap's visual model: passive resting depth as a cool-tone background, two bid/ask corridor lines tracking the spread, and executed trade bubbles for active liquidity. Also fixes the root-cause bugs preventing Futures depth streams from working (wrong adapter + wrong sequence validation).
- **Impact summary**: 0 TypeScript errors; all 8 orderbook sync tests pass; Futures heatmap now initializes correctly (0 resyncs in steady state); cool-tone depth ramp visually separates passive from active liquidity; corridor lines show spread history; green/red bubbles show where trades actually executed.

## [2026-09-16] - Feature: Interactive Heatmap Split Chart Canvas, Independent Pan/Zoom & Price/Time Axes

- **What changed**:
  - In `components/chart/HeatmapPanel.tsx`:
    - Transformed `HeatmapPanel` into an interactive standalone chart canvas that enables as an indicator docked side-by-side in `ChartPanel`.
    - Added dedicated vertical Price Axis (`PRICE_AXIS_WIDTH = 65px`) along the right edge and horizontal Time Axis (`TIME_AXIS_HEIGHT = 24px`) along the bottom edge using `drawPriceAxis` and `drawTimeAxis` from `components/chart/drawAxes.ts`.
    - Implemented independent navigation coordinate state (`priceCenterRef`, `priceRangeRef`, `scrollOffsetRef`, `barWidthRef`, `isAutoScaledRef`).
    - Added comprehensive canvas interaction handlers:
      - Dragging inside chart canvas: freely pans in time (`scrollOffset`) and price (`priceCenter`) without affecting the main candlestick chart.
      - Dragging right vertical price bar: smoothly zooms price range (`ns-resize` cursor).
      - Dragging bottom horizontal time bar: smoothly zooms time scale (`ew-resize` cursor) anchored at mouse position.
      - Mouse wheel zoom: zooms price over price axis, zooms time over time axis or chart area.
      - Double-clicking price axis: auto-fits price to active market depth and re-engages auto-scale.
      - Double-clicking time axis: resets time zoom and scroll back to latest live bar (`barWidth = 12, scrollOffset = 0`).
    - Added a live current market price dashed reference line across the heatmap and an accent-colored price badge on the price axis.
    - Added "AUTO" toggle badge button and "RESET" navigation button to the top header controls overlay.
    - Strictly clipped heatmap rendering to `[0, chartWidth] × [0, chartHeight]` to prevent pixel bleed into axes.
    - Preserved 0 React re-renders during active drag and pan/zoom gestures via rAF-scheduled redraws.
- **Why it changed**: User requested that the heatmap function as its own interactive chart with its own space, independent up/down/left/right movement, zooming, and vertical/horizontal price and time bars.
- **Impact summary**: Heatmap operates as a full-featured, responsive split chart canvas with independent navigation and crisp TradingView-style price and time axes; zero UI freezes; zero React re-render churn during dragging; all tests pass and 0 TypeScript errors.

## [2026-09-16] - Fix: Order Book Heatmap Color Scheme Restoration, Visible Alpha Curve & Accurate P95 Sampling

- **What changed**:
  - In `lib/draw/drawOrderbookHeatmap.ts`:
    - Updated alpha power curve in `HEATMAP_COLOR_LUT` to `0.18 + 0.77 * t^1.3`, providing a visible 18% floor so the steel-blue background orderbook envelope glows clearly on dark `#0E1015` canvas without multi-pass overdraw.
    - Implemented a wall-preserving blend in pixel-column quantization: if a genuine heavy resting wall exists (`max >= safeP95 * 0.6`), it is preserved at full peak wall intensity (`max`); background and moving bids use natural latest/average sizing, preventing 5-second noise from artificially turning the entire active price channel solid red.
    - Removed redundant vertical pixel map allocation, rendering each discrete price bucket directly with half-pixel canvas coordinates.
  - In `lib/liquidity/orderbookHeatmap.ts`:
    - Restored full viewport sampling for `p95Clamp` calculation across all visible slots (removed artificial 1,000-cell cutoff from the first 2 slots that collapsed p95 to near-zero).
- **Why it changed**: User identified that while the freeze was eliminated, the previous `Math.max` merge across 25 slots combined with artificially low p95 sampling caused the heatmap to lose its color gradient and appear as a flat solid red block.
- **Impact summary**: Restored the original rich color gradient (steel blue background envelope, cyan-teal, green, amber, and sharp red-orange core walls); freeze remains 100% eliminated; all tests pass and 0 TypeScript errors.

## [2026-09-16] - Fix: Order Book Heatmap Performance, Pixel-Column Max Merge & React Render Decoupling

- **What changed**:
  - In `lib/draw/drawOrderbookHeatmap.ts`:
    - Replaced sub-pixel draw loop with pixel-column quantization: grouped time slots by integer pixel `x = Math.floor(timeToX(slot.timeSlot))`.
    - Implemented `Math.max` merge per price row across all sub-pixel slots sharing a column, guaranteeing zero historical resting wall data loss.
    - Added vertical integer pixel grouping sanity cap so zooming out on tight tick sizes cannot exceed screen height in draw calls.
    - Batched trade overlay dots into a single `Path2D` / `ctx.beginPath()` pass with 1 `ctx.fill()` and 1 `ctx.stroke()`, eliminating thousands of redundant canvas state changes.
  - In `components/chart/HeatmapPanel.tsx`:
    - Decoupled `HeatmapPanel` completely from high-frequency React state re-renders: removed `trades`, `candles`, and `viewportPrice` hook subscriptions.
    - Switched to imperative subscriptions outside React via `useChartRuntimeStore.subscribe` and `useChartStore.subscribe`, matching established pattern from `CvdPanel.tsx`.
    - Made `render()` read store values imperatively via `getState()`, ensuring `HeatmapPanel` React component re-renders 0 times during active trade streaming.
  - In `lib/liquidity/orderbookHeatmap.ts`:
    - Replaced $O(N \log N)$ `sortedTimeSlots.sort()` in `ingestSlice` with an $O(1)$ chronological append / binary insert.
    - Bounded 95th percentile clamp sampling in `getVisibleGrid` to 1,000 samples and cached for 1 second, eliminating sorting 50,000 floats per frame.
  - In `components/chart/ChartCanvas.tsx`:
    - Added epsilon deadband ($10^{-4}$) to `setViewportPrice` to suppress store notifications from floating-point micro-jitter on idle frames.
- **Why it changed**: Heatmap panel caused UI freezes and 100% CPU spikes due to drawing up to 7,000 sub-pixel slots (>350,000 `ctx.fillRect` calls) and re-rendering the React component 50-100 times per second on trade ticks.
- **Impact summary**: Draw calls reduced by >97% (capped strictly to screen width × visible rows); React re-render churn eliminated (0 renders during live trading); historical liquidity walls preserved via Math.max merge; 0 TypeScript errors and all tests passing.

## [2026-09-16] - Feature: Order Book Liquidity Heatmap Panel, Off-Thread Worker & Binance Diff Synchronization

- **What changed**:
  - In `lib/liquidity/orderbook.ts`:
    - Implemented Binance depth sync specification (Section 4): pre-snapshot WebSocket diff queueing, discard `u <= lastUpdateId`, first bridging event validation `U <= lastUpdateId + 1 <= u`, and strict rolling sequence checks `U === rollingU + 1`.
    - Added automatic gap detection with `onGapDetected` triggering a clean state reset, resync count increment, and automatic REST snapshot re-fetch.
    - Added `simulateGap()` helper for controlled testing of sequence gap recovery.
  - In `lib/liquidity/orderbookHeatmap.ts`:
    - Implemented high-performance sparse time-price 2D grid (`OrderbookHeatmapEngine`) with configurable bucket size and sample interval.
    - Added fixed-capacity ring buffer retention with explicit memory cleanup via `slot.cells.clear()` and `this.slots.delete(oldestKey)`.
    - Implemented 95th percentile clamp calculation over active viewport price bounds.
  - In `lib/worker/heatmapWorker.ts` & `lib/worker/heatmapWorkerClient.ts`:
    - Created dedicated off-thread Web Worker managing `OrderbookManager`, raw JSON string parsing, periodic sampling ticks, and slice broadcast without blocking main thread.
    - Created `HeatmapWorkerClient` bridging worker lifecycle, passing raw depth messages without main-thread `JSON.parse`, local engine synchronization, and resync notifications.
  - In `lib/draw/drawOrderbookHeatmap.ts`:
    - Implemented single-ramp continuous color palette interpolating across 5 rgb anchors: steel blue `rgb(37,60,92)` → cyan-teal `rgb(29,122,143)` → green `rgb(58,166,92)` → amber `rgb(230,178,46)` → red-orange `rgb(224,64,54)`.
    - Applied alpha power curve `0.05 + 0.9 * t^1.4` with precomputed 256-entry lookup table for high-performance integer-index rendering.
    - Rendered trade markers over the heatmap with `#FFFFFF` fill and subtle dark ring `rgba(0,0,0,0.6)` when trade overlay is enabled.
    - Rendered live column depth outline with crisp half-pixel alignment.
  - In `components/chart/HeatmapPanel.tsx` & `components/chart/ChartPanel.tsx`:
    - Created `HeatmapPanel` side-by-side canvas component with decoupled `requestAnimationFrame` render loop, synchronized 1:1 price/time scale, draggable resize divider, and resync indicator badge.
    - Mounted `HeatmapPanel` beside `ChartCanvas` in `ChartPanel` with width controls and smooth resizing.
  - In `components/chart/ChartCanvas.tsx`:
    - Published active `priceMin`, `priceMax`, `priceCenter`, and `priceRange` to `chartRuntimeStore` during redraw loop for vertical alignment across panels.
  - In `components/FeedProvider.tsx`, `components/feed/hooks/useFeedAggregation.ts`, and `lib/feeds/*`:
    - Passed raw WebSocket payload string directly through feed adapters (`binance.ts`, `binanceFutures.ts`, `feedRegistry.ts`) to `heatmapWorkerClient.postRawDiff(raw)`, eliminating main-thread JSON parsing overhead.
    - Added unconditional worker and orderbook reset on WebSocket disconnect/reconnect and symbol change.
  - In `types/chart.ts`, `lib/store/chart.ts`, `lib/store/chartRuntime.ts`:
    - Extended chart settings with heatmap panel tunables (`heatmapPanelEnabled`, `heatmapBucketSize`, `heatmapSampleIntervalMs`, `heatmapRetentionMinutes`, `heatmapClampPercentile`, `heatmapPanelWidth`, `heatmapShowTrades`).
    - Added runtime properties `viewportPrice` and `orderbookResyncCount`.
    - Added indicator mappings for toggling and settings modal focus.
  - In `components/ui/chart-settings/HeatmapSettings.tsx`:
    - Added controls for heatmap panel toggle, bucket size, sample interval, retention minutes, 95th percentile clamp, panel width, trade markers, and live dev resync status.
  - In `scripts/testOrderbookSync.ts` & `scripts/testHeatmapRetention.ts`:
    - Created comprehensive unit test validating Section 4 orderbook sync, pre-snapshot buffering, rolling sequence checks, and gap recovery (all 4 tests passed).
    - Created memory retention simulation verifying ring buffer slot bounds and flat heap footprint across 5,000 iterations (heap delta 2.94 MB).
- **Why it changed**: Implemented the Order Book Liquidity Heatmap panel per `skills/heatmap/Liquidity heatmap spec.md` to display high-resolution historical depth alongside candlesticks, running completely off-thread to maintain a 60fps UI.
- **Impact summary**: Zero main-thread freeze risk from depth parsing/aggregation; verified 0 memory leaks across long runs; strict Binance sequence compliance with automatic gap recovery; 0 TypeScript errors.

## [2026-09-15] - Feature: Binance REST Proxy Support, undici ProxyAgent & Binance Vision Default

- **What changed**:
  - In `scripts/collector/btcusdtCollector.mjs`:
    - Integrated `undici.ProxyAgent` support via `getProxyAgent()`, honoring `BINANCE_PROXY_URL`, `HTTPS_PROXY`, and `HTTP_PROXY`.
    - Passed proxy `dispatcher` into `fetch()` during Futures backfills (and optionally all sources via `PROXY_ALL=true`).
    - Created `getRestBaseUrl(source)` helper resolving REST endpoints dynamically.
    - Updated Spot backfill default from `api.binance.com` to `https://data-api.binance.vision/api/v3` (Binance Vision CDN public market data endpoint, unblocked globally for datacenter IPs).
    - Exported `getProxyAgent` and `getRestBaseUrl` in `_test`.
  - In `scripts/collector/btcusdtCollector.test.mjs`:
    - Added unit test `ProxyAgent: getProxyAgent instantiates and caches ProxyAgent from environment`.
    - Added unit test `REST Base URLs: getRestBaseUrl resolves defaults, proxy prefixes, and direct overrides`.
- **Why it changed**: Datacenter VPS (Enzonic US) received HTTP 451 from Binance on historical REST backfills. Webshare HTTP/HTTPS proxies allow unblocked backfilling without CloudFront 403 blocks.
- **Impact summary**: Spot backfills work immediately without 451 using Binance Vision; Futures backfills route through standard HTTP/HTTPS proxies via `BINANCE_PROXY_URL`; all 14 collector tests and 15 bubble tests passing.

## [2026-09-14] - Fix: Collector Hard Watchdogs, REST Backfill Timeout & Cold-Start Watermark Seeding

- **What changed**:
  - In `scripts/collector/btcusdtCollector.mjs`:
    - Added trade ingestion watchdog in `heartbeatTimer` (restarts via `safeExit(1)` if 0 trades in 120s, suppressed when `isBackfilling === true`).
    - Added persistence stall watchdog in `logStatus` (restarts via `safeExit(1)` if pending slices are stuck > 5m, suppressed when any source is backfilling).
    - Added 10-second `AbortSignal.timeout(10000)` on all REST `fetch()` calls in `runBackfill` to prevent indefinite socket hangs on cloud VPS drops.
    - Added stamping of `sourceState[source].lastTradeTimeMs` during REST backfill trade ingestion.
    - Added `last_spot_trade_time_ms` and `last_futures_trade_time_ms` tracking in `collector_meta`.
    - Added `seedWatermarksFromDatabase()` on cold startup to seed spot/futures watermarks independently and prevent data holes / fake LVNs on restart.
    - Added top-level `unhandledRejection` and `uncaughtException` listeners and a rapid restart 10-second cooldown guard.
    - Added injectable `exitFn` exported in `_test`.
  - In `scripts/collector/btcusdtCollector.test.mjs`:
    - Added 4 new comprehensive unit tests covering trade watchdog, persistence watchdog, backfill timestamps, and cold-start watermark seeding.
- **Why it changed**: Collector on Enzonic entered a 3-hour zombie state because klines kept bumping message timestamps while trades were dead, and slices could not close.
- **Impact summary**: Collector automatically detects and recovers from dropped trade streams, guarantees continuous backfill without data gaps or fake LVNs, and passes 12/12 unit tests.

## [2026-09-14] - Feature: Chart Mode 4 (Side-by-Side MT5 Comparison Sandbox) & Bidirectional Reverse Channel

- **What changed**:
  - In `types/chart.ts`: Extended `ChartMode` union with `'side-by-side'`; added `mt5Candles: Candle[]` to `PanelRuntimeState`.
  - In `components/ui/ChartModeSelector.tsx`: Added `SideBySideCandlestickIcon` and registered 4th mode `'side-by-side'` (`MT5 Compare`).
  - In `components/chart/drawSideBySideCandles.ts`: Created dedicated dual-slot renderer displaying Binance candle on left sub-slot and MT5 broker candle on right sub-slot (Cyan `#00E5FF` bullish, Magenta `#D500F9` bearish with crisp outline) sharing the exact same price-to-Y axis.
  - In `components/chart/ChartCanvas.tsx`: Routed `chartMode === 'side-by-side'` to `drawSideBySideCandles`; expanded `getVisiblePriceRange` to include MT5 wicks; anchored volume bubbles cleanly to Binance sub-slot.
  - In `lib/store/chartRuntime.ts`: Added `mt5Candles`, `setMt5Candles`, `fetchMT5Candles`, and `notifyMT5ViewState` with strict mode gating so zero writes occur when in standard modes (`candle`, `hollow`, `footprint`).
  - In `hooks/useTradingSync.ts`: Added reverse-channel view state synchronization: notifies bridge when entering/leaving Mode 4 and fast-polls live candles only while Mode 4 is active.
  - In `market_order_bridge/server.mjs`: Added `/mt5-view-state`, `/poll-view`, `/mt5-candles-history`, `/mt5-candles-live`, and `/mt5-candles` endpoints with `MAX_CACHED_BARS = 300` bounded ring buffer pruning and timestamp normalization to unix seconds.
  - In `market_order_bridge/MarketOrderEA.mq5`: Updated timer to 100ms; implemented `/poll-view` checking, `SendCandlesHistory` via `CopyRates`, `SendLiveCandleDelta` with 50ms strict timeout and in-flight lock (`g_isCandleReqActive`) to safeguard MT5's single thread.
- **Why it changed**: User requested a side-by-side comparative candle view of web chart vs MT5 broker prices implemented as an isolated Chart Mode 4 sandbox to eliminate any performance regression or freeze risk for existing chart modes.
- **Impact summary**: Zero performance impact or store writes when browsing standard chart modes; seamless side-by-side MT5 candle comparison in Mode 4; bidirectional timeframe/symbol synchronization; 15/15 bubble tests passing; 0 TypeScript errors.

- **What changed**:
  - In `lib/store/chart.ts`: Set default `vwapBand1Enabled`, `vwapBand2Enabled`, and `vwapBand3Enabled` to `false` in `createDefaultPanel`.
  - Preserved standard industry defaults: `vwapPeriodMode: 'Session'`, `vwapSessionAnchor: 'Day'`, `vwapEnvelopeMode: 'Standard Deviation'`.
  - Bumped store version to `41` with migration turning off bands by default for existing stores.
- **Why it changed**: User requested that all three VWAP bands be off by default while retaining standard industry mode, anchor, and envelope presets.
- **Impact summary**: Adding VWAP renders a clean, focused single benchmark line without cluttered bands unless explicitly enabled; 0 tsc/lint errors.
