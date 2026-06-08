

# OrderFlow Chart - Project Map

## Project Overview
A personal order-flow charting tool for learning market microstructure. It fetches live market data through REST/WebSocket feeds, stores selected market history, and renders candlestick charts, footprint charts, CVD, liquidity/heatmap tools, and Volume Profiles. The app supports single or split chart panels with independent panel settings.

## Folder Structure

```text
/
├── app/                         # Next.js App Router pages, layout, and history APIs
│   ├── api/history/              # Stored candle, footprint, profile, trade, and status routes
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Main app scaffold: header, sidebar, chart layout, focus mode
│   └── globals.css               # Tailwind globals and CSS variables
│
├── components/                  # UI, chart panels, feed lifecycle, and canvas renderers
│   ├── FeedProvider.tsx          # Panel feed lifecycle and storage/hydration orchestration
│   ├── ChartEngineContext.tsx    # Chart engine/context bridge
│   ├── chart/                    # Canvas chart, CVD, drawing, footprint, profile renderers
│   ├── layout/                   # Header and sidebar
│   └── ui/                       # Toolbar, settings, selectors, and reusable controls
│
├── hooks/                       # Keyboard shortcuts and custom React hooks
├── lib/                         # Market logic, stores, feeds, DB, caches, metrics, utilities
│   ├── actions/                  # Server action bridge for storage
│   ├── aggregation/              # Footprint aggregation and shared footprint cache
│   ├── cache/                    # Shared cache retention/cleanup policy
│   ├── config/                   # Market/timeframe/source validation and constants
│   ├── db/                       # libSQL/Turso and MongoDB storage adapters
│   ├── debug/                    # Dev-only market metrics snapshot registry
│   ├── draw/                     # Pure canvas drawing helpers
│   ├── feeds/                    # Binance spot/futures adapters and shared feed registry
│   ├── liquidity/                # Orderbook, liquidity zones, heatmap support
│   ├── liquidityVacuum/          # Liquidity Vacuum detection
│   ├── store/                    # Zustand state
│   ├── utils/                    # Math, formatting, CVD, sessions, measurement helpers
│   └── volumeProfile/            # Shared/profile engine and cache
│
├── types/                       # Shared TypeScript types
├── artifacts/                   # Audits, reports, and design documents
├── skills/                      # Project map and change log
├── data/                        # Local generated database files
├── scripts/                     # Local verification scripts
├── package.json                 # Scripts and dependencies
└── pnpm-lock.yaml               # Locked dependency graph
```

## Current File Responsibilities

### Root / App

- `package.json` → Project scripts and dependencies, including `@libsql/client`, `mongodb`, `ts-node`, and the MongoDB index maintenance script.
- `pnpm-lock.yaml` → Locked pnpm dependency graph.
- `.gitignore` → Excludes dependencies, build outputs, env files, and local DB files.
- `.env.local` → Local runtime env values for DB drivers, MongoDB/libSQL, and retention settings.
- `next.config.mjs` → Next.js configuration, including instrumentation hook support.
- `instrumentation.ts` → Server startup hook that initializes the selected storage adapter and runs libSQL cleanup only when using libSQL.
- `app/layout.tsx` → Root layout and global app shell wiring.
- `app/page.tsx` → Main app scaffold with Header, Sidebar, chart panel layout, draggable split, focus layout mode, gated internal debug panel mount, and main `#0F0F0F` app surface.
- `app/globals.css` → Tailwind base styles, dark theme surface variables, TradingView-style bullish/bearish CSS variables, popup contrast utilities, panel loading-dot animation, and shared scoped scrollbar styling utilities.

### History APIs

- `app/api/history/candles/route.ts` → Selected-driver candle history API returning source-scoped candles for MongoDB and legacy-safe libSQL candles.
- `app/api/history/footprint/route.ts` → Selected-driver footprint restore API for canonical source-scoped `1m/$5` rows with a 2-hour canonical base-row range cap and clear oversized-range errors.
- `app/api/history/profile/route.ts` → Selected-driver fine Volume Profile restore API for canonical source-scoped `1m` fine rows with guarded per-request range sizing and a 6-hour max restore window.
- `app/api/history/trades/route.ts` → Raw trade history API with cursor/range support where used for fallback/hydration.
- `app/api/history/aggregate-bubbles/route.ts` -> Aggregate Trade bubble candidate restore API using the dedicated bubbles MongoDB connection, spot/futures/both source selection, 6-hour range guard, bounded limits, and storage-threshold response headers.
- `app/api/history/status/route.ts` → History/status API for selected driver metadata, counts, retention, and DB status.

### Layout / UI Components

- `components/layout/Header.tsx` → Top toolbar, layout controls, connection status, auth controls, and main-surface header styling.
- `components/layout/Sidebar.tsx` → Thin icon-rail tools sidebar with active-panel context, main-surface sidebar styling, and elevated chart/tool status tooltips.
- `components/ui/ConnectionStatus.tsx` → Combined live connection indicator using shared semantic status colors.
- `components/ui/PanelToolbar.tsx` → Per-panel header controls for the symbol selector, timeframe, chart mode, Long/Short Position drawing tool selection, panel-targeted settings access, whole-layout focus toggle, and main/elevated dark toolbar styling.
- `components/ui/DrawingFavoritesToolbar.tsx` → Draggable panel-bounded compact/collapsible icon-only elevated floating toolbar with scoped inner-control contrast for Profile, Measure, and favorite line/box drawing tool selection using existing drawing state.
- `components/ui/ChartSettingsDropdown.tsx` → Draggable, resizable, elevated panel-anchored top-layer settings window with scoped inner-control contrast, persisted height, chart aggregation/global tick-size controls without chart contract or Flow Source controls, restored Profiles tab with default/custom Volume Profile controls, no global Indicators tab, focused per-indicator dialog mode for sessions/CVD/bubbles/Volume/heatmap/liquidity map controls, Footprint Cells/Aggregate Trades bubble source, Size By Volume/Orders, and Min Orders controls, Volume input/filter/color/display/average controls without duplicate Market Source controls, radius/scale controls, Volume Profile auto/manual row-size display and linear/sqrt hints, compact signal toggles/settings using the shared bullish accent, single/combined liquidity depth source, real orderbook heatmap visual controls, responsive label visibility/detail/min-quantity controls, and related controls.
- `components/ui/PairSelector.tsx` → Panel-scoped elevated settings-style Binance USDT symbol/contract modal selector with scoped inner-control contrast and Spot/Perpetual Futures choices.
- `components/ui/TimeframeSelector.tsx` → Panel-scoped timeframe switcher with elevated active/hover control styling.
- `components/ui/ChartModeToggle.tsx` → Candle/footprint mode toggle with elevated hover control styling.
- `components/ui/BucketSizeInput.tsx` → Panel-scoped footprint bucket-size input using elevated control styling.
- `components/debug/DebugPanel.tsx` → Gated elevated floating internal debug panel with scoped inner-control contrast, Ctrl+Shift+D toggle, low-cadence polling, tabs for metrics/restore/runtime/bubbles/signals/store summaries, footprint restore range/chunk/failure fields, and trimmed snapshot copy including market debug data such as aggregate bubbles and Volume.

### Feed / Engine Context

- `components/FeedProvider.tsx` → Panel feed lifecycle, live-first streaming, non-persisted runtime store writes for candles/status/signals/bubbles/liquidity results, per-panel need-based footprint trade ingestion/restore gating, bounded visible/current-window footprint restore with 2-hour chunks and range/chunk/failure diagnostics, source-tagged aggregate-trade event buffering for aggregate bubbles or Volume only when enabled/settings require it using the panel Flow Source, read-only aggregate bubble history restore/hydration gated by visibility or Volume aggregate need with live/restored dedupe diagnostics, progressive background history restore/status publishing, snapshot-buffered depth synchronization with gap resync only when liquidity or heatmap features need orderbook data, safe single/combined ready-source orderbook merging, settings-driven fixed-cadence orderbook heatmap sampling/windowing only when heatmap is enabled, engine/cache attachment, opt-in raw-trade restore behind `NEXT_PUBLIC_ENABLE_RAW_TRADE_RESTORE`, fine/profile hydration and gated footprint hydration, default-first chunked fine profile restore with lazy scrolled/custom range backfill only when profiles are enabled/visible, canonical minimum-1.5 fine profile live cache promotion, source-scoped candle/raw-trade storage, default-off browser market persistence behind `NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES`, and restore/write/hidden-work diagnostics.
- `components/ChartEngineContext.tsx` → React context exposing the panel aggregation engine, liquidity history, orderbook heatmap engine, fine Volume Profile source, and redraw revision wiring.

### Chart Rendering

- `components/chart/ChartPanel.tsx` → Panel bridge combining persisted chart settings with non-persisted runtime candles/status/signals/bubbles/liquidity results into chart props, including Bubbles/Volume Flow Source routing, panel-scoped chart info loading state wiring without normal restore-detail badge UI, indicator labels, CVD canvases, main panel background styling, orderbook heatmap engine/settings wiring, fixed floating drawing toolbar ownership, persistent panel toolbar visibility, and compact CVD values.
- `components/chart/IndicatorLabels.tsx` → TradingView-style top-left independent chart info row and labels for source controls, connection dot, loading dots, Bubbles, CVD, Volume, Sessions, VOP, Heatmap, and Liquidity with per-panel persisted collapse state that hides both chart info and indicators, readable text-first layout, elevated hover controls, per-panel eye toggles, per-indicator settings dialogs for indicator labels, and VOP gear routing to the global Profiles tab.
- `components/chart/ChartCanvas.tsx` → Main canvas render orchestration, explicit main canvas background fill, runtime-store crosshair sync via direct selector subscription, bubble source switching, aggregate bubble and Volume prop routing, active market context routing, aggregate bubble and Volume debug publication, auto-sized Volume Profile bucket selection for default and custom profiles, real orderbook heatmap same-snapshot cell/geometry-aware late-label draw order, dev-only force-label fallback, passive/interaction redraw throttling, overlay draw order, hit-testing, local-ref hover/drag state, time-anchored drawing placement and movement including Long/Short Position risk-only preview, finalized default target creation, top-layer drawing pass, position-aware toolbar spacing, and entry/stop/target dragging, selectable elevated drawing toolbar with scoped inner-control contrast plus style/lock/delete controls, custom profile interactions including lock/remove/settings controls, render metrics, and visible footprint/profile/CVD wiring.
- `components/chart/CvdPanel.tsx` → Attached CVD canvas with synced horizontal geometry, main panel background styling, runtime-store crosshair sync via direct selector subscription, vertical scaling, memoized CVD series/divergence, and render metrics.
- `components/chart/useCoordinates.ts` → Coordinate math for price/time/index mapping, visible range, and drawable width.
- `components/chart/usePanZoom.ts` → Shared pan/zoom hook with anchored zoom, drag handling, crosshair interaction, and sibling canvas sync.
- `components/chart/drawCandles.ts` → Candlestick renderer using shared bullish/bearish chart colors for bodies, borders, and wicks.
- `components/chart/drawCvd.ts` → CVD renderer for candle, bar, line, histogram, labels, compact values, divergence markers, main canvas/axis backgrounds, and elevated crosshair value labels.
- `components/chart/drawFootprint.ts` → Footprint renderer with visible-range drawing, normalized scaling, shared bullish/bearish thin-candle colors, and per-redraw footprint resolution support.
- `components/chart/drawBubbles.ts` → Volume bubble overlay renderers for footprint-cell data and live aggregate-trade events with shared buy/sell colors, Flow Source filtering, Volume/Orders sizing, Min Volume/Min Orders filtering, source-count diagnostics, robust percentile scaling, linear/sqrt/log radius scale modes, placement/filter diagnostics, trade-count fallback diagnostics, optional Both-mode futures stroke distinction, and nearest footprint-bucket debug context.
- `components/chart/drawVolumeBars.ts` → Volume bottom histogram renderer using visible candle history for Volume input or existing aggregate-trade buffers for Orders/Agg Trades, shared bullish/bearish color modes, Flow Source filtering via props, min/max filters, value text, average line, unavailable aggregate-data states, and visible/historical/live debug counts.
- `components/chart/drawVolumeProfile.ts` → Default Volume Profile renderer with bar/filled modes, POC, VA, LVN, HVN-style accents, width clamping, per-row volume opacity, continuous adjacent row boundaries, and row readability options.
- `components/chart/drawSelectionRect.ts` → Custom profile selection rectangle/profile renderer with handles, filled/bar profile modes, POC/VA/LVN accents, per-row volume opacity, continuous adjacent row boundaries, and resize/move support.
- `components/chart/drawLines.ts` → Horizontal/vertical line, ray, box, Long/Short Position risk/reward zones using shared bearish/bullish colors, candle-overlap shading, conditional TradingView-style metric labels, elevated handle/delete/price-label surfaces, selected-state, and backward-compatible drawing style renderer.
- `components/chart/drawAxes.ts` → Price/time axis and 1px aligned chart grid renderers using the main chart surface.
- `components/chart/drawPriceLine.ts` → Live price line, badge, countdown, and shared bullish/bearish direction coloring.
- `components/chart/drawCrosshair.ts` → Crosshair and elevated axis-label renderer.
- `components/chart/drawAbsorption.ts` → Absorption signal marker renderer using shared bullish/bearish semantic colors.
- `components/chart/drawExhaustion.ts` → Exhaustion signal marker renderer.
- `components/chart/AbsorptionTooltip.tsx` → Elevated Absorption hover tooltip using shared bullish/bearish semantic colors.
- `components/chart/ExhaustionTooltip.tsx` → Elevated Exhaustion hover tooltip.
- `components/chart/IcebergTooltip.tsx` → Elevated Iceberg hover tooltip using shared bid/ask defense colors.
- `components/chart/MeasurementPanel.tsx` → Elevated Measurement overlay UI with shared bullish/bearish metric colors.

### Drawing Helpers

- `lib/draw/drawDeltaProfile.ts` → Delta profile strip renderer aligned to independent profile row-size/readability settings and shared bullish/bearish delta colors.
- `lib/draw/drawMeasurement.ts` → Measurement tool rectangle and metrics renderer with shared directional colors.
- `lib/draw/drawSessions.ts` → Trading session background renderer.
- `lib/draw/drawLiquidity.ts` → Subtle near-price current orderbook liquidity marker renderer using shared bid/ask colors.
- `lib/draw/drawOrderbookHeatmap.ts` → Real time x price orderbook heatmap cell renderer with clipped visible-column drawing, pixel-grouped sample compression, Bookmap-style side-to-amber/yellow liquidity intensity, final-geometry label candidate merging/density and overlap skipping, dev/debug labels, and draw/label/coverage metrics.
- `lib/draw/drawLiquidityHeatmap.ts` → Legacy right-side liquidity summary strip renderer using shared bid/ask colors.
- `lib/draw/drawIceberg.ts` → Iceberg defense line/label/tint renderer using shared bid/ask defense colors.
- `lib/draw/drawLiquidityVacuum.ts` → Liquidity Vacuum zone renderer.

### State / Hooks

- `lib/store/chart.ts` → Persisted Zustand chart settings, selected market/timeframe/mode, drawing/profile/session/CVD/bubble/Volume/signal/liquidity/heatmap preferences, layout/auth/settings-window state, restore status shape including footprint range/chunk/failure fields, shared CVD default colors, crosshair sync setting, and migration normalization that strips legacy runtime fields and maps legacy semantic colors.
- `lib/store/chartRuntime.ts` → Non-persisted Zustand runtime panel state for candles, trades, connection/loading/restore status, signal result maps, aggregate bubble buffers, profile/measurement selection, liquidity zones, footprint redraw triggers, and shared crosshair sync payload with selector subscriptions.
- `hooks/useKeyboardShortcuts.ts` → Keyboard shortcuts for chart modes, tools, sessions, liquidity, signal toggles, focus mode, and active panel targeting.

### Feeds / Shared Live Data

- `lib/feeds/adapter.ts` → Feed adapter interface for candle history, kline streams, and aggTrade streams.
- `lib/feeds/depthAdapter.ts` → Depth adapter abstraction plus Binance and Bybit spot/futures REST snapshot and depth WebSocket implementations with normalized update, previous-update, and sequence IDs where available.
- `lib/feeds/binance.ts` → Binance spot REST/WebSocket adapter for klines, aggTrades, reconnect handling, and aggregate trade id plus first/last trade id parsing.
- `lib/feeds/binanceFutures.ts` → Binance futures REST/WebSocket adapter for klines, aggTrades, and aggregate trade id plus first/last trade id parsing.
- `lib/feeds/feedRegistry.ts` → Shared ref-counted feed registry for kline, aggTrade, concrete exchange/contract-routed depth streams, in-flight history/snapshot dedupe, and stream metrics.
- `lib/feeds/candleCache.ts` → Shared contract/symbol/timeframe candle cache with capped candles, normalized loaded ranges, subscriber fanout, restore dedupe, cleanup, and metrics.
- `lib/feeds/index.ts` → Feed and Binance/Bybit depth adapter exports.

### Aggregation / Footprint

- `lib/aggregation/engine.ts` → Panel-specific AggregationEngine over shared canonical `1m/$5` footprint base slices, display timeframe/bucket derivation, persisted hydration, and lifecycle ownership.
- `lib/aggregation/footprintCache.ts` → Shared source-scoped footprint cache for canonical `1m/$5` rows, coverage metadata, restore dedupe, live update dedupe, TTL cleanup, and diagnostics.
- `lib/utils/aggregation.ts` → Trade-to-footprint-cell math.
- `types/footprint.ts` → Footprint types and display modes.

### Volume Profile

- `lib/volumeProfile/profileCache.ts` → Shared source/base-bucket Volume Profile cache for canonical `1m` fine rows, live updates, merged loaded-range coverage including empty restores, restore dedupe, trade/key pruning, and cleanup metrics.
- `lib/volumeProfile/profileEngine.ts` → Panel-local Volume Profile source/view over shared fine-row cache, non-finer stored-row aggregation into visual profile buckets, bounded keyed profile build cache, raw-trade fallback, and render/cache stats.
- `lib/utils/volumeProfile.ts` → Volume Profile aggregation, POC/VA math, LVN detection, and profile utility helpers.

### Signals / Analysis

- `lib/absorption/engine.ts` → Absorption signal scoring and map building.
- `lib/exhaustion/engine.ts` → Exhaustion signal scoring and map building.
- `lib/iceberg/engine.ts` → Iceberg detection/scoring engine.
- `lib/liquidityVacuum/engine.ts` → Liquidity Vacuum detection and scoring.
- `types/absorption.ts` → Absorption result/direction/rank types.
- `types/exhaustion.ts` → Exhaustion result/direction/rank types.
- `types/iceberg.ts` → Iceberg level/side/rank types.
- `types/liquidityVacuum.ts` → Liquidity Vacuum zone/anchor/rank/direction types.



### Liquidity / Orderbook

- `lib/liquidity/orderbook.ts` → Local in-memory orderbook manager with REST snapshot plus buffered diff-depth bridging, stale/gap detection, per-source sync debug state, WebSocket reset snapshots, incremental updates, and normalized map replacement for combined depth.
- `lib/liquidity/orderbookHeatmap.ts` → Rolling time x price orderbook heatmap engine with configurable near-price bucketed snapshot columns, per-bucket total/max-level asset quantities, capped lookback windows, and coverage metrics.
- `lib/liquidity/aggregation.ts` → Orderbook aggregation into liquidity zones.
- `lib/liquidity/history.ts` → Capped FIFO history of candle-close liquidity snapshots.
- `lib/liquidity/analysis.ts` → Liquidity behavior classification.
- `lib/liquidity/heatmap.ts` → Legacy liquidity summary row construction near current price.
- `types/liquidity.ts` → Liquidity zone types.

### Database / Storage

- `lib/db/storageAdapter.ts` → Market storage adapter interface, libSQL default selection, and MongoDB routing behind `MARKET_DB_DRIVER=mongodb`.
- `lib/db/database.ts` → Turso/libSQL client, schema setup, candle/footprint/profile/raw trade helpers, retention config, metadata, counts, and legacy query helpers.
- `lib/db/marketStorage.ts` → Best-effort storage orchestration for closed candles, footprints, fine profile rows, raw trades, and metadata.
- `lib/db/aggregateBubbleStorage.ts` -> Dedicated Aggregate Trade bubble MongoDB storage module using `BUBBLES_MONGODB_URI`/`BUBBLES_MONGODB_DB_NAME`, regular collection indexes/TTL including covered restore sort indexes, threshold metadata, batched candidate inserts, and disk-sort-safe restore queries.
- `lib/db/cleanupJob.ts` → Server cleanup timer for retention-based libSQL pruning.
- `lib/db/mongo/client.ts` → Singleton MongoDB client, DB selection, and ping verification.
- `lib/db/mongo/marketStorageMongo.ts` → MongoDB adapter for `market_candles_ts`, `footprint_cells_ts`, and `profile_rows_ts` time-series collections, background query indexes, TTL, duplicate checks, writes, disk-sort-safe restores, counts, and diagnostics.
- `lib/actions/storageActions.ts` → Server Action bridge routing closed candles, base footprint rows, and fine profile rows through the selected adapter while keeping raw trades on the current libSQL path.
- `data/market.db` → Generated local libSQL database file for file-mode development.
- `scripts/testDb.ts` → Local database verification script.
- `scripts/ensureIndexes.ts` -> MongoDB index maintenance script for market time-series collections and aggregate bubble restore/TTL indexes.

### Scripts

- `scripts/collector/btcusdtCollector.mjs` -> Standalone BTCUSDT Binance spot/futures aggTrade collector for canonical MongoDB footprint and fine Volume Profile rows across spot/futures/both source identities plus non-fatal collector-only qualified aggregate bubble candidate persistence to the dedicated bubbles MongoDB database.

### Cache / Metrics / Config

- `lib/cache/marketCachePolicy.ts` → Shared cache retention, cleanup interval, inactive grace, and max-size defaults/env overrides.
- `lib/debug/marketMetrics.ts` → Dev-only metrics registry exposed through `window.__MARKET_DEBUG__` for streams, caches, aggregate bubble render/filter/restore snapshots with market source, active chart source, live/restored source counts, storage thresholds, restore range, duplicate skips, size mode, min-order, rendered-value, and trade-count fallback diagnostics, Volume enabled/input/Flow Source/visible/historical/live/max/average snapshots, orderbook sync state/gaps/resyncs, orderbook heatmap sampling/coverage, restore/storage diagnostics, cleanup, render rates, and redraw source breakdown.
- `lib/debug/debugPanelAdapter.ts` → Internal debug panel snapshot adapter summarizing `window.__MARKET_DEBUG__`, persisted chart settings including Volume status, and runtime store state without copying raw market arrays.
- `lib/config/markets.ts` → Supported Binance USDT symbols/timeframes, validation helpers, source-scoped storage key constants, and canonical fine profile base-bucket sizing.
- `lib/config/chartColors.ts` → Shared TradingView-style bullish/bearish chart colors, RGB values, rgba conversion helper, and legacy semantic color normalization.

### Utilities / Types

- `lib/utils/canvas.ts` → Canvas primitives for footprint bid/ask/delta cells using shared bullish/bearish colors and stable drawing helpers.
- `lib/utils/chartUtils.ts` → Shared chart utility helpers.
- `lib/utils/delta.ts` → CVD series, reset/smoothing, compact CVD values, and lightweight divergence detection.
- `lib/utils/format.ts` → Price, volume, delta, and timeframe formatting.
- `lib/utils/sessions.ts` → Session occurrence logic.
- `lib/utils/measurement.ts` → Measurement tool metrics.
- `types/candle.ts` → Candle/OHLCV types.
- `types/bubble.ts` → Bubble source, aggregate bubble market-source, bubble size mode, and live/restored aggregate trade bubble event types with optional persisted aggregate trade ids and origin metadata.
- `types/trade.ts` → Trade tick shape, including optional aggregate trade id and first/last raw trade ids.
- `types/measurement.ts` → Measurement tool data types.

### Artifacts / Skills

- `artifacts/timeframe_behavior_report.md` → Report on settings behavior across timeframes.
- `artifacts/pi_deployment.md` → Raspberry Pi pm2 deployment and restart notes.
- `artifacts/storage_migration_audit.md` → Audit of current libSQL/Turso schema, write paths, restore paths, MongoDB classification, risks, and migration order.
- `artifacts/mongodb_storage_design.md` → MongoDB time-series storage design for candles, footprint cells, profile rows, retention, indexes, adapters, and migration order.
- `artifacts/volume_profile_system_audit.md` → Audit of Volume Profile architecture, persistence, panel locality, and improvement direction.
- `artifacts/current_system_state.md` → System-state audit for footprint fetching, storage, and client-side data flow.
- `artifacts/rendering_performance_audit.md` → Audit of canvas redraw triggers, throttling, visible-range work, expensive layers, React render risks, and recommended fixes.
- `artifacts/liquidity_heatmap_audit.md` → Audit of the spot-only liquidity/orderbook path, far-level zone selection, right-side heatmap strip, root causes, and rebuild plan.
- `artifacts/volume_profile_rendering_audit.md` -> Audit of custom/default Volume Profile row sizing, normalization, clamping, POC/VA/LVN behavior, visual noise causes, and fix order.
- `artifacts/drawing_anchor_shift_audit.md` -> Audit of drawing/custom profile candle-index anchoring, rolling-window drift root cause, and timestamp-anchor fix direction.
- `artifacts/collector_persistence_audit.md` -> Audit of current website-side footprint and fine Volume Profile persistence flow for future collector migration.
- `artifacts/aggregate_bubble_persistence_audit.md` -> Audit of collector-only aggregate trade bubble persistence, current restore gaps, schema/index recommendations, and phased implementation plan.
- `artifacts/node_collector_design.md` -> Design for a standalone Node.js collector that persists canonical footprint and fine Volume Profile rows to MongoDB.
- `skills/map.md` → Compact source-of-truth file responsibility map. Update existing lines only; do not append chronological task history.
- `skills/log.md` → Chronological change history for feature/fix context and impact summaries.

## Architecture & Tech Stack

- **Framework:** Next.js 14 App Router
- **Styling:** Tailwind CSS with dark theme and custom palette
- **State:** Zustand with persisted panel settings
- **Charting:** Custom HTML5 Canvas per chart/CVD surface
- **Market Data:** Binance spot/futures REST and WebSocket feeds plus selectable Binance, Bybit, or combined depth streams through shared feed registry
- **Storage:** libSQL/Turso fallback plus MongoDB time-series adapter behind `MARKET_DB_DRIVER=mongodb`
- **Caches:** Shared in-memory candle, footprint, and Volume Profile caches with TTL cleanup
- **Observability:** Dev-only `window.__MARKET_DEBUG__` snapshot metrics, including orderbook heatmap sampling stats
- **Layout:** Single/split chart panels with focus layout mode

## Maintenance Rule

`skills/map.md` should describe the current state only. Do not append long historical responsibility updates here. Put chronological task history in `skills/log.md`.
