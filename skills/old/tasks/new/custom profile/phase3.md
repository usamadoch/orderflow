# Custom Range Profile — Task 3 of 3
## Render Profile Inside Selected Range

---

## Goal for This Task Only

Use the anchored range from Task 2 to build and render a volume profile for exactly the selected candles and price range. The profile renders inside or alongside the selection rectangle. POC and VA lines are drawn. A `CUSTOM` label distinguishes it from the default profile. A clear button removes the selection.

---

## What Gets Built Here

- `buildProfile` called with `firstIndex` and `lastIndex` from `customProfileRange`
- Profile bars rendered inside the right edge of the selection rectangle
- POC line and VA lines scoped to the selection rectangle width only
- `CUSTOM` label
- `✕ CLEAR` button inside the rectangle
- Default profile dims when custom is active

---

## Reuse buildProfile

**File:** `lib/utils/volumeProfile.ts`

`buildProfile` already accepts `firstIndex` and `lastIndex` — no changes needed. Pass `customProfileRange.firstIndex` and `customProfileRange.lastIndex` directly.

The profile calculation is scoped to only those candles automatically.

---

## Rendering the Custom Profile

**File:** `lib/draw/drawSelectionRect.ts`

Extend this file to also render the profile inside the selection. Keep it in the same file — the rectangle and its profile are one visual unit.

### `drawCustomProfile(ctx, customProfileRange, profile, indexToX, priceToY, barWidth, bucketSize)`

Profile bars render along the right inner edge of the selection rectangle.

**Bar positioning:**
- Right edge of the rectangle: `x2 = indexToX(lastIndex) + barWidth / 2`
- Bars grow leftward from `x2` inward — same direction as the default profile
- Max bar width capped at the rectangle width so bars never overflow outside the selection
- `barMaxWidth = x2 - x1` — full rectangle width is the ceiling

**Bar height:**
- `topY = priceToY(row.price + bucketSize)`
- `bottomY = priceToY(row.price)`
- Only render rows where `topY >= priceToY(priceHigh)` and `bottomY <= priceToY(priceLow)` — clip to selected price range

**Bar color:**
- Same bid/ask split as default profile — teal ask portion, red bid portion
- Slightly higher opacity than default: `0.5` — custom profile feels more prominent

**POC line:**
- Draw only within the rectangle's x bounds — from `x1` to `x2`
- Color: `#F0B90B`, dashed `[4, 4]`, `1px`
- Does not extend across full chart width — scoped to selection only

**VA High and VA Low lines:**
- Same — scoped from `x1` to `x2` only
- Color: `#3D7EFF`, dashed `[2, 4]`

**`CUSTOM` label:**
- Top-left corner of the rectangle, inside
- Position: `x1 + 4`, `y1 + 12`
- Font: `JetBrains Mono 9px`, color `#3D7EFF`

---

## Dim the Default Profile

**File:** `lib/draw/drawVolumeProfile.ts`

When `customProfileRange` is set in the store, render the default profile at reduced opacity — `0.2` instead of the normal `0.35` on bars, and reduce POC/VA line opacity to `0.3`.

Pass `isCustomActive: boolean` into `drawVolumeProfile`. If true, apply reduced opacity. Keeps the default profile visible as context without competing with the custom one.

---

## Clear Button

**File:** `lib/draw/drawSelectionRect.ts`

Inside `drawCustomProfile`, render a small `✕` text in the top-right corner of the rectangle:
- Position: `x2 - 14`, `y1 + 12`
- Font: `JetBrains Mono 11px`, color `#8A8A8A`
- On hover: color changes to `#E8E8E8`

**Hover detection:**
In `ChartCanvas` `onMouseMove`, check if cursor is within `12px` of the `✕` position. If yes, set local ref `isHoveringClear = true`, change cursor to `pointer`, trigger redraw so `✕` brightens.

**Click detection:**
In `ChartCanvas` `onMouseDown`, check same proximity. If yes, call `setCustomProfileRange(null)`, clear draw mode, prevent pan from starting.

---

## Draw Order Update

```
1. drawGrid
2. drawSelectionRect              ← background tint only, behind candles
3. drawCandles OR drawFootprint
4. drawBubbles
5. drawAbsorption
6. drawCustomProfile              ← profile bars on top of candles, inside rect
7. drawVolumeProfile              ← dimmed when custom active
8. drawAxes
```

Split `drawSelectionRect` into two calls — background tint before candles, profile bars after — so profile renders on top of chart content within the rectangle.

---
