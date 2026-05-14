# Measurement Tool — Task 1 of 3
## Activation, Drag Interaction, and Rectangle Overlay

---

## Goal for This Task Only

Add the measurement tool to the toolbar. Handle the drag interaction on the canvas. Draw the dashed rectangle overlay while dragging and after release. No info panel yet. No metrics yet. Just the tool activating, the drag working, and the rectangle appearing correctly.

---

## Toolbar Button

**File:** `components/ui/Toolbar.tsx`

Add a ruler icon button. Label it `RULER` or use a `⟷` character if no icon library is available.

- Inactive: transparent background, text `#4A4A4A`
- Active: background `#1F1F1F`, border `1px solid #3D7EFF`, text `#E8E8E8`
- Clicking toggles `measureToolActive` in store
- Activating measurement tool must deactivate any other active drawing tool — custom profile tool, line drawing tool. Only one tool active at a time.
- Clicking while already active: deactivates, clears any existing measurement

---

## Store Additions

**File:** `lib/store/chart.ts`

```ts
measureToolActive: boolean   // default false, not persisted
activeMeasurement: {
  startX: number    // pixel x at drag start
  startY: number    // pixel y at drag start
  endX:   number    // pixel x at current drag position
  endY:   number    // pixel y at current drag position
  live:   boolean   // true while dragging, false after release
} | null             // null means no measurement on screen
```

Actions:
- `setMeasureToolActive(v: boolean)`
- `setActiveMeasurement(m | null)`

Do not persist either field. Measurements are session-only and always start cleared.

---

## Keyboard Shortcut

**File:** `hooks/useKeyboardShortcuts.ts`

Add `M` key to toggle `measureToolActive`.
Guard: skip if `e.target` is an input element.
When toggled off: also call `setActiveMeasurement(null)`.

---

## Canvas Cursor

**File:** `components/chart/ChartCanvas.tsx`

When `measureToolActive` is true, set `canvas.style.cursor = 'crosshair'`.
When false, restore to `'default'` (or whatever the current tool cursor is).

Do this inside a `useEffect` watching `measureToolActive`.

---

## Mouse Interaction

**File:** `components/chart/ChartCanvas.tsx`

Add measurement interaction at the top of `onMouseDown`, before all other tool checks.

### Priority in `onMouseDown`

Check `measureToolActive` first — before profile, before line drawing, before pan.

### `onMouseDown` when `measureToolActive`

- Read `e.clientX` and `e.clientY`
- Get canvas bounding rect: `canvas.getBoundingClientRect()`
- Compute canvas-relative position: `x = e.clientX - rect.left`, `y = e.clientY - rect.top`
- Call `setActiveMeasurement({ startX: x, startY: y, endX: x, endY: y, live: true })`
- Set a local ref `isMeasuring = true`
- Do not start pan

### `onMouseMove` when `isMeasuring`

- Compute canvas-relative x and y from `e.clientX - rect.left`, `e.clientY - rect.top`
- Call `setActiveMeasurement({ ...existing, endX: x, endY: y, live: true })`
- Call `scheduleRedraw()`

### `onMouseUp` when `isMeasuring`

- Set `isMeasuring = false`
- Call `setActiveMeasurement({ ...existing, live: false })` — finalize, keep on screen
- Do not clear the measurement

### Clearing on plain click (tap with no drag)

In `onMouseUp`, check if `abs(endX - startX) < 4 && abs(endY - startY) < 4`. If true, the user just tapped without dragging — call `setActiveMeasurement(null)` instead of finalizing.

### Clearing on Escape

In `useKeyboardShortcuts`, add `Escape` key handling:
- If `activeMeasurement` is set: call `setActiveMeasurement(null)`, do not deactivate the tool itself — user may want to draw another measurement immediately after clearing

### Clearing on pair/timeframe change

In `FeedProvider` or wherever pair/timeframe changes trigger feed resubscription, call `setActiveMeasurement(null)`.

---

## Drawing the Rectangle

**File:** `lib/draw/drawMeasurement.ts`

### `drawMeasurementRect(ctx, measurement)`

Parameters:
- `ctx` — canvas 2D context
- `measurement` — the `activeMeasurement` object from store

If `measurement` is null, return immediately.

Compute rectangle bounds — handle all four drag directions:
- `x = Math.min(measurement.startX, measurement.endX)`
- `y = Math.min(measurement.startY, measurement.endY)`
- `w = Math.abs(measurement.endX - measurement.startX)`
- `h = Math.abs(measurement.endY - measurement.startY)`

If `w < 2 || h < 2`: skip drawing — too small, likely a tap not a drag.

**Fill:**
`ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'`
`ctx.fillRect(x, y, w, h)`

**Border:**
`ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'`
`ctx.lineWidth = 1`
`ctx.setLineDash([4, 3])`
`ctx.strokeRect(x, y, w, h)`
`ctx.setLineDash([])` — always reset after

**Start point dot:**
Draw a small filled circle at `(startX, startY)`:
- Radius: `3px`
- Fill: `rgba(255, 255, 255, 0.6)`
This anchors the visual to where the user first clicked.

---

## Wiring Into ChartCanvas Redraw

**File:** `components/chart/ChartCanvas.tsx`

Add `drawMeasurementRect` to the redraw function.

Draw order position — after everything else, just before `drawAxes`:

```
...
8.  drawVolumeProfile
9.  drawMeasurementRect     ← new, on top of all chart content
10. drawAxes
```

Measurement renders on top of all chart content so it is always readable. Axes still render last so axis strips paint over the rectangle edges cleanly.

Read `activeMeasurement` from store in the redraw function and pass it into `drawMeasurementRect`.

---

## Mutual Exclusivity With Other Tools

**File:** `lib/store/chart.ts`

When `setMeasureToolActive(true)` is called:
- Also set `isDrawMode = false` (custom profile tool)
- Also set `lineDrawMode = 'none'` (line drawing tool)

When any other drawing tool is activated:
- Also set `measureToolActive = false`
- Also set `activeMeasurement = null`

This ensures only one tool is ever active at a time without requiring each tool to know about the others explicitly.

---


Do not proceed to Task 2 until the rectangle renders correctly in all drag directions and all clearing behaviors work.