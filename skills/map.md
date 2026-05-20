# OrderFlow Chart - Project Map

## Project Overview
A personal, minimal order flow charting tool for learning market microstructure. It fetches live market data via WebSockets and renders candlestick charts, footprint charts, and volume profiles. Supports dual independent chart panels.

## Folder Structure

```
/
├── app/                      # Next.js App Router root
│   ├── layout.tsx            # Root layout, loads fonts (Inter, JetBrains Mono) & dark mode
│   ├── page.tsx              # Main scaffold: Header, Sidebar, dual ChartPanel layout w/ draggable split
│   └── globals.css           # Tailwind base + Custom CSS variables (color palette)
│
├── components/               # UI and Charting Components
│   ├── FeedProvider.tsx      # PanelFeedProvider — per-panel WebSocket/REST/orderbook lifecycle, liquidity history depth sync
│   ├── ChartEngineContext.tsx# React context for AggregationEngine (one per panel)
│   ├── chart/                # Chart-specific components
│   │   ├── ChartPanel.tsx    # Panel wrapper — reads panel state, ensures proper layout container
│   │   ├── ChartCanvas.tsx   # Pure rendering canvas, HiDPI scaling, overlays, liquidity heatmap/profile wiring
│   │   ├── CvdPanel.tsx      # Attached lower CVD panel with synced time axis and vertical scale interactions
│   │   ├── useCoordinates.ts # Coordinate math (price-to-pixel, index-to-pixel, time-to-index)
│   │   ├── usePanZoom.ts     # Anchored pan/zoom with optimized window-level interaction tracking
│   │   ├── drawCandles.ts    # Candlestick draw function
│   │   ├── drawCvd.ts        # CVD panel renderer for candles, bars, line, histogram, axis, and labels
│   │   ├── drawFootprint.ts  # Footprint cell draw function (w/ left-aligned candle)
│   │   ├── drawAxes.ts       # Polished axes (12h time, formatted price, 12px font)
│   │   ├── drawPriceLine.ts  # Live price badge with countdown and direction-color
│   │   ├── drawCrosshair.ts  # TradingView-style crosshair with axis labels
│   │   ├── drawAbsorption.ts # Absorption markers (minor/strong/extreme), glow, labels, timeframe-scaled
│   │   ├── drawExhaustion.ts # Exhaustion markers (dash scaling, rank-based labels), timeframe-scaled
│   │   ├── AbsorptionTooltip.tsx # Hover breakdown of absorption signals (delta, volume, progression)
│   │   ├── ExhaustionTooltip.tsx # Hover breakdown of exhaustion signals (momentum, rejection, compression)
│   │   ├── drawBubbles.ts    # Volume bubbles overlay (adaptive thresholds, radius/opacity-scaled)
│   │   ├── drawVolumeProfile.ts # Unified amber profile with POC highlight, VA fill, optional heatmap POC glow
│   │   ├── drawSelectionRect.ts # Custom profile rendering with subtle borders and no background tint
│   │   ├── drawLines.ts         # Horizontal and Vertical line drawing tool
│   │   └── MeasurementPanel.tsx # Overlay showing measurement tool metrics
│   ├── layout/               # General layout components
│   │   ├── Header.tsx        # Top toolbar — Logo, Layout, Connection, Settings toggle
│   │   └── Sidebar.tsx       # Collapsible sidebar — Data/Session stats
│   └── ui/                   # Reusable UI components
│       ├── ConnectionStatus.tsx # Combined live connection indicator
│       ├── PanelToolbar.tsx     # Per-panel controls — Pair, TF, Mode, Drawing tools, Quick Toggles
│       ├── ChartSettingsDropdown.tsx # Draggable settings window with profile, signal, session, liquidity heatmap controls
│       ├── PairSelector.tsx     # Pair switcher (panel-scoped)
│       ├── TimeframeSelector.tsx# Timeframe switcher (panel-scoped)
│       ├── ChartModeToggle.tsx  # Candle / Footprint toggle (panel-scoped)
│       └── BucketSizeInput.tsx  # Bucket size config (panel-scoped)
│
├── hooks/                    # Custom React hooks
│   └── useKeyboardShortcuts.ts # Hotkeys targeting activePanel (1-5, C, F, R, [, ], S, Q, L, M)
│
├── lib/                      # Business logic, state, and utilities
│   ├── draw/                 # Pure drawing logic (context-based)
│   │   ├── drawDeltaProfile.ts # Renders delta profile strip (ask-bid imbalance)
│   │   ├── drawMeasurement.ts  # Renders measurement tool rectangle and metrics
│   │   ├── drawSessions.ts     # Renders trading session background boxes
│   │   ├── drawLiquidity.ts    # Renders orderbook liquidity zones as horizontal price bands
│   │   └── drawLiquidityHeatmap.ts # Renders historical liquidity heatmap strip (w/ simplified gradient mode & scroll label)
│   ├── aggregation/          # Trade aggregation logic
│   │   └── engine.ts         # AggregationEngine (Real-time Trade Aggregation)
│   ├── absorption/           # Absorption detection system
│   │   └── engine.ts         # scoreCandle, buildAbsorptionMap, scoreLatestCandle (Signals 1-5)
│   ├── exhaustion/           # Exhaustion detection system
│   │   └── engine.ts         # scoreExhaustion, buildExhaustionMap, scoreLatestExhaustion (Signals 1-5, relaxed constraints)
│   ├── iceberg/              # Iceberg detection system
│   │   └── engine.ts         # IcebergEngine, per-price-level scoring across lookback candles, top-level results
│   ├── liquidity/            # Orderbook liquidity map system
│   │   ├── orderbook.ts      # OrderbookManager — local in-memory orderbook (snapshot + incremental updates)
│   │   ├── aggregation.ts    # aggregateOrderbook — buckets raw levels into LiquidityZone[] with intensity scoring
│   │   ├── history.ts        # LiquidityHistoryManager — manages capped FIFO buffer of candle-close snapshots
│   │   ├── analysis.ts       # getLiquidityBehavior — classifies level activity (pulled vs consumed)
│   │   └── heatmap.ts        # buildHeatmapRows — constructs visual heatmap rows from history, capped near current price
│   ├── feeds/                # Data adapters for WebSockets & REST
│   │   ├── adapter.ts        # FeedAdapter interface (History + Live + Orderbook + clone())
│   │   ├── binance.ts        # Binance implementation (REST klines/depth + WebSocket kline/aggTrade/depth streams)
│   │   └── index.ts          # Active adapter export
│   ├── store/                # Zustand global state
│   │   └── chart.ts          # Panel state, timeframe settings, sessions, liquidity heatmap + iceberg settings, auth, persistence (v18)
│   └── utils/                # Helper functions
│       ├── aggregation.ts    # Trade -> footprint cell math
│       ├── canvas.ts         # HTML5 canvas rendering functions
│       ├── volumeProfile.ts  # Volume profile aggregation, POC, and VA math
│       ├── chartUtils.ts     # Shared chart utilities (rolling averages, opacity, etc.)
│       ├── delta.ts          # CVD series, reset, and smoothing helpers
│       ├── format.ts         # Price, volume, delta, and timeframe formatting
│       ├── sessions.ts       # Session occurrence calculation logic
│       └── measurement.ts    # Measurement metric calculation logic
│
├── types/                    # TypeScript interfaces
│   ├── candle.ts             # OHLCV definitions
│   ├── footprint.ts          # Footprint data structures & FootprintMode ('bid-ask' | 'delta')
│   ├── absorption.ts         # AbsorptionResult, AbsorptionDirection, AbsorptionRank
│   ├── exhaustion.ts         # ExhaustionResult, ExhaustionDirection, ExhaustionRank
│   ├── iceberg.ts            # IcebergLevel, IcebergSide, IcebergRank detection output types
│   ├── measurement.ts        # Measurement tool data structures
│   ├── liquidity.ts          # LiquidityZone interface for orderbook aggregation
│   └── trade.ts              # Individual trade tick definitions
│
├── artifacts/                # Reports and analytical documents
│   └── timeframe_behavior_report.md # Analysis of settings behavior across timeframes
│
├── tailwind.config.ts        # Design system constraints and tokens
└── package.json              # Project dependencies (zustand, etc.)
```

## Current File Responsibilities
package.json → Project scripts and dependencies, including @libsql/client.
pnpm-lock.yaml → Locked pnpm dependency graph, including @libsql/client.
.gitignore → Excludes generated dependencies, build output, local env files, and local database files.
.env.local → Local Turso/libSQL file database URL and retention-hours config.
next.config.mjs → Next.js configuration, including the instrumentation hook flag.
instrumentation.ts → Next.js server startup hook that initializes the database schema in the Node runtime.
app/api/history/candles/route.ts → API route returning stored candles in frontend Candle shape.
app/api/history/footprint/route.ts → API route returning stored footprint cells for one candle and bucket size.
app/api/history/status/route.ts → API route returning collector metadata, candle counts, retention, and DB size.
components/FeedProvider.tsx → Panel feed lifecycle, DB-backed startup history restore, and closed-candle storage serialization.
lib/config/markets.ts → Shared allowed symbols and timeframes for history API validation.
lib/actions/storageActions.ts → Server Action bridge that accepts serialized closed-candle data from the client feed.
lib/aggregation/engine.ts → AggregationEngine footprint storage, candle ingestion, and persisted footprint hydration.
lib/db/cleanupJob.ts → Server cleanup timer for retention-based database pruning.
lib/db/database.ts → Turso/libSQL client singleton, schema setup, retention config, metadata, counts, size, and history query helpers.
lib/db/marketStorage.ts → Best-effort closed-candle storage orchestration for OHLCV, footprint cells, candle delta, and metadata.
scripts/testDb.ts → Temporary database verification script for schema creation and candle round-trip testing.
data/market.db → Generated local libSQL database file used by file-mode development/runtime.
components/chart/ChartCanvas.tsx → Canvas render orchestration, overlay draw order, and signal hover detection.
components/chart/ChartPanel.tsx → Panel state bridge from store/context into ChartCanvas props.
components/chart/IcebergTooltip.tsx → Iceberg hover tooltip with rank, reasons, price, and volume stats.
components/ui/PanelToolbar.tsx → Per-panel toolbar controls including ABS, EX, and ICE signal toggles.
components/ui/ChartSettingsDropdown.tsx → Settings window for chart, profiles, sessions, and signal controls.
components/layout/Sidebar.tsx → Active panel settings and signal statistics, including iceberg level summary.
hooks/useKeyboardShortcuts.ts → Keyboard shortcuts for chart mode, tools, sessions, liquidity, and iceberg toggles/logging.
lib/draw/drawIceberg.ts → Pure canvas renderer for iceberg defense lines, labels, tint, caps, and absorption handoff.
lib/iceberg/engine.ts → Iceberg scoring engine and window metadata for detected price levels.
lib/store/chart.ts → Zustand panel state, persisted settings, and session-only signal maps/levels.
types/iceberg.ts → IcebergLevel, IcebergSide, and IcebergRank detection output types.
artifacts/pi_deployment.md → pm2 production deployment and restart notes for Raspberry Pi.

Latest responsibility updates:
lib/store/chart.ts → Zustand panel state, persisted settings, drawing overlays, and independent Volume Profile row-size/readability controls.
components/ui/ChartSettingsDropdown.tsx → Draggable settings window with chart, profile resolution/rendering, sessions, signal, and liquidity controls.
components/chart/ChartPanel.tsx → Panel state bridge from store/context into ChartCanvas, including fine profile source, tick size, and profile resolution settings.
components/chart/ChartCanvas.tsx → Canvas render orchestration using independent profile row-size aggregation and readable row rendering settings.
components/chart/drawVolumeProfile.ts → Visible Volume Profile renderer with width clamping, min row height support, POC, VA, LVN, and profile bars.
components/chart/drawSelectionRect.ts → Custom profile rectangle/profile renderer with width clamping, min row height support, LVN markers, and resize handles.
lib/draw/drawDeltaProfile.ts → Delta profile strip renderer aligned to independent profile row size and readable row height settings.
types/trade.ts → Trade tick shape, including optional Binance aggregate trade id for raw-trade persistence.
lib/volumeProfile/profileEngine.ts → Fine raw-trade Volume Profile source/aggregator with a replaceable interface for future shared cache support.
app/api/history/trades/route.ts → API route returning stored raw trades for a symbol/time window.
lib/feeds/binance.ts → Binance adapter for REST/WS market data, including aggTrade id parsing.
components/ChartEngineContext.tsx → Shared chart engine context, including fine Volume Profile source and redraw revision.
components/FeedProvider.tsx → Panel feed lifecycle, raw trade hydration/storage batching, fine profile ingestion, and existing chart/footprint feed orchestration.
components/chart/ChartPanel.tsx → Panel state bridge from store/context into ChartCanvas, including fine profile source and tick size.
components/chart/ChartCanvas.tsx → Canvas render orchestration using tick-size raw-trade Volume Profile first with existing footprint/candle fallback.
lib/db/database.ts → Turso/libSQL schema and helpers for candles, footprints, deltas, metadata, and raw trade storage/history.
lib/db/marketStorage.ts → Best-effort closed-candle and raw-trade storage orchestration.
lib/actions/storageActions.ts → Server Action bridge for closed-candle snapshots and raw-trade batch storage.
components/chart/ChartCanvas.tsx → Custom volume profile hit-testing, cursor/crosshair suppression, controls positioning, and resize/move orchestration.
components/chart/drawSelectionRect.ts → Custom profile rectangle/profile rendering, including LVN markers and resize handles.
components/chart/drawVolumeProfile.ts → Visible volume profile rendering for POC, VA, LVN levels, and profile bars.
lib/utils/volumeProfile.ts → Volume profile aggregation, POC/VA math, and LVN detection.
components/FeedProvider.tsx → Panel feed lifecycle, DB-backed startup history restore, and non-blocking closed-candle snapshot save requests.
lib/db/database.ts → Turso/libSQL client singleton, schema setup, atomic closed-candle batch writes with transient retry, metadata, and history query helpers.
lib/db/marketStorage.ts → Best-effort closed-candle snapshot storage orchestration using one atomic DB write and clear failure logging.
components/chart/ChartCanvas.tsx → Canvas render orchestration, drawing tool creation, hover/delete, and move/resize interactions for drawable overlays.
components/chart/drawLines.ts → Canvas renderer for horizontal/vertical lines, right-extending horizontal rays, boxes, handles, delete dots, and price labels.
components/ui/PanelToolbar.tsx → Per-panel toolbar controls with compact drawing-tool selector plus signal/session quick toggles.
lib/store/chart.ts → Zustand panel state, persisted settings, drawing tool modes, drawable overlay storage, and drawing update actions.

components/chart/drawLines.ts → Drawing overlay renderer with left-anchored price labels for rays and outside-edge box labels.
components/chart/ChartCanvas.tsx → Canvas render orchestration passing drawing geometry into overlay label rendering.

components/FeedProvider.tsx → Panel feed lifecycle with live-first Binance streaming, background history merge, trade dedupe, raw-trade hydration, and partial-footprint persistence guards.
lib/store/chart.ts → Zustand panel state with time-keyed candle merging for live/history consistency.
lib/feeds/binance.ts → Binance adapter for REST/WS market data with REST kline close-state detection.
components/chart/ChartCanvas.tsx → Canvas render orchestration without blocking history-loading overlay.

components/FeedProvider.tsx → Performance-aware feed lifecycle with chunked raw-trade hydration, throttled profile redraws, and reduced realtime store churn.
lib/volumeProfile/profileEngine.ts → Raw-trade Volume Profile source with bounded trade retention, time-window lookup, and profile-result caching.

types/liquidityVacuum.ts → Liquidity Vacuum zone, anchor, rank, direction, and scoring output types.
lib/liquidityVacuum/engine.ts → Liquidity Vacuum detector scoring fast, low-participation movement between active volume anchors.
lib/draw/drawLiquidityVacuum.ts → Canvas renderer for lightweight Liquidity Vacuum chart zones.
lib/store/chart.ts → Zustand panel state, persisted Liquidity Vacuum settings, and session-only vacuum zones.
components/FeedProvider.tsx → Panel feed lifecycle with Liquidity Vacuum zone recomputation after history, live footprint, bucket, and closed-candle updates.
components/chart/ChartPanel.tsx → Panel state bridge into ChartCanvas, including Liquidity Vacuum settings and zones.
components/chart/ChartCanvas.tsx → Canvas render orchestration including Liquidity Vacuum zone drawing behind candles.
components/ui/PanelToolbar.tsx → Per-panel toolbar controls including VAC signal toggle.
components/ui/ChartSettingsDropdown.tsx → Settings window with Liquidity Vacuum score, opacity, label, and max-zone controls.
components/layout/Sidebar.tsx → Active panel signal statistics, including Liquidity Vacuum zone summary.
hooks/useKeyboardShortcuts.ts → Keyboard shortcuts for chart mode, tools, sessions, liquidity, iceberg, and Liquidity Vacuum toggles/logging.
skills/map.md → Source-of-truth file responsibility map and latest responsibility updates.
skills/log.md → Change history for feature/fix context and impact summaries.

components/chart/CvdPanel.tsx → Attached lower CVD canvas with synced horizontal geometry, time axis, crosshair sync, vertical zoom, and vertical pan.
components/chart/drawCvd.ts → Pure CVD renderer for candle, bar, line, and histogram modes with CVD axis/labels.
lib/utils/delta.ts → Builds CVD series from footprint deltas with daily/session/no reset and optional smoothing.
components/chart/ChartPanel.tsx → Panel state bridge and vertical chart/CVD layout attachment with draggable CVD height resizing.
components/chart/ChartCanvas.tsx → Main chart canvas orchestration with optional hidden time axis for attached indicator panels.
components/chart/usePanZoom.ts → Shared pan/zoom hook syncing persisted horizontal geometry across sibling canvases.
components/chart/drawAxes.ts → Chart axis renderers with configurable price-axis height alignment.
components/ui/PanelToolbar.tsx → Per-panel toolbar controls including CVD quick toggle.
components/ui/ChartSettingsDropdown.tsx → Settings window including CVD panel mode, reset, smoothing, scale, height, color, and marker controls.
lib/store/chart.ts → Zustand panel state, persisted settings, drawing overlays, signals, profiles, and CVD panel settings.

## Architecture & Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (Strict dark mode, custom color palette)
- **State Management:** Zustand (panel-scoped, persisted to localStorage v18)
- **Data Layer:** Client-side WebSockets via `FeedAdapter` pattern (one per panel)
- **Charting:** Custom HTML5 Canvas (Single Canvas Architecture per panel)
- **Layout:** Single or Dual panel mode with independent pair/timeframe/mode per panel
- **Auth:** Simple password protection for premium signal details ("alpha")
