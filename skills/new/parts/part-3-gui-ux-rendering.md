# Part 3 — GUI/UX Mapping: How the Rendering Actually Works

**Scope:** the coordinate system, the canvas layering strategy, what gets redrawn on which trigger, and where computation should physically run on the client. You've already got the right foundation — canvas-based drawing, animation-frame-driven updates, state kept outside React's re-render cycle via Zustand. This file goes past that foundation into what changes at higher data volume and multiple simultaneous viewers, and includes a direct diagnosis of the pagination-rendering complaint.

---

## 1. The Coordinate System, in Full Detail

Everything on the chart reduces to two conversion functions, kept perfectly consistent everywhere they're used:

- **priceToY(price)** — takes a price and the currently visible price range (min/max) and the canvas's pixel height, returns a vertical pixel position.
- **timeToX(timestamp)** — takes a timestamp and the currently visible time range and the canvas's pixel width, returns a horizontal pixel position.

**The viewport** is just two ranges: the visible price range and the visible time range. Every other interaction is a mutation of this pair of ranges, never a direct manipulation of pixels:

- **Zoom** = shrinking or growing one or both ranges, while the pixel dimensions of the canvas stay fixed. Zooming in on price means shrinking the visible price range; the same pixel height now represents fewer dollars, so price differences appear larger on screen.
- **Pan** = shifting both ranges by the same amount without changing their size — the window slides, its width doesn't change.
- **Hit-testing** (what's under the cursor, for tooltips and the crosshair) is running both conversion functions in reverse: take a mouse pixel position, recover the price and time it corresponds to given the current viewport, then look up what data exists at that price/time.

**Why this matters as a single source of truth:** if zoom, pan, tooltip positioning, and drawing each implement their own slightly different version of "where does this price go on screen," they will drift out of sync with each other at the edges — a tooltip that's a few pixels off from the bar it's supposedly describing, or a crosshair that doesn't quite line up with the price axis after a zoom. Centralizing both conversion functions (and their inverses) in one place and having every other piece of code call through them, rather than each doing its own pixel math, is what keeps this coherent as more visual layers get added over time.

**Resize handling:** when the canvas's actual pixel dimensions change (window resize, sidebar toggle), the viewport's price/time *ranges* should stay the same — only the pixel dimensions used in the conversion functions change. Getting this backwards (resetting the viewport on resize) is a common and jarring bug — the chart appears to "jump" to a different price range whenever the window is resized.

---

## 2. Layered Canvas Architecture, in Full Detail

Stack multiple canvas elements on top of each other via CSS positioning (each absolutely positioned, filling the same space), rather than one canvas redrawing everything on every update:

- **Static/background layer** — grid lines, price axis labels, time axis labels, session boundary markers. Redraws only when the viewport changes (zoom/pan) or the window resizes — never on a new tick.
- **Live-data layer** — footprint cells, candle bodies, bubbles, volume profile. Redraws when new data arrives.
- **Overlay layer** — crosshair, hover tooltip, any in-progress drawing tool. Redraws on essentially every mouse move, but this layer is cheap to redraw (a couple of lines and a text label), so redrawing it constantly doesn't cost much.

Set `pointer-events: none` on every layer except the topmost one that actually needs to catch mouse events, so mouse interaction doesn't need to be manually routed to the correct layer — the browser handles it via normal event bubbling to whichever element is actually meant to receive it.

**Why this separation is the direct fix for laggy interaction:** without it, a mouse move anywhere on the chart forces a full redraw of every footprint cell, every bubble, and the entire grid, sixty times a second while the mouse is moving — all to update a crosshair that's a few lines of drawing. Splitting the overlay into its own layer means that cost disappears; only the actual crosshair drawing happens on mouse move, and the expensive layers stay untouched until their own data actually changes.

---

## 3. Only Redraw What Changed

**Viewport culling.** The draw loop should iterate only over data that intersects the currently visible time/price range — never over the full set of loaded data. If your draw function currently loops over "every bar you've ever loaded" and computes each one's pixel position before checking whether it's on-screen, that's wasted work that grows with how much history the user has scrolled through, even though the visible chart never shows more than a fixed number of bars at once. The fix is to compute the visible time range first, then either binary-search or index directly into the loaded data to find the start/end of what's actually visible, and only touch that slice.

**Dirty-rectangle rendering.** Rather than calling `clearRect` on the entire canvas and redrawing everything on every update, track the bounding box of what actually changed since the last frame (typically just the rightmost, currently-forming bar when a new trade arrives) and clear + redraw only that region. Since the overwhelming majority of a footprint or volume-profile chart is historical and unchanged from one frame to the next, this — combined with viewport culling above — is what makes the difference between a redraw that costs something proportional to "everything on screen" versus one that costs something proportional to "only what's new," and it's a large part of why a chart can stay smooth even as the total loaded dataset grows into the tens of thousands of bars.

---

## 4. Where This Connects to Your Pagination Bug

"Pagination rendering is not good" almost always traces back to one of these patterns, and it's worth checking each explicitly rather than guessing:

- **Full re-render on every page load.** If loading the next chunk of historical data (scrolling back) triggers a full redraw of the entire visible chart rather than just extending the drawn region to include the newly-loaded bars, you'll see exactly the kind of visible stutter or flash that "not good" usually describes — the fix is the same dirty-region thinking from Section 3, applied to data loading events, not just live ticks.
- **State replaced instead of merged.** If a page of historical data arrives and the client-side state management replaces the entire loaded-data array/object with a new one (rather than merging the new page into the existing structure), anything relying on that array's identity — including, in a React-adjacent codebase, memoized components or effects keyed on it — will treat this as "everything changed," even though 99% of the data is identical to what was already there a moment ago. Structuring the merge as an explicit append/prepend into the existing store (Zustand, which you're already using, is well suited to this — update the store in place rather than swapping in a whole new object) avoids this class of bug entirely.
- **Coordinate recalculation on prepend.** When older data is prepended (loaded at the left edge, scrolling back in time), if anything about the coordinate system depends on the *index* of a bar within the loaded array rather than its actual timestamp, prepending shifts every existing index and invalidates positions that were already correct — visible as a jump. The fix is structural: the coordinate functions from Section 1 should always key off timestamp, never off array position, specifically so that prepending older data changes nothing about how already-visible bars are positioned.
- **No decoupling between "fetch resolved" and "redraw."** If every historical-data fetch response directly and synchronously triggers a full draw call inline, a burst of rapid scrolling that fires several fetches in quick succession can trigger several full redraws stacked back to back. Debouncing the redraw itself (batch: let new data arrive, but only actually redraw on the next animation frame, regardless of how many fetch responses landed since the last one) decouples data arrival from render timing and smooths this out.

---

## 5. Getting Heavy Work Off the Main Thread

The same single-threaded constraint from the ingestion file (Part 1) applies here, just on a different machine: the browser has exactly one thread doing layout, paint, and your JavaScript. Heavy work on it — a large draw loop, or worse, a data aggregation step running synchronously right before a draw — blocks scrolling, clicking, and the crosshair until it finishes. **Web Workers** are the browser's version of the same fix Part 1 applies server-side with `worker_threads`: a background JS thread that can run computation without touching the main thread. Recognizing these as the same underlying pattern, applied on two different machines, is worth doing once — you're not learning two unrelated techniques, you're applying the identical idea at both ends of the pipeline.

**OffscreenCanvas** takes this further specifically for drawing: a canvas element's rendering context can be transferred to a worker (`canvas.transferControlToOffscreen()`, then the resulting handle is sent to the worker via `postMessage`), and the worker draws directly onto it, off the main thread entirely. Be precise about what this actually buys you: the worker still ultimately shares the same GPU as the main thread when the browser composites everything onto the screen, so pure drawing-only gains are moderate. Where it earns its complexity is when the *computation feeding* the drawing is heavy — footprint/profile aggregation, in your case — because that computation can now happen entirely off the main thread, with only the relatively cheap final draw calls needing to touch the shared canvas context.

**Practical split:** keep simple, cheap UI (overlay layer, basic event handling) on the main thread. Move data aggregation and, where it's worth the added complexity, the live-data layer's drawing itself into a worker with an OffscreenCanvas. Given you're chasing a hang that's plausibly rooted in exactly this kind of synchronous heavy computation, this is one of the two places (the other being the server-side fix in Part 1) where that computation needs to actually move, not just get faster.

---

## 6. Rendering the Specific Visuals

**Footprint cells.** Batch draw calls by type rather than interleaving them — draw every rectangle for a bar first, then every text label, rather than alternating rectangle-text-rectangle-text. Switching between different kinds of canvas operations carries more overhead than doing many of the same kind consecutively. Text is typically the single most expensive canvas drawing operation relative to shapes — for cells whose numbers haven't changed since the last frame (which, for any closed/historical bar, is almost all of them), avoid re-drawing that text at all; only the currently-forming bar's numbers are actually changing frame to frame, so only that bar's text needs to be touched.

**Bubbles.** Rendered as filled circles at the trade's price/time position, radius from the sizing function (Part 4), colored by aggressor side. Because Binance's `aggTrade` stream already aggregates simultaneous fills at one price into a single event, you generally don't need additional client-side grouping for a single bubble — but a large aggressive order sweeping through several price levels in a fast burst of separate `aggTrade` events milliseconds apart can visually read as several small bubbles when it's really one continuous move; grouping same-side trades that land within a very short time window (tens of milliseconds) into one visually larger bubble is worth considering once this becomes a feature people rely on for reading intent, rather than something the raw event stream naturally captures.

**Heatmap/liquidity gradient** (for the future liquidity feature): resting depth at each price level over time, rendered as color opacity, updates on the order-book diff cadence rather than the trade cadence — it needs its own draw pass and, given how often depth updates arrive, is a strong candidate for the OffscreenCanvas/worker treatment from Section 5 once it's built, rather than something to bolt onto the main thread and find out later that it's the new source of hangs.

---

## 7. The React/Framework Boundary

Since the front end is React-based: the canvas element itself should be mounted once via a ref and never re-rendered by React after that — all drawing happens imperatively (direct calls into the canvas context), triggered by data changes, not by component re-renders. The specific trap worth naming, given you're already on Zustand: subscribing to the *entire* store inside a React component (even one that only reads it to trigger a redraw) causes that component to re-render on every single store update, which for tick-rate data means constant unnecessary React re-renders sitting on top of the canvas drawing you're already doing. The fix is to use Zustand's vanilla store subscription (`store.subscribe(...)`) outside of React's render cycle for anything tick-rate — trade updates, live order-book changes — so those updates drive the imperative draw loop directly, and reserve actual React state/re-renders for genuinely UI-level state that changes rarely (which symbol is selected, which indicators are toggled on, panel layout). This is the same "decouple frequent updates from the render cycle" idea from Section 4's pagination discussion, applied to live data instead of paginated data.

---

## Terms Reference

- **Viewport** — the currently visible price range and time range; the single source of truth that zoom, pan, and all drawing derive from.
- **Viewport culling** — skipping the pixel-position computation and draw call entirely for any data outside the current viewport.
- **Dirty-rectangle rendering** — clearing and redrawing only the specific region of canvas that actually changed, instead of the whole canvas.
- **OffscreenCanvas** — a canvas rendering context that can be transferred to and drawn on from a Web Worker, off the main thread.
- **Web Worker** — the browser's background-thread mechanism for running JavaScript without blocking the main thread; the client-side counterpart to Node's `worker_threads`.
- **Store subscription (vanilla)** — reading from a state store (Zustand) outside of React's component render cycle, so high-frequency updates don't trigger React re-renders.
