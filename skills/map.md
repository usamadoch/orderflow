# OrderFlow Chart - Project Map

## Project Overview
A personal, minimal order flow charting tool for learning market microstructure. It fetches live market data via WebSockets and renders candlestick charts, footprint charts, and volume profiles.

## Folder Structure

```
/
├── app/                      # Next.js App Router root
│   ├── layout.tsx            # Root layout, loads fonts (Inter, JetBrains Mono) & dark mode
│   ├── page.tsx              # Main UI scaffold (Header, Sidebar, Chart container)
│   └── globals.css           # Tailwind base + Custom CSS variables (color palette)
│
├── components/               # UI and Charting Components
│   ├── FeedProvider.tsx      # WebSocket & REST lifecycle (Backfills history on connect)
│   ├── ChartEngineContext.tsx# React context for AggregationEngine
│   ├── chart/                # Chart-specific components
│   │   ├── ChartCanvas.tsx   # Single canvas, owns setup + redraw loop
│   │   ├── useCoordinates.ts # Coordinate math (price-to-pixel, index-to-pixel)
│   │   ├── usePanZoom.ts     # Anchored pan/zoom & persistent axis refs
│   │   ├── drawCandles.ts    # Candlestick draw function
│   │   ├── drawFootprint.ts  # Footprint cell draw function (w/ left-aligned candle)
│   │   ├── drawAxes.ts       # Polished axes (12h time, formatted price, high-readability 12px font)
│   │   ├── drawPriceLine.ts  # Live price badge with larger fonts, countdown, and direction-color
│   │   ├── drawCrosshair.ts  # TradingView-style crosshair with high-visibility axis labels
│   │   └── drawVolumeProfile.ts # Horizontal volume bars, POC, and Value Area
│   ├── layout/               # General layout components
│   │   ├── Header.tsx        # Top toolbar with pair/timeframe selectors
│   │   └── Sidebar.tsx       # Collapsible sidebar for data settings
│   └── ui/                   # Reusable UI components
│       ├── ConnectionStatus.tsx # Live connection indicator
│       ├── PairSelector.tsx     # Active pair switcher (Persisted)
│       ├── TimeframeSelector.tsx# Active timeframe switcher (Persisted)
│       ├── ChartModeToggle.tsx  # Candle / Footprint mode toggle (Persisted)
│       └── BucketSizeInput.tsx  # Footprint bucket size config (Persisted)
│
├── lib/                      # Business logic, state, and utilities
│   ├── aggregation/          # Trade aggregation logic
│   │   └── engine.ts         # AggregationEngine (Real-time Trade Aggregation)
│   ├── feeds/                # Data adapters for WebSockets & REST
│   │   ├── adapter.ts        # FeedAdapter interface (History + Live contracts)
│   │   ├── binance.ts        # Binance implementation (REST klines + WebSocket streams)
│   │   └── index.ts          # Active adapter export
│   ├── store/                # Zustand global state
│   │   └── chart.ts          # State for data (candles, trades) and UI settings (Persisted)
│   └── utils/                # Helper functions
│       ├── aggregation.ts    # Trade -> footprint cell math
│       ├── canvas.ts         # HTML5 canvas rendering functions
│       ├── volumeProfile.ts  # Volume profile aggregation, POC, and VA math
│       ├── delta.ts          # Delta calculation helpers (Planned)
│       └── format.ts         # Timeframe parsing, countdowns, and price formatting
│
├── types/                    # TypeScript interfaces
│   ├── candle.ts             # OHLCV definitions
│   ├── footprint.ts          # Footprint data structures
│   └── trade.ts              # Individual trade tick definitions
│
├── tailwind.config.ts        # Design system constraints and tokens
└── package.json              # Project dependencies (zustand, etc.)
```

## Architecture & Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (Strict dark mode, custom color palette)
- **State Management:** Zustand (in-memory)
- **Data Layer:** Client-side WebSockets via `FeedAdapter` pattern
- **Charting:** Custom HTML5 Canvas (Single Canvas Architecture)
