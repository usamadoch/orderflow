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
│   ├── FeedProvider.tsx      # WebSocket lifecycle wrapper
│   ├── chart/                # Chart-specific components
│   │   ├── ChartContainer.tsx# Outer layout and container for charts
│   │   ├── CandleChart.tsx   # lightweight-charts wrapper with store wiring
│   │   ├── useChartInit.ts   # Custom hook for chart initialization
│   │   ├── FootprintCanvas.tsx # Custom canvas footprint renderer (Planned)
│   │   └── VolumeProfile.tsx # Horizontal volume bars (Planned)
│   ├── layout/               # General layout components
│   │   ├── Sidebar.tsx       # Sidebar for settings (Planned)
│   │   └── Toolbar.tsx       # Top toolbar (Planned)
│   └── ui/                   # Reusable UI components
│       ├── ConnectionStatus.tsx # Live connection indicator
│       ├── PairSelector.tsx     # Active pair switcher
│       └── TimeframeSelector.tsx# Active timeframe switcher
│
├── lib/                      # Business logic, state, and utilities
│   ├── aggregation/          # Trade aggregation logic
│   │   └── engine.ts         # AggregationEngine class
│   ├── feeds/                # Data adapters for WebSockets
│   │   ├── adapter.ts        # FeedAdapter interface (Data contract)
│   │   ├── binance.ts        # Binance WebSocket implementation
│   │   └── index.ts          # Active adapter export
│   ├── store/                # Zustand global state
│   │   └── chart.ts          # State for active pair, timeframe, candles, trades
│   └── utils/                # Helper functions
│       ├── aggregation.ts    # Trade -> footprint cell math
│       ├── delta.ts          # Delta calculation helpers (Planned)
│       └── format.ts         # Number formatting (Planned)
│
├── types/                    # TypeScript interfaces
│   ├── candle.ts             # OHLCV definitions
│   ├── footprint.ts          # Footprint data structures
│   └── trade.ts              # Individual trade tick definitions
│
├── tailwind.config.ts        # Design system constraints and tokens
└── package.json              # Project dependencies (lightweight-charts, zustand, etc.)
```

## Architecture & Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (Strict dark mode, custom color palette)
- **State Management:** Zustand (in-memory)
- **Data Layer:** Client-side WebSockets via `FeedAdapter` pattern
- **Charting:** `lightweight-charts` (Candles) + HTML5 Canvas (Footprint)
