Implement Size By: Volume / Orders and Min Orders for Aggregate Trade Bubbles.

Context:

* Volume Bubbles currently support two sources:

  * Footprint Cells
  * Aggregate Trades
* Footprint Cells remains the default and should not be changed.
* Aggregate Trade bubbles are live-only and rendered from Binance aggTrade events.
* Aggregate BubbleEvent already includes optional `tradeCount` calculated from first/last trade IDs when available.
* Aggregate bubbles already support min volume, side filter, scale mode, min radius, and max radius.
* Debug snapshots already exist at `window.__MARKET_DEBUG__.getSnapshot().aggregateBubbles`.

Goal:
Add the ability to size and filter Aggregate Trade bubbles by either:

* Volume
* Orders / trade count

Do not implement raw trades, iceberg logic, persistence, grouping, clustering, or spot/futures visual split.

1. Add Bubble Size By setting

Add a new setting:

`bubbleSizeBy: 'volume' | 'orders'`

Default:
`volume`

UI label:
`Size By`

Options:

* Volume
* Orders

This setting should mainly affect Aggregate Trade bubbles for now.

For Footprint Cells:

* Keep existing behavior as volume-based.
* If user selects Orders while Bubble Source = Footprint Cells, either disable Orders or show it only when Bubble Source = Aggregate Trades.
* Do not fake order count for footprint cells.

2. Add Min Orders setting

Add a new setting:

`bubbleMinOrders: number`

UI label:
`Min Orders`

Suggested range:

* 1 to 500 or 1 to 1000
* default: 1

Only show or enable this setting when:

* Bubble Source = Aggregate Trades
* Size By = Orders

3. Aggregate Trade rendering logic

When Bubble Source = Aggregate Trades:

If `bubbleSizeBy === 'volume'`:

* Filter using existing min volume threshold.
* Bubble value = event.volume.
* Radius scaling uses event.volume.

If `bubbleSizeBy === 'orders'`:

* Filter using `bubbleMinOrders`.
* Bubble value = event.tradeCount.
* Radius scaling uses event.tradeCount.
* If tradeCount is missing or invalid, treat it as 1 or skip it safely. Pick the safer option and document it in comments/debug output.

Keep side filter working in both modes:

* buy
* sell
* both

Keep scale modes working in both modes:

* linear
* sqrt
* log

Keep min/max radius working in both modes.

4. Debug updates

Update aggregate bubble debug snapshot to include:

* bubbleSizeBy
* bubbleMinOrders
* latest event tradeCount
* visible/rendered count by size mode
* filter reasons for volume filter vs orders filter
* rendered bubble value used for sizing

This should make it easy to verify whether a bubble appeared because of volume or order count.

5. Persistence/state

Wire new settings through:

* store state
* setters
* persistence/migration/normalization if the app has persisted chart settings
* panel settings
* ChartCanvas props
* renderer props
* settings UI

Use backward-compatible defaults so existing saved chart settings do not break.

6. Do not change existing behavior

Do not change:

* Footprint Cell bubble rendering
* footprint aggregation
* footprint storage/restore
* aggregate event buffer lifecycle
* symbol/source reset behavior
* bubble source switching behavior
* raw/aggregate feed adapters beyond what is needed for tradeCount usage

7. Validation

Run:

* `npx.cmd tsc --noEmit`

If lint has existing unrelated failures, mention them but do not fix unrelated files.

Expected result:

* Aggregate Trade bubbles can be sized by Volume or Orders.
* Volume mode behaves like before.
* Orders mode shows bubbles based on aggregate event tradeCount.
* Min Orders filter works.
* Debug output clearly explains which mode/filter caused bubbles to render.
* Footprint Cells remains unchanged and stable.
