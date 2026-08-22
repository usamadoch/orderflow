# OrderFlow Chart — Build Roadmap

Each phase discussed and built one at a time.

---

## Phase 1 — Project Shell
- Next.js init with TypeScript + Tailwind
- CSS variables wired up
- Font setup (Inter + JetBrains Mono)
- Dark base layout (root bg, sidebar placeholder, toolbar placeholder)
- Zustand store skeleton (pair, timeframe, candles array, trades array)

---

## Phase 2 — Binance Feed Adapter
- `FeedAdapter` interface finalized
- Binance WebSocket class (klines stream)
- Binance WebSocket class (aggTrades stream)
- Reconnection logic (exponential backoff)
- Connection status indicator in UI
- Store wired to live candle updates

---

## Phase 3 — Candlestick Chart
- `lightweight-charts` instance setup inside React
- OHLCV data piped from Zustand → chart series
- Live candle updates (last candle mutates, new candle appends)
- Pair selector wired (swap stream on change)
- Timeframe selector wired

---

## Phase 4 — Trade Aggregation Engine
- Raw `aggTrade` → price bucket logic
- Configurable bucket size (e.g. $10, $50, $100 per cell)
- Bid vs ask classification (`isBuyerMaker` flag)
- Per-candle footprint data structure built in memory
- Delta calculation (bid vol − ask vol) per candle

---

## Phase 5 — Footprint Canvas
- Canvas setup, sizing, pixel ratio handling
- Coordinate system (price → y, time → x)
- Footprint cell rendering (bid / ask columns per price level)
- Color intensity scaling (volume → opacity)
- Delta column alongside each candle
- Canvas synced with `lightweight-charts` scroll + zoom

---

## Phase 6 — Volume Profile
- Visible range detection (which candles are on screen)
- Aggregate volume per price level across visible range
- Horizontal bar rendering (right side of chart)
- POC line (Point of Control — highest volume level)
- VA High / VA Low (70% value area)

---

## Phase 7 — UI Polish
- Toolbar: pair selector, timeframe, bucket size input
- Sidebar: session stats (total delta, high vol levels)
- Keyboard shortcuts (timeframe switch, reset zoom)
- Settings panel (colors, bucket size, VA % threshold)

---

## Phase 8 — Historical Data Loading
- Binance REST klines integration
- Async backfill orchestration in `FeedProvider`
- Loading state UI overlay on chart
- `pushAllCandles` bulk state action
- Redraw synchronization between history and live feeds

---

## Not Building
- Alerts
- Multiple chart panes
- Any trade execution UI