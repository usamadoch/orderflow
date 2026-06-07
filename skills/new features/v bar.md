Implement a Volume Bars indicator.

Context:

* This app has chart indicators shown on the left-top indicator area.
* Indicators have hide/show and settings buttons.
* Volume Bubbles already have advanced source logic such as Footprint Cells vs Aggregate Trades, market source, size by volume/orders, etc.
* Now add a new indicator called `Volume Bars`.
* This should be treated as an indicator, not a signal.

Goal:
Add a Volume Bars indicator that displays volume histogram bars at the bottom of the chart/canvas, with its own independent settings popup.

1. Add indicator entry

Add a new indicator named:

`Volume Bars`

It should appear in the left-top indicator list with the other indicators.

It should have:

* show/hide toggle
* settings icon
* independent settings popup/dialog

Do not put its detailed settings inside global settings.

2. Default behavior

Default:

* Volume Bars disabled/hidden by default.
* User can enable it from the indicator area.
* When disabled, do not calculate, filter, draw, or update state for Volume Bars.

Important:
Hidden/disabled should mean no background work.

3. Basic rendering

When enabled:

* Draw volume histogram bars at the bottom of the chart.
* Bars should align with candles.
* Each candle gets one volume bar.
* Bar height should scale relative to visible range max volume.
* Bars should not cover the main chart too much.
* Keep the visual style consistent with the app’s dark theme.

Basic volume formula:

* If using footprint/candle volume:
  `totalVolume = askVol + bidVol`
* If direct candle volume exists from Binance kline, use candle volume as the simplest base.
* Prefer the cleanest existing data source already available in the app.

4. Input Data setting

Add `Input Data` setting for Volume Bars.

Options:

* `Volume`
* `Orders`
* `Aggregate Trades`

Meaning:

Volume:

* Bar value = total traded volume for the candle.
* For footprint data, this can be askVol + bidVol.
* For kline/candle data, this can use candle volume if available.

Orders:

* Bar value = number of trade/order executions in that candle if available.
* If order count is not available for a source, show disabled/unavailable clearly and do not fake it.

Aggregate Trades:

* Bar value = aggregate trade event count or aggregate trade volume, depending on selected calculation mode if already available.
* Reuse existing aggregate trade buffer/history where possible.
* Do not build a new feed system.

5. Market Source setting

Add `Market Source` setting.

Options:

* `Active Chart`
* `Spot`
* `Futures`
* `Both`

Behavior:

* Active Chart = use current chart contract/source.
* Spot = use spot data only.
* Futures = use futures data only.
* Both = combine spot + futures data.

Do not rewrite event prices.
Do not change existing feed architecture.

6. Filter settings

Add filters:

* `Filter Min`
* `Filter Max`

Behavior:

* If value is below min, do not draw that volume bar.
* If max is 0, do not apply max filter.
* If max is greater than 0, hide values above max or clamp depending on the simpler existing pattern. Prefer hiding above max for v1.

7. Display settings

Add these simple display settings:

* Bar opacity
* Bar height percent / panel height
* Show value text: on/off
* Text size
* Average line: on/off
* Average length: number of candles

Average line:

* Calculate average volume over the selected visible/history candles.
* Draw a small line over the volume bars.
* If disabled, do not calculate it.

8. Color mode / background mode

Add a simple `Color Mode` setting.

Options:

* `Fixed`
* `Price Direction`
* `Delta`
* `Volume Slope`

Meaning:

Fixed:

* all bars use one neutral volume color.

Price Direction:

* bullish candle = buy/green style
* bearish candle = sell/red style

Delta:

* positive delta = buy/green style
* negative delta = sell/red style
* if delta unavailable, fall back to Price Direction or neutral.

Volume Slope:

* current volume > previous volume = increasing color
* current volume < previous volume = decreasing color

Do not implement advanced delta range coloring yet.

9. Settings popup

Clicking the Volume Bars settings icon should open only Volume Bars settings.

Settings should include:

* Input Data
* Market Source
* Filter Min
* Filter Max
* Color Mode
* Bar opacity
* Bar height/panel height
* Show value text
* Text size
* Average line on/off
* Average length

Keep this popup focused. Do not add unrelated indicator settings.

10. Data source expectations

For BTCUSDT:

* stored footprint/profile/aggregate history may exist.
* Volume Bars should use available restored data if present.

For non-BTC symbols:

* persistent footprint/profile may not exist.
* candlestick volume from Binance should still work.
* live aggregate/footprint-derived behavior can work only if the existing live feed supports it.
* Do not add collector persistence for all symbols in this task.

11. Performance rules

Important:

* If Volume Bars is disabled, do nothing.
* If Input Data is Volume and candle volume exists, do not use expensive footprint scans unnecessarily.
* Only use footprint/aggregate data when the selected settings require it.
* Render only visible candles/bars.
* Avoid scanning full history on every redraw.
* Add basic debug counts if existing debug panel patterns are easy to reuse:

  * volumeBarsEnabled
  * inputData
  * visibleBarsCount
  * maxVisibleValue
  * averageValue if enabled

12. Do not implement advanced features yet

Do not implement:

* marker alerts
* total delta absorption marker
* seconds-based acceleration calculation
* custom delta range editor
* external data sources
* new collector persistence
* new WebSocket system
* comparison overlays

These can be added later.

13. Validation

Run:

* `npx.cmd tsc --noEmit`

If lint has unrelated existing failures, mention them but do not fix unrelated files.

Expected result:

* New `Volume Bars` indicator appears in the indicator list.
* It has hide/show and settings buttons.
* It renders bottom volume histogram bars when enabled.
* It supports Volume / Orders / Aggregate Trades as input data where available.
* It supports Active/Spot/Futures/Both market source.
* It supports min/max filter, color mode, text toggle, opacity, height, and average line.
* It does no background work when disabled.
