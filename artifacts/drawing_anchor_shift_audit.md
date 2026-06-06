# Drawing Anchor Shift Audit

## 1. Current drawing anchor model

Drawings use a mixed anchor model:

- Price-only anchors are stored as prices. A normal horizontal line stores `DrawnLine.value` as a price and renders only through `priceToY`.
- Time/candle anchors are stored as candle array indices, not timestamps. `DrawnLine.value` stores the candle index for vertical lines, `DrawnLine.startIndex` stores the start candle index for horizontal rays, and `DrawnLine.firstIndex` / `lastIndex` store box candle bounds (`lib/store/chart.ts:112`).
- Custom Volume Profile selections use the same index model. `customProfileRange` stores `firstIndex`, `lastIndex`, `priceHigh`, and `priceLow`; it does not store selected candle times (`lib/store/chart.ts:152`).
- Drawing creation converts mouse x pixels to the current candle index with `xToIndex(...)` and persists that index (`components/chart/ChartCanvas.tsx:1063`, `components/chart/ChartCanvas.tsx:1066`, `components/chart/ChartCanvas.tsx:1596`, `components/chart/ChartCanvas.tsx:1649`).
- Rendering converts saved indices back to pixels with `indexToX(...)` (`components/chart/drawLines.ts:45`, `components/chart/drawLines.ts:62`, `components/chart/drawLines.ts:86`, `components/chart/drawSelectionRect.ts:31`, `components/chart/drawSelectionRect.ts:89`).
- `timeToIndex(...)` exists in `components/chart/useCoordinates.ts:105`, but it is used for synced crosshair time lookup, not as the persisted drawing anchor model.

The x-coordinate formula is index-relative to the current candle array length:

```ts
drawableWidth - barWidth / 2 - (candlesLength - 1 - candleIndex) * barWidth + scrollOffset
```

This means a persisted index is interpreted as "whatever candle is currently at this array position", not "the candle with this original timestamp" (`components/chart/useCoordinates.ts:71`).

## 2. Affected drawing types

Affected:

- Vertical lines: `value` is a candle index and renders via `indexToX(line.value)`.
- Horizontal rays: price is stable, but the ray start is `startIndex`, so the horizontal start point can drift.
- Boxes/rectangles: `firstIndex` and `lastIndex` are candle indices.
- Custom Volume Profile selections: `customProfileRange.firstIndex` / `lastIndex` define both the drawn rectangle and the candle slice used for profile calculation.
- Custom profile React overlay controls and delta profile placement: both derive x from the same saved indices (`components/chart/ChartCanvas.tsx:597`, `components/chart/ChartCanvas.tsx:1003`).

Mostly not affected:

- Plain horizontal lines: current model stores only a price in `value`, so there is no candle/time x anchor to drift.
- Pure pixel-live drag previews before mouse release: while actively dragging, raw pixels are used temporarily. Drift begins after the drag is committed into index fields.

## 3. Root cause

The exact root cause is persisted candle-index anchoring combined with rolling candle retention.

Candles are merged by timestamp, sorted ascending, and capped to the newest 500 candles in the Zustand store (`lib/store/chart.ts:591`, `lib/store/chart.ts:614`). The shared candle cache uses the same merge/sort/cap pattern. Live candle updates enter the panel through `pushCandle`, and full cache snapshots enter through `pushAllCandles` (`lib/store/chart.ts:1035`, `lib/store/chart.ts:1041`; `components/FeedProvider.tsx:871`, `components/FeedProvider.tsx:1531`).

Before the 500-candle cap is reached, appending a new candle increases `candles.length`. A saved index still names the same array element, and the whole chart geometry moves relative to the right edge as expected.

After the 500-candle cap is reached, each new candle drops the oldest candle via `.slice(-500)`. That shifts every surviving candle one array slot lower:

- candle at old index `101` becomes index `100`
- saved drawing anchor remains `101`
- index `101` now refers to the next newer candle

So the drawing stays bound to the numeric index, not to the original candle time. Visually, it appears to move one candle to the right relative to the original candle on every capped append. Custom Volume Profile has the same failure because it stores `firstIndex` / `lastIndex` and builds the profile from `candles.slice(customFirstIndex, customLastIndex + 1)` (`components/chart/ChartCanvas.tsx:558`). After an index drift, the selected time window and the calculated profile both slide to newer candles.

This is not a pixel-position bug. Pixel positions are recalculated every render from saved chart coordinates. The unstable part is that the saved chart coordinate for x is a mutable array index.

## 4. Recommended smallest fix

Smallest durable fix: store time anchors for every drawing that needs a candle/time x-position, then resolve those times to current indices only at render and interaction time.

Recommended model:

- Add timestamp fields beside the current index fields first for migration compatibility:
  - vertical line: `time`
  - horizontal ray: `startTime`
  - box: `firstTime`, `lastTime`
  - custom profile: `firstTime`, `lastTime`
- On drawing creation, use the selected index only to read `candles[index].time`, then persist the timestamp.
- On render, convert timestamp to the current index with `timeToIndex(time, candles)` or a stricter exact/nearest lookup, then pass that transient index into existing `indexToX`.
- For custom profile calculation, slice by timestamp range instead of stale index range.
- Keep existing index fields as fallback for old persisted drawings, but prefer timestamps whenever present.

This avoids changing the chart's pan/zoom coordinate system and limits the fix to drawing data shape, creation, rendering, hit testing, and custom profile slicing. It also survives candle append, history restore, deduplication, and rolling retention as long as the anchored candle time is still present in the retained candle window. If the anchored time falls outside retention, the drawing should be skipped or rendered as out-of-range rather than silently rebinding to a different candle.
