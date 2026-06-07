Audit the existing market debug system before implementing a visual debug panel.

Do not implement changes yet. Only inspect and report.

Context:

* The app already has some debug access through `window.__MARKET_DEBUG__.getSnapshot()`.
* Current debugging is mostly console/JSON based.
* We want to build an internal developer/debug panel later that visually shows performance, restore, runtime, and chart-layer stats.
* Before building the panel, audit what debug data already exists and what is missing.

Goal:
Understand the current debug architecture and recommend the cleanest way to add an internal visual debug panel without duplicating debug logic.

1. Find existing debug implementation

Inspect all existing debug-related code.

Look for:

* `window.__MARKET_DEBUG__`
* `getSnapshot`
* debug snapshots
* restore diagnostics
* aggregate bubble diagnostics
* performance/debug helpers
* console/debug flags
* dev-only helpers

Report:

* exact files/functions involved
* what data each debug section currently exposes
* whether debug is panel-scoped or global
* whether debug data is updated live or only on demand

2. Audit current debug data

List what is currently available for:

* restore status
* candle restore
* footprint restore
* volume profile restore
* aggregate bubble restore
* aggregate bubble buffer
* live feed/subscription status
* signal counts
* liquidity/orderbook status
* profile/cache status
* chart/panel state
* multi-panel state

For each, say:

* available
* partially available
* missing

3. Audit missing performance timings

Check whether the app currently records timings for:

* total redraw time
* candles draw time
* footprint draw time
* volume bubbles draw time
* aggregate bubbles draw time
* volume profile draw time
* signals draw time
* drawings/tools draw time
* restore fetch time
* restore parse time
* restore hydrate time
* store update frequency
* localStorage write frequency
* live trades per second
* redraw count per second

Report what exists and what needs to be added.

4. Check where timers should be added later

Identify the best files/functions to instrument later.

Likely areas:

* `ChartCanvas.tsx` render/redraw function
* candle drawing function
* footprint drawing function
* bubble drawing function
* volume profile drawing/building functions
* signal drawing functions
* `FeedProvider.tsx` restore/fetch/hydration flow
* Zustand/store update paths if practical

Do not add timers yet. Just identify locations.

5. Debug panel design recommendation

Recommend a simple v1 debug panel structure.

Suggested tabs:

* Performance
* Restore
* Runtime
* Bubbles
* Signals
* Store/Updates

For each tab, list what should be displayed using existing debug data and what requires new instrumentation.

6. Access control / visibility

Recommend how the panel should be enabled.

Options to evaluate:

* `NEXT_PUBLIC_ENABLE_DEBUG_PANEL=true`
* `?debug=true`
* keyboard shortcut such as `Ctrl + Shift + D`
* dev environment only

Recommend the safest/simple option for v1.

7. Output format

Provide the report in this structure:

A. Short summary
B. Existing debug files/functions
C. Existing debug data inventory
D. Missing debug/performance metrics
E. Best instrumentation points for Phase 3 timers
F. Recommended debug panel v1 structure
G. Risks / things not to overbuild
H. Implementation prompt outline for the next task

Important:

* Do not implement code.
* Do not refactor debug system.
* Do not add UI yet.
* Do not add performance timers yet.
* Only audit and recommend.
