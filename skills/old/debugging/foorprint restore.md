Fix footprint restore range so signals do not request huge footprint history.

Issue:

* Candle charts can still need footprint data because enabled signals use footprint/order-flow data.
* That is fine.
* The problem is footprint restore sometimes requests a huge range and fails.
* Example: right panel requested a very large footprint range and returned 400/failed.
* This can cause lag and partial/broken chart state.

Goal:
Keep footprint work enabled when needed, but make footprint restore safe and limited.

1. Keep `needsFootprintWork`

Do not remove `needsFootprintWork`.

It should still become true when:

* chart mode is footprint
* footprint-cell bubbles are enabled
* absorption/exhaustion/iceberg/liquidity-vacuum need footprint data
* CVD or other footprint-dependent feature is enabled

2. Limit footprint restore range

When `needsFootprintWork` is true, do not restore huge footprint ranges.

Use a safe restore window based on visible/current chart range.

Suggested:

* restore visible range plus small buffer
* max single request: 1–2 hours for 1m footprint data
* do not request multi-day footprint data in one API call

3. Chunk large ranges

If a larger range is needed:

* split into smaller chunks
* restore chunks sequentially or safely batched
* merge/hydrate results
* avoid duplicate hydration

4. API guard

Update `/api/history/footprint` so huge requests are rejected or clamped cleanly.

Return a clear error instead of causing Mongo/query failure.

5. Frontend behavior

If footprint restore fails:

* do not break chart rendering
* keep candles/live chart working
* show debug/restore status
* allow retry with smaller range

6. Debug update

Add debug fields:

* requested footprint range
* clamped/chunked range
* chunk count
* rows per chunk
* skipped because range too large
* restore failure reason

7. Do not change unrelated systems

Do not change:

* signal logic
* footprint calculation logic
* bubbles
* volume profile
* volume indicator
* chart header flow source
* collector
* persistence schema

8. Validation

Run:

* `npx.cmd tsc --noEmit`

Expected result:

* Signals can still use footprint data.
* Candle mode does not request huge footprint history.
* Footprint restore no longer fails from oversized ranges.
* Chart stays responsive even when footprint restore is heavy.
