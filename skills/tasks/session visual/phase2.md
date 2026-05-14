# Session Visualization — Task 2 of 2
## Canvas Rendering, Scroll/Zoom Behavior, and Multi-Panel

---

## Goal for This Task Only

Draw session boxes on the canvas. Sessions must stay correctly anchored while scrolling and zooming. Render behind all chart content. Handle multi-day candle ranges correctly — a session recurs every day so the draw function must render multiple instances. Handle multi-panel independently. Verify visually.

Task 1 must be complete before starting this.

---

## Core Concept — Sessions Repeat Daily

A session is not a one-time region. Tokyo opens every day at 00:00 UTC. The chart may show 3 days of 1m candles — Tokyo should appear three times. The draw function must identify every occurrence of each session across the visible candle range and draw each one.

This is the fundamental difference from the custom profile tool or measurement tool — those are single regions. Sessions tile across the entire visible history.

---

## Finding Session Occurrences

**File:** `lib/utils/sessions.ts`

### `getSessionOccurrences(session, candles, visibleRange)`

Takes a single `SessionConfig` and the visible candle array. Returns an array of pixel-coordinate pairs — one pair per occurrence of that session in the visible range.

**What it does:**

Iterates visible candles. For each candle, computes the UTC hour and minute of its open time:
- `date = new Date(candle.time * 1000)`
- `utcHour = date.getUTCHours()`
- `utcMin = date.getUTCMinutes()`

Determines if this candle falls within the session window:
- Session spans from `startHour:startMin` to `endHour:endMin` UTC
- A candle is "inside" the session if its open time is >= session start and < session end
- Check: `(utcHour * 60 + utcMin) >= (startHour * 60 + startMin)` AND same logic for end

Groups consecutive inside-session candles into contiguous blocks. Each block is one session occurrence.

For each block: record the index of the first and last candle in that block.

Returns an array of `{ firstIndex, lastIndex }` — one entry per session occurrence in the visible range.

**Performance note:**
This function iterates visible candles — not all 500. Visible range is typically 50–150 candles. This is fast enough to call on every redraw without concern.

---

## Drawing Session Boxes

**File:** `lib/draw/drawSessions.ts`

### `drawSessions(ctx, candles, visibleRange, indexToX, barWidth, canvasHeight, timeAxisHeight, sessions, sessionsEnabled)`

Parameters:
- `ctx` — canvas context
- `candles` — full candle array
- `visibleRange` — from coordinate system
- `indexToX` — coordinate function
- `barWidth` — current zoom level
- `canvasHeight`, `timeAxisHeight` — for vertical bounds
- `sessions` — the sessions config object from store (`{ tokyo, london, newYork }`)
- `sessionsEnabled` — master toggle boolean

If `sessionsEnabled` is false: return immediately, draw nothing.

For each of the three sessions, if `session.enabled` is true:
1. Call `getSessionOccurrences(session, candles, visibleRange)` to get all blocks
2. For each block, draw one session rectangle

### Drawing one session rectangle

```
x1 = indexToX(block.firstIndex) - barWidth / 2
x2 = indexToX(block.lastIndex)  + barWidth / 2
y1 = 0
y2 = canvasHeight - timeAxisHeight
```

If `x1` is null or `x2` is null: skip this block — candles are off screen.

Fill:
- `ctx.fillStyle = hexToRgba(session.color, 0.07)`
- `ctx.fillRect(x1, y1, x2 - x1, y2 - y1)`

No border on the session box. Border adds visual clutter. The fill alone is enough.

The `hexToRgba` helper converts a hex color string and opacity to an rgba string. Add it to `lib/utils/format.ts`:
- Input: `'#B39DDB'`, `0.07`
- Output: `'rgba(179, 157, 219, 0.07)'`

### Opacity

Default opacity `0.07` — very subtle. Session boxes are context, not foreground. Chart content must remain fully readable on top.

Do not make opacity user-configurable in this implementation. If it is too strong or too weak, adjust the default and rebuild.

---

## Session Label

Each session occurrence renders a small text label at the top of its box.

Position: `x = x1 + 4`, `y = 12`

Text: session name abbreviation — `TYO`, `LON`, `NYC`

Font: `JetBrains Mono`, `9px`
Color: same as session color at `0.5` opacity — `hexToRgba(session.color, 0.5)`

Only render the label when the box is wide enough: `x2 - x1 > 30`. Below 30px the label overlaps the box edge.

---

## Draw Order — Behind Everything

**File:** `components/chart/ChartCanvas.tsx`

Session boxes must render before all chart content so everything — candles, footprint cells, volume profile, bubbles, signals — paints on top.

```
1. drawGrid
2. drawSessions          ← new, immediately after grid
3. drawLines
4. drawSelectionHighlight
5. drawCandles OR drawFootprint
6. drawBubbles
7. drawAbsorption
8. drawExhaustion
9. drawMeasurementRect
10. drawCustomProfile
11. drawVolumeProfile
12. drawAxes
```

Session boxes are the lowest rendering layer above the grid.

---

## Scroll and Zoom Behavior

Session boxes re-derive their pixel positions on every redraw using `indexToX`. Since `indexToX` reflects the current `scrollOffset` and `barWidth`, session boxes automatically reposition correctly on scroll and zoom — same as candles. No special handling needed.

At very tight zoom (many candles visible, `barWidth` very small), session boxes may stack with very little gap between them if candles span multiple days. This is acceptable — the chart is too zoomed out for individual session boxes to be useful at that scale. Consider hiding labels when `barWidth < 3` but still draw the boxes.

At very wide zoom (few candles visible, `barWidth` large), a single session box may span the entire visible width. This is correct — the user is zoomed into one session's worth of time.

---

## Overlap Between Sessions

London and New York overlap from 13:00–16:00 UTC. Both boxes render independently. Where they overlap, their fills stack:
- `rgba(color1, 0.07)` + `rgba(color2, 0.07)` blended by the browser = slightly higher combined opacity

This is visually acceptable and actually useful — the overlap region appears slightly brighter, which accurately communicates that this is a high-activity window where two sessions are active simultaneously. No special overlap handling is needed.

---

## Behavior With Timeframes

Sessions are time-based, not candle-based. They work the same way regardless of timeframe because `getSessionOccurrences` works from UTC timestamps, not candle counts.

On 1m: a 6-hour Tokyo session spans 360 candles per occurrence.
On 1h: same session spans 6 candles per occurrence.
On 5m: 72 candles.

The draw function produces the correct box width in all cases because it uses `indexToX` which accounts for `barWidth`.

**One edge case:** on a 4h timeframe, a single candle may span across a session boundary — the candle starts inside the session and ends outside, or vice versa. In this case, include the candle in the session block if its open time falls within the session window. Accept that the box edge may not perfectly align with the session boundary — this is a minor visual imprecision acceptable at higher timeframes.

---

## Candlestick Mode vs Footprint Mode

Session boxes behave identically in both modes. No special logic for footprint mode. The session is a time-based background element — it does not interact with footprint cells, volume profile, or order flow signals.

The boxes render behind footprint cells exactly as they render behind candles.

---

## Multi-Panel Behavior

In dual panel mode, each panel renders its own session boxes independently via its own `drawSessions` call in its own `ChartCanvas` redraw.

Session config is shared state — it lives at the top level of the store, not per-panel. Both panels use the same session times and colors. If the user changes the Tokyo start time in settings, both panels update simultaneously.

Each panel's `scrollOffset` and `barWidth` are independent, so the session boxes may appear at different x positions in each panel (they are looking at different time ranges), but the session config is the same.

---

## Performance

`getSessionOccurrences` runs once per session per redraw — three times total. Each call iterates ~50–150 visible candles. This is negligible.

The only expensive scenario is if `visibleRange` is very large (user has zoomed far out and 400+ candles are visible). In that case, session boxes may have many occurrences. Even then, drawing 30–50 filled rectangles is fast — well under a millisecond.

No caching, no memoization needed. Recompute fresh on every redraw.

---

## How to Verify This Task is Done

**Basic rendering:**
- Open the chart — Tokyo, London, and New York session boxes appear as subtle colored backgrounds
- Each session has the correct color (purple, blue, green)
- Session labels `TYO`, `LON`, `NYC` appear at the top-left of each box
- Boxes render behind candles — candles are fully visible on top of the session tint

**Scroll and zoom:**
- Pan left and right — session boxes move with the candles, stay correctly anchored
- Zoom in — boxes expand as candles spread out
- Zoom out — boxes compress, multiple day sessions visible simultaneously

**Overlap:**
- During 13:00–16:00 UTC, London and New York boxes overlap — the overlap area appears slightly brighter than either box alone

**Settings:**
- Toggle Tokyo off in settings — Tokyo boxes disappear immediately
- Toggle back on — boxes return
- Change Tokyo start hour to `1` — Tokyo boxes shift to start one hour later on the chart
- Change London color to red — all London boxes update to red immediately
- Master toggle off — all session boxes disappear at once
- `S` keyboard shortcut — toggles all boxes on and off

**Timeframes:**
- Switch from 1m to 1h — session boxes still appear, now spanning fewer candles but same time range
- Switch to 5m — boxes re-render at the correct width for 5m candles

**Multi-panel (if implemented):**
- Dual panel mode active — both panels show session boxes
- Change a session time — both panels update
- Each panel scrolled to a different date — session boxes appear at different x positions in each panel

**No regression:**
- All existing features still work — candles, footprint, profiles, signals, measurement tool all render correctly on top of session boxes