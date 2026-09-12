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
│   ├── db/                       # libSQL/Turso and TimescaleDB storage adapters
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
├── skills/                      # Project map, change log, and large-file section maps
│   └── maps/                    # Fast context and navigation maps for 800+ line files
├── data/                        # Local generated database files
├── scripts/                     # Local verification scripts
├── package.json                 # Scripts and dependencies
└── pnpm-lock.yaml               # Locked dependency graph
```

## Current File Responsibilities

### Root / App

- `package.json` → Project scripts and dependencies (`@libsql/client`, `pg`, `ts-node`, etc.).
- `pnpm-lock.yaml` → Locked pnpm dependency graph.
- `.gitignore` → Excludes dependencies, build outputs, environment files, and local DB files.
- `.env.local` → Local runtime environment variables for DB drivers, retention settings, and threshold limits.
- `next.config.mjs` → Next.js configuration, including server instrumentation hook support.
- `instrumentation.ts` → Server startup hook that initializes DB storage adapters and cleanup tasks.
- `tailwind.config.ts` → Tailwind configuration mapping theme tokens and MacFont / BlinkMacSystemFont typography.
- `app/layout.tsx` → Root layout wiring MacFont (`BlinkMacSystemFont`) local fonts, stylesheet, and global app shell.
- `app/page.tsx` → Main app scaffold (Header, Sidebar, chart panel layout without vertical main padding, draggable split, focus layout mode, and debug panel mount).
- `app/globals.css` → Tailwind base styles, theme color variables, MacFont typography, contrast utilities, scrollbar styling, and animations.

### History APIs

- `app/api/history/candles/route.ts` → Selected-driver candle history API returning source-scoped candles.
- `app/api/history/footprint/route.ts` → Selected-driver footprint restore API with range caps and safe 503 fallback.
- `app/api/history/profile/route.ts` → Selected-driver fine Volume Profile restore API with range caps and safe 503 fallback.
- `app/api/history/trades/route.ts` → Raw trade history API with range and cursor hydration support.
- `app/api/history/aggregate-bubbles/route.ts` → Aggregate trade bubble restore API querying TimescaleDB history with range bounds.
- `app/api/history/status/route.ts` → Database status API returning driver metadata, row counts, and retention info.
- `app/api/history/storage/route.ts` → Storage size inspection and manual data deletion API for TimescaleDB.

### Trading APIs

- `app/api/trading/health/route.ts` → Safe trading health API checking mode, testnet status, credentials, server time, and safety blocks.
- `app/api/trading/account-snapshot/route.ts` → Safe read-only account snapshot API synchronizing balances, open orders, positions, and recent fills.
- `app/api/trading/orders/route.ts` → Safe Binance testnet spot order placement and cancellation API with request validation and risk gates.
- `app/api/trading/risk-status/route.ts` → Safe trading risk status API returning lock state, kill switch, risk limits, and daily counters.
- `app/api/trading/stream-status/route.ts` → Safe Binance user data stream status API reporting connection, listenKey, and sync state.

### Layout / UI Components

- `components/layout/Header.tsx` → Top toolbar styled with dark #0F0F0F background and border tokens, housing connection status indicator, auth-gated storage access, and symbol/settings controls with FigTooltip triggers.
- `components/layout/Sidebar.tsx` → Thin icon-rail sidebar (kept intact in codebase, hidden from view per UI requirements).
- `components/ui/ChartLayoutDropdown.tsx` → Layout selector dropdown using FigPopup with mode="dropdown", stable bottom-right positioning without jumping, p-3.5 padding, rounded-xl corners, 1.5x larger layout buttons (h-10 w-12), FigUI3 trigger tooltip, and "Sync In Layout" toggles for independent Crosshair and Drawings synchronization.
- `components/ui/ConnectionStatus.tsx` → Combined live connection status indicator with FigTooltip for connection state and manual connect trigger.
- `components/ui/PanelToolbar.tsx` → Per-panel controls for symbol, timeframe, chart mode, position & BUY/SELL trade tools, chart layout selector, refresh, and settings using FigButton and FigTooltip triggers.
- `components/ui/OrderTicket.tsx` → Draggable floating order ticket modal with quantity presets, risk checks, and validation.
- `components/ui/AccountBalanceWidget.tsx` → Header widget displaying available asset balances from live account snapshots.
- `components/ui/OrdersPanel.tsx` → Bottom pane table displaying open limit orders with real-time status and cancellation controls.
- `components/ui/DrawingFavoritesToolbar.tsx` → Draggable floating toolbar with z-[70] stacking above header, 32x32px padded button clickable targets, full-area hover, strokeWidth 1.5 icons, and unblocked window drag listeners.
- `components/ui/ChartSettingsDropdown.tsx` → The settings window with solid opaque styling, indicator dialog mode, draggable floating settings window with custom vertical resize, FigButton sidebar navigation, and unblocked window drag listeners.
- `components/ui/chart-settings/GeneralChartSettings.tsx` → General aggregation, global timezone/format, and interaction settings using FigUI3 and PropsKit controls.
- `components/ui/chart-settings/CanvasSettings.tsx` → Canvas appearance settings (background, gridlines, crosshair, candle colors) using FigUI3 controls and child ColorPickerPopover.
- `components/ui/chart-settings/AlertsSettings.tsx` → Placeholder settings panel for upcoming alert management.
- `components/ui/chart-settings/FootprintSettings.tsx` → Footprint chart display mode settings using FigSegmentedControl.
- `components/ui/chart-settings/VolumeProfileSettings.tsx` → Volume Profile indicator configurations (periods, type, scaling, cosmetics) using FigUI3 and PropsKit controls.
- `components/ui/chart-settings/HistoricalSessionProfileSettings.tsx` → Historical session volume profile selection, sessions, and display modes using FigUI3 controls.
- `components/ui/chart-settings/SessionsSettings.tsx` → Trading sessions toggles, hours, and colors using FigSwitch, TimeInput, and child ColorPickerPopover.
- `components/ui/chart-settings/CvdSettings.tsx` → Cumulative Volume Delta indicator settings (mode, reset, scale, sliders, divergence) using FigUI3 and PropsKit controls.
- `components/ui/chart-settings/VolumeBarsSettings.tsx` → Volume Bars indicator settings (input data, filters, colors, opacity, MA) using FigUI3 and PropsKit controls.
- `components/ui/chart-settings/BubbleSettings.tsx` → Volume Bubbles indicator settings (size, modes, thresholds, sliders, 2D/3D, FigButton docs link) using FigUI3 and PropsKit controls.
- `components/ui/chart-settings/LiquidityMapSettings.tsx` → Liquidity map indicator settings (opacity, bucket size, min size, range) using PropskitSlider and PropskitNumber.
- `components/ui/chart-settings/HeatmapSettings.tsx` → Historical orderbook heatmap indicator settings (opacity, fade, strip width, depth, toggles) using FigUI3 and PropsKit controls.
- `components/ui/chart-settings/StatsSettings.tsx` → Stats indicator toggles and display ordering using FigSwitch controls.
- `components/ui/chart-settings/SignalSettings.tsx` → Microstructure signal detection settings (absorption, exhaustion, iceberg, liquidity vacuum) using FigButton toggles and PropsKit controls.
- `components/ui/chart-settings/VwapSettings.tsx` → VWAP indicator configuration (mode, anchor, lookback, envelopes, bands) using FigUI3 and PropsKit components.
- `components/ui/fig/` → Reusable React wrappers for FigUI3 and PropsKit web components (`FigSwitch`, `FigButton`, `FigSegmentedControl`, `FigSelect`, `PropskitSlider`, `PropskitNumber`, `FigPopup`, `FigDialog`, `FigTooltip`).
- `components/ui/IndicatorsModal.tsx` → Indicator picker popup using FigPopup with mode="dropdown", generous p-2.5 padding, rounded-xl corners, +50% taller rows (min-h-[38px]), left-aligned text, and persistent active button styling matching FigUI3 tokens.
- `components/ui/ColorPickerPopover.tsx` → Shared TradingView-style color picker popover (80-swatch matrix, custom color '+' button, 3/6/8-digit hex parser, native eyedropper, and opacity slider) used by drawing tools and indicator settings.
- `components/ui/TimeInput.tsx` → Reusable time input control supporting 12-hour (with FigButton AM/PM toggle) and 24-hour modes matching global settings.
- `components/ui/BubblesDocsModal.tsx` → Reference modal explaining Volume Bubbles visualization, sizing, and color indicators.
- `components/ui/PairSelector.tsx` → Anchored dropdown selector using FigPopup with dropdown prop opening directly underneath trigger button with FigTooltip.
- `components/ui/TimeframeSelector.tsx` → Panel timeframe switcher control.
- `components/ui/ChartModeSelector.tsx` → Chart mode dropdown selector using FigPopup with mode="dropdown", generous p-2.5 padding, rounded-xl corners, +50% taller rows (min-h-[38px]), left-aligned text, custom TradingView-style SVGs on the left, persistent active item styling, and FigTooltip trigger.
- `components/ui/ChartModeToggle.tsx` → (Legacy) Candle and footprint chart mode selector using FigButton.
- `components/ui/BucketSizeInput.tsx` → Footprint bucket size selector input.
- `components/ui/StorageManager.tsx` → Modal component (rendered via Portal) for viewing TimescaleDB storage usage and executing manual data cleanup with FigButton destructive action.
- `components/ui/fig/useFigElement.ts` → Reusable React hook managing dynamic FigUI3 library import, Light/Shadow DOM property sync, attribute reflection, and native custom event binding.
- `components/ui/fig/FigButton.tsx` → Reusable React wrapper for `<fig-button>` supporting id prop on custom element, variants, sizes, icon-only mode, selected states, and guaranteed cursor: pointer inheritance into shadow DOM.
- `components/ui/fig/FigSwitch.tsx` → Reusable React wrapper for `<fig-switch>` supporting controlled/uncontrolled checked states and native change dispatch.
- `components/ui/fig/FigSegmentedControl.tsx` → Reusable React wrapper for `<fig-segmented-control>` and `<fig-segment>` supporting radio-group selection, animated active indicators, delegated click handling, direct onChange propagation, and cursor: pointer styling.
- `components/ui/fig/FigSelect.tsx` → Reusable React wrapper for `<fig-select>` custom dropdown selector supporting option lists, groups, and change event forwarding.
- `components/ui/fig/PropskitSlider.tsx` → Reusable React wrapper for `<propskit-slider>` labeled numeric range slider with elastic scrub and text field support.
- `components/ui/fig/PropskitNumber.tsx` → Reusable React wrapper for `<propskit-number>` labeled exact numeric input with precision, unit, and empty label suppression.
- `components/ui/fig/FigPopup.tsx` → Reusable React wrapper for `<dialog is="fig-popup">` supporting explicit presentation modes (`mode="dropdown"` with synchronous pre-paint positioning supporting left, right, and center horizontal alignment without glitching vs `mode="modal"`), fixed positioning, and click-outside.
- `components/ui/fig/FigDialog.tsx` → Reusable React wrapper for `<dialog is="fig-dialog">` supporting modal dialogs and draggable floating windows.
- `components/ui/fig/FigTooltip.tsx` → Reusable React wrapper for `<fig-tooltip>` custom element supporting contextual hover/click tooltips with explicit position/offset forwarding and no-overlay styling.
- `components/ui/fig/index.ts` → FigUI3 component barrel export.
- `components/debug/DebugPanel.tsx` → Floating dev debug panel (Ctrl+Shift+D) displaying metrics, store summaries, and restore diagnostics with FigButton tab navigation.
- `components/chart/IndicatorLabels.tsx` → Top-left chart header displaying active indicator values, data source switcher, reordering controls, and quick toggles using FigButton and FigTooltip wrappers.

### Feed / Engine Context

- `components/FeedProvider.tsx` → Panel feed orchestrator and WebSocket lifecycle ([Section Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/FeedProvider.map.md)).
- `components/ChartEngineContext.tsx` → React context providing panel aggregation engine, footprint/profile caches, orderbook heatmap, and redraw triggers.

### Chart Rendering

- `components/chart/ChartPanel.tsx` → Panel container bridging chart settings, runtime state, symbol filtering, historical session ranges, and global 28% opacity CVD border styling with FigButton CVD expand/collapse triggers.
- `components/chart/chartPanelUtils.ts` → Utilities for symbol filtering (orders, positions, fills) and historical session ranges.
- `components/chart/chartBottomPanels.ts` → Layout engine calculating non-overlapping vertical slots for docked bottom indicators, treating volume bars as an on-canvas overlay.
- `components/chart/IndicatorLabels.tsx` → Top-left chart header displaying active indicator values, data source switcher, reordering controls, and quick toggles using FigButton.
- `components/chart/LiquidityControls.tsx` → Overlay for adjusting liquidity heatmap intensity and threshold.
- `components/chart/ChartCanvas.tsx` → Main canvas coordinator and multi-layer rendering pipeline ([Section Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/ChartCanvas.map.md)).
- `components/chart/chartCanvasUtils.ts` → Continuous fractional index interpolation (resolveIndexFromTime) from timestamps for multi-timeframe drawing sync, coordinate translation, bucket indexing, order placement math, and segment distance utilities.
- `components/chart/chartCanvasHitTest.ts` → Hit testing logic for interactive canvas elements (limit orders, drawings, position drags, profiles).
- `components/chart/CanvasDrawingToolbar.tsx` → Floating context toolbars for active drawings (1px white defaults, FigUI tooltips, Trash2 delete, box border/fill, and position tool profit & stop loss color pickers) and custom profile controls with pointer/mouse event isolation.
- `components/chart/CvdPanel.tsx` → Canvas panel rendering Cumulative Volume Delta with price/time axis resize cursors (ns-resize, ew-resize), vertical scale wheel zoom, time axis alignment, and synced crosshairs.
- `components/chart/cvdPanelUtils.ts` → CVD panel scale calculations and viewport mapping.
- `components/chart/drawStatsGrid.ts` → Canvas overlay rendering volume, delta, and CVD summary statistics grid with borders styled using global 28% grid opacity.
- `components/chart/useCoordinates.ts` → Hook calculating price/time coordinate bounds, visible range mappings, and timeToIndex with boundary extrapolation.
- `components/chart/hooks/useVwapHydration.ts` → Hook explicitly fetching and subscribing to historical 1m base candles to hydrate accurate VWAP state independent of active timeframe.
- `components/chart/usePanZoom.ts` → Hook handling chart pan, zoom, axis drag/wheel zoom, ns-resize and ew-resize cursor states, and crosshair coordination.
- `components/chart/drawCandles.ts` → Candlestick renderer for body, wick, and border geometry with half-pixel alignment for crisp high-definition lines and TradingView-standard hollow candle rendering.
- `components/chart/drawCvd.ts` → CVD renderer supporting candle, bar, line, and histogram modes with crisp TradingView axis typography, half-pixel ticks, and divergence markers.
- `components/chart/drawFootprint.ts` → Footprint renderer displaying bid/ask volume clusters, delta, or delta-volume profiles per price level.
- `components/chart/drawBubbles.ts` → Volume bubble renderer visualizing trade volume, order clusters, and color modes with percentile scaling and 3D effects.
- `components/chart/drawVolumeBars.ts` → On-canvas histogram overlay renderer for volume and trade counts layered behind candlesticks with moving average.
- `components/chart/drawVolumeProfile.ts` → Main Volume Profile renderer displaying horizontal volume distribution, POC line, developing POC trail, Value Area, and HVN/LVN levels with configurable cosmetics.
- `components/chart/drawSelectionRect.ts` → Interactive selection rectangle, developing POC trail, and custom Volume Profile renderer.
- `components/chart/drawLines.ts` → Canvas renderer for lines, rays, boxes, and position tools ([Section Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/drawLines.map.md)).
- `lib/utils/format.ts` → Formatting helpers for price precision, time countdowns, elapsed duration, volume/delta abbreviations, and TradingView-style date-time badges (e.g. `Sat 05 Sep '26  12:05 AM`).
- `components/chart/drawVwap.ts` → Canvas renderer for VWAP line, rolling window, and envelope bands.
- `components/chart/drawAxes.ts` → Price and time axis gridline and label renderer with crisp TradingView typography, half-pixel tick marks, integer-aligned text, and boundary clipping.
- `components/chart/drawPriceLine.ts` → Current market price line, badge, and countdown renderer with crisp half-pixel line and integer-aligned typography.
- `components/chart/drawTradingOverlays.ts` → Canvas overlay renderer for limit orders, SL/TP brackets, virtual positions, and fill markers.
- `components/chart/drawCrosshair.ts` → Crosshair overlay and axis price/time label renderer with crisp TradingView typography, borderless 2px rounded badges, and integer-aligned text coordinates.
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

- `lib/store/chart.ts` → Persisted Zustand store (v38) for chart preferences, indicator settings, and themes ([Section Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/chartStore.map.md)).
- `lib/store/chartRuntime.ts` → Ephemeral Zustand store for live candles, depth, signals, brackets, and trades ([Section Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/chartRuntimeStore.map.md)).
- `hooks/useKeyboardShortcuts.ts` → Keyboard shortcut handler for chart tools, modes, and navigation.
- `types/chart.ts` → TypeScript definitions for chart configurations, panels, indicator options, and DrawnLine properties (including position profit/stop colors).

### Feeds / Shared Live Data

- `lib/feeds/adapter.ts` → Abstract interface for market feed adapters, exposing explicit connection states.
- `lib/feeds/depthAdapter.ts` → Orderbook depth stream adapter supporting Binance and Bybit REST/WebSocket feeds.
- `lib/feeds/binance.ts` → Binance Spot WebSocket/REST market data adapter with explicit state machine and jitter.
- `lib/feeds/binanceFutures.ts` → Binance Futures WebSocket/REST market data adapter with explicit state machine and jitter.
- `lib/feeds/feedRegistry.ts` → Central ref-counted manager for shared market feeds and stream deduplication.
- `lib/feeds/candleCache.ts` → Shared in-memory candle cache with subscriber fanout and range tracking.
- `lib/feeds/index.ts` → Module exports for market feed adapters.
- `types/feed.ts` → Types for feed interfaces, connection states, trade events, and subscription options.

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

- `lib/volumeProfile/profileCache.ts` → In-memory cache for 1m fine Volume Profile rows supporting volume, order count, and aggregate trade metrics.
- `lib/volumeProfile/profileEngine.ts` → Profile engine building viewable Volume Profiles over cached fine rows with O(N) developing POC trail computation.
- `lib/utils/volumeProfile.ts` → Volume Profile math for POC, Value Area (VA), High/Low Volume Nodes (HVN/LVN).
- `lib/utils/historicalSessions.ts` → Historical session calculation and multi-session boundary range resolution with dynamic merge/split support.
- `types/volumeProfile.ts` → Types for volume distributions, nodes, developing POC trails, and profile settings.

### Signals / Analysis

- `lib/utils/vwap.ts` → Incremental and full VWAP calculation engine supporting base-candle fallback, sessions, rolling windows, and envelope bands.
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

- `lib/db/storageAdapter.ts` → Unified storage facade supporting libSQL and TimescaleDB drivers.
- `lib/db/database.ts` → libSQL database facade delegating connection setup, migrations, and table queries to domain repositories.
- `lib/db/repositories/dbSetup.ts` → Database connection setup, table schema migrations, write retry helpers, and database size metadata.
- `lib/db/repositories/candleRepository.ts` → Candle table queries, time range selects, and candle snapshot persistence.
- `lib/db/repositories/tradeRepository.ts` → Raw trade batch insertion and cursor query execution.
- `lib/db/repositories/footprintRepository.ts` → Footprint cell queries, overloaded range queries, and snapshot persistence.
- `lib/db/repositories/profileRepository.ts` → Fine Volume Profile row persistence and range queries.
- `lib/db/repositories/libsqlStorageAdapter.ts` → libSQL implementation of the unified MarketStorageAdapter interface.
- `lib/db/marketStorage.ts` → High-level persistence router for candles, footprint, profile, and trade records.
- `lib/db/aggregateBubbleStorage.ts` → TimescaleDB storage facade for aggregate trade bubble history.
- `lib/db/cleanupJob.ts` → Background maintenance task purging expired records based on retention policies.
- `lib/db/timescale/client.ts` → TimescaleDB/pg pool singleton and connection logic.
- `lib/db/timescale/migrations.ts` → TimescaleDB schema definition and hypertable setup.
- `lib/db/timescale/repositories/timescaleCandleRepository.ts` → TimescaleDB candle batch insertion and range queries.
- `lib/db/timescale/repositories/timescaleFootprintRepository.ts` → TimescaleDB footprint batch insertion and range queries.
- `lib/db/timescale/repositories/timescaleProfileRepository.ts` → TimescaleDB profile batch insertion and range queries.
- `lib/db/timescale/repositories/timescaleBubbleRepository.ts` → TimescaleDB bubble candidate storage and deduplication logic.
- `lib/actions/storageActions.ts` → Server Actions bridging frontend persistence requests to DB storage adapters.
- `data/market.db` → Local SQLite/libSQL database file for offline/dev storage.
- `scripts/testDb.ts` → Verification script testing database connection and operations.
- `scripts/migrateMongoToTimescale.ts` → Optional one-time script for data migration.
- `types/storage.ts` → Definitions for storage adapters, schemas, and query parameters.

### Scripts

- `scripts/collector/btcusdtCollector.mjs` → Standalone Node.js collector fetching and storing BTCUSDT market data to TimescaleDB ([Section Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/btcusdtCollector.map.md)).
- `scripts/collector/runBackfill.mjs` → Data backfill script fetching historical market feeds to populate storage.

### Local Market Order Bridge

- `market_order_bridge/server.mjs` → Local HTTP bridge handling market orders, TP/SL modifications, position closes, MT5 account/position snapshot updates, and EA polling.
- `market_order_bridge/MarketOrderEA.mq5` & `skills/new/trade_placing/MarketOrderBridgeEA.mq5` → MT5 Expert Advisors polling the bridge for market orders, TP/SL modifications, position closes, calculating lot size by risk %, and reporting periodic account & position snapshots.

### Cache / Metrics / Config

- `lib/cache/marketCachePolicy.ts` → Retention and cleanup policies for in-memory market caches.
- `lib/debug/marketMetrics.ts` → Developer metrics registry tracking stream health, cache usage, and render performance.
- `lib/debug/debugPanelAdapter.ts` → Adapter formatting market metrics for the UI debug panel.
- `lib/config/markets.ts` → Supported market pairs, timeframe definitions, and symbol validation logic.
- `lib/config/chartColors.ts` → Shared color palette definitions, theme color constants (DEFAULT_CANVAS_BG, DEFAULT_BORDER_COLOR, DEFAULT_GRID_COLOR, DEFAULT_GRID_OPACITY = 0.28, DEFAULT_HEADER_BG = '#0F0F0F'), and color utility functions.
- `lib/config/constants.ts` → Core application constants and system defaults.
- `types/debug.ts` → TypeScript definitions for metrics, logs, and debug snapshots.

### Utilities / Types

- `lib/services/storageService.ts` → TimescaleDB storage usage summary aggregation and date-range deletion service.
- `lib/validators/orderValidation.ts` → Order request payload reading, parameter normalization, validation, and error response builder.
- `lib/validators/historyValidation.ts` → History API time parameter normalization, contract type resolution, and query parameter validation.
- `lib/utils/tradingApiUtils.ts` → Shared symbol/limit normalizers and error snapshot/status builders for trading APIs.
- `lib/utils/canvas.ts` → Low-level HTML5 Canvas drawing primitives and integer-aligned DPR canvas initializer with high-quality smoothing.
- `lib/utils/chartUtils.ts` → General charting calculations and data helper functions.
- `lib/utils/delta.ts` → Delta calculation and CVD series formatting utilities.
- `lib/utils/format.ts` → Formatter functions for currency, numbers, volume, and timestamps.
- `lib/utils/sessions.ts` → Trading session timezone and market hours calculations.
- `lib/utils/historicalSessions.ts` → Segment-based math and timezone mapping for historical session profile ranges.
- `lib/utils/measurement.ts` → Calculations for measurement tool distance, price change, and duration.
- `types/candle.ts` → OHLCV candlestick data types.
- `types/bubble.ts` → Volume bubble event and configuration types.
- `types/trade.ts` → Trade tick and market trade types.
- `types/measurement.ts` → Measurement tool selection and measurement data types.
- `types/trading.ts` → Types for order management, positions, account balances, and bracket orders.
- `types/cvd.ts` → Cumulative Volume Delta types, marker configurations, and draw options with grid styling.
- `types/figui3.d.ts` → TypeScript custom element declarations and module typings for FigUI3.

### Artifacts / Skills

- `artifacts/timeframe_behavior_report.md` → Analysis report on settings behavior across timeframes.
- `artifacts/pi_deployment.md` → Deployment and PM2 configuration guide for Raspberry Pi.
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
- `skills/maps/` → Dedicated section maps for large source files (>800 lines).

### Large File Section Maps (800+ Lines)

Fast navigation for files exceeding 800 lines to avoid loading full source files:

- `skills/maps/ChartCanvas.map.md` → [ChartCanvas.tsx Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/ChartCanvas.map.md) (4,336 lines, 8 logical sections)
- `skills/maps/FeedProvider.map.md` → [FeedProvider.tsx Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/FeedProvider.map.md) (2,905 lines, 14 logical sections)
- `skills/maps/chartStore.map.md` → [chart.ts Store Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/chartStore.map.md) (2,129 lines, 8 logical sections)
- `skills/maps/btcusdtCollector.map.md` → [btcusdtCollector.mjs Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/btcusdtCollector.map.md) (1,669 lines, 14 logical sections)
- `skills/maps/drawLines.map.md` → [drawLines.ts Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/drawLines.map.md) (1,106 lines, 6 logical sections)
- `skills/maps/chartRuntimeStore.map.md` → [chartRuntime.ts Store Map](file:///c:/Users/d/Documents/ob/orderflowApp/skills/maps/chartRuntimeStore.map.md) (1,107 lines, 7 logical sections)

## Architecture & Tech Stack

- **Framework:** Next.js 14 App Router
- **Styling:** Tailwind CSS with dark theme and custom palette
- **State:** Zustand with persisted panel settings
- **Charting:** Custom HTML5 Canvas per chart/CVD surface
- **Market Data:** Binance spot/futures REST and WebSocket feeds plus selectable Binance, Bybit, or combined depth streams through shared feed registry
- **Storage:** libSQL/Turso fallback plus TimescaleDB adapter behind `MARKET_DB_DRIVER=timescaledb`
- **Caches:** Shared in-memory candle, footprint, and Volume Profile caches with TTL cleanup
- **Observability:** Dev-only `window.__MARKET_DEBUG__` snapshot metrics, including orderbook heatmap sampling stats
- **Layout:** Single/split chart panels with focus layout mode

## Maintenance Rule

`skills/map.md` should describe the current state only. Do not append long historical responsibility updates here. Put chronological task history in `skills/log.md`.
