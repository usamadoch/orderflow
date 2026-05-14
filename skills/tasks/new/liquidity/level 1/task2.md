# Liquidity Map — Level 1, Task 2 of 2
## Canvas Rendering, Visualization, and Settings

---

## Goal for This Task Only

Render the liquidity zones from Task 1 onto the canvas. Zones appear as horizontal bands behind candles. Intensity controls opacity. Bid zones below price, ask zones above. Handle zoom and scroll correctly. Add settings panel controls. Verify visually.

Task 1 must be complete and producing valid `liquidityZones` before starting this.

---

## Visual Design

Liquidity zones are horizontal bands — rectangles spanning a price range, full width across the chart. They sit behind all chart content and feel like a background context layer, not a foreground signal.

The goal is clarity without noise. A user glancing at the chart should immediately see where the large walls are without having to read numbers or labels.

### Bid zones (below current price)
- Color: `#26A69A` — teal, same as bull/buy color
- Fill: `rgba(38, 166, 154, intensity * liquidityOpacity * 0.4)`
- The `0.4` multiplier keeps even high-intensity zones from being too strong
- A zone with `intensity = 1.0` and `liquidityOpacity = 0.6` renders at `rgba(38, 166, 154, 0.24)`

### Ask zones (above current price)
- Color: `#EF5350` — red, same as bear/sell color
- Fill: `rgba(239, 83, 80, intensity * liquidityOpacity * 0.4)`

### No borders, no labels on zones
Borders add visual clutter at this layer. Labels are not needed — the intensity communicates relative size. If a user wants exact numbers they can hover (future feature).

---

## Zone Height on Canvas

Each zone represents a price bucket of `liquidityBucketSize` (e.g. `$50`).

```
topY    = priceToY(zone.price + liquidityBucketSize)
bottomY = priceToY(zone.price)
height  = bottomY - topY
```

If `height < 1`: set height to `1px` — never let a zone completely disappear.

Width: full drawable chart width — from `x = 0` to `x = canvasWidth - PRICE_AXIS_WIDTH - PROFILE_WIDTH`.

The zone does not have a left or right anchor to a candle — it is purely price-based, not time-based. It spans the entire visible horizontal range.

---

## Draw Function

**File:** `lib/draw/drawLiquidity.ts`

### `drawLiquidity(ctx, liquidityZones, priceToY, canvasWidth, canvasHeight, priceAxisWidth, profileWidth, liquidityOpacity, liquidityBucketSize)`

For each zone in `liquidityZones`:
- Compute `topY` and `bottomY` using `priceToY`
- If both values are outside the drawable area (above 0 or below `canvasHeight - timeAxisHeight`): skip — zone is off screen vertically
- Compute fill color from `zone.side` and `zone.intensity * liquidityOpacity * 0.4`
- Call `ctx.fillRect`

After drawing all zone fills, draw a thin intensity indicator line on the right edge of each zone:
- Position: `x = canvasWidth - PRICE_AXIS_WIDTH - PROFILE_WIDTH - 2`
- Height: same as the zone
- Width: `3px`
- Color: same as zone fill but at full `liquidityOpacity` — stronger, makes the edge readable
- This thin stripe gives visual separation between adjacent zones of different intensities

No borders around the full zone rectangle — only the right-edge stripe.

---

## Draw Order

**File:** `components/chart/ChartCanvas.tsx`

Liquidity zones render between the grid and session boxes — behind absolutely everything else:

```
1. drawGrid
2. drawLiquidity          ← new, lowest layer above grid
3. drawSessions
4. drawLines
5. drawSelectionHighlight
6. drawCandles OR drawFootprint
7. drawBubbles
8. drawAbsorption
9. drawExhaustion
10. drawMeasurementRect
11. drawCustomProfile
12. drawVolumeProfile
13. drawAxes
```

Placing it below sessions means session boxes render slightly on top of liquidity zones. This is intentional — sessions are broader context, liquidity zones are specific price points.

---

## Scroll and Zoom Behavior

Liquidity zones are price-anchored, not candle-anchored. They do not use `indexToX` at all. Their vertical position depends only on `priceToY`, which updates on every redraw as the visible price range changes.

When the user pans horizontally: zones stay at the same vertical position — correct, they represent price levels not time.

When the user zooms: the visible price range changes, so `priceToY` output changes, and zone heights change proportionally. A `$50` zone appears taller when zoomed in vertically, shorter when zoomed out. This is correct behavior.

When price moves and new candles arrive: `getVisiblePriceRange` auto-scales, which shifts zone positions. No special handling needed — it happens automatically.

---

## Current Price Indicator

Add a horizontal line at the current price (last close of the most recent candle).

**File:** `lib/draw/drawLiquidity.ts` — add at the end of `drawLiquidity`

- `currentPrice = candles[candles.length - 1].close`
- `y = priceToY(currentPrice)`
- Draw a thin horizontal line: `rgba(255, 255, 255, 0.3)`, `1px`, dashed `[2, 4]`
- This gives visual context for which zones are above and below current price

This is a minor addition but valuable for orientation when the chart is scrolled away from the latest candle.

---

## Filtering Zones by Visible Price Range

Only render zones within the currently visible price range. Zones far outside the visible area consume draw calls unnecessarily.

Before the draw loop, compute:
- `visibleTop = priceToY(0) — actually derive from visiblePriceMax`
- Filter `liquidityZones` to only those where `zone.price` is between `visiblePriceMin - liquidityBucketSize` and `visiblePriceMax + liquidityBucketSize`

This is a simple pre-filter that eliminates zones the user cannot see.

---

## Interaction With Footprint Cells

In footprint mode, footprint cells render on top of liquidity zones (draw order handles this). No special interaction needed.

One useful visual behavior: when a footprint cell and a liquidity zone occupy the same price level, the cell renders clearly on top. The zone acts as a color hint behind the cell — teal cells on a teal bid zone reinforce the buy side context. This works naturally without any special logic.

---

## Interaction With Volume Profile

The volume profile sits on the right side of the chart. Liquidity zones span the full chart width including that area. This means liquidity zone fills render behind the volume profile bars — the profile bars paint on top.

This is correct — the profile bars are more specific information and should not be obscured.

---

## Settings Panel

**File:** `components/ui/SettingsPanel.tsx`

Add a `LIQUIDITY MAP` section:

```
LIQUIDITY MAP
  Show liquidity map    [toggle]
  Opacity               [slider]   60%
  Bucket size           [input]    $50
  Minimum size          [input]    5 BTC
  Range                 [slider]   10%
```

- **Opacity slider:** range 10–100, stored as 0.1–1.0, default 60%
- **Bucket size input:** number input, min `$10`, max `$500`, step `$10`. On change: triggers re-aggregation.
- **Minimum size input:** number input in BTC, min `0.5`, max `100`, step `0.5`. On change: triggers re-aggregation.
- **Range slider:** how far from current price to show zones. Range 5–20%, default 10%. On change: triggers re-aggregation with new `liquidityRange` parameter.

Re-aggregation on setting change means calling `aggregateOrderbook` again with the new settings and updating `liquidityZones` in store. The orderbook data does not need to be re-fetched — it is in memory.

---

## Toolbar Quick Toggle

Add a small liquidity icon button (`≡` or `|||`) to the toolbar. Maps to `liquidityEnabled` master toggle. Same compact style as other toolbar toggles.

Keyboard shortcut: `Q` — toggles `liquidityEnabled`. Guard against input focus as usual.

---

## Multi-Panel Behavior

Liquidity zones represent the current state of the orderbook — there is only one orderbook per pair. In dual panel mode, if both panels show the same pair, they share the same `liquidityZones` from the store.

If panels show different pairs (e.g. BTC in left, ETH in right), each panel needs its own orderbook connection. The liquidity system must be made panel-aware — `liquidityZones` moves into per-panel state alongside `candles` and `connected`.

For MVP: if both panels show the same pair, shared zones is acceptable. Document this limitation and defer multi-pair liquidity to a later pass.

---

## Performance Expectations

`drawLiquidity` iterates the `liquidityZones` array — typically 10–40 zones after filtering. Each zone is one `fillRect` call. This is negligible.

The expensive operation is `aggregateOrderbook`, which runs every 500ms — not in the render loop. The render loop only reads the pre-computed zones from the store.

The orderbook WebSocket at 100ms update frequency generates significant message volume. Ensure the depth stream update handler is lean — only update the in-memory map, set the `pendingAggregation` flag, and return. No computation in the message handler itself.

---
