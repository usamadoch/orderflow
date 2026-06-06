



Implement the hidden-work fixes for Footprint and Iceberg from the Phase 2 audit.


Do not rebuild the chart. Do not change visual behavior when features are enabled. Only stop unnecessary background work when features are disabled or not needed.

Audit findings to fix:

1. Footprint work is always-on per mounted panel, even when chart is in candlestick mode and footprint is hidden.
2. Stored footprint restore is unconditional.
3. Live trade footprint ingestion is always running for selected dataSourceMode.
4. Iceberg is mostly gated, but it still does unnecessary state clearing/updating while disabled.

Goal:
Make Footprint and Iceberg truly need-based.

1. Add a `needsFootprintWork(panel)` predicate

Create a clear helper/predicate that decides whether footprint work is needed for a panel.

Footprint work should run only if at least one of these is true:

* `chartMode === 'footprint'`
* Footprint-cell Volume Bubbles are enabled and `bubbleSource === 'footprintCells'`
* CVD is enabled and depends on footprint/delta data
* Any enabled signal needs footprint data:

  * Absorption
  * Exhaustion
  * Iceberg
  * Liquidity vacuum if it depends on footprint data
* Browser market writes are explicitly enabled and require footprint aggregation
* Any other existing feature truly depends on footprint cells

If none of these are true:

* do not restore stored footprint rows
* do not hydrate footprint rows
* do not ingest live trades into the footprint aggregation engine
* do not trigger footprint redraw bookkeeping

Important:

* Candlestick mode alone should not require footprint work.
* Switching to Footprint mode should trigger/restore needed footprint data at that time.
* Do not break fast switching; if data is not ready, restore/load it when Footprint is enabled.

2. Gate stored footprint restore

Currently `shouldHydrateStoredFootprints = true` or equivalent unconditional logic exists.

Change this:

* only fetch/restore `/api/history/footprint` when `needsFootprintWork(panel)` is true
* if skipped, record debug/restore status like `footprintRestoreSkipped: true`
* when user later enables Footprint or a feature needing footprint, restore then

Do not remove the footprint restore path. Only gate it.

3. Gate live footprint ingestion

Live Binance `aggTrade` events should not always be fed into `AggregationEngine` for footprint if no active feature needs footprint.

When `needsFootprintWork(panel)` is false:

* skip footprint aggregation ingestion
* skip footprint/profile redraw bookkeeping tied only to footprint
* still allow live candles/chart price to update normally

When `needsFootprintWork(panel)` becomes true again:

* resume ingestion
* use stored restore and live data from that point forward as current architecture allows

Do not break:

* candles
* aggregate trade bubbles source
* volume profile if it has its own restored/profile path
* spot/futures subscriptions needed by other enabled features

4. Multi-panel behavior

Apply the predicate per panel.

In dual chart mode:

* left panel should only do footprint work if left panel needs it
* right panel should only do footprint work if right panel needs it
* one panel needing footprint should not force the other panel to do footprint work

5. Fix Iceberg disabled-state waste

Audit found Iceberg is mostly gated, but still calls something like `setIcebergLevels(panelId, [])` on bucket/lookback effects even when disabled.

Fix this:

* if Iceberg is disabled and there are no existing iceberg levels to clear, do not update state
* do not repeatedly write empty arrays/maps while disabled
* only clear once when transitioning from enabled to disabled or when stale data actually exists
* do not run iceberg engine/update logic while disabled

Keep Iceberg behavior unchanged when enabled.

6. Debug / verification

Add lightweight debug fields if existing debug patterns support it:

* `needsFootprintWork`
* reasons why footprint work is needed
* `footprintRestoreSkipped`
* `footprintIngestionSkipped`
* `icebergDisabledNoopSkipped`
* per-panel values for dual mode

Do not spam console logs.

7. Do not change unrelated systems

Do not change:

* Zustand persisted/runtime store split
* Volume Profile cache
* aggregate bubble rendering
* aggregate bubble persistence/history
* raw trade restore
* canvas layer architecture
* Web Workers
* drawing tools
* visual defaults

8. Validation

Run:

* `npx.cmd tsc --noEmit`

If lint has unrelated existing failures, mention them but do not fix unrelated files.

Expected result:

* Footprint restore and live footprint aggregation only run when a panel actually needs footprint data.
* Candlestick-only panels do not pay footprint background cost.
* Switching to Footprint still works by restoring/starting footprint work when needed.
* Iceberg disabled state stops causing repeated empty state updates.
* Multi-panel mode avoids unnecessary duplicate footprint work.
* Existing enabled behavior remains unchanged.
