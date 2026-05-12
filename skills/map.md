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
│   │   ├── ChartPanel.tsx    # Panel wrapper — reads panel state, passes props to ChartCanvas
│   │   ├── ChartCanvas.tsx   # Pure rendering canvas, accepts all data via props, handles cursor & hover logic
│   │   ├── useCoordinates.ts # Coordinate math (price-to-pixel, index-to-pixel)
│   │   ├── usePanZoom.ts     # Anchored pan/zoom with interaction callback support
│   │   ├── drawCandles.ts    # Candlestick draw function
│   │   ├── drawFootprint.ts  # Footprint cell draw function (w/ left-aligned candle)
│   │   ├── drawAxes.ts       # Polished axes (12h time, formatted price, 12px font)
│   │   ├── drawPriceLine.ts  # Live price badge with countdown and direction-color
│   │   ├── drawCrosshair.ts  # TradingView-style crosshair with axis labels
│   │   ├── drawAbsorption.ts # Absorption markers (minor/strong/extreme), glow, labels
│   │   ├── drawExhaustion.ts # Exhaustion markers (dash scaling, rank-based labels)
│   │   ├── AbsorptionTooltip.tsx # Hover breakdown of absorption signals (delta, volume, progression)
│   │   ├── ExhaustionTooltip.tsx # Hover breakdown of exhaustion signals (momentum, rejection, compression)
│   │   ├── drawBubbles.ts    # Volume bubbles overlay (threshold-filtered, radius/opacity-scaled)
│   │   ├── drawVolumeProfile.ts # Renders profile with scaling, POC highlight, and VA fill
│   │   ├── drawSelectionRect.ts # Handles custom profile logic and rendering with visual controls
│   │   └── drawLines.ts         # Horizontal and Vertical line drawing tool
│   ├── layout/               # General layout components
│   │   ├── Header.tsx        # Top toolbar — Logo, Layout, Connection, Settings toggle
│   │   └── Sidebar.tsx       # Collapsible sidebar — Data/Session stats
│   └── ui/                   # Reusable UI components
│       ├── ConnectionStatus.tsx # Combined live connection indicator
│       ├── PanelToolbar.tsx     # Per-panel controls — Pair, TF, Mode, Drawing tools
│       ├── ChartSettingsDropdown.tsx # Centralized settings (Bucket, Footprint, Bubbles, Absorption, Exhaustion, Profile)
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
│   │   └── drawDeltaProfile.ts # Renders delta profile strip (ask-bid imbalance)
│   ├── aggregation/          # Trade aggregation logic
│   │   └── engine.ts         # AggregationEngine (Real-time Trade Aggregation)
│   ├── absorption/           # Absorption detection system
│   │   └── engine.ts         # scoreCandle, buildAbsorptionMap, scoreLatestCandle (Signals 1-4)
│   ├── exhaustion/           # Exhaustion detection system
│   │   └── engine.ts         # scoreExhaustion, buildExhaustionMap, scoreLatestExhaustion (Signals 1-5)
│   ├── feeds/                # Data adapters for WebSockets & REST
│   │   ├── adapter.ts        # FeedAdapter interface (History + Live + clone())
│   │   ├── binance.ts        # Binance implementation (REST klines + WebSocket streams)
│   │   └── index.ts          # Active adapter export
│   ├── store/                # Zustand global state
│   │   └── chart.ts          # Panel state, indicators, visual settings, and persistence (v11)
│   └── utils/                # Helper functions
│       ├── aggregation.ts    # Trade -> footprint cell math
│       ├── canvas.ts         # HTML5 canvas rendering functions
│       ├── volumeProfile.ts  # Volume profile aggregation, POC, and VA math
│       ├── chartUtils.ts     # Shared chart utilities (rolling averages, opacity, etc.)
│       ├── delta.ts          # Delta calculation helpers (Planned)
│       └── format.ts         # Timeframe parsing, countdowns, and price formatting
│
├── types/                    # TypeScript interfaces
│   ├── candle.ts             # OHLCV definitions
│   ├── footprint.ts          # Footprint data structures & FootprintMode ('bid-ask' | 'delta')
│   ├── absorption.ts         # AbsorptionResult, AbsorptionDirection, AbsorptionRank
│   ├── exhaustion.ts         # ExhaustionResult, ExhaustionDirection, ExhaustionRank
│   └── trade.ts              # Individual trade tick definitions
│
├── tailwind.config.ts        # Design system constraints and tokens
└── package.json              # Project dependencies (zustand, etc.)
```

## Architecture & Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (Strict dark mode, custom color palette)
- **State Management:** Zustand (panel-scoped, persisted to localStorage v6)
- **Data Layer:** Client-side WebSockets via `FeedAdapter` pattern (one per panel)
- **Charting:** Custom HTML5 Canvas (Single Canvas Architecture per panel)
- **Layout:** Single or Dual panel mode with independent pair/timeframe/mode per panel
