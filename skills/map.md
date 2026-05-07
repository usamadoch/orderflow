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
│   ├── ChartEngineContext.tsx# React context for AggregationEngine
│   ├── chart/                # Chart-specific components
│   │   ├── ChartCanvas.tsx   # Single canvas, owns setup + redraw loop
│   │   ├── useCoordinates.ts # Coordinate math (price-to-pixel, index-to-pixel)
│   │   ├── usePanZoom.ts     # Fixed-scale pan/zoom & persistent axis refs
│   │   ├── drawCandles.ts    # Candlestick draw function
│   │   ├── drawFootprint.ts  # Footprint cell draw function (w/ left-aligned candle)
│   │   ├── drawAxes.ts       # Dynamic price axis (1-2-5 series), time axis, grid lines
│   │   ├── drawPriceLine.ts  # Horizontal line at current market price
│   │   ├── drawCrosshair.ts  # TradingView-style crosshair and axis labels
│   │   └── VolumeProfile.tsx # Horizontal volume bars (Planned)
│   ├── layout/               # General layout components
│   │   ├── Sidebar.tsx       # Sidebar for settings (Planned)
│   │   └── Toolbar.tsx       # Top toolbar (Planned)
│   └── ui/                   # Reusable UI components
│       ├── ConnectionStatus.tsx # Live connection indicator
│       ├── PairSelector.tsx     # Active pair switcher
│       ├── TimeframeSelector.tsx# Active timeframe switcher
│       ├── ChartModeToggle.tsx  # Candle / Footprint mode toggle
│       └── BucketSizeInput.tsx  # Footprint bucket size config
│
├── lib/                      # Business logic, state, and utilities
│   ├── aggregation/          # Trade aggregation logic
│   │   └── engine.ts         # AggregationEngine class
│   ├── feeds/                # Data adapters for WebSockets
│   │   ├── adapter.ts        # FeedAdapter interface (Data contract)
│   │   ├── binance.ts        # Binance WebSocket implementation
│   │   └── index.ts          # Active adapter export
│   ├── store/                # Zustand global state
│   │   └── chart.ts          # State for active pair, timeframe, candles, trades, chartMode
│   └── utils/                # Helper functions
│       ├── aggregation.ts    # Trade -> footprint cell math
│       ├── canvas.ts         # HTML5 canvas rendering functions (w/ formatted footprint cells)
│       ├── delta.ts          # Delta calculation helpers (Planned)
│       └── format.ts         # Number formatting (Planned)
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
