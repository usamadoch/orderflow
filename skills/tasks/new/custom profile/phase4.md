



# Custom Range Profile — Task 4 of 4
## UX Polish + Interaction Improvements

---

## Goal for This Task Only

Improve how the custom profile behaves after it is drawn. Bars grow left-to-right. The profile can be dragged to reposition. Drawing mode auto-exits after first draw. The profile only disappears when explicitly deleted. Resize handles and a locked state are added.

No changes to profile calculation logic. No changes to `buildProfile`. No changes to coordinate math. Pure interaction and rendering layer improvements.

---

## Change 1 — Bar Direction Left to Right

**File:** `lib/draw/drawSelectionRect.ts`

Currently bars grow from `x2` (right edge) leftward. Flip this.

Bars now anchor to `x1` (left edge of selection) and grow rightward.

For each row:
- Bar starts at `x1`
- Bar width: `(row.totalVol / profile.maxVol) * barMaxWidth`
- `barMaxWidth = x2 - x1`
- Ask portion starts at `x1`, width = `barW * (row.askVol / row.totalVol)`
- Bid portion starts at `x1 + askWidth`, width = remaining

POC and VA lines do not change — they already span `x1` to `x2`.

`CUSTOM` label stays top-left at `x1 + 4`. No change.

`✕` button stays top-right at `x2 - 14`. No change.

---

## Change 2 — Auto-Exit Draw Mode After First Draw

**File:** `components/chart/ChartCanvas.tsx` and `lib/store/chart.ts`

Currently after completing a drag, `isDrawMode` stays true and the user can keep drawing indefinitely.

New behavior: after `onMouseUp` finalizes a drag and calls `setCustomProfileRange(...)`, immediately call `setDrawMode(false)`.

The toolbar button reflects this — it deactivates visually after the first profile is drawn.

The profile stays on screen. Turning off draw mode does not clear `customProfileRange`. These are now two independent concerns.

---

## Change 3 — Profile Persists Independent of Draw Mode

**File:** `lib/store/chart.ts`

`customProfileRange` and `isDrawMode` are already separate fields. The only change needed is removing any logic that clears `customProfileRange` when `isDrawMode` is toggled off.

Audit `ChartCanvas.tsx` and `Toolbar.tsx` — remove any `setCustomProfileRange(null)` call that is triggered by disabling draw mode. The only places that should clear `customProfileRange` are:
- The `✕` delete button on the profile
- Pressing `Escape` — keep this but make it a deliberate user action, not a side effect of toggling the tool

---

## Change 4 — Drag to Reposition Profile

This is the most involved change. The profile can be grabbed and moved after it is drawn.

### Hit detection

**File:** `components/chart/ChartCanvas.tsx`

On `onMouseMove`, when `isDrawMode` is false and `customProfileRange` is set, check where the cursor is relative to the profile rectangle:

Compute `x1`, `x2`, `y1`, `y2` from `customProfileRange` using `indexToX` and `priceToY` — same as the draw function does.

Three zones to detect:
- **Inside the rectangle** (not near any edge): cursor is `grab`, drag moves the whole profile
- **Near left or right edge** (within 6px): cursor is `ew-resize`, drag resizes horizontally
- **Near top or bottom edge** (within 6px): cursor is `ns-resize`, drag resizes vertically
- **Outside**: cursor returns to `crosshair` if draw mode, otherwise `default`

Store detected zone in a local ref `hoverZone: 'move' | 'resize-left' | 'resize-right' | 'resize-top' | 'resize-bottom' | null`.

### Drag move logic

On `onMouseDown` when `hoverZone === 'move'`:
- Record `dragAnchor: { x, y }` — mouse position at drag start
- Record `profileSnapshot` — a copy of `customProfileRange` at drag start
- Set `isDraggingProfile = true`

On `onMouseMove` when `isDraggingProfile`:
- Compute `deltaX = currentX - dragAnchor.x` and `deltaY = currentY - dragAnchor.y`
- Convert `deltaX` to index delta: `indexDelta = Math.round(deltaX / barWidth)`
- Convert `deltaY` to price delta using inverse of `priceToY`
- Apply deltas to `profileSnapshot` to get new `firstIndex`, `lastIndex`, `priceHigh`, `priceLow`
- Clamp `firstIndex` and `lastIndex` to valid array bounds
- Call `setCustomProfileRange(newRange)` — profile recalculates and redraws
- Call `scheduleRedraw()`

On `onMouseUp`: clear `isDraggingProfile`, clear `dragAnchor`, clear `profileSnapshot`

### Drag resize logic

On `onMouseDown` when `hoverZone` is one of the resize variants:
- Same anchor recording as move
- Set `isDraggingResize = true`, store which edge

On `onMouseMove` when `isDraggingResize`:
- Only update the relevant boundary:
  - `resize-left`: update `firstIndex` from new x
  - `resize-right`: update `lastIndex` from new x
  - `resize-top`: update `priceHigh` from new y
  - `resize-bottom`: update `priceLow` from new y
- Enforce minimum size: `lastIndex - firstIndex >= 2`, `priceHigh - priceLow >= bucketSize`
- Call `setCustomProfileRange(updatedRange)`, `scheduleRedraw()`

---

## Change 5 — Resize Handles

**File:** `lib/draw/drawSelectionRect.ts`

When `customProfileRange` is set and the profile is not being dragged, draw small handle indicators on the edges.

Four edge handles — one on each side, centered on that edge:
- Left edge handle: small rectangle, `4px wide × 16px tall`, centered vertically on the left border
- Right edge handle: same, on right border
- Top handle: `16px wide × 4px tall`, centered horizontally on top border
- Bottom handle: same, on bottom border

Style:
- Fill: `#3D7EFF` at `0.7` opacity
- Border radius effect: just a filled rect, no actual border-radius needed on canvas
- Only visible when cursor is hovering inside the profile rectangle or near an edge — use `isHoveringProfile` ref to gate rendering

---

## Change 6 — Hover Highlight State

**File:** `lib/draw/drawSelectionRect.ts`

When cursor is inside the profile rectangle (`hoverZone` is not null), increase the background tint opacity from `0.06` to `0.10`. Border opacity increases from `0.5` to `0.8`.

This gives clear feedback that the profile is interactive.

Pass `isHovered: boolean` into `drawSelectionRect` / `drawCustomProfile`. Derive it from `hoverZone !== null`.

---

## Change 7 — Profile Lock Toggle

Add a lock state so the profile cannot be accidentally moved.

**Store addition:**
- `customProfileLocked: boolean` — default `false`
- `setCustomProfileLocked(v: boolean)` action

When `customProfileLocked` is true:
- `hoverZone` detection returns null even if cursor is inside — no move or resize cursors
- Dragging does nothing
- The `✕` delete button still works — lock only prevents repositioning, not deletion

**Visual indicator:**
Inside the profile rectangle, top-left area next to `CUSTOM` label, render a small lock icon — just two characters is enough: `🔒` or a simple padlock drawn with canvas lines. Alternatively a text label `LOCKED` in `#4A4A4A`.

**How to toggle:**
Add a lock icon button inside the profile rectangle header area, left of the `✕`. On click: toggle `customProfileLocked`. Same hit detection pattern as the `✕` button — check mouse proximity in `onMouseDown`.

---

## Change 8 — Selected vs Unselected Profile State

A profile can be in two visual states:
- **Selected** — user just drew it, or clicked inside it
- **Unselected** — profile exists but user is working elsewhere on the chart

**Store addition:**
- `isProfileSelected: boolean` — default `true` (newly drawn profile starts selected)
- `setProfileSelected(v: boolean)` action

**Visual difference:**
- Selected: border `rgba(61, 126, 255, 0.8)`, solid not dashed, resize handles visible
- Unselected: border `rgba(61, 126, 255, 0.35)`, dashed `[4, 4]`, resize handles hidden

**When selected state changes:**
- Clicking inside the profile: set selected to `true`
- Clicking outside the profile (on the chart, not on a toolbar button): set selected to `false`
- Drawing a new profile: starts selected

In `onMouseDown`, after checking for delete/lock button hits and before starting pan, check if click is inside the profile rectangle. If yes, set selected to true and stop there — do not start a pan. If click is outside, set selected to false and continue to pan logic.

---

## Store Summary for This Task

```ts
// Existing — behavior changes only, no type changes
customProfileRange: { firstIndex, lastIndex, priceHigh, priceLow } | null
isDrawMode: boolean

// New fields
customProfileLocked: boolean     // default false
isProfileSelected:  boolean      // default true
```

Persist `customProfileLocked` — user's preference for their drawn profile should survive a redraw. Do not persist `isProfileSelected` — always starts unselected on page load.

---

## Interaction Priority in onMouseDown

Mouse events can now trigger several different things. Check in this exact order to avoid conflicts:

1. Is draw mode active and user starts dragging? → start new draw, skip everything else
2. Is cursor on the `✕` delete button? → delete profile, skip everything else
3. Is cursor on the lock button? → toggle lock, skip everything else
4. Is cursor inside profile and not locked? → start profile drag or resize based on `hoverZone`
5. Is cursor inside profile and locked? → set profile selected, skip pan
6. None of the above → existing pan logic

---

## Completion Checklist

```
lib/draw/drawSelectionRect.ts
├── Bars grow left to right from x1
├── Hover highlight state (background + border opacity)
├── Resize handles on all four edges when hovered
├── Selected vs unselected border style
├── Lock indicator label/icon
└── Lock and delete button hit areas documented for canvas

components/chart/ChartCanvas.tsx
├── Auto-exit draw mode after first draw
├── hoverZone detection (move / resize-left/right/top/bottom / null)
├── Cursor changes per zone
├── isDraggingProfile move logic
├── isDraggingResize resize logic per edge
├── onMouseDown priority order implemented
├── Profile selected on click inside, deselected on click outside
└── Escape still clears profile (deliberate delete)

lib/store/chart.ts
├── customProfileLocked added
├── isProfileSelected added
├── setDrawMode(false) no longer clears customProfileRange
└── customProfileLocked persisted, isProfileSelected not persisted

Behavior:
├── Bars render left to right
├── Draw mode exits after first profile drawn
├── Profile stays on screen when draw tool toggled off
├── Profile only deleted via ✕ button or Escape
├── Dragging inside profile moves it, stays anchored correctly through pan/zoom
├── Edge dragging resizes the profile bounds
├── Resize handles visible on hover
├── Lock prevents move and resize, not deletion
├── Selected state shows solid border + handles
├── Unselected state shows dashed border, no handles
```

---

## What This Task Does Not Cover

- Multiple simultaneous profiles
- Named/saved profiles
- Snapping to candle boundaries during resize
- Profile duplication