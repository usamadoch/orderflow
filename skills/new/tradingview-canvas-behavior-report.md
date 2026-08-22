# TradingView — Canvas Interaction & Behavior Report

**Scope:** how TradingView's charts actually feel to use — dragging, zooming horizontally and vertically, price-axis behavior, the crosshair, and live-data behavior — plus the specific settings that control each one, so they can be replicated or deliberately deviated from in your own canvas engine.

**What this is grounded in.** TradingView publishes and open-sources **Lightweight Charts**, an HTML5-canvas charting library built by TradingView itself, and its documented options are the clearest authoritative window into the interaction model TradingView's own charts are built around — even though the flagship tradingview.com app runs a more advanced, larger private library on top of the same underlying ideas. Where a behavior is confirmed by this public API, it's stated as fact below; where something is a well-known general convention rather than something directly documented, it's flagged as such.

---

## 1. Panning (Dragging)

**The behavior.** Dragging directly on the chart body pans — it moves the visible time window left/right, and depending on configuration, can also move the visible price window. This tracks the cursor directly, one-to-one, in real time; there's no animated easing on the pan itself while your mouse is actually moving; it moves exactly as fast and as far as your cursor does.

**Where the "animation" actually lives: momentum after release.** On touch devices, releasing a drag mid-swipe continues the chart moving briefly and decelerates smoothly to a stop — the same inertial "flick" feel a phone's native scroll view has. On a mouse, this momentum is **off by default** — releasing the mouse button stops the pan immediately, with no glide. This is a deliberate, not incidental, distinction: touch users expect and are used to inertial scrolling from every other app on their device, while mouse users generally want precise, immediate stops rather than needing to guess where a momentum-glide will settle.

**The settings.**

- `handleScroll` — a group of four independent toggles: `mouseWheel`, `pressedMouseMove` (click-and-drag panning), `horzTouchDrag`, `vertTouchDrag`. Each can be enabled or disabled independently, or the whole group can be set to a single `true`/`false`.
- `kineticScroll` — two independent toggles, `mouse` and `touch`, each controlling whether momentum/deceleration applies after release for that input type. Default: `touch: true`, `mouse: false`.

---

## 2. Zooming — Horizontal (Time) and Vertical (Price)

**Zooming the chart body.** Mouse wheel and pinch gestures zoom the chart. The standard convention (and the expected behavior here) is that zooming is anchored to the cursor or pinch-center position — the specific time/price point under the cursor stays visually fixed while everything scales around it, rather than the zoom being anchored to the center of the canvas regardless of where you're pointing. This is what makes "zoom in on this exact spike" feel natural instead of requiring a zoom-then-pan correction afterward.

**Zooming a single axis by dragging it — a separate gesture from panning.** Clicking and dragging directly on the **time axis** (the bottom strip) rescales time only — it changes how much time is visible without moving the vertical price window. Clicking and dragging on the **price axis** (the side strip) rescales price only, the vertical equivalent. This is a deliberately distinct interaction from dragging the chart body itself (which pans rather than zooms) — the axis strips are their own drag targets with their own behavior.

**Resetting a scale.** Double-clicking either axis resets that axis's scale back to its default/auto state, undoing any manual drag-to-zoom that was applied to it.

**A zoom floor.** There's a minimum zoom-in limit — the chart won't let you zoom in far enough that fewer than roughly two bars would be visible, which prevents the chart from reaching a degenerate, unusable state at the extreme end of zooming in.

**The settings.**

- `handleScale` — `mouseWheel` (boolean), `pinch` (boolean), `axisPressedMouseMove` (an object with independent `time` and `price` booleans, controlling whether dragging each specific axis rescales it), `axisDoubleClickReset` (same shape — independent `time`/`price` booleans for whether double-click resets each axis).

---

## 3. Price Axis Behavior — Auto-Scale and Scale Modes

**Auto-scale is the default, and it's continuous, not a one-time fit.** With auto-scale on, the visible price range isn't an independently-set value — it's _derived_ from whatever bars are currently visible on the time axis, recalculated every time the visible time range changes. Pan left into older history, and the price axis silently rescales to fit whatever's now visible. Zoom the time axis in or out, same thing. This coupling — price range as a function of the current time range, not a separately-held setting — is the core of what makes the chart feel like it's always showing a well-framed view without the user manually adjusting price zoom after every pan.

**Manually overriding it.** Dragging the price axis directly (Section 2) switches that axis out of auto-scale into a fixed manual scale, which stays fixed (ignoring what's visible on the time axis) until the user double-clicks to reset it back to auto.

**The four display modes**, which change how price values are mapped to vertical position, independent of the auto-scale/manual distinction above:

- **Normal** — a plain linear scale; equal dollar amounts occupy equal vertical distance everywhere on the axis.
- **Logarithmic** — an exponential scale where equal _percentage_ moves occupy equal vertical distance, regardless of absolute price. A move from $10 to $20 (a 100% change) takes up the same vertical space as a move from $100 to $200 (also 100%), even though the second move is ten times larger in absolute dollars. This is the standard choice for anything that can move by multiples over its history — exactly the case for most crypto assets — since a linear scale would visually flatten early, smaller-dollar-value volatility into near-invisibility.
- **Percentage** — a linear scale, but labeled and measured as percentage change from the first visible value rather than absolute price; the first visible point reads as 0%.
- **Indexed to 100** — the same idea as Percentage, but the first visible value is set to display as 100 instead of 0%, with everything else shown relative to that baseline. Mainly useful for comparing two differently-priced instruments on the same chart by normalizing them to a common starting point.

---

## 4. The Crosshair — Magnet vs. Normal

**Normal mode.** The crosshair sits at the exact pixel position of the cursor, no snapping — a free-moving reticle.

**Magnet mode.** The crosshair snaps to the nearest actual data point rather than sitting wherever the cursor happens to be — in the base charting library this means the nearest close price; the full trading platform extends this with **Strong** and **Weak** magnet variants for drawing tools specifically (Strong snaps only to high/low wicks, Weak also allows snapping to open/close), plus a newer option to snap to indicator values rather than only price bars. The purpose is precision — reading an exact value off the axis label, or placing a trendline/Fibonacci tool exactly on a wick or close rather than a few pixels off from eyeballing it.

---

## 5. Real-Time / Live-Edge Behavior

This section matters more for your use case than a typical static chart, since your data is continuously live and multiple users will each be scrolled to different positions at any given moment.

**The core rule: new bars only pull the view forward if the user is already at the live edge.** If the visible range currently includes the most recent bar, a new incoming bar shifts the whole visible window forward to keep showing the live edge — the chart "follows" price in real time. But if a user has scrolled back into history, arriving live bars do **not** yank their view forward to the present; their scroll position is left alone, and the new data simply accumulates off-screen to the right until they scroll back themselves. This is a small rule with an outsized effect on how the chart _feels_ to use — without it, any user reviewing history would get forcibly dragged back to the live edge every time a new trade printed, which would make historical review essentially unusable on an active symbol.

**Reserved space at the live edge.** A small empty margin is kept to the right of the most recent bar by default, rather than the last bar sitting flush against the right edge of the canvas — this gives the most recent price action a bit of breathing room and somewhere for the crosshair/price label to sit without overlapping the last bar.

**Hard scroll boundaries.** Scrolling can be capped at both ends — refusing to scroll past the first available bar of loaded history, and refusing to scroll past the most recent bar into "future" empty space — independently toggleable per edge.

**Resize stability.** The currently visible time range can be explicitly locked so that resizing the browser window or container doesn't itself change what's in view — a resize changes the pixel dimensions being mapped to, not the underlying visible range (the same principle covered in your Part 3 rendering file).

**The settings.**

- `rightOffset` — how much empty space (in bar-widths) to reserve to the right of the most recent bar.
- `shiftVisibleRangeOnNewBar` — whether a new live bar shifts the visible window forward; explicitly documented as only taking effect when the last bar is already visible, which is exactly the "only follow if already at the live edge" rule above.
- `fixLeftEdge` / `fixRightEdge` — hard scroll limits at the start and end of available data respectively.
- `lockVisibleTimeRangeOnResize` — prevents the visible range from changing purely because the container was resized.

---

## 6. Rendering Precision — Pixel-Perfect Canvas

TradingView specifically engineered around a common canvas pitfall: on high-density screens or at non-100% browser zoom, naive canvas drawing produces blurry lines because a "1-pixel" line doesn't actually land cleanly on a single device pixel. Their fix — device-pixel-ratio-aware coordinate snapping, so every drawn line lands cleanly on the actual pixel grid regardless of screen density or browser zoom level — is significant enough that they built and maintain a small dedicated internal library (referred to internally as "fancy-canvas") specifically to handle correct canvas sizing and pixel-ratio configuration, rather than leaving each part of the chart to handle this individually. The practical result: text and lines stay crisp at any zoom level, and the chart doesn't need a refresh or manual adjustment when the browser's zoom level changes mid-session.

A smaller, related polish detail: price and time axis labels are explicitly kept from sliding off the visible edge of the canvas — a label near the very top or bottom of the price axis stays fully visible rather than getting clipped, which is a deliberate positioning adjustment, not an automatic side effect of normal label placement.

---

## 7. Historical Data Loading While Scrolling

The library exposes a subscription hook that fires whenever the visible time range changes from user interaction (panning, zooming) — the intended use, per TradingView's own documentation, is listening for this event specifically to trigger fetching more historical data once the user scrolls near the edge of what's currently loaded. This confirms the general pattern your Part 5 file already lays out (prefetching the next page before the user hits the loaded edge) is exactly the mechanism TradingView's own library is built to support — the event fires on visible-range change, not on scroll pixel position directly, which avoids over-firing the historical-data request on every small scroll adjustment.

---

## 8. Settings Reference — Consolidated

| Setting                                            | Controls                                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `handleScroll.mouseWheel`                          | Whether the mouse wheel pans the chart                                                              |
| `handleScroll.pressedMouseMove`                    | Whether click-and-drag pans the chart                                                               |
| `handleScroll.horzTouchDrag` / `vertTouchDrag`     | Whether touch dragging pans horizontally / vertically                                               |
| `handleScale.mouseWheel`                           | Whether the mouse wheel zooms                                                                       |
| `handleScale.pinch`                                | Whether pinch gestures zoom                                                                         |
| `handleScale.axisPressedMouseMove.time` / `.price` | Whether dragging the time/price axis rescales that axis                                             |
| `handleScale.axisDoubleClickReset.time` / `.price` | Whether double-clicking an axis resets its scale                                                    |
| `kineticScroll.mouse` / `.touch`                   | Whether momentum/deceleration applies after releasing a drag, per input type                        |
| Price scale `autoScale`                            | Whether the price axis continuously refits to the visible time range, or holds a fixed manual range |
| Price scale `mode`                                 | Normal / Logarithmic / Percentage / Indexed to 100                                                  |
| Crosshair `mode`                                   | Normal (free) vs. Magnet (snaps to nearest data point)                                              |
| `rightOffset`                                      | Empty space reserved to the right of the most recent bar                                            |
| `shiftVisibleRangeOnNewBar`                        | Whether new live bars pull the view forward — only when already at the live edge                    |
| `fixLeftEdge` / `fixRightEdge`                     | Hard scroll limits at the start/end of available data                                               |
| `lockVisibleTimeRangeOnResize`                     | Whether a container resize is prevented from changing the visible range                             |

---

## 9. What This Means for Your Rebuild

A few of these translate directly into concrete additions worth designing in from the start, rather than retrofitting later:

- **Treat axis-drag-to-zoom as a distinct gesture from body-drag-to-pan**, each with its own hit region (the axis strip vs. the chart body) and its own effect (rescale one axis vs. shift the visible window). Conflating these into one drag handler is a common source of charts that feel "off" compared to TradingView without an obvious reason why.
- **Implement the live-edge-follow rule explicitly** (`shiftVisibleRangeOnNewBar`'s actual behavior, Section 5) — this matters more for you than it did for your single-user build, since with several concurrent viewers, each one's scroll position is independent, and each needs their own "am I currently at the live edge" state driving whether incoming data moves their view.
- **Make auto-scale a real, toggleable state per price axis** — not just the initial fit calculation run once at load — so that panning and zooming the time axis correctly keeps recalculating the visible price range live, exactly as Section 3 describes, until the user explicitly overrides it by dragging the axis themselves.
- **Kinetic scroll only for touch, not mouse**, matching the documented default — this is a small detail but a deliberate one, and skipping it (or, worse, adding mouse momentum where TradingView specifically doesn't) is an easy way to make a chart feel subtly unfamiliar to users coming from TradingView-style tools.
