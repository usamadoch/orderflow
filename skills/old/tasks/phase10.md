# Custom Range Volume Profile

---

## Goal

Let the user drag across the chart to select a range of candles and render a volume profile for only those candles. The selection persists on screen until the user clears it or makes a new one. Works entirely on whatever candles are currently in memory — no database, no historical data required.

---

## How It Feels to Use

User holds a modifier key (e.g. `Shift`) and drags left or right on the canvas. A highlighted region appears over the selected candles. On mouse release, a volume profile renders for that range — replacing or sitting alongside the default visible-range profile. A small `✕` button or pressing `Escape` clears the selection and returns to the default profile.

---

## What Changes vs the Default Profile

The default profile (Phase 6) always reflects the visible range — it updates on every scroll and zoom. The custom profile is locked to a specific candle index range chosen by the user. It does not update when the user scrolls. It stays pinned to those candles visually even as the chart pans.

Both can coexist — render the default profile dimmed when a custom selection is active, and the custom profile at full opacity. Or simply replace the default profile with the custom one while a selection is active. Simpler to replace for MVP.

---

## State

Add to Zustand store (per panel if multi-panel is implemented):

- `customProfileRange: { firstIndex: number, lastIndex: number } | null` — null means no active selection, default profile is shown
- `isSelectingProfile: boolean` — true while the user is actively dragging

Actions:
- `setCustomProfileRange(range | null)` — sets or clears the selection
- `setSelectingProfile(v: boolean)`

---

## Interaction — Mouse Events on Canvas

**File:** `components/chart/ChartCanvas.tsx` — extend existing mouse handlers

Selection mode is activated by holding `Shift` while pressing mouse down. Regular mouse down without `Shift` still pans as before.

### `onMouseDown`
- Check if `e.shiftKey` is true
- If yes: enter selection mode — set `isSelectingProfile: true`, record the starting candle index from `indexToX` inverse (see below), do not start panning

### `onMouseMove`
- If `isSelectingProfile` is true: compute the current candle index under the cursor, update a local ref `selectionEndIndex`, trigger a redraw to show the live selection highlight
- If not selecting: pan as before

### `onMouseUp`
- If `isSelectingProfile` was true: finalize the selection — call `setCustomProfileRange({ firstIndex: min(start, end), lastIndex: max(start, end) })`, set `isSelectingProfile: false`

### Cursor
- When `Shift` is held: cursor changes to `crosshair` (already is) or a custom column-select cursor
- Add a `keydown` / `keyup` listener on `window` to detect `Shift` state and update a ref — use this to change cursor style on the canvas when Shift is held, before the user even clicks

---

## Inverse Coordinate — X to Candle Index

Currently the coordinate system has `indexToX(i)` — index to pixel. For selection you need the reverse: given a mouse x pixel, which candle index is it over.

**File:** `lib/utils/coordinates.ts`

Add `xToIndex(x, candles, scrollOffset, barWidth, canvasWidth)`:

- Takes the mouse x position and current pan/zoom state
- Returns the nearest candle index
- Formula is the inverse of `indexToX` — derive from the same right-anchored math
- Clamp result to `[0, candles.length - 1]`
- This function is only called during mouse interaction, not every frame

---

## Drawing the Selection Highlight

**File:** `lib/draw/drawSelection.ts`

### `drawSelectionHighlight(ctx, firstIndex, lastIndex, indexToX, barWidth, canvasHeight, timeAxisHeight)`

Called during redraw when either `isSelectingProfile` is true (live drag) or `customProfileRange` is set (finalized selection).

- For each candle index in the selected range, compute `x` via `indexToX`
- Draw a semi-transparent rectangle spanning from the first candle's left edge to the last candle's right edge
- Full height: from `y = 0` to `y = canvasHeight - timeAxisHeight`
- Fill: `rgba(61, 126, 255, 0.08)` — very subtle blue tint
- Left and right border lines: `rgba(61, 126, 255, 0.4)` — 1px solid, marks the selection boundary clearly
- Draw this before candles/footprint so it sits behind the chart content

---

## Rendering the Custom Profile

**File:** `lib/draw/drawVolumeProfile.ts` — extend existing function

The existing `drawVolumeProfile` builds a profile from `visibleRange`. Add an overload or an optional parameter that accepts a custom range instead.

When `customProfileRange` is set in the store:
- Pass `customProfileRange.firstIndex` and `customProfileRange.lastIndex` into `buildProfile` instead of the visible range
- The resulting profile renders exactly as the default profile does — same bars, same POC, same VA lines
- Add a small label above the profile bars: `CUSTOM` in `#3D7EFF`, 9px — so it's clear this is not the auto profile
- POC and VA lines for the custom profile should use a slightly different style to distinguish from the default if both are ever shown simultaneously — dashed vs solid, or different opacity

---

## Clearing the Selection

Three ways to clear:

1. Press `Escape` — keyboard shortcut, calls `setCustomProfileRange(null)`
2. Click without `Shift` — starting a pan clears the selection. In `onMouseDown`, if no `Shift` key and `customProfileRange` is set, call `setCustomProfileRange(null)` before starting pan
3. Make a new selection — starting a new `Shift+drag` replaces the old selection automatically

Add a small `✕ CLEAR` button that appears in the top-right corner of the selection highlight when a custom range is active. On click: `setCustomProfileRange(null)`. This gives a discoverable way to clear for users who don't know the keyboard shortcut.

---

## Draw Order Update

In `ChartCanvas` redraw function, insert the selection highlight at the right layer:

```
1. drawGrid
2. drawSelectionHighlight        ← new, behind everything
3. drawCandles OR drawFootprint
4. drawVolumeProfile             ← uses customProfileRange if set
5. drawAxes
```

---

## Interaction With Footprint Mode

In footprint mode, the custom profile uses the same footprint cell data the aggregation engine has for those candles — bid/ask split in profile bars works exactly as normal. If some candles in the selection have no footprint data yet, the fallback OHLCV distribution kicks in (already handled in `buildProfile`).

---

## Interaction With Scroll and Zoom

The custom profile stays pinned to the selected candle indices, not screen positions. When the user scrolls, `indexToX` gives new x positions for the same indices — the selection highlight and profile bars move with the candles correctly without any extra logic.

---

## Minimum Selection Size

If the user drags less than 2 candles (a stray click with Shift held), do not set a custom range. In `onMouseUp`, check that `abs(endIndex - startIndex) >= 2` before calling `setCustomProfileRange`.

---

## File Checklist

```
lib/store/chart.ts
├── customProfileRange field
├── isSelectingProfile field
├── setCustomProfileRange action
└── setSelectingProfile action

lib/utils/coordinates.ts
└── xToIndex function added

lib/draw/
├── drawSelection.ts             — new, selection highlight rectangle
└── drawVolumeProfile.ts         — accepts custom range, CUSTOM label

components/chart/ChartCanvas.tsx
├── Shift+drag selection logic in mouse handlers
├── Shift keydown/keyup listener for cursor change
├── drawSelectionHighlight added to redraw order
└── Clear on non-Shift mousedown

hooks/useKeyboardShortcuts.ts
└── Escape clears customProfileRange

Behavior:
├── Shift+drag selects candle range visually
├── Release finalizes selection, custom profile appears
├── Custom profile stays pinned through scroll and zoom
├── Escape or plain click clears selection
├── Works in both candle and footprint mode
├── Footprint bid/ask split visible in custom profile bars
└── CUSTOM label distinguishes it from default profile
```

---

## What This Does Not Cover

- Saving named selections
- Multiple simultaneous custom profiles
- Clicking a saved zone to restore its profile