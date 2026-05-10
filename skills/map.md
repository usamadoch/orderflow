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
│   │   ├── drawBubbles.ts    # Volume bubbles overlay (threshold-filtered, radius/opacity-scaled)
│   │   ├── drawVolumeProfile.ts # Horizontal volume bars, POC, and Value Area
│   │   ├── drawSelectionRect.ts # Selection rect, Custom Profile, Resizing handles, Locking
│   │   └── drawLines.ts         # Horizontal and Vertical line drawing tool
│   ├── layout/               # General layout components
│   │   ├── Header.tsx        # Top toolbar — Logo, Layout, Connection, Settings toggle
│   │   └── Sidebar.tsx       # Collapsible sidebar — Data/Session stats
│   └── ui/                   # Reusable UI components
│       ├── ConnectionStatus.tsx # Combined live connection indicator
│       ├── PanelToolbar.tsx     # Per-panel controls — Pair, TF, Mode, Drawing tools
│       ├── ChartSettingsDropdown.tsx # Centralized chart settings (Bucket, Footprint, Bubbles)
│       ├── PairSelector.tsx     # Pair switcher (panel-scoped)
│       ├── TimeframeSelector.tsx# Timeframe switcher (panel-scoped)
│       ├── ChartModeToggle.tsx  # Candle / Footprint toggle (panel-scoped)
│       └── BucketSizeInput.tsx  # Bucket size config (panel-scoped)
│
├── hooks/                    # Custom React hooks
│   └── useKeyboardShortcuts.ts # Hotkeys targeting activePanel (1-5, C, F, R, [, ])
│
├── lib/                      # Business logic, state, and utilities
│   ├── aggregation/          # Trade aggregation logic
│   │   └── engine.ts         # AggregationEngine (Real-time Trade Aggregation)
│   ├── absorption/           # Absorption detection system
│   │   └── engine.ts         # scoreCandle, buildAbsorptionMap, scoreLatestCandle (Signals 1-3)
│   ├── feeds/                # Data adapters for WebSockets & REST
│   │   ├── adapter.ts        # FeedAdapter interface (History + Live + clone())
│   │   ├── binance.ts        # Binance implementation (REST klines + WebSocket streams)
│   │   └── index.ts          # Active adapter export
│   ├── store/                # Zustand global state
│   │   └── chart.ts          # Panel-scoped state, absorption + bubble + custom profile settings, persist v6
│   └── utils/                # Helper functions
│       ├── aggregation.ts    # Trade -> footprint cell math
│       ├── canvas.ts         # HTML5 canvas rendering functions
│       ├── volumeProfile.ts  # Volume profile aggregation, POC, and VA math
│       ├── delta.ts          # Delta calculation helpers (Planned)
│       └── format.ts         # Timeframe parsing, countdowns, and price formatting
│
├── types/                    # TypeScript interfaces
│   ├── candle.ts             # OHLCV definitions
│   ├── footprint.ts          # Footprint data structures & FootprintMode ('bid-ask' | 'delta')
│   ├── absorption.ts         # AbsorptionResult, AbsorptionDirection, AbsorptionRank
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
