# Phase 5 — Footprint Canvas (Draw Mode)

---

## Goal

Integrate footprint rendering into the **same single canvas** built in Phase 3.
There is no "overlay" canvas. The footprint is simply an alternative draw mode for the candlestick chart.

---

## 1. File Structure

```
components/chart/
└── drawFootprint.ts         — footprint cell draw function
lib/store/chart.ts           — add chartMode state
```

---

## 2. Mode Toggle

A single `chartMode` value in the Zustand store: `"candle" | "footprint"`.

- UI renders a toggle button.
- On change: update store, trigger canvas redraw.
- No remounting, no canvas teardown. The `ChartCanvas.tsx` render loop just checks `chartMode` and calls `drawFootprint` instead of (or alongside) `drawCandles`.

---

## 3. Footprint Draw Mode (drawFootprint.ts)

Uses the exact same `indexToX` and `priceToY` as candlestick mode. No new coordinate logic.

For each visible candle:
1. Get `FootprintCandle` from aggregation engine by `candle.time`
2. If empty (no trades yet), render a simple wick so price action is still visible.
3. Find max volume across all visible cells first (for opacity scaling).
4. For each price bucket in `footprintCandle.cells`:
   - `y = priceToY(bucketPrice + bucketSize)` (top of row)
   - `rowHeight = priceToY(bucketPrice) - y`
   - `x = indexToX(i) - barWidth / 2` (left edge of candle column)
   - Draw left half (bid vol) and right half (ask vol) with opacity scaling.
5. Draw delta label per candle (below low or in bottom strip).
6. Optionally draw a thin OHLC wick behind the cells.

### Opacity Scaling
- Max volume is found across all visible cells.
- Bid half fill: `rgba(239, 83, 80, opacity)`
- Ask half fill: `rgba(38, 166, 154, opacity)`
- Minimum opacity: `0.08`

---

## 4. Syncing & Redraws

- Because everything shares one canvas and coordinate system, pan/zoom is instantly perfectly synced.
- The aggregation engine data must trigger throttled redraws (e.g. 100ms) when new footprint volume arrives.

---

## Completion Checklist

- `chartMode` added to store and UI
- `drawFootprint` rendering bid/ask cells using Phase 3 coordinates
- Opacity scaling relative to visible max volume
- Delta column rendered
- Throttled redraws on live trade updates