# OrderFlow Chart - Project Map

## Project Overview

A personal order-flow charting tool for learning market microstructure. It fetches live market data through REST/WebSocket feeds, stores selected market history, and renders candlestick charts, footprint charts, CVD, liquidity/heatmap tools, and Volume Profiles. The app supports single or split chart panels with independent panel settings.

## Folder Structure

```text
/
├── app/                         # Next.js App Router pages, layout, and history APIs
│   ├── api/history/              # Stored candle, footprint, profile, trade, and status routes
│   ├── api/trading/              # Safe trading health and account snapshot routes
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
│   ├── trading/                  # Server-only trading config, signed Binance client, adapter, and health helpers
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

- `package.json` → Project scripts and dependencies (`@libsql/client`, `mongodb`, `ts-node`, etc.).
- `pnpm-lock.yaml` → Locked pnpm dependency graph.
- `.gitignore` → Excludes dependencies, build outputs, environment files, and local DB files.
- `.env.local` → Local runtime environment variables for DB drivers, retention settings, and threshold limits.
- `next.config.mjs` → Next.js configuration, including server instrumentation hook support.
- `instrumentation.ts` → Server startup hook that initializes DB storage adapters and cleanup tasks.
- `app/layout.tsx` → Root layout and global app shell wiring.
- `app/page.tsx` → Main app scaffold (Header, Sidebar, chart panel layout, draggable split, focus layout mode, and debug panel mount).
- `app/globals.css` → Tailwind base styles, theme color variables, contrast utilities, scrollbar styling, and animations.

### History APIs

- `app/api/history/candles/route.ts` → Selected-driver candle history API returning source-scoped candles.
- `app/api/history/footprint/route.ts` → Selected-driver footprint restore API for 1m base footprint rows with range caps.
- `app/api/history/profile/route.ts` → Selected-driver fine Volume Profile restore API for 1m fine rows with range caps.
- `app/api/history/trades/route.ts` → Raw trade history API with range and cursor hydration support.
- `app/api/history/aggregate-bubbles/route.ts` → Aggregate trade bubble restore API querying MongoDB history with range bounds.
- `app/api/history/status/route.ts` → Database status API returning driver metadata, row counts, and retention info.
- `app/api/history/storage/route.ts` → Storage size inspection and manual data deletion API.

### Trading APIs

- `app/api/trading/health/route.ts` → Safe trading health API checking mode, testnet status, credentials, server time, and safety blocks.
- `app/api/trading/account-snapshot/route.ts` → Safe read-only account snapshot API synchronizing balances, open orders, positions, and recent fills.
- `app/api/trading/orders/route.ts` → Safe Binance testnet spot order placement and cancellation API with request validation and risk gates.
- `app/api/trading/risk-status/route.ts` → Safe trading risk status API returning lock state, kill switch, risk limits, and daily counters.
- `app/api/trading/stream-status/route.ts` → Safe Binance user data stream status API reporting connection, listenKey, and sync state.

### Layout / UI Components

- `components/layout/Header.tsx` → Top toolbar with layout controls, connection status indicator, and symbol/settings access.
- `components/layout/Sidebar.tsx` → Thin icon-rail sidebar for active chart tools and status tooltips.
- `components/ui/ConnectionStatus.tsx` → Combined live connection status indicator.
- `components/ui/PanelToolbar.tsx` → Per-panel controls for symbol, timeframe, chart mode, drawing tools, refresh, and settings.
- `components/ui/OrderTicket.tsx` → Draggable floating order ticket modal with quantity presets, risk checks, and validation.
- `components/ui/AccountBalanceWidget.tsx` → Header widget displaying available asset balances from live account snapshots.
- `components/ui/OrdersPanel.tsx` → Bottom pane table displaying open limit orders with real-time status and cancellation controls.
- `components/ui/DrawingFavoritesToolbar.tsx` → Floating toolbar for quick selection of favorite drawing tools (Profile, Measure, Lines, Boxes).
- `components/ui/ChartSettingsDropdown.tsx` → Panel settings modal providing controls for aggregation, indicators, Volume Profiles, CVD, signals, aggregate bubbles, and orderbook heatmap.
- `components/ui/BubblesDocsModal.tsx` → Reference modal explaining Volume Bubbles visualization, sizing, and color indicators.
- `components/ui/PairSelector.tsx` → Symbol selection modal supporting Spot and Perpetual Futures contracts.
- `components/ui/TimeframeSelector.tsx` → Panel timeframe switcher control.
- `components/ui/ChartModeToggle.tsx` → Candle and footprint chart mode selector.
- `components/ui/BucketSizeInput.tsx` → Footprint bucket size selector input.
- `components/ui/StorageManager.tsx` → Modal component for viewing daily storage sizes and executing manual data cleanup.
- `components/debug/DebugPanel.tsx` → Floating dev debug panel (Ctrl+Shift+D) displaying metrics, store summaries, and restore diagnostics.

### Feed / Engine Context

- `components/FeedProvider.tsx` → Panel feed orchestrator managing WebSocket streaming, history hydration (candles, footprint, profile, bubbles), depth synchronization, and store writes.
- `components/ChartEngineContext.tsx` → React context providing panel aggregation engine, footprint/profile caches, orderbook heatmap, and redraw triggers.

### Chart Rendering

- `components/chart/ChartPanel.tsx` → Panel container bridging chart settings, runtime state, symbol filtering, and historical session ranges.
- `components/chart/chartPanelUtils.ts` → Utilities for symbol filtering (orders, positions, fills) and historical session ranges.
- `components/chart/IndicatorLabels.tsx` → Top-left chart header displaying active indicator values and quick toggles.
- `components/chart/ChartCanvas.tsx` → Main canvas rendering coordinator, imperatively updated via Zustand subscription to avoid React re-renders.
- `components/chart/chartCanvasUtils.ts` → Coordinate translation, bucket indexing, order placement math, and segment distance utilities.
- `components/chart/chartCanvasHitTest.ts` → Hit testing logic for interactive canvas elements (limit orders, drawings, position drags, profiles).
- `components/chart/CanvasDrawingToolbar.tsx` → Floating context toolbars for active drawings, custom profile controls, and order modification dialogs.
- `components/chart/CvdPanel.tsx` → Canvas panel rendering Cumulative Volume Delta imperatively synced with main chart viewport via Zustand.
- `components/chart/cvdPanelUtils.ts` → CVD panel scale calculations and viewport mapping.
- `components/chart/drawStatsGrid.ts` → Canvas overlay rendering volume, delta, and CVD summary statistics grid.
- `components/chart/useCoordinates.ts` → Hook calculating price/time coordinate bounds and visible range mappings.
- `components/chart/usePanZoom.ts` → Hook handling chart pan, zoom, crosshair interaction, and multi-canvas synchronization.
- `components/chart/drawCandles.ts` → Candlestick renderer for body, wick, and border geometry using shared chart colors.
- `components/chart/drawCvd.ts` → CVD renderer supporting candle, bar, line, and histogram modes with divergence markers.
- `components/chart/drawFootprint.ts` → Footprint renderer displaying bid/ask volume clusters, delta, or delta-volume profiles per price level.
- `components/chart/drawBubbles.ts` → Volume bubble renderer visualizing trade volume and order clusters with percentile scaling.
- `components/chart/drawVolumeBars.ts` → Bottom histogram renderer for volume and trade counts with moving average overlay.
- `components/chart/drawVolumeProfile.ts` → Main Volume Profile renderer displaying horizontal volume distribution, POC, Value Area, and HVN/LVN levels.
- `components/chart/drawSelectionRect.ts` → Interactive selection rectangle and custom Volume Profile renderer.
- `components/chart/drawLines.ts` → Canvas renderer for horizontal lines, trendlines, rays, boxes, and Risk/Reward position tools.
- `components/chart/drawAxes.ts` → Price and time axis gridline and label renderer.
- `components/chart/drawPriceLine.ts` → Current market price line, badge, and timer renderer.
- `components/chart/drawTradingOverlays.ts` → Canvas overlay renderer for limit orders, SL/TP brackets, virtual positions, and fill markers.
- `components/chart/drawCrosshair.ts` → Crosshair overlay and axis price/time label renderer.
- `components/chart/drawAbsorption.ts` → Marker renderer for absorption signals.
- `components/chart/drawExhaustion.ts` → Marker renderer for exhaustion signals.
- `components/chart/AbsorptionTooltip.tsx` → Hover tooltip displaying absorption signal details.
- `components/chart/ExhaustionTooltip.tsx` → Hover tooltip displaying exhaustion signal details.
- `components/chart/IcebergTooltip.tsx` → Hover tooltip displaying detected iceberg order details.
- `components/chart/MeasurementPanel.tsx` → Hover overlay showing price, percent, time, and volume metrics from measurement tool.

### Drawing Helpers

- `lib/draw/drawDeltaProfile.ts` → Delta profile strip renderer showing net buying/selling per price level.
- `lib/draw/drawMeasurement.ts` → Measurement tool overlay renderer.
- `lib/draw/drawSessions.ts` → Visual background shading renderer for trading sessions (Asia, London, NY).
- `lib/draw/drawLiquidity.ts` → Orderbook liquidity depth visualization overlay near current price.
- `lib/draw/drawOrderbookHeatmap.ts` → Rolling time-and-price orderbook heatmap renderer with intensity color scaling.
- `lib/draw/drawLiquidityHeatmap.ts` → Right-side orderbook liquidity depth summary strip.
- `lib/draw/drawIceberg.ts` → Renderer for detected iceberg order defense levels.
- `lib/draw/drawLiquidityVacuum.ts` → Renderer highlighting low-liquidity vacuum zones.

### State / Hooks

- `lib/store/chart.ts` → Persisted Zustand store for chart preferences, indicator settings, drawings, and UI state.
- `lib/store/chartRuntime.ts` → Ephemeral Zustand store for live candles, depth, trades, signals, trading account data, and active drag state.
- `hooks/useKeyboardShortcuts.ts` → Keyboard shortcut handler for chart tools, modes, and navigation.
- `types/chart.ts` → TypeScript definitions for chart configurations, panels, and indicator options.

### Feeds / Shared Live Data

- `lib/feeds/adapter.ts` → Abstract interface for market feed adapters.
- `lib/feeds/depthAdapter.ts` → Orderbook depth stream adapter supporting Binance and Bybit REST/WebSocket feeds.
- `lib/feeds/binance.ts` → Binance Spot WebSocket/REST market data adapter.
- `lib/feeds/binanceFutures.ts` → Binance Futures WebSocket/REST market data adapter.
- `lib/feeds/feedRegistry.ts` → Central ref-counted manager for shared market feeds and stream deduplication.
- `lib/feeds/candleCache.ts` → Shared in-memory candle cache with subscriber fanout and range tracking.
- `lib/feeds/index.ts` → Module exports for market feed adapters.
- `types/feed.ts` → Types for feed interfaces, trade events, and subscription options.

### Trading Foundation

- `lib/trading/config.ts` → Server-side configuration facade for Binance testnet/live environment.
- `lib/trading/tradingConfigParser.ts` → Credential resolution, endpoint constants, and safe status builders.
- `lib/trading/binanceRestClient.ts` → Signed REST API client for Binance account and order operations.
- `lib/trading/binanceAdapter.ts` → Spot broker adapter implementing order placement, cancellation, balance sync, and position tracking.
- `lib/trading/binanceFuturesAdapter.ts` → Futures broker adapter implementing order placement, leverage setting, cancellation, and position tracking.
- `lib/trading/tradingMappers.ts` → Order, balance, position, and trade fill payload normalization and rejected result builders.
- `lib/trading/health.ts` → Server health check helper for exchange API connectivity and time offset sync.
- `lib/trading/risk.ts` → Risk management engine enforcing position limits, daily order caps, and kill-switch locks.
- `lib/trading/riskState.ts` → Risk configuration parsing and daily counter state tracking.
- `lib/trading/userDataStreamManager.ts` → Server singleton orchestrating Binance user data WebSocket stream and account reconciliation.
- `lib/trading/userStreamClient.ts` → WS client endpoints, listenKey management, and Binance execution report event mappers.

### Aggregation / Footprint

- `lib/aggregation/engine.ts` → Engine deriving footprint buckets and custom timeframes from base trade data.
- `lib/aggregation/footprintCache.ts` → Shared in-memory cache for canonical 1m footprint base slices.
- `lib/utils/aggregation.ts` → Math utilities aggregating trade ticks into footprint price levels.
- `lib/worker/aggregationWorker.ts` → Web Worker script for processing high-frequency trades into base footprints off the main thread.
- `lib/worker/aggregationWorkerClient.ts` → Client singleton coordinating communication with the aggregation worker.
- `types/footprint.ts` → Footprint cluster and aggregation types.

### Volume Profile

- `lib/volumeProfile/profileCache.ts` → In-memory cache for 1m fine Volume Profile rows.
- `lib/volumeProfile/profileEngine.ts` → Profile engine building viewable Volume Profiles over cached fine rows.
- `lib/utils/volumeProfile.ts` → Volume Profile math for POC, Value Area (VA), High/Low Volume Nodes (HVN/LVN).
- `types/volumeProfile.ts` → Types for volume distributions, nodes, and profile settings.

### Signals / Analysis

- `lib/absorption/engine.ts` → Signal engine orchestrating order flow absorption candidate detection.
- `lib/absorption/absorptionScorer.ts` → Pure scoring algorithms for single-candle absorption (delta extremity, volume extremity, progression, imbalance).
- `lib/exhaustion/engine.ts` → Signal engine orchestrating order flow exhaustion signal detection.
- `lib/exhaustion/exhaustionScorer.ts` → Pure scoring rules for single-candle exhaustion (momentum decay, weak continuation, wick rejection, range shrink).
- `lib/iceberg/engine.ts` → Signal engine orchestrating hidden iceberg order detection.
- `lib/iceberg/icebergScorer.ts` → Level analysis, threshold scoring, and standard deviation math for iceberg orders.
- `lib/liquidityVacuum/engine.ts` → Signal engine orchestrating liquidity vacuum zone detection.
- `lib/liquidityVacuum/vacuumDetector.ts` → Segment statistics, baseline calculation, and fast movement scoring for liquidity vacuum zones.
- `types/absorption.ts` → Types for absorption signal structures.
- `types/exhaustion.ts` → Types for exhaustion signal structures.
- `types/iceberg.ts` → Types for iceberg order structures.
- `types/liquidityVacuum.ts` → Types for liquidity vacuum structures.

### Liquidity / Orderbook

- `lib/liquidity/orderbook.ts` → In-memory orderbook maintainer synchronizing REST snapshots with WebSocket diff updates.
- `lib/liquidity/orderbookHeatmap.ts` → Time-series orderbook engine capturing historical depth snapshots for heatmap rendering.
- `lib/liquidity/aggregation.ts` → Utilities aggregating orderbook levels into liquidity clusters.
- `lib/liquidity/history.ts` → Capped buffer storing historical orderbook snapshots.
- `lib/liquidity/analysis.ts` → Classification logic for liquidity behavior and imbalance.
- `lib/liquidity/heatmap.ts` → Utility building orderbook depth rows near current market price.
- `types/liquidity.ts` → Types for orderbook levels, depth snapshots, and liquidity zones.

### Database / Storage

- `lib/db/storageAdapter.ts` → Unified storage facade supporting libSQL and MongoDB drivers.
- `lib/db/database.ts` → libSQL database facade delegating connection setup, migrations, and table queries to domain repositories.
- `lib/db/repositories/dbSetup.ts` → Database connection setup, table schema migrations, write retry helpers, and database size metadata.
- `lib/db/repositories/candleRepository.ts` → Candle table queries, time range selects, and candle snapshot persistence.
- `lib/db/repositories/tradeRepository.ts` → Raw trade batch insertion and cursor query execution.
- `lib/db/repositories/footprintRepository.ts` → Footprint cell queries, overloaded range queries, and snapshot persistence.
- `lib/db/repositories/profileRepository.ts` → Fine Volume Profile row persistence and range queries.
- `lib/db/repositories/libsqlStorageAdapter.ts` → libSQL implementation of the unified MarketStorageAdapter interface.
- `lib/db/marketStorage.ts` → High-level persistence router for candles, footprint, profile, and trade records.
- `lib/db/aggregateBubbleStorage.ts` → MongoDB storage facade for aggregate trade bubble history.
- `lib/db/cleanupJob.ts` → Background maintenance task purging expired records based on retention policies.
- `lib/db/mongo/client.ts` → MongoDB client connection singleton.
- `lib/db/mongo/marketStorageMongo.ts` → MongoDB storage facade delegating queries to domain repositories.
- `lib/db/mongo/repositories/mongoCandleRepository.ts` → MongoDB candle collection setup, candle batch insertion, and range queries.
- `lib/db/mongo/repositories/mongoFootprintRepository.ts` → MongoDB footprint collection setup, cell batch insertion, and range queries.
- `lib/db/mongo/repositories/mongoProfileRepository.ts` → MongoDB profile row collection setup, fine row batch insertion, and range queries.
- `lib/db/mongo/repositories/mongoBubbleRepository.ts` → Dedicated MongoDB collection repository storing aggregate trade bubble history.
- `lib/actions/storageActions.ts` → Server Actions bridging frontend persistence requests to DB storage adapters.
- `data/market.db` → Local SQLite/libSQL database file for offline/dev storage.
- `scripts/testDb.ts` → Verification script testing database connection and operations.
- `scripts/ensureIndexes.ts` → Script maintaining MongoDB collection indexes and TTL policies.
- `types/storage.ts` → Definitions for storage adapters, schemas, and query parameters.

### Scripts

- `scripts/collector/btcusdtCollector.mjs` → Standalone Node.js collector fetching and storing BTCUSDT market data to MongoDB.
- `scripts/collector/runBackfill.mjs` → Data backfill script fetching historical market feeds to populate storage.

### Cache / Metrics / Config

- `lib/cache/marketCachePolicy.ts` → Retention and cleanup policies for in-memory market caches.
- `lib/debug/marketMetrics.ts` → Developer metrics registry tracking stream health, cache usage, and render performance.
- `lib/debug/debugPanelAdapter.ts` → Adapter formatting market metrics for the UI debug panel.
- `lib/config/markets.ts` → Supported market pairs, timeframe definitions, and symbol validation logic.
- `lib/config/chartColors.ts` → Shared color palette definitions and color utility functions.
- `lib/config/constants.ts` → Core application constants and system defaults.
- `types/debug.ts` → TypeScript definitions for metrics, logs, and debug snapshots.

### Utilities / Types

- `lib/services/storageService.ts` → Storage usage summary aggregation and date-range deletion service.
- `lib/validators/orderValidation.ts` → Order request payload reading, parameter normalization, validation, and error response builder.
- `lib/validators/historyValidation.ts` → History API time parameter normalization, contract type resolution, and query parameter validation.
- `lib/utils/tradingApiUtils.ts` → Shared symbol/limit normalizers and error snapshot/status builders for trading APIs.
- `lib/utils/canvas.ts` → Low-level HTML5 Canvas drawing primitives.
- `lib/utils/chartUtils.ts` → General charting calculations and data helper functions.
- `lib/utils/delta.ts` → Delta calculation and CVD series formatting utilities.
- `lib/utils/format.ts` → Formatter functions for currency, numbers, volume, and timestamps.
- `lib/utils/sessions.ts` → Trading session timezone and market hours calculations.
- `lib/utils/historicalSessions.ts` → Local timezone mapping for historical session profile ranges.
- `lib/utils/measurement.ts` → Calculations for measurement tool distance, price change, and duration.
- `types/candle.ts` → OHLCV candlestick data types.
- `types/bubble.ts` → Volume bubble event and configuration types.
- `types/trade.ts` → Trade tick and market trade types.
- `types/measurement.ts` → Measurement tool selection and measurement data types.
- `types/trading.ts` → Types for order management, positions, account balances, and bracket orders.
- `types/cvd.ts` → Cumulative Volume Delta types and marker configurations.

### Artifacts / Skills

- `artifacts/timeframe_behavior_report.md` → Analysis report on settings behavior across timeframes.
- `artifacts/pi_deployment.md` → Deployment and PM2 configuration guide for Raspberry Pi.
- `artifacts/storage_migration_audit.md` → Audit of storage migration from libSQL to MongoDB.
- `artifacts/mongodb_storage_design.md` → Architecture document for MongoDB time-series storage.
- `artifacts/volume_profile_system_audit.md` → Technical audit of Volume Profile calculation and storage architecture.
- `artifacts/current_system_state.md` → System audit of footprint data pipeline and state flow.
- `artifacts/rendering_performance_audit.md` → Performance audit of canvas rendering and optimization recommendations.
- `artifacts/liquidity_heatmap_audit.md` → Audit of orderbook depth and heatmap rendering pipeline.
- `artifacts/volume_profile_rendering_audit.md` → Audit of Volume Profile visual rendering and row sizing.
- `artifacts/drawing_anchor_shift_audit.md` → Technical audit of drawing coordinate anchoring and time drift fixes.
- `artifacts/collector_persistence_audit.md` → Audit of background collector storage pipeline.
- `artifacts/aggregate_bubble_persistence_audit.md` → Audit of aggregate bubble candidate storage and query performance.
- `artifacts/node_collector_design.md` → Design specification for standalone Node.js market data collector.
- `artifacts/collector_backfill_analysis.md` → Strategy and design for historical market data backfill.
- `artifacts/large_profile_bug_diagnosis.md` → Root cause diagnosis for custom profile cache eviction behavior.
- `skills/map.md` → Source-of-truth file responsibility map.
- `skills/log.md` → Chronological log of codebase changes, features, and fixes.

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
