# Iceberg Detection — Task 2 of 2
## Visual Markers, Tooltip, and Settings

---

## Goal for This Task Only

Render iceberg level markers on the canvas. Show a hover tooltip explaining the detection. Add toolbar controls and settings panel section. Connect to the absorption engine for cross-signal context.

Task 1 must be complete and logging correct results before starting this.

---

## How Iceberg Markers Differ From Absorption and Exhaustion

Absorption markers are circles placed on individual candles — they are candle-specific events.
Exhaustion markers are dashes near candle highs/lows — they are also candle-specific.

Iceberg markers are different — they are **price level markers**, not candle markers. They run horizontally across the chart at the defended price level, spanning the candle range where the defense was detected.

This is the right visual treatment because an iceberg is a price-level phenomenon across multiple candles, not a single-candle event.

---

## Marker Design

### Horizontal defense line

A horizontal line at `priceToY(level.price + bucketSize / 2)` — the center of the defended bucket.

- Spans from `indexToX(windowStartIndex)` to `indexToX(windowEndIndex)` — the candle range where the iceberg was detected
- Line weight: `1.5px`
- Style: dashed `[6, 3]` for `suspected`, solid for `probable`, double solid for `confirmed`
- Color:
  - `bid_defense` (support being defended): `#26A69A` teal
  - `ask_defense` (resistance being defended): `#EF5350` red

### Rank scaling

- `suspected (35–55)`: opacity `0.4`, dashed line only, no label
- `probable (55–75)`: opacity `0.65`, dashed line, small label
- `confirmed (75–100)`: opacity `0.9`, solid line, label, end caps

### End caps (confirmed only)

At the right end of the line (most recent candle), draw a small vertical tick mark:
- Height: `bucketSize` in pixels — same as the row height
- Width: `2px`
- Same color and opacity as the line
- Visually closes the right edge of the defended zone

### Label (probable and confirmed)

Small text placed at the right end of the line, above it:
- `ICE` for probable
- `ICE 82` (score) for confirmed
- Font: `JetBrains Mono`, `9px`
- Color: same as line
- Only render when `barWidth >= 10` — too zoomed out and labels overlap

### Background tint (confirmed only)

For confirmed levels, draw a very subtle filled rectangle spanning the entire bucket height across the detected candle range:
- `topY = priceToY(level.price + bucketSize)`
- `bottomY = priceToY(level.price)`
- Fill: `rgba(color, 0.04)` — barely visible, just enough to highlight the zone

---

## Draw Function

**File:** `lib/draw/drawIceberg.ts`

### `drawIceberg(ctx, icebergLevels, candles, indexToX, priceToY, barWidth, bucketSize, settings)`

For each `IcebergLevel`:
- If score < `settings.icebergMinScore`: skip
- Compute `windowStartIndex` and `windowEndIndex` — these are stored on the level (the candle range where detection occurred). If not stored, derive them from `level.detectedAt` and `icebergLookback`.
- Get `x1 = indexToX(windowStartIndex)` and `x2 = indexToX(windowEndIndex)` — skip if either is null
- Get `y = priceToY(level.price + bucketSize / 2)`
- Determine style from `level.rank`
- Draw background tint (confirmed only)
- Draw the horizontal line
- Draw end cap (confirmed only)
- Draw label (probable and confirmed, when wide enough)
- If `level.provisional`: apply `0.5` opacity multiplier to everything — iceberg based on unclosed candle data is uncertain

---

## Draw Order

```
1.  drawGrid
2.  drawLiquidity
3.  drawLiquidityHeatmap
4.  drawSessions
5.  drawLines
6.  drawSelectionHighlight
7.  drawCandles OR drawFootprint
8.  drawBubbles
9.  drawAbsorption
10. drawExhaustion
11. drawIceberg             ← new, after exhaustion
12. drawLiquiditySignals
13. drawMeasurementRect
14. drawCustomProfile
15. drawVolumeProfile
16. drawAxes
```

Iceberg lines render on top of candles so they are clearly visible. They render before liquidity signals so liquidity markers paint on top in case they coincide at the same price level.

---

## Hover Tooltip

**File:** `components/chart/IcebergTooltip.tsx`

Same architecture as absorption and exhaustion tooltips — HTML overlay div, `position: fixed`, `pointer-events: none`.

### Hover detection

In `ChartCanvas` `onMouseMove`, check if cursor is within `8px` vertically of any iceberg level's `y` position AND within the `x1` to `x2` horizontal range of that level. Both conditions must pass — horizontal lines need a 2D hit test, not just proximity to a point.

Set `hoveredIceberg: IcebergLevel | null` in local state.

### Tooltip content

```
┌────────────────────────────────┐
│  BID DEFENSE — ICEBERG         │
│  Score: 72  ◈◈◈                │
│  $64,500  |  10 candles        │
│                                │
│  ✓ Volume 4.2× average         │
│  ✓ 78% ask-dominant            │
│  ✓ Price visited 9/10 candles  │
│  ✓ Delta near-neutral (0.91)   │
│  ✓ Stable volume (CV: 0.28)    │
│                                │
│  Total volume:  184.3 BTC      │
│  Avg per candle: 18.4 BTC      │
│  Cumulative Δ:  +8.2           │
└────────────────────────────────┘
```

- Title: `BID DEFENSE — ICEBERG` or `ASK DEFENSE — ICEBERG`
- Title color: teal for bid defense, red for ask defense
- Rank diamonds: 3 total — same convention as exhaustion
- Price and candle count
- Reason lines with `✓` prefix
- Stats block at bottom: total volume, average per candle, cumulative delta
- Font: `JetBrains Mono`, 11px
- Width: 240px — slightly wider than other tooltips due to stats block
- Position: above the line if space allows, below if near top edge

---

## Connection to Absorption Engine

When an absorption signal exists on a candle that falls within an iceberg's detected range and price level, visually reinforce the connection.

In `drawIceberg`, after drawing the main line: check the `absorptionMap` for any candle within the window range where the absorption marker is near the iceberg's price level (within `2 × bucketSize`).

If found:
- Extend the iceberg line by `barWidth / 2` past `x2` as a short extension in the opposite color (amber `#F0B90B`) — a visual "handoff" from iceberg defense to absorbed candle
- This is subtle — just a short colored extension, not a new shape

This is optional. If it creates visual noise, skip it.

---

## Sidebar Integration

**File:** `components/ui/Sidebar.tsx`

Add to the existing signal stats area:

```
ICEBERG
  Active levels    4
  Confirmed        1
  Probable         2
  Last detected    12:38
```

- `Active levels`: count of `IcebergLevel` with `isActive === true`
- `Confirmed / Probable`: count by rank
- `Last detected`: timestamp of the most recently detected level, formatted `HH:MM`

---

## Settings Panel

**File:** `components/ui/SettingsPanel.tsx`

Add `ICEBERG` section after `EXHAUSTION`:

```
ICEBERG DETECTION
  Show iceberg levels      [toggle]   on
  Minimum score            [slider]   45
  Lookback window          [slider]   10 candles
  Show suspected           [toggle]   on
  Show labels              [toggle]   on
  Show background tint     [toggle]   on
```

- Minimum score slider: range 30–80, step 5
- Lookback window slider: range 5–20, step 1. On change: `icebergEngine.reset()` then re-run full analysis with new window
- `Show suspected`: when off, only `probable` and `confirmed` render — reduces visual noise
- `Show labels`: when off, no `ICE` text on any marker — clean line-only view
- `Show background tint`: when off, no fill rectangle on confirmed levels

All settings persisted.

---

## Toolbar

Add `ICE` button to the toolbar alongside absorption (`ABS`) and exhaustion (`EX`) toggles. Group all three under a `SIGNALS` label if not already done.

- Active: `#1F1F1F` background, `1px solid #3D7EFF` border
- Inactive: transparent, muted
- Maps to `icebergEnabled` toggle
- Keyboard shortcut: `K` (A = absorption, E = exhaustion used or reserved, K = iceberg)

---

## Complete Store Summary

```ts
icebergEnabled:  boolean         // default true, persisted
icebergMinScore: number          // default 45, persisted
icebergLookback: number          // default 10, persisted
icebergShowSuspected: boolean    // default true, persisted
icebergShowLabels:    boolean    // default true, persisted
icebergShowTint:      boolean    // default true, persisted
icebergLevels:   IcebergLevel[]  // session only, not persisted
```

---
