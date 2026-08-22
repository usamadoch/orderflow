# DeepCharts Volume Profile — Full Analysis & Implementation Gap Report

## Why Yours Looks Like Bars, Theirs Looks Like Shape

**Root cause — one sentence:**
DeepCharts auto-groups tick rows to match the pixel height of the visible price scale.
Your implementation does not.

When they have 800 potential tick rows across a 400px chart height,
they render ~100–200 rows automatically. Each row is 2–4px tall, no gaps, smooth shape.
When you have 800 rows across 400px at fixed 8t grouping,
you still get too many thin rows with visual gaps between them.
Shape never emerges because the row count is not coupled to viewport pixel height.

This is the single biggest fix. Everything else is secondary.

---

## DeepCharts Profile Types — Complete List

### A. By VBP Type (what data is shown)

| Type | What It Shows | Use Case |
|---|---|---|
| **Volume Profile** | Total traded volume per price level | Identify HVN/LVN, POC, D/P/b shape |
| **Ask/Bid Volume Profile** | Buy vs sell volume side by side per level | Imbalance at price levels, absorption |
| **Delta Profile** | Ask vol minus Bid vol per level | Net aggression per level, exhaustion |
| **Delta + Total Volume** | Delta left strip, total volume right strip | Both views simultaneously |
| **Delta Percentage** | Delta as % of total vol per level | Relative aggression strength |
| **Number of Trades** | Trade count not volume | Activity frequency, not size |

You currently have: Volume Profile and a separate Delta strip.
Missing: Ask/Bid split bars, Delta%, trade count mode.

---

### B. By VBP Period (what time range is profiled)

| Period | Behavior | Use Case |
|---|---|---|
| **Latest** | Only most recent N-period profile | Clean single session view |
| **Multiple** | One profile per period (daily, hourly, etc.) | Compare sessions side by side |
| **Composite** | Single profile for all loaded data | Long-term value area identification |
| **Visible** | Profile updates dynamically as you scroll/zoom | Active exploration mode |
| **Custom** | User draws a selection box | Specific range analysis |

You currently have: Custom (selection box) and a default attached profile.
Missing: Multiple (per-session), Composite, Visible (dynamic rebuild on scroll).

---

### C. Deep Profile Swing (separate indicator)

This auto-detects price swings and builds a volume profile for each swing automatically.
No manual selection needed. Uses swing detection algorithms:

- **Left Right Bar** — pivot bars N bars left and right
- **Highest Lowest** — new swing when price makes new high/low
- **Reversal Absolute** — fixed price reversal threshold
- **Reversal Tick** — tick-count-based reversal

Also supports VWAP within the swing:
draws the VWAP line for the duration of each swing alongside the profile.

This is an advanced feature. Not priority for now but good to know it exists.

---

## What Makes Theirs Look Visually Clean — Technical Breakdown

### 1. Auto Tick Grouping (most important)

DeepCharts calculates grouping dynamically:

```
visible price range in ticks ÷ visible chart height in pixels = ticks per pixel
target row height = 2–4 pixels
auto group ticks = ceil(ticks per pixel × target row height)
```

Result: row count always proportional to canvas height. Never sub-pixel rows.
As you zoom in, more rows appear. Zoom out, fewer rows, each taller. Always clean.

Your fix: implement this calculation and use it as the effective `profileBucketSize`.
The manual slider becomes a multiplier on top of auto grouping, not a fixed override.

---

### 2. Continuous Fill (no visual gaps)

Each row's height is calculated as exactly `priceToY(rowPrice) - priceToY(rowPrice + bucketSize)`.
Adjacent rows share the same Y coordinate boundary — no 1px gap between them.

If your renderer calculates height slightly differently (e.g., floor vs round),
adjacent rows leave hairline gaps that make the profile look sparse.

Check: `rowY + rowHeight` for row N should equal `rowY` for row N+1 exactly.

---

### 3. Opacity Encodes Volume Strength

DeepCharts does not use uniform opacity for all non-POC rows.
Bars that are closer to POC volume get higher opacity/brightness.
Low-volume rows are visually dimmer even if their width is correct.

This creates the visual gradient that makes shape pop.
Your current implementation: same opacity for all non-POC rows. Shape is flat.

Suggested formula:
```ts
const volumeRatio = row.totalVol / profile.maxVol; // 0.0 to 1.0
const minOpacity = 0.25;
const opacity = minOpacity + (1 - minOpacity) * volumeRatio;
// POC = 1.0, rows at 10% of POC = 0.32, not 1.0
```

---

### 4. Peak/Valley Detection with Sensitivity Slider

Their Peaks (HVN) and Valleys (LVN) detection has a sensitivity setting.
Higher sensitivity = fewer, more significant nodes marked.

Your current LVN detection: simple adjacent comparison, marks micro-valleys at fine resolution.
Missing: HVN detection entirely. Only POC is highlighted, no secondary peaks.

Improved approach:
- Smooth the row volume array with a moving average before detection
- Then find local maxima/minima on the smoothed array
- Sensitivity slider controls the smoothing window size

---

### 5. Min/Max Volume Filter

DeepCharts lets you filter the input data by order size.
Only trades above N contracts contribute to the profile.
This removes noise from tiny retail fills and shows only significant activity.

Your implementation: all trades contribute equally.
This is why at fine resolution, every micro-trade creates a row.

This filter would dramatically improve shape clarity,
especially for BTC spot/futures where there are thousands of tiny fills.

---

## Implementation Priority Order (your platform)

### Phase 1 — Fix the visual quality immediately (no new features)

1. **Auto tick grouping** — calculate optimal row height from viewport pixels.
   One calculation before `buildProfile()` is called. Biggest visual impact.

2. **Opacity gradient** — encode `row.totalVol / maxVol` into bar opacity.
   2-line change in `drawVolumeProfile.ts`. Immediate shape improvement.

3. **Continuous row fill** — verify no hairline gaps between adjacent rows.
   Check `rowY + rowHeight === nextRowY`. Fix rounding if not exact.

4. **Default to linear scaling** — SQRT as opt-in, not default.

---

### Phase 2 — Add missing profile modes

5. **Visible profile** — rebuild profile on scroll/zoom for visible candle range.
   High value for exploration. Moderate implementation complexity.

6. **Multiple profiles** — one profile per session/day, rendered side by side.
   Good for multi-day context. Requires period-splitting logic.

7. **Ask/Bid split bar** — render bid (left) and ask (right) in same row.
   Already have bid/ask data in footprint candles. Mainly a draw change.

8. **HVN detection** — find secondary peaks, not just POC.
   Smooth the row array, find local maxima above a threshold.

---

### Phase 3 — Advanced (later)

9. **Min/Max volume filter** — filter by minimum trade size.
10. **Delta %** profile type.
11. **Composite profile** — entire loaded history in one profile.
12. **Swing profile** — auto swing detection + profile per swing.

---

## Settings Theirs Has That Yours Does Not

| Setting | DeepCharts | Your Platform |
|---|---|---|
| Auto tick grouping | Yes (adapts to zoom) | No (fixed manual only) |
| Opacity per volume strength | Yes (implied by visual) | No (uniform) |
| Peak/Valley sensitivity slider | Yes | No |
| Min/Max order size filter | Yes | No |
| Session split (ETH/RTH) | Yes | No |
| Composite period | Yes | No |
| Visible range auto-rebuild | Yes | No |
| Delta % type | Yes | No |
| Trade count type | Yes | No |
| Swing auto-profile | Yes | No |
| Merge/Split profiles | Yes | No |
| Developing POC line | Yes | No |

---

## What To Give the Agent

For the Phase 1 fix, give the agent these specific tasks in one TASK.md:

**Task 1: Auto grouping**
> In `ChartCanvas.tsx` before calling `volumeProfileEngine.buildProfile()`,
> calculate `autoBucketSize` from visible price range and canvas pixel height.
> Use `autoBucketSize` as `profileBucketSize` when `profileResolutionTicks` is 0 or auto.
> Formula: `autoBucketSize = ceil((priceHigh - priceLow) / (canvasHeightPx / targetRowPx)) rounded to nearest tickSize`
> where `targetRowPx = 3`.

**Task 2: Opacity encoding**
> In `drawVolumeProfile.ts` and `drawSelectionRect.ts`,
> replace fixed opacity constant with `minOpacity + (1 - minOpacity) * (row.totalVol / profile.maxVol)`.
> Use `minOpacity = 0.2`. Apply same formula to both renderers.

**Task 3: Gap check**
> In `drawVolumeProfile.ts`, log `rowY + rowHeight` for row N and `rowY` for row N+1.
> Confirm they are equal. If not, fix the height calculation to use exact boundary sharing.