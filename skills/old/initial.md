# OrderFlow Chart — Project Bootstrap

---

## App Goal

Personal, minimal order flow charting tool for learning market microstructure.
Fetches live market data (Binance initially), renders candlestick + footprint charts, volume profile.
No trading. No accounts. No backend. Pure data visualization.

Eventually extendable to forex and futures pairs via adapter swap.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | Familiar, good for config UI pages |
| Language | TypeScript | Strict mode on |
| Charting (OHLCV) | `lightweight-charts` v4 (TradingView OSS) | Battle-tested, performant, minimal |
| Charting (Footprint) | Custom HTML5 Canvas | No lib does this well enough |
| State | Zustand | Minimal, no boilerplate |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Data | Binance WebSocket API | Free, no key needed for market data |
| Package Manager | pnpm | Faster, disk-efficient |

---

## Design Constraints

### Dark Mode Only

No light mode. Period.

**Color palette:**

```
Background (base):     #0D0D0D   — near-black, not pure black
Surface (panels):      #141414   — cards, sidebars
Border:                #1F1F1F   — subtle separators
Muted text:            #4A4A4A   — labels, timestamps
Secondary text:        #8A8A8A   — axis values
Primary text:          #E8E8E8   — main readable content

Bullish (bid):         #26A69A   — teal-green (TradingView standard)
Bearish (ask):         #EF5350   — muted red
Delta positive:        #00897B
Delta negative:        #C62828

Accent (UI):           #3D7EFF   — blue, for active states, focus rings
```

**Fonts:**

These platforms (TradingView, Bookmap, DeepCharts) use monospace or semi-condensed for numbers — critical for column alignment in footprint cells.

```
Numbers / Data:   "JetBrains Mono" or "IBM Plex Mono"  — monospaced, clean
UI Labels:        "Inter" or "DM Sans"                  — readable at small sizes
```

Install via Google Fonts or `next/font`.

---

## Technical Constraints

- **No backend** — all data via client-side WebSocket
- **No auth** — local tool, no users
- **No database** — in-memory only, data does not persist between sessions
- **No trading** — read-only market data
- **Browser only** — no Electron, no mobile concern
- **Single currency at a time** — one active pair, one active timeframe
- **Binance-first** — other feeds come later via adapter pattern

---

## Features (Scope)

### In Scope (MVP)

- [ ] Candlestick chart — live updating via klines stream
- [ ] Footprint chart — bid/ask volume per price level per candle
- [ ] Volume profile — horizontal bar, visible range
- [ ] Delta column — per candle net delta (bid vol − ask vol)
- [ ] Pair selector — BTC/USDT, ETH/USDT to start
- [ ] Timeframe selector — 1m, 5m, 15m, 1h
- [ ] Aggregation size config — price bucket size for footprint
- [ ] Connection status indicator

### Explicitly Out of Scope

- Order placement / trading
- Alerts or notifications
- Historical data beyond what fits in memory
- Multiple charts / layouts
- Custom indicators
- User accounts or settings persistence

### Future (Not Now)

- Forex pairs via OANDA adapter
- Gold / index futures via Databento adapter
- Heatmap / order book depth visualization

---

## Folder Structure

```
/
├── app/
│   ├── layout.tsx              # Root layout, font setup, dark bg
│   ├── page.tsx                # Main chart view
│   └── globals.css             # Tailwind base + CSS vars
│
├── components/
│   ├── chart/
│   │   ├── CandleChart.tsx     # lightweight-charts wrapper
│   │   ├── FootprintCanvas.tsx # Custom canvas footprint renderer
│   │   └── VolumeProfile.tsx   # Horizontal volume bars
│   ├── ui/
│   │   ├── PairSelector.tsx
│   │   ├── TimeframeSelector.tsx
│   │   └── ConnectionStatus.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       └── Toolbar.tsx
│
├── lib/
│   ├── feeds/
│   │   ├── adapter.ts          # FeedAdapter interface (the contract)
│   │   ├── binance.ts          # Binance WebSocket implementation
│   │   └── index.ts            # Active adapter export
│   ├── store/
│   │   └── chart.ts            # Zustand store (pair, tf, candles, trades)
│   └── utils/
│       ├── aggregation.ts      # Trade → footprint cell math
│       ├── delta.ts            # Delta calculation helpers
│       └── format.ts           # Number formatting (price, volume)
│
├── types/
│   ├── candle.ts
│   ├── trade.ts
│   └── footprint.ts
│
├── public/
└── ...config files
```

---

## Feed Adapter Interface

The one abstraction that makes future data sources swappable:

```ts
// lib/feeds/adapter.ts

export interface Candle {
  time: number        // unix seconds
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Trade {
  time: number
  price: number
  quantity: number
  isBuyerMaker: boolean   // false = aggressive buy, true = aggressive sell
}

export interface FeedAdapter {
  subscribeCandles(pair: string, timeframe: string, cb: (candle: Candle) => void): void
  subscribeTrades(pair: string, cb: (trade: Trade) => void): void
  disconnect(): void
}
```

All chart components consume `FeedAdapter`. Switching Binance → OANDA means writing one new class, touching zero chart code.

---

## Environment Setup

### Prerequisites

- Node.js 18+
- pnpm (`npm i -g pnpm`)

### Init

```bash
pnpm create next-app@latest orderflow --typescript --tailwind --app --no-src-dir
cd orderflow
```

### Dependencies

```bash
# Core
pnpm add lightweight-charts zustand

# Dev / Types
pnpm add -D @types/node
```

No other runtime dependencies needed for MVP.

### next.config.ts

```ts
const nextConfig = {
  reactStrictMode: true,
}

export default nextConfig
```

### Tailwind dark mode

In `tailwind.config.ts`:

```ts
export default {
  darkMode: 'class',
  // ...
}
```

In `app/layout.tsx`:

```tsx
<html lang="en" className="dark">
```

### CSS Variables

In `app/globals.css`:

```css
:root {
  --bg-base:     #0D0D0D;
  --bg-surface:  #141414;
  --border:      #1F1F1F;
  --text-muted:  #4A4A4A;
  --text-dim:    #8A8A8A;
  --text-main:   #E8E8E8;
  --bull:        #26A69A;
  --bear:        #EF5350;
  --accent:      #3D7EFF;
}
```

---

## What This Doc Does Not Cover

- Footprint rendering logic (next)
- WebSocket reconnection strategy (next)
- Aggregation algorithm detail (next)
- Canvas coordinate math (next)

Those come when we start building each piece.
