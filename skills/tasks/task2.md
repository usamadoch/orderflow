# Phase 3 — Candlestick Chart

---

## Goal

Render a live candlestick chart using `lightweight-charts`.
Feed it candles from Zustand. Handle live mid-candle updates correctly.
Pair and timeframe selectors already built in Phase 2 — they just work here automatically via the store.

---

## Important Constraint

`lightweight-charts` is an imperative library. It creates and mutates a chart instance directly on a DOM node. It does not work like a React component — you cannot just re-render it with new props.

Rule: **create the chart instance once, update it imperatively forever after.**
Never destroy and recreate the chart on candle updates.

---

## 1. Install

```bash
pnpm add lightweight-charts
```

Current stable: v4. Do not use v3 — API is different.

---

## 2. File Structure for This Phase

```
components/
└── chart/
    ├── ChartContainer.tsx    — outer layout, sizing, dark background
    ├── CandleChart.tsx       — chart instance, series, data wiring
    └── useChartInit.ts       — custom hook, isolates chart setup logic
```

Keep the chart logic out of the component body as much as possible.
`CandleChart.tsx` should be mostly wiring. The hook does the heavy lifting.

---

## 3. ChartContainer Component

**File:** `components/chart/ChartContainer.tsx`

Purely a layout wrapper. No chart logic here.

### What it does
- Renders a `div` that fills available space (full width, full height minus toolbar)
- Sets background to `#0D0D0D` — must match the chart's background color exactly or you get a seam
- Renders `<CandleChart />` inside it
- This separation matters later — footprint canvas and volume profile will be siblings inside this container

---

## 4. useChartInit Hook

**File:** `components/chart/useChartInit.ts`

Takes a `ref` pointing to the container `div`. Returns the chart instance and the candlestick series instance.

### What it takes
- `containerRef` — a `RefObject<HTMLDivElement>` — the DOM node to mount the chart into

### What it does
- Runs once on mount inside a `useEffect`
- Calls `createChart(containerRef.current, options)` from `lightweight-charts`
- Chart options to set:
  - `width` and `height` from the container's `offsetWidth` / `offsetHeight`
  - `layout.background` — type `ColorType.Solid`, color `#0D0D0D`
  - `layout.textColor` — `#8A8A8A`
  - `grid.vertLines.color` and `horzLines.color` — `#1F1F1F`
  - `crosshair.mode` — `CrosshairMode.Normal`
  - `timeScale.borderColor` — `#1F1F1F`
  - `rightPriceScale.borderColor` — `#1F1F1F`
- After chart is created, calls `chart.addCandlestickSeries()` with:
  - `upColor` — `#26A69A`
  - `downColor` — `#EF5350`
  - `borderVisible` — `false`
  - `wickUpColor` — `#26A69A`
  - `wickDownColor` — `#EF5350`
- Stores both chart and series in refs (not state — state would trigger re-renders)
- Sets up a `ResizeObserver` on the container — on resize, calls `chart.applyOptions({ width, height })` so the chart fills correctly
- On cleanup (unmount): disconnects the ResizeObserver, calls `chart.remove()`

### What it returns
- `chartRef` — ref holding the chart instance
- `seriesRef` — ref holding the candlestick series instance

---

## 5. CandleChart Component

**File:** `components/chart/CandleChart.tsx`

This is where the hook and the store data meet.

### What it does

**Setup:**
- Creates a `containerRef` and passes it to `useChartInit`
- Gets back `seriesRef` (the candlestick series)
- Reads `candles` from Zustand store

**Initial data load — `useEffect` on `[candles.length === 0 → candles populated]`:**
- When `candles` first fills (pair just connected, first batch of candles arrive), call `series.setData(candles)`
- `setData` replaces all chart data at once — use this only on initial load or pair/timeframe swap
- The candles array from the store is already in the shape lightweight-charts expects (`{ time, open, high, low, close }`) — volume is not used by this series

**Live update — `useEffect` on last candle:**
- Watch only the last item in `candles` array — `candles[candles.length - 1]`
- On change, call `series.update(lastCandle)`
- `update()` is the key method — if the candle's `time` already exists in the series, it mutates it in place. If it's a new `time`, it appends. This is exactly the behavior the store's `pushCandle` mirrors.
- Never call `setData` here — it resets the entire chart including scroll position

**Pair/timeframe change:**
- When `pair` or `timeframe` changes in the store, the store clears `candles` to `[]`
- Watch for `candles.length === 0` — when it hits zero, call `series.setData([])` to clear the chart
- New candles will arrive from the feed and the initial load effect will fire again

### What it renders
- Just the `containerRef` div — the chart library owns the DOM inside it

---

## 6. Data Shape Note

`lightweight-charts` candlestick series expects:

```ts
{
  time:  number   // unix seconds — matches what the store holds
  open:  number
  high:  number
  low:   number
  close: number
}
```

The `Candle` type from Phase 2 has extra fields (`volume`, `isClosed`) — that is fine. Pass the object as-is; lightweight-charts ignores unknown fields.

One rule: **data passed to `setData` must be sorted oldest → newest by `time`.** The store already maintains this order.

---

## 7. How Pair/Timeframe Selectors Wire In

Nothing extra needed in this phase. The selectors from Phase 2 call `setPair` / `setTimeframe` on the store. That clears candles. `FeedProvider` re-subscribes. New candles arrive. The chart clears and refills automatically.

The only thing `CandleChart` must do is react to `candles.length === 0` and clear the series — otherwise stale candles from the previous pair stay visible during the brief reconnection window.

---

## 8. ResizeObserver — Why It Matters

Browsers do not automatically resize canvas elements. If the window resizes and the chart is not told, it renders at the original size and clips or leaves empty space.

The `ResizeObserver` in `useChartInit` watches the container div. On any size change it calls `chart.applyOptions({ width: newWidth, height: newHeight })`. This keeps the chart filling its container at all times.

---

## 9. What Not To Do

- Do not store the chart instance in React state — causes re-renders that fight with the library
- Do not call `setData` on every candle update — resets scroll position every second
- Do not recreate the chart on pair change — clear the series data instead, keep the instance
- Do not hardcode chart width/height — always read from the container element

---

## Completion Checklist

```
components/chart/
├── ChartContainer.tsx     — layout wrapper, dark bg, full size
├── CandleChart.tsx        — store wiring, setData vs update logic
└── useChartInit.ts        — chart + series creation, ResizeObserver, cleanup

Behavior:
├── Chart mounts once, never recreated
├── Live candle updates without scroll reset
├── Pair swap clears and refills chart cleanly
├── Timeframe swap same as pair swap
└── Chart fills container on window resize
```

---

## What This Phase Does Not Cover

- Footprint cells overlaid on candles — Phase 5
- Volume profile sidebar — Phase 6
- Historical candle backfill via Binance REST (optional — discuss before Phase 4)