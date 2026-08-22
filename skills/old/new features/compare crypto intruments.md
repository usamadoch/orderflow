


Implement a simple Binance crypto symbol selector for each chart header.

Current situation:

* The chart header currently has a BTC/ETH toggle.
* Remove that BTC/ETH toggle.
* Replace it with one clickable rounded symbol button.
* This button is now the only way to change the chart symbol/instrument.

Goal:
User should be able to click the current symbol button, open a popup, choose a crypto symbol, then choose Spot or Perpetual Futures. The selected instrument should replace the currently opened chart.

1. Replace BTC/ETH toggle

Remove the existing BTC/ETH toggle from the chart header.

Add a rounded clickable button in the same header area.

Button display examples:

* `BTCUSDT`
* `BTCUSDT.P`
* `ETHUSDT`
* `ETHUSDT.P`

Use:

* normal symbol like `BTCUSDT` for Spot
* `.P` suffix for Perpetual Futures

Example:

* Binance Spot BTC = `BTCUSDT`
* Binance Futures BTC = `BTCUSDT.P`

2. Open symbol popup on click

When user clicks the symbol button, open a popup/modal similar in style to existing settings popups.

The popup should show a list of supported crypto symbols.

No external search API for now.
No TradingView-style full symbol search.
Just a local hardcoded list.

3. Supported symbols

Add a hardcoded list of around 8–10 Binance USDT symbols:

* BTCUSDT
* ETHUSDT
* SOLUSDT
* BNBUSDT
* XRPUSDT
* ADAUSDT
* DOGEUSDT
* AVAXUSDT
* LINKUSDT
* LTCUSDT

4. Symbol row behavior

In the popup, show each crypto symbol as a row.

When user clicks a symbol row, expand/drop down that row and show two options:

* Spot
* Perpetual Futures

Example:

BTCUSDT

* Spot
* Perpetual Futures

ETHUSDT

* Spot
* Perpetual Futures

5. Selecting an option

When user clicks `Spot`:

* update the current chart symbol to that symbol
* set contract type to `spot`
* close the popup
* chart should load/show that spot chart

When user clicks `Perpetual Futures`:

* update the current chart symbol to that symbol
* set contract type to `futures`
* close the popup
* chart should load/show that futures chart
* header button should display `.P`, for example `ETHUSDT.P`

6. Data behavior

Candlesticks should work for all supported symbols using the existing Binance feed system.

Footprint/order-flow behavior:

* Existing persistent footprint/profile data is only expected for BTCUSDT because the collector currently runs only for BTC.
* For non-BTC symbols, do not expect stored footprint/profile history.
* If footprint is selected for non-BTC symbols, live footprint data can build from live trades only if the existing live feed supports it.
* Do not add persistence/collector support for all symbols in this task.

7. Panel-scoped behavior

This selector is per chart panel.

If two charts are open:

* left chart can select BTCUSDT futures
* right chart can select ETHUSDT spot
* changing one panel should not force the other panel to change

8. Do not implement extra features

Do not implement:

* comparison overlay
* plus button
* comparison chips
* broker/CFD data
* external search API
* new collector logic
* persistence for non-BTC symbols
* TradingView full symbol search

This task is only:

* remove BTC/ETH toggle
* add selected-symbol button
* add popup
* allow selecting Spot or Perpetual Futures from hardcoded Binance symbols
* update current chart accordingly

9. Validation

Run:

* `npx.cmd tsc --noEmit`

Expected result:

* BTC/ETH toggle is gone.
* Chart header shows current selected symbol button.
* Clicking it opens a popup.
* Popup lists supported symbols.
* Each symbol expands to Spot and Perpetual Futures.
* Selecting one updates that chart panel.
* Candles load for selected symbol/contract.
* Non-BTC footprint/profile persistence is not expected.
