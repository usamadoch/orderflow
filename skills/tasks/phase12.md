# Line Drawing Tool

---

## Goal

Let the user draw horizontal and vertical lines on the chart. One click places a line. Lines persist until manually deleted. No labels, no text, no price display. Just clean lines using existing colors.

---

## Two Line Types

**Horizontal line** — spans the full chart width at a fixed price level. Useful for marking support, resistance, POC levels.

**Vertical line** — spans the full chart height at a fixed candle. Useful for marking time events, session opens, news candles.

---

## State

**File:** `lib/store/chart.ts`

```ts
interface DrawnLine {
  id:        string              // unique id, e.g. crypto.randomUUID()
  type:      'horizontal' | 'vertical'
  value:     number              // price for horizontal, candle index for vertical
}
```

Add to store:
- `drawnLines: DrawnLine[]` — default `[]`
- `lineDrawMode: 'none' | 'horizontal' | 'vertical'` — default `'none'`
- `addLine(line: DrawnLine)` action
- `removeLine(id: string)` action
- `setLineDrawMode(mode)` action

Persist `drawnLines` — lines should survive page refresh.
Do not persist `lineDrawMode` — always resets to `'none'` on load.

---

## Toolbar

**File:** `components/ui/Toolbar.tsx`

Two small buttons, grouped together after the existing controls:

- `—` horizontal line button
- `|` vertical line button

Each button:
- Inactive: transparent background, text `#4A4A4A`
- Active (that mode selected): background `#1F1F1F`, border `1px solid #3D7EFF`, text `#E8E8E8`
- Clicking an already-active mode deactivates it — sets `lineDrawMode` back to `'none'`
- Clicking one while the other is active switches mode

When either line mode is active, canvas cursor changes to `crosshair`.

---

## Placing a Line

**File:** `components/chart/ChartCanvas.tsx`

In `onMouseDown`, check `lineDrawMode` before pan logic — same priority pattern as the profile tool.

If `lineDrawMode === 'horizontal'`:
- Convert `e.clientY` to a price using `yToPrice`
- Call `addLine({ id: randomUUID(), type: 'horizontal', value: price })`
- Set `lineDrawMode` to `'none'` — auto-exit after one placement
- Do not start pan

If `lineDrawMode === 'vertical'`:
- Convert `e.clientX` to a candle index using `xToIndex`
- Call `addLine({ id: randomUUID(), type: 'vertical', value: candleIndex })`
- Set `lineDrawMode` to `'none'`
- Do not start pan

Lines are placed on mouse down, not mouse up. Feels more immediate.

---

## Drawing the Lines

**File:** `lib/draw/drawLines.ts`

### `drawLines(ctx, drawnLines, indexToX, priceToY, canvasWidth, canvasHeight, timeAxisHeight, priceAxisWidth, hoveredLineId)`

For each line in `drawnLines`:

**Horizontal line:**
- `y = priceToY(line.value)`
- If `y` is outside drawable area, skip
- Draw from `x = 0` to `x = canvasWidth - priceAxisWidth`
- Color: `#8A8A8A` normally, `#E8E8E8` when hovered
- Line width: `1px`
- Style: solid

**Vertical line:**
- `x = indexToX(line.value)`
- If `x` is null (candle off screen), skip
- Draw from `y = 0` to `y = canvasHeight - timeAxisHeight`
- Same color behavior as horizontal
- Line width: `1px`
- Style: solid

No dashes. No arrows. No labels. Just clean lines.

---

## Delete Handle

Each line gets a small delete dot that appears on hover.

**Horizontal line delete dot:**
- Position: right end of the line, `x = canvasWidth - priceAxisWidth - 6`, `y = priceToY(line.value)`
- Circle, radius `5px`
- Fill: `#EF5350` on hover, `#1F1F1F` with border `#4A4A4A` otherwise
- Only visible when that line is hovered

**Vertical line delete dot:**
- Position: top of the line, `x = indexToX(line.value)`, `y = 10`
- Same circle style

---

## Hover Detection

**File:** `components/chart/ChartCanvas.tsx`

In `onMouseMove`, when `lineDrawMode === 'none'`:

For each horizontal line:
- Check if `abs(mouseY - priceToY(line.value)) < 6` — cursor is near the line
- If yes: set `hoveredLineId = line.id`, cursor to `pointer`

For each vertical line:
- Check if `abs(mouseX - indexToX(line.value)) < 6`
- If yes: set `hoveredLineId = line.id`, cursor to `pointer`

If no line is hovered, `hoveredLineId = null`, cursor returns to default.

Store `hoveredLineId` in a local ref — triggers a `scheduleRedraw()` so the hover state renders.

---

## Deleting a Line

**File:** `components/chart/ChartCanvas.tsx`

In `onMouseDown`, after line draw mode check and before profile/pan logic:

If `hoveredLineId` is set:
- Check if cursor is within `8px` of that line's delete dot position
- If yes: call `removeLine(hoveredLineId)`, clear `hoveredLineId`, skip pan
- If no (hovering the line but not the dot): skip pan — do nothing on click, just hover

---

## Draw Order

```
1. drawGrid
2. drawLines              ← new, behind everything
3. drawSelectionHighlight
4. drawCandles OR drawFootprint
5. drawBubbles
6. drawAbsorption
7. drawCustomProfile
8. drawVolumeProfile
9. drawAxes
```

Lines draw first so all chart content renders on top. Lines should feel like they are on the chart surface, not floating above it.

---

## Completion Checklist

```
lib/store/chart.ts
├── DrawnLine type
├── drawnLines array
├── lineDrawMode field
├── addLine, removeLine, setLineDrawMode actions
└── drawnLines persisted, lineDrawMode not persisted

lib/draw/drawLines.ts
└── drawLines function — horizontal + vertical, hover state, delete dot

components/chart/ChartCanvas.tsx
├── onMouseDown line placement logic (before pan)
├── onMouseMove hover detection for lines
├── hoveredLineId local ref
├── cursor changes per hover state
└── delete dot click detection

components/ui/Toolbar.tsx
└── horizontal and vertical line buttons, active state

Behavior:
├── Click places line immediately, draw mode auto-exits
├── Lines persist through pan, zoom, resize
├── Hovering a line highlights it and shows delete dot
├── Clicking delete dot removes the line
├── Lines survive page refresh
└── No labels, no text, no price display on the lines
```