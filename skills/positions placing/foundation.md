Implement trading foundation for Binance-linked paper/testnet trading.

Goal:
Add the base trading architecture only. Do not build order UI yet and do not place real trades.

This project should support Binance testnet/demo trading first, with live trading added later behind a safety gate.

1. Add trading modes

Create trading mode support:

* `binance_testnet`
* `binance_live`
* optional future: `local_paper`

Default must be:

`binance_testnet`

Do not enable live trading by default.

2. Add shared trading models

Create shared TypeScript types for:

* TradingMode
* BrokerAdapter
* OrderRequest
* OrderResult
* Order
* Position
* Balance
* TradeFill
* AccountSnapshot

Keep these generic so the UI can use the same model for Binance testnet and Binance live later.

3. Add BrokerAdapter interface

Create one adapter interface with methods like:

* `getAccountSnapshot()`
* `getOpenOrders()`
* `getPositions()`
* `getBalances()`
* `getRecentTrades()`
* `placeOrder()`
* `cancelOrder()`

For this task, only implement health/snapshot stubs where needed.
Do not implement actual order placement yet.

4. Add Binance testnet config

Add server-side environment config for Binance testnet/demo.

Use server-only env variables, for example:

* `BINANCE_TRADING_MODE=binance_testnet`
* `BINANCE_TESTNET_API_KEY`
* `BINANCE_TESTNET_API_SECRET`
* `BINANCE_ENABLE_LIVE_TRADING=false`

Never expose API secret to frontend.
Do not put API keys in localStorage.
Do not send secrets to the browser.

5. Add backend health check route

Create a backend route like:

`/api/trading/health`

It should return safe status only:

* selected trading mode
* whether API key exists
* whether API secret exists
* Binance server time check result if implemented
* connection status
* no secret values

6. Add frontend trading status state

Add small frontend state for:

* current trading mode
* connection status
* testnet/live badge
* last health check time
* last error message

Do not build full trading UI yet.

7. Safety rule

If mode is `binance_live` but `BINANCE_ENABLE_LIVE_TRADING` is not `true`, backend must reject live trading mode.

8. Do not change chart behavior

Do not change:

* chart rendering
* indicators
* order-flow data
* Binance market data feeds
* footprint/profile logic
* drawing tools
* existing settings

9. Validation

Run:

`npx.cmd tsc --noEmit`

Expected result:

* trading foundation types exist
* backend health route exists
* frontend can show trading connection/mode status if needed
* API secrets stay server-only
* live trading is blocked by default
* no real orders can be placed yet
