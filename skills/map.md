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
│   ├── FeedProvider.tsx      # PanelFeedProvider — per-panel WebSocket & REST lifecycle
│   ├── ChartEngineContext.tsx# React context for AggregationEngine (one per panel)
│   ├── chart/                # Chart-specific components
│   │   ├── ChartPanel.tsx    # Panel wrapper — reads panel state, ensures proper layout container
│   │   ├── ChartCanvas.tsx   # Pure rendering canvas, robust resizing via ResizeObserver & CSS w-full layout
│   │   ├── useCoordinates.ts # Coordinate math (price-to-pixel, index-to-pixel)
│   │   ├── usePanZoom.ts     # Anchored pan/zoom with interaction callback support
│   │   ├── drawCandles.ts    # Candlestick draw function
│   │   ├── drawFootprint.ts  # Footprint cell draw function (w/ left-aligned candle)
│   │   ├── drawAxes.ts       # Polished axes (12h time, formatted price, 12px font)
│   │   ├── drawPriceLine.ts  # Live price badge with countdown and direction-color
│   │   ├── drawCrosshair.ts  # TradingView-style crosshair with axis labels
│   │   ├── drawAbsorption.ts # Absorption markers (minor/strong/extreme), glow, labels, timeframe-scaled
│   │   ├── drawExhaustion.ts # Exhaustion markers (dash scaling, rank-based labels), timeframe-scaled
│   │   ├── AbsorptionTooltip.tsx # Hover breakdown of absorption signals (delta, volume, progression)
│   │   ├── ExhaustionTooltip.tsx # Hover breakdown of exhaustion signals (momentum, rejection, compression)
│   │   ├── drawBubbles.ts    # Volume bubbles overlay (adaptive thresholds, radius/opacity-scaled)
│   │   ├── drawVolumeProfile.ts # Unified amber profile with POC highlight and VA fill
│   │   ├── drawSelectionRect.ts # Custom profile rendering with subtle borders and no background tint
│   │   ├── drawLines.ts         # Horizontal and Vertical line drawing tool
│   │   └── MeasurementPanel.tsx # Overlay showing measurement tool metrics
│   ├── layout/               # General layout components
│   │   ├── Header.tsx        # Top toolbar — Logo, Layout, Connection, Settings toggle
│   │   └── Sidebar.tsx       # Collapsible sidebar — Data/Session stats
│   └── ui/                   # Reusable UI components
│       ├── ConnectionStatus.tsx # Combined live connection indicator
│       ├── PanelToolbar.tsx     # Per-panel controls — Pair, TF, Mode, Drawing tools, Quick Toggles
│       ├── ChartSettingsDropdown.tsx # Draggable settings window with vertical sidebar navigation, adaptive toggles
│       ├── PairSelector.tsx     # Pair switcher (panel-scoped)
│       ├── TimeframeSelector.tsx# Timeframe switcher (panel-scoped)
│       ├── ChartModeToggle.tsx  # Candle / Footprint toggle (panel-scoped)
│       └── BucketSizeInput.tsx  # Bucket size config (panel-scoped)
│
├── hooks/                    # Custom React hooks
│   └── useKeyboardShortcuts.ts # Hotkeys targeting activePanel (1-5, C, F, R, [, ])
│
├── lib/                      # Business logic, state, and utilities
│   ├── draw/                 # Pure drawing logic (context-based)
│   │   ├── drawDeltaProfile.ts # Renders delta profile strip (ask-bid imbalance)
│   │   ├── drawMeasurement.ts  # Renders measurement tool rectangle and metrics
│   │   └── drawSessions.ts     # Renders trading session background boxes
│   ├── aggregation/          # Trade aggregation logic
│   │   └── engine.ts         # AggregationEngine (Real-time Trade Aggregation)
│   ├── absorption/           # Absorption detection system
│   │   └── engine.ts         # scoreCandle, buildAbsorptionMap, scoreLatestCandle (Signals 1-5)
│   ├── exhaustion/           # Exhaustion detection system
│   │   └── engine.ts         # scoreExhaustion, buildExhaustionMap, scoreLatestExhaustion (Signals 1-5, relaxed constraints)
│   ├── feeds/                # Data adapters for WebSockets & REST
│   │   ├── adapter.ts        # FeedAdapter interface (History + Live + clone())
│   │   ├── binance.ts        # Binance implementation (REST klines + WebSocket streams)
│   │   └── index.ts          # Active adapter export
│   ├── store/                # Zustand global state
│   │   └── chart.ts          # Panel state, timeframe-linked settings, sessions, auth, and persistence (v12)
│   └── utils/                # Helper functions
│       ├── aggregation.ts    # Trade -> footprint cell math
│       ├── canvas.ts         # HTML5 canvas rendering functions
│       ├── volumeProfile.ts  # Volume profile aggregation, POC, and VA math
│       ├── chartUtils.ts     # Shared chart utilities (rolling averages, opacity, etc.)
│       ├── delta.ts          # Delta calculation helpers (Planned)
│       ├── format.ts         # Price, volume, delta, and timeframe formatting
│       ├── sessions.ts       # Session occurrence calculation logic
│       └── measurement.ts    # Measurement metric calculation logic
│
├── types/                    # TypeScript interfaces
│   ├── candle.ts             # OHLCV definitions
│   ├── footprint.ts          # Footprint data structures & FootprintMode ('bid-ask' | 'delta')
│   ├── absorption.ts         # AbsorptionResult, AbsorptionDirection, AbsorptionRank
│   ├── exhaustion.ts         # ExhaustionResult, ExhaustionDirection, ExhaustionRank
│   ├── measurement.ts        # Measurement tool data structures
│   └── trade.ts              # Individual trade tick definitions
│
├── artifacts/                # Reports and analytical documents
│   └── timeframe_behavior_report.md # Analysis of settings behavior across timeframes
│
├── tailwind.config.ts        # Design system constraints and tokens
└── package.json              # Project dependencies (zustand, etc.)
```

## Architecture & Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (Strict dark mode, custom color palette)
- **State Management:** Zustand (panel-scoped, persisted to localStorage v12)
- **Data Layer:** Client-side WebSockets via `FeedAdapter` pattern (one per panel)
- **Charting:** Custom HTML5 Canvas (Single Canvas Architecture per panel)
- **Layout:** Single or Dual panel mode with independent pair/timeframe/mode per panel
- **Auth:** Simple password protection for premium signal details ("alpha")
