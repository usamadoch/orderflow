Implement Internal Debug Panel v1.

Context:

* Existing debug system is centered on `window.__MARKET_DEBUG__.getSnapshot()`.
* Main debug registry lives in `lib/debug/marketMetrics.ts`.
* It already exposes streams, caches, restore diagnostics, aggregate bubble diagnostics, and totals.
* The goal is to create a visual internal panel instead of manually running `window.__MARKET_DEBUG__.getSnapshot()` in the console.
* Do not duplicate debug logic inside the UI. The panel should read existing debug data.
* Note: liquidity heatmap code lives in `lib/liquidity/heatmap.ts` and `lib/draw/drawLiquidityHeatmap.ts`. Do not reference `orderbookHeatmap.ts`.

Do not add performance timers in this task.
Do not refactor the debug system.
Do not add Web Workers.
Do not change chart behavior.
Do not change market-data logic.

1. Add debug panel access control

Enable the panel only when one of these is true:

* development environment
* `NEXT_PUBLIC_ENABLE_DEBUG_PANEL=true`

Add keyboard shortcut:

* `Ctrl + Shift + D`

Behavior:

* shortcut toggles the debug panel open/closed
* panel is hidden by default
* panel should not appear for normal users unless enabled

2. Create a debug snapshot adapter

Create a small adapter/helper that reads from:

* `window.__MARKET_DEBUG__.getSnapshot()`
* `useChartRuntimeStore`
* `useChartStore`

The adapter should prepare clean display data for the panel.

Important:

* Do not put heavy calculations inside React render.
* Do not duplicate restore/cache/bubble logic.
* Do not copy or display huge raw arrays by default.
* Poll snapshot at low cadence, for example every 1000ms.
* Avoid high-frequency React state updates.

3. Add floating debug panel UI

Create an internal floating panel.

Requirements:

* draggable or fixed position is fine
* dark UI matching the chart style
* close button
* refresh button
* copy snapshot button
* panel should not block chart interaction when closed
* panel should be readable but simple

4. Add tabs

Add these tabs:

* Performance
* Restore
* Runtime
* Bubbles
* Signals
* Store/Updates

For v1, show available data only. If a metric is missing, show `Not instrumented yet`.

5. Performance tab

Use existing data where available:

* stream event rates
* cache totals
* global totals

Show missing metrics as `Not instrumented yet`:

* total redraw time
* candles draw time
* footprint draw time
* bubbles draw time
* volume profile draw time
* signals draw time
* drawings/tools draw time
* redraw count/sec

Do not add these timers yet.

6. Restore tab

Show:

* current per-panel restore status from runtime store
* recent restore calls from debug snapshot
* candle restore info if available
* footprint restore info if available
* volume profile restore info if available
* aggregate bubble restore info if available
* raw trade restore skipped/enabled status if available

7. Runtime tab

Show per panel:

* symbol/pair
* timeframe
* chart mode
* contract type
* data source mode
* loading/connected status
* candle count
* footprint work status if available
* liquidity zones count if available
* orderbook/heatmap status if available

8. Bubbles tab

Use existing aggregate bubble diagnostics.

Show per panel:

* bubble source
* aggregate bubble market source
* buffer size/cap
* live count
* restored count
* spot/futures counts
* visible count
* rendered count
* filter reasons
* latest rendered event
* min volume/min orders
* size by mode
* scale mode

9. Signals tab

Signal diagnostics are not currently in `window.__MARKET_DEBUG__`.

Read signal counts directly from `useChartRuntimeStore` runtime maps/arrays.

Show per panel:

* absorption count from absorption runtime map/array length
* exhaustion count from exhaustion runtime map/array length
* iceberg count from iceberg levels/map/array length
* liquidity vacuum count from liquidity vacuum zones/map/array length

Do not mark these as missing just because they are not inside `__MARKET_DEBUG__`.

If compute/draw timings are missing, show `Not instrumented yet`.

10. Store/Updates tab

For v1, show available store summary:

* persisted settings summary
* runtime store summary
* panel count
* active panel ids if available

Show missing metrics as `Not instrumented yet`:

* store updates/sec
* localStorage writes/sec
* mousemove updates/sec
* redraw triggers/sec

Do not add store instrumentation yet.

11. Copy snapshot

Add a button:

* `Copy Snapshot`

It should copy a JSON snapshot containing:

* market debug snapshot
* runtime store summary
* chart settings summary
* timestamp

Important:

* Do not copy the full raw debug object with huge arrays.
* Truncate arrays to the last 10 items in the copy output.
* Truncate deeply nested large arrays where needed.
* Include counts when arrays are truncated.
* Full raw snapshot should remain available through the console command.

This keeps copied debug output readable and useful for sharing.

12. Do not overbuild

Do not implement:

* performance timers
* redraw instrumentation
* store update counters
* localStorage write counters
* new chart logic
* new cache logic
* new market-data logic

This is only the visual panel v1.

13. Validation

Run:

* `npx.cmd tsc --noEmit`

If lint has unrelated existing failures, mention them but do not fix unrelated files.

Expected result:

* Internal debug panel opens with `Ctrl + Shift + D`.
* Panel reads existing debug data visually.
* Signal counts are read from runtime store maps/arrays.
* Copy Snapshot produces a trimmed JSON, not a giant raw dump.
* Console command is no longer required for common debugging.
* Missing future metrics are clearly marked as `Not instrumented yet`.
* No chart behavior changes.
