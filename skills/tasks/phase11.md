# Volume Bubbles

---

## Goal

Render circles on the chart at candle positions where significant volume occurred. Bubble size and opacity reflect how much volume traded at that level. Color reflects whether it was buy or sell aggression. A toolbar control lets the user set the minimum volume threshold that triggers a bubble — filtering out noise and showing only the levels that matter.

---

## Concept

Each candle has a `FootprintCandle` with cells — each cell is one price bucket with `bidVol` and `askVol`. A bubble represents a single cell where the volume on one side (bid or ask) crosses the user-defined threshold. The bubble is placed at that price level on that candle.

This is different from the volume profile — the profile aggregates across candles horizontally. Bubbles are per-candle, per-price-level, showing where large activity happened inside a specific candle.

---

## What Determines a Bubble

For each cell in each visible footprint candle:

- If `askVol >= threshold` → render a buy bubble (teal) at that price level on that candle
- If `bidVol >= threshold` → render a sell bubble (red) at that price level on that candle
- If both sides cross threshold → render both, or render the dominant side only (configurable, see settings)
- If neither crosses threshold → no bubble

The threshold is the primary filter. Without it every cell gets a bubble and the chart becomes unreadable.

---

## Bubble Appearance

### Position
- X: `indexToX(i)` — same center x as the candle
- Y: `priceToY(bucketPrice + bucketSize / 2)` — center of the price bucket vertically
- Bubbles sit on top of the candle body / footprint cells

### Radius
- Scales with volume: `radius = minRadius + (vol / maxVol) * (maxRadius - minRadius)`
- `minRadius` — smallest bubble rendered when vol just hits threshold (default `4px`)
- `maxRadius` — largest bubble at the session's highest single-cell volume (default `20px`)
- `maxVol` is the highest single-side volume seen across all visible cells — same value already computed in `drawFootprint`, can be reused
- Both `minRadius` and `maxRadius` are user-configurable via settings (see below)

### Opacity
- Also scales with volume: `opacity = 0.4 + (vol / maxVol) * 0.5`
- Range: `0.4` (just above threshold) to `0.9` (session max)
- Never fully opaque — bubbles should feel like an overlay, not block the chart

### Color
- Buy bubble (ask aggression): `rgba(38, 166, 154, opacity)` — teal
- Sell bubble (bid aggression): `rgba(239, 83, 80, opacity)` — red
- Stroke: same color at full opacity, `1px`, gives a clean edge especially at low fill opacity

### Overlap Handling
- Bubbles from adjacent price levels on the same candle can overlap — this is acceptable and actually useful, dense clusters signal a high-activity zone
- Bubbles from adjacent candles at the same price do not overlap because x positions are distinct

---

## State and Settings

Add to Zustand store:

- `bubblesEnabled: boolean` — default `true`
- `bubbleThreshold: number` — minimum single-side volume to show a bubble, default `50`
- `bubbleMinRadius: number` — default `4`
- `bubbleMaxRadius: number` — default `20`
- `bubbleSide: 'both' | 'buy' | 'sell'` — which side to show, default `'both'`

Actions: `setBubblesEnabled`, `setBubbleThreshold`, `setBubbleMinRadius`, `setBubbleMaxRadius`, `setBubbleSide`

Persist all of these in the store's `partialize` — bubble settings should survive page refresh.

---

## Toolbar Control

Add a bubbles section to the main toolbar. Keep it compact — one toggle and one threshold input visible inline. Full radius controls go in the settings panel.

### Inline toolbar additions

**Enable/disable toggle**
- A small circle icon (matching the bubble visual) as a toggle button
- Active: icon filled teal, background `#1F1F1F`
- Inactive: icon outline only, muted
- Clicking toggles `bubblesEnabled`

**Threshold input**
- Only visible when `bubblesEnabled` is true
- Label: `VOL ≥`
- Number input bound to `bubbleThreshold`
- Debounced 300ms — do not redraw on every keystroke
- Min: `1`. No hard max — let the user filter aggressively if they want
- Width: 65px
- Font: `JetBrains Mono`, 12px

**Side selector**
- Three small buttons: `B` (buy), `S` (sell), `B+S` (both)
- Active: `#3D7EFF` background
- Inactive: transparent, muted
- Controls `bubbleSide`

---

## Settings Panel Additions

**File:** `components/ui/SettingsPanel.tsx`

Add a new section: `BUBBLES`

```
BUBBLES
  Show bubbles        [toggle]
  Volume threshold    [input]   50
  Side                [B] [S] [B+S]
  Min radius          [slider]  4px
  Max radius          [slider]  20px
```

- Min and max radius: sliders, range `2`–`40`
- Enforce `minRadius < maxRadius` — if user drags min above max, clamp it
- Preview would be nice but out of scope — just the sliders

---

## Draw Function

**File:** `lib/draw/drawBubbles.ts`

### `drawBubbles(ctx, candles, visibleRange, indexToX, priceToY, bucketSize, engine, settings)`

Parameters:
- `ctx` — canvas context
- `candles` — from store
- `visibleRange` — `{ firstIndex, lastIndex }` from coordinates
- `indexToX`, `priceToY` — coordinate functions
- `bucketSize` — from store
- `engine` — aggregation engine
- `settings` — object containing `bubbleThreshold`, `bubbleMinRadius`, `bubbleMaxRadius`, `bubbleSide`

### What it does

**Step 1 — Find `maxVol` across visible cells**
Same two-pass pattern as `drawFootprint`. Iterate all visible footprint candles, find the highest single-side volume. Used for radius and opacity scaling.

**Step 2 — Iterate visible candles**
For each visible candle:
- Get `FootprintCandle` from engine — skip if null
- Get `x` from `indexToX` — skip if null
- Iterate each cell in `footprintCandle.cells`

**Step 3 — Per cell, check threshold and render**

For ask side (buy bubble):
- Skip if `bubbleSide === 'sell'`
- Skip if `cell.askVol < threshold`
- Compute `y` from `priceToY(bucketPrice + bucketSize / 2)`
- Compute `radius` from volume scaling formula
- Compute `opacity` from volume scaling formula
- Draw circle: `ctx.arc(x, y, radius, 0, Math.PI * 2)`
- Fill teal at computed opacity, stroke teal at full opacity

For bid side (sell bubble):
- Skip if `bubbleSide === 'buy'`
- Skip if `cell.bidVol < threshold`
- Same y position
- Draw circle, fill red at computed opacity, stroke red at full opacity

**Step 4 — Optional: volume label inside large bubbles**
If `radius >= 12`, render the volume number centered inside the circle.
- Font: `JetBrains Mono`, `9px`
- Color: `#E8E8E8`
- Abbreviated: `1.2k`
- Only do this if the label fits — check `radius * 1.6 >= textWidth`

---

## Draw Order in ChartCanvas

Bubbles render after candles/footprint but before axes and the volume profile bars. They should sit on top of chart content but under the axis strips.

```
1. drawGrid
2. drawSelectionHighlight       (if active)
3. drawCandles OR drawFootprint
4. drawBubbles                  ← new, goes here
5. drawVolumeProfile
6. drawAxes
```

---

## Candle Mode vs Footprint Mode

Bubbles work in both modes. In candle mode, the bubbles give order flow context on top of OHLCV bars — this is useful precisely because footprint cells aren't showing. In footprint mode, bubbles highlight the standout cells above the threshold without the user having to scan every row manually.

In candle mode with no footprint data (no trades ingested yet), `engine.getFootprintCandle()` returns null — no bubbles render, which is correct.

---

## Performance Note

At high zoom (many candles visible) with a low threshold (many bubbles), this can get expensive. Two guards:

- Skip bubble rendering entirely when `barWidth < 4` — bars too small, bubbles would overlap completely and be unreadable anyway
- Cap bubbles per candle at `20` — if a candle has more than 20 cells crossing the threshold, render only the 20 highest volume ones. Sort cells by `Math.max(bidVol, askVol)` descending, take the top 20.

---

## File Checklist

```
lib/draw/drawBubbles.ts          — new draw function

lib/store/chart.ts
├── bubblesEnabled
├── bubbleThreshold
├── bubbleMinRadius
├── bubbleMaxRadius
├── bubbleSide
└── matching actions, all persisted

components/ui/Toolbar.tsx
├── bubble toggle button
├── threshold input
└── side selector (B / S / B+S)

components/ui/SettingsPanel.tsx
└── BUBBLES section with radius sliders

components/chart/ChartCanvas.tsx
└── drawBubbles added to redraw, gated on bubblesEnabled

Behavior:
├── Bubbles appear only above threshold volume
├── Radius and opacity scale to session max volume
├── Teal = buy aggression, red = sell aggression
├── Side filter shows buy only, sell only, or both
├── Toggle hides all bubbles instantly
├── Threshold change redraws immediately (debounced)
├── Large bubbles show abbreviated volume label
├── No bubbles when bar width too small
└── Settings persist across refresh
```

---

## What This Does Not Cover

- Bubble animation (pulse on new high-volume trade)
- Click on bubble to inspect full cell data
- Bubble-based alerts