Move chart contract/source controls out of Global Settings and into the chart header.

Current issue:

* Global Settings still has `Contract Type` with Spot/Futures.
* Global Settings also has `Aggregate Trades` source with Spot/Futures/Both.
* This is confusing because chart symbol selection already decides Spot vs Futures.
* The trade/flow source should be visible near the chart symbol, not buried in settings.

Goal:
Clean up the chart source UX.

1. Remove Contract Type from Global Settings

Remove the `Contract Type` section from Global Settings.

Reason:

* The selected instrument already defines the chart contract:

  * `BTCUSDT` = Spot chart
  * `BTCUSDT.P` = Perpetual Futures chart

Do not remove the underlying contract type state.
Only remove this global UI control.

2. Move Aggregate Trades source control to chart header

Move the current aggregate trade/source selector out of Global Settings.

Add a small source selector near the chart symbol on the top-left chart header, above/near the canvas indicator labels.

Display something like:

`BTCUSDT.P · Binance · Flow: Both`

or compact buttons:

`Spot | Futures | Both`

This controls the trade/flow data source used for footprint/order-flow style data.

3. Rename the concept clearly

Do not call this “Aggregate Trades” in the header.

Use:

`Flow Source`

Options:

* Spot
* Futures
* Both

Meaning:

* Spot = use Binance spot trades
* Futures = use Binance futures trades
* Both = combine spot + futures trade flow

4. Preserve current behavior

This should keep the same underlying behavior as the old Aggregate Trades source setting.

Do not change:

* candle price source
* OHLC source
* selected chart symbol
* chart contract type
* footprint calculation logic
* bubbles logic
* volume bars logic
* volume profile logic

Only move the control and rename/display it better.

5. Header placement

Place the new Flow Source control near the selected symbol button.

Example layout:

`BTCUSDT.P` `Binance` `Flow: Both`

Keep it compact like TradingView-style top-left chart controls.

6. Panel scoped

This setting should remain panel-scoped.

In dual chart mode:

* left panel can have Flow Source = Futures
* right panel can have Flow Source = Spot/Both
* changing one panel should not affect the other

7. Keep Global Settings clean

After this task, Global Settings should not show:

* Contract Type
* Aggregate Trades source selector

Global Settings should still keep unrelated chart settings:

* aggregation
* tick size
* bucket size
* interaction
* profile settings
* signal settings

8. Validation

Run:

* `npx.cmd tsc --noEmit`

Expected result:

* Contract Type UI is gone from Global Settings.
* Aggregate Trades source UI is gone from Global Settings.
* Chart header shows selected symbol + Binance + Flow Source control.
* Flow Source still controls spot/futures/both trade-flow behavior.
* Chart candle source still comes from selected instrument.
* No indicator or data logic is changed.
