# Custom Range Profile — Task 1 of 3
## Draw Mode Toggle + Rectangle Overlay

---

## Goal for This Task Only

Add a toggle button to the toolbar that activates "profile draw mode". When active, the user can click and drag on the canvas to draw a rectangle. Render that rectangle as a dashed overlay on the canvas. Nothing else. No profile calculation. No coordinate anchoring. Just the interaction and the visual rectangle.

---

## What Gets Built Here

- A toolbar toggle button for draw mode
- A `isDrawMode` boolean in the store
- Mouse down / move / up logic on the canvas for drag selection
- A dashed rectangle drawn on the canvas showing the selection
- The rectangle uses raw pixel coordinates for now — no candle index math yet

---

## Store Changes

**File:** `lib/store/chart.ts`

Add:
- `isDrawMode: boolean` — default `false`
- `setDrawMode(v: boolean)` action

Nothing else. No range storage yet.

---

## Toolbar Button

**File:** `components/ui/Toolbar.tsx`

Add a button labeled `PROFILE` or a selection box icon.

- Inactive: transparent background, muted text `#4A4A4A`
- Active: background `#1F1F1F`, border `1px solid #3D7EFF`, text `#E8E8E8`
- On click: toggles `isDrawMode` in store
- When `isDrawMode` becomes true, change canvas cursor to `crosshair`
- When `isDrawMode` becomes false, clear any in-progress drag and cursor returns to default

---

## Canvas Mouse Logic

**File:** `components/chart/ChartCanvas.tsx`

Add three local refs — not state, refs — to avoid re-renders during drag:
- `dragStart: { x: number, y: number } | null`
- `dragEnd: { x: number, y: number } | null`
- `isDragging: boolean`

### `onMouseDown`
- If `isDrawMode` is false: run existing pan logic, nothing changes
- If `isDrawMode` is true: record `e.clientX - canvasRect.left` and `e.clientY - canvasRect.top` into `dragStart`, set `isDragging = true`, set `dragEnd = null`

### `onMouseMove`
- If `isDragging` and `isDrawMode`: update `dragEnd` with current cursor position, call `scheduleRedraw()`
- If not in draw mode: existing pan logic unchanged

### `onMouseUp`
- If `isDragging` and `isDrawMode`: set `isDragging = false`, keep `dragStart` and `dragEnd` as the finalized rectangle — do not clear them yet
- The rectangle stays visible after mouse release

### Clearing the rectangle
- If user clicks without dragging while in draw mode (mouse up with no move) → clear `dragStart` and `dragEnd`
- Pressing `Escape` → clear both refs, call `scheduleRedraw()`
- Toggling draw mode off → clear both refs, call `scheduleRedraw()`

---

## Drawing the Rectangle

**File:** `lib/draw/drawSelectionRect.ts`

### `drawSelectionRect(ctx, dragStart, dragEnd)`

- Takes context and the two pixel coordinate points
- If either is null, return immediately — nothing to draw
- Compute `x = min(dragStart.x, dragEnd.x)`, `y = min(dragStart.y, dragEnd.y)`
- Compute `width = abs(dragEnd.x - dragStart.x)`, `height = abs(dragEnd.y - dragStart.y)`
- If width or height is less than 5px, return — ignore tiny accidental drags
- Draw a filled rectangle: `rgba(61, 126, 255, 0.06)` — very subtle blue tint
- Draw a dashed border: `rgba(61, 126, 255, 0.5)`, line width `1px`, dash pattern `[4, 4]`
- Reset line dash after drawing

---

## Redraw Order

Add `drawSelectionRect` at the top of the redraw stack, right after `drawGrid`, before candles:

```
1. drawGrid
2. drawSelectionRect      ← new
3. drawCandles OR drawFootprint
4. ...rest unchanged
```

---
