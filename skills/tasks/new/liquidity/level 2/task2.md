# Liquidity Map — Level 2, Task 2 of 3
## Heatmap Rendering and Aging/Fading Logic

---

## Goal for This Task Only

Render the historical liquidity data as a heatmap on the canvas. Each price level gets a color intensity based on how much liquidity was present there over time. Older liquidity fades. Consumed and pulled liquidity display differently. This is the visual evolution from Level 1's current-state bands to a temporal heatmap.

Level 2 Task 1 must be complete before starting this.

---

## Heatmap Concept

The heatmap shows a vertical strip on the right side of the chart — separate from the volume profile strip but on the same side. Each horizontal row is a price bucket. The row's color intensity shows the peak liquidity that was ever resting at that level across all captured snapshots.

This gives a visual memory of where large orders have been sitting. Levels that consistently attract large orders show as persistent bright rows. Levels that were briefly touched show as faint marks.

Unlike Level 1 which only shows current state, the heatmap shows historical accumulation — where liquidity keeps returning, where it appeared once and vanished, and how recently it was active.

---

## Heatmap Strip Dimensions

The heatmap renders as a fixed-width strip immediately to the left of the volume profile strip.

- Default width: `60px` — narrower than profile, it is supporting context
- Add `liquidityHeatmapWidth: number` to store, default `60`, range `30–120`
- This width is reserved from the drawable chart area — same as `PROFILE_WIDTH` and `deltaProfileWidth`
- Update `buildCoordinates` to include `liquidityHeatmapWidth` in the total reserved right-side space when heatmap is enabled

Position in the right-side layout (right to left from price axis):
```
[price axis] [profile] [delta profile] [heatmap] [chart content]
```

---

## Building the Heatmap Data

**File:** `lib/liquidity/heatmap.ts`

### `buildHeatmapRows(liquidityHistory, visiblePriceMin, visiblePriceMax, bucketSize)`

Takes the full `LiquidityHistory` and the current visible price range.

Returns `HeatmapRow[]` — one row per price bucket in the visible range.

```ts
interface HeatmapRow {
  price:        number
  side:         'bid' | 'ask' | 'both'    // which side had liquidity here
  peakQty:      number                     // highest qty ever seen at this level
  currentQty:   number                     // qty in most recent snapshot (0 if gone)
  ageScore:     number                     // 0–1, 1 = oldest, 0 = newest
  behavior:     LiquidityBehavior          // from getLiquidityBehavior()
  intensity:    number                     // 0–1, scaled against global peak
}
```

**Steps:**
1. For each price bucket in visible range, call `liquidityHistory.getPriceHistory(price, side)` for both bid and ask
2. Call `getLiquidityBehavior(priceHistory)` to get behavioral classification
3. Find global `maxPeakQty` across all rows — used to normalize `intensity`
4. `intensity = Math.sqrt(row.peakQty / maxPeakQty)` — sqrt normalization same as volume profile

Called once per redraw when heatmap is enabled. Iterates all visible price buckets — typically 50–150 rows. Fast enough for inline computation.

---

## Draw Function

**File:** `lib/draw/drawLiquidityHeatmap.ts`

### `drawLiquidityHeatmap(ctx, heatmapRows, priceToY, stripX, stripWidth, bucketSize, settings)`

`stripX` = the left edge of the heatmap strip in pixels.

For each `HeatmapRow`:

**Compute row bounds:**
```
topY    = priceToY(row.price + bucketSize)
bottomY = priceToY(row.price)
height  = Math.max(1, bottomY - topY)
```

**Color selection:**
- Bid-side liquidity (below price, buyers): base color `#26A69A` — teal
- Ask-side liquidity (above price, sellers): base color `#EF5350` — red
- If both sides had significant liquidity at this level: use a neutral `#F0B90B` amber — indicates contested zone

**Intensity and aging:**

Final opacity = `row.intensity * (1 - row.ageScore * ageFadeFactor) * settings.heatmapOpacity`

Where:
- `row.intensity` — normalized peak qty (0–1)
- `row.ageScore` — 0 = recent, 1 = oldest visible. Older rows fade.
- `ageFadeFactor` — user configurable, default `0.6`. At 0.6, the oldest row renders at 40% of its intensity.
- `settings.heatmapOpacity` — master opacity, default `0.7`

Minimum rendered opacity: `0.04` — so even old, small levels are faintly visible rather than disappearing completely.

**Draw the row:**
`ctx.fillStyle = hexToRgba(color, finalOpacity)`
`ctx.fillRect(stripX, topY, stripWidth, height)`

---

## Behavioral Overlays

On top of the base heatmap fill, draw small overlay indicators for classified behaviors.

### Pulled liquidity
Rows where `behavior.wasPulled === true`:
- Draw a small `×` or diagonal cross at the right edge of the row
- Color: `#FF9800` orange — distinct warning color
- Size: `6×6px` centered vertically in the row
- Only draw if `height >= 6`

### Consumed liquidity
Rows where `behavior.wasConsumed === true`:
- Draw a small filled circle on the right edge
- Color: `#8A8A8A` muted gray — consumed means gone, neutral
- Radius: `3px`
- Only draw if `height >= 6`

### Persistent liquidity (appeared in >70% of snapshots)
`behavior.appearances / liquidityHistory.snapshots.length > 0.7`:
- Draw a thin left-edge stroke on the row — `2px wide`, full row height
- Color: same as the row's base color at full opacity
- This highlights levels that consistently have a large order resting — a real wall, not a fleeting order

---

## Fading and Aging

The heatmap should visually communicate recency. Recent liquidity appears bright. Old liquidity fades.

`ageScore` is computed in `getLiquidityBehavior` based on when the level was first seen relative to the total history window.

The fade is baked into the opacity formula above. No animation needed — on every redraw, rows are painted with their current age-weighted opacity.

When a level completely disappears from the orderbook (current qty = 0), its historical intensity still renders but its `ageScore` approaches 1 quickly — it fades toward the minimum opacity over the next few snapshots.

Implement `ageScore` decay: if `currentQty === 0`, increment the effective age by `1 / maxSnapshots` per snapshot until it reaches 1.0. This means a disappeared level fully fades after `maxSnapshots` candles — consistent with the history window.

---

## Interaction With Level 1 Live Zones

Level 1 and Level 2 can coexist. When both are enabled:
- Level 2 heatmap renders in its dedicated right-side strip — separate from the chart content
- Level 1 live zones render as horizontal bands across the full chart width — behind candles

They do not visually overlap or conflict. The heatmap is on the right side, the live bands are across the chart.

The heatmap shows history. The live bands show current state. Together they give both temporal context and current positioning.

---

## Draw Order

```
1. drawGrid
2. drawLiquidity (Level 1 bands)
3. drawLiquidityHeatmap (Level 2 strip)    ← new, before sessions
4. drawSessions
5. ...rest unchanged
```

The heatmap strip is on the right side and does not overlap the chart content area, so draw order relative to candles does not technically matter — but place it early for consistency.

---

## Settings Panel

**File:** `components/ui/SettingsPanel.tsx`

Add to or extend the `LIQUIDITY MAP` section:

```
LIQUIDITY HEATMAP
  Show heatmap         [toggle]
  Heatmap opacity      [slider]   70%
  Age fade factor      [slider]   60%
  Strip width          [slider]   60px
  Show pulled markers  [toggle]
  Show consumed markers [toggle]
  Show persistence bar  [toggle]
```

- Age fade factor slider: range 0–100%, default 60%. At 0% no fading — all rows same opacity regardless of age. At 100% oldest rows are nearly invisible.
- All toggles persist.

---

## How to Verify This Task is Done

Wait for at least 10 candles to close so the history has meaningful data.

Visual checks:
- A heatmap strip appears to the right of the chart content, left of the volume profile
- Rows at price levels near current price are brighter than rows further away
- After scrolling the history or waiting, older rows visibly fade relative to recent ones
- Pulling the minimum liquidity threshold lower in Level 1 settings makes the heatmap denser

Behavioral marker checks (may need to wait longer or observe during active market):
- Find a price level where a large order disappeared without price reaching it → pulled marker (`×`) appears on that row
- Find a price level that price traded through → consumed marker (dot) appears

Settings:
- Toggle heatmap off — strip disappears, chart content expands
- Adjust age fade factor to 0% — all rows same brightness
- Adjust to 100% — strong gradient from bright (recent) to nearly invisible (old)

Do not proceed to Task 3 until the heatmap renders correctly and behavioral markers appear.