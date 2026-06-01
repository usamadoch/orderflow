

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

- `package.json` → Project scripts and dependencies, including `@libsql/client` and `mongodb`.
- `pnpm-lock.yaml` → Locked pnpm dependency graph.
- `.gitignore` → Excludes dependencies, build outputs, env files, and local DB files.
- `.env.local` → Local runtime env values for DB drivers, MongoDB/libSQL, and retention settings.
- `next.config.mjs` → Next.js configuration, including instrumentation hook support.
- `instrumentation.ts` → Server startup hook that initializes the selected storage adapter and runs libSQL cleanup only when using libSQL.
- `app/layout.tsx` → Root layout and global app shell wiring.
- `app/page.tsx` → Main app scaffold with Header, Sidebar, chart panel layout, draggable split, and focus layout mode.
- `app/globals.css` → Tailwind base styles and custom color variables.

### History APIs

- `app/api/history/candles/route.ts` → Selected-driver candle history API returning source-scoped candles for MongoDB and legacy-safe libSQL candles.
- `app/api/history/footprint/route.ts` → Selected-driver footprint restore API for canonical source-scoped `1m/$5` rows.
- `app/api/history/profile/route.ts` → Selected-driver fine Volume Profile restore API for canonical source-scoped `1m` fine rows.
- `app/api/history/trades/route.ts` → Raw trade history API with cursor/range support where used for fallback/hydration.
- `app/api/history/status/route.ts` → History/status API for selected driver metadata, counts, retention, and DB status.

### Layout / UI Components

- `components/layout/Header.tsx` → Top toolbar, layout controls, connection/settings access, and outside-click-managed settings dropdown toggle.
- `components/layout/Sidebar.tsx` → Active panel settings, market/session stats, and signal summaries.
- `components/ui/ConnectionStatus.tsx` → Combined live connection indicator.
- `components/ui/PanelToolbar.tsx` → Per-panel controls for pair, timeframe, chart mode, CVD, drawing tools, sessions/liquidity quick toggles, and whole-layout focus toggle.
- `components/ui/ChartSettingsDropdown.tsx` → Draggable, resizable settings window with persisted height, internal scrolling, compact signal toggles/settings, sessions, CVD, single/combined liquidity depth source, real orderbook heatmap visual controls, responsive label visibility/detail/min-quantity controls, and related controls.
- `components/ui/PairSelector.tsx` → Panel-scoped pair switcher.
- `components/ui/TimeframeSelector.tsx` → Panel-scoped timeframe switcher.
- `components/ui/ChartModeToggle.tsx` → Candle/footprint mode toggle.
- `components/ui/BucketSizeInput.tsx` → Panel-scoped footprint bucket-size input.

### Feed / Engine Context

- `components/FeedProvider.tsx` → Panel feed lifecycle, live-first streaming, background history restore, snapshot-buffered depth synchronization with gap resync, safe single/combined ready-source orderbook merging, settings-driven fixed-cadence orderbook heatmap sampling/windowing, engine/cache attachment, raw/fine/profile/footprint hydration, canonical minimum-1.5 fine profile base-bucket storage/restore, source-scoped storage, and restore/write diagnostics.
- `components/ChartEngineContext.tsx` → React context exposing the panel aggregation engine, liquidity history, orderbook heatmap engine, fine Volume Profile source, and redraw revision wiring.

### Chart Rendering

- `components/chart/ChartPanel.tsx` → Panel state bridge from Zustand/context into chart and CVD canvases, including orderbook heatmap engine/settings wiring, persistent panel toolbar visibility, and compact CVD values.
- `components/chart/ChartCanvas.tsx` → Main canvas render orchestration, real orderbook heatmap same-snapshot cell/geometry-aware late-label draw order, dev-only force-label fallback, passive/interaction redraw throttling, overlay draw order, hit-testing, drawing placement, custom profile interactions, render metrics, and visible footprint/profile/CVD wiring.
- `components/chart/CvdPanel.tsx` → Attached CVD canvas with synced horizontal geometry, vertical scaling, memoized CVD series/divergence, and render metrics.
- `components/chart/useCoordinates.ts` → Coordinate math for price/time/index mapping, visible range, and drawable width.
- `components/chart/usePanZoom.ts` → Shared pan/zoom hook with anchored zoom, drag handling, crosshair interaction, and sibling canvas sync.
- `components/chart/drawCandles.ts` → Candlestick renderer.
- `components/chart/drawCvd.ts` → CVD renderer for candle, bar, line, histogram, labels, compact values, and divergence markers.
- `components/chart/drawFootprint.ts` → Footprint renderer with visible-range drawing, normalized scaling, and per-redraw footprint resolution support.
- `components/chart/drawBubbles.ts` → Volume bubble overlay renderer using footprint data and robust percentile scaling.
- `components/chart/drawVolumeProfile.ts` → Default Volume Profile renderer with bar/filled modes, POC, VA, LVN, HVN-style accents, width clamping, and row readability options.
- `components/chart/drawSelectionRect.ts` → Custom profile selection rectangle/profile renderer with handles, filled/bar profile modes, POC/VA/LVN accents, and resize/move support.
- `components/chart/drawLines.ts` → Horizontal/vertical line, ray, box, handle, delete-dot, and price-label renderer.
- `components/chart/drawAxes.ts` → Price/time axis renderers.
- `components/chart/drawPriceLine.ts` → Live price line, badge, countdown, and direction coloring.
- `components/chart/drawCrosshair.ts` → Crosshair and axis-label renderer.
- `components/chart/drawAbsorption.ts` → Absorption signal marker renderer.
- `components/chart/drawExhaustion.ts` → Exhaustion signal marker renderer.
- `components/chart/AbsorptionTooltip.tsx` → Absorption hover tooltip.
- `components/chart/ExhaustionTooltip.tsx` → Exhaustion hover tooltip.
- `components/chart/IcebergTooltip.tsx` → Iceberg hover tooltip.
- `components/chart/MeasurementPanel.tsx` → Measurement overlay UI.

### Drawing Helpers

- `lib/draw/drawDeltaProfile.ts` → Delta profile strip renderer aligned to independent profile row-size/readability settings.
- `lib/draw/drawMeasurement.ts` → Measurement tool rectangle and metrics renderer.
- `lib/draw/drawSessions.ts` → Trading session background renderer.
- `lib/draw/drawLiquidity.ts` → Subtle near-price current orderbook liquidity marker renderer.
- `lib/draw/drawOrderbookHeatmap.ts` → Real time x price orderbook heatmap cell renderer with clipped visible-column drawing, pixel-grouped sample compression, Bookmap-style side-to-amber/yellow liquidity intensity, final-geometry label candidate merging/density and overlap skipping, dev/debug labels, and draw/label/coverage metrics.
- `lib/draw/drawLiquidityHeatmap.ts` → Legacy right-side liquidity summary strip renderer.
- `lib/draw/drawIceberg.ts` → Iceberg defense line/label/tint renderer.
- `lib/draw/drawLiquidityVacuum.ts` → Liquidity Vacuum zone renderer.

### State / Hooks

- `lib/store/chart.ts` → Zustand panel state, persisted settings, candles, drawing tools/overlays, signals, sessions, CVD, profiles, real orderbook heatmap visual/window/responsive-label controls, contract/trade/single-or-combined depth source modes, plus global focus-mode and settings-window UI state.
- `hooks/useKeyboardShortcuts.ts` → Keyboard shortcuts for chart modes, tools, sessions, liquidity, signal toggles, focus mode, and active panel targeting.

### Feeds / Shared Live Data

- `lib/feeds/adapter.ts` → Feed adapter interface for candle history, kline streams, and aggTrade streams.
- `lib/feeds/depthAdapter.ts` → Depth adapter abstraction plus Binance and Bybit spot/futures REST snapshot and depth WebSocket implementations with normalized update, previous-update, and sequence IDs where available.
- `lib/feeds/binance.ts` → Binance spot REST/WebSocket adapter for klines, aggTrades, reconnect handling, and aggregate trade id parsing.
- `lib/feeds/binanceFutures.ts` → Binance futures REST/WebSocket adapter for klines and aggTrades.
- `lib/feeds/feedRegistry.ts` → Shared ref-counted feed registry for kline, aggTrade, concrete exchange/contract-routed depth streams, in-flight history/snapshot dedupe, and stream metrics.
- `lib/feeds/candleCache.ts` → Shared contract/symbol/timeframe candle cache with capped candles, normalized loaded ranges, subscriber fanout, restore dedupe, cleanup, and metrics.
- `lib/feeds/index.ts` → Feed and Binance/Bybit depth adapter exports.

### Aggregation / Footprint

- `lib/aggregation/engine.ts` → Panel-specific AggregationEngine over shared canonical `1m/$5` footprint base slices, display timeframe/bucket derivation, persisted hydration, and lifecycle ownership.
- `lib/aggregation/footprintCache.ts` → Shared source-scoped footprint cache for canonical `1m/$5` rows, coverage metadata, restore dedupe, live update dedupe, TTL cleanup, and diagnostics.
- `lib/utils/aggregation.ts` → Trade-to-footprint-cell math.
- `types/footprint.ts` → Footprint types and display modes.

### Volume Profile

- `lib/volumeProfile/profileCache.ts` → Shared source/base-bucket Volume Profile cache for canonical `1m` fine rows, live updates, coverage, restore dedupe, trade/key pruning, and cleanup metrics.
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
- `lib/db/cleanupJob.ts` → Server cleanup timer for retention-based libSQL pruning.
- `lib/db/mongo/client.ts` → Singleton MongoDB client, DB selection, and ping verification.
- `lib/db/mongo/marketStorageMongo.ts` → MongoDB adapter for `market_candles_ts`, `footprint_cells_ts`, and `profile_rows_ts` time-series collections, indexed profile restore queries with disk-sort fallback, indexes, TTL, duplicate checks, writes, restores, counts, and diagnostics.
- `lib/actions/storageActions.ts` → Server Action bridge routing closed candles, base footprint rows, and fine profile rows through the selected adapter while keeping raw trades on the current libSQL path.
- `data/market.db` → Generated local libSQL database file for file-mode development.
- `scripts/testDb.ts` → Local database verification script.

### Cache / Metrics / Config

- `lib/cache/marketCachePolicy.ts` → Shared cache retention, cleanup interval, inactive grace, and max-size defaults/env overrides.
- `lib/debug/marketMetrics.ts` → Dev-only metrics registry exposed through `window.__MARKET_DEBUG__` for streams, caches, orderbook sync state/gaps/resyncs, orderbook heatmap sampling/coverage, restore/storage diagnostics, cleanup, render rates, and redraw source breakdown.
- `lib/config/markets.ts` → Allowed symbols/timeframes, validation helpers, source-scoped storage key constants, and canonical fine profile base-bucket sizing.

### Utilities / Types

- `lib/utils/canvas.ts` → Canvas primitives for footprint bid/ask/delta cells and stable drawing helpers.
- `lib/utils/chartUtils.ts` → Shared chart utility helpers.
- `lib/utils/delta.ts` → CVD series, reset/smoothing, compact CVD values, and lightweight divergence detection.
- `lib/utils/format.ts` → Price, volume, delta, and timeframe formatting.
- `lib/utils/sessions.ts` → Session occurrence logic.
- `lib/utils/measurement.ts` → Measurement tool metrics.
- `types/candle.ts` → Candle/OHLCV types.
- `types/trade.ts` → Trade tick shape, including optional aggregate trade id.
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
