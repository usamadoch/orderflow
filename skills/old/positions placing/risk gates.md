Implement Task 10: Risk gates and live-mode lock.

Context:

* Binance testnet spot Market/Limit order placement works.
* Cancel order works.
* Chart order lines work.
* Drag modify works through cancel + replace.
* Live trading is still blocked by default.
* Futures trading is still unsupported.

Goal:
Add strict trading safety controls before any live trading can ever be enabled.

1. Add server-side risk config

Add server-only risk config values:

* `BINANCE_ENABLE_LIVE_TRADING=false`
* `TRADING_MAX_ORDER_NOTIONAL`
* `TRADING_MAX_ORDER_QTY`
* `TRADING_MAX_DAILY_ORDER_COUNT`
* `TRADING_MAX_DAILY_LOSS`
* `TRADING_REQUIRE_CONFIRMATION=true`
* `TRADING_KILL_SWITCH=false`

Use safe defaults.

2. Enforce risk gates on backend

Apply risk checks before:

* place order
* cancel + replace modify
* cancel if needed

Block order placement when:

* kill switch is enabled
* live mode is requested but live trading flag is false
* order quantity exceeds max quantity
* order notional exceeds max notional
* daily order count limit is reached
* daily loss limit is reached if available
* symbol/side/type/quantity/price validation fails
* futures order is attempted

3. Add live-mode hard lock

Live mode must stay blocked unless all are true:

* trading mode is `binance_live`
* `BINANCE_ENABLE_LIVE_TRADING=true`
* required live credentials exist
* kill switch is false
* risk config is valid

If any check fails, return a clear safe error.

4. Add risk status route

Add route:

`/api/trading/risk-status`

Return safe data only:

* live trading enabled/blocked
* kill switch status
* max notional
* max quantity
* daily order count used/limit
* daily loss used/limit if available
* current trading mode
* block reasons

Never return API secrets.

5. Add frontend risk state

Extend non-persisted trading runtime state with:

* riskStatus
* riskLoading
* riskError
* liveBlocked
* killSwitchActive
* riskBlockReasons

Do not persist this state.

6. UI warnings

Update order ticket and chart modify confirmation modal:

* show testnet/live badge clearly
* show live blocked warning if mode is live but blocked
* show risk block reason when order is blocked
* disable final confirm if risk status blocks the order

7. Kill switch behavior

If kill switch is active:

* block new orders
* block modify/cancel+replace
* allow viewing account/orders/positions
* allow cancel existing orders only if you decide cancel is safer
* show clear warning in UI

8. Daily limits

Implement daily counters in the simplest safe way available.

Track:

* placed orders count
* estimated notional
* failed/blocked orders if useful for debug

Use server-side tracking, not frontend-only.

If persistent storage is already available and simple, store daily counters there.
If not, use an in-memory server tracker for now and clearly mark it as non-persistent.

9. Debug info

Add safe debug fields:

* risk status
* live blocked
* kill switch
* daily order count
* daily order limit
* max notional
* max quantity
* last risk rejection reason

10. Keep scope tight

Do not implement:

* futures trading
* live trading UI enable flow
* SL/TP orders
* bracket orders
* local paper engine
* new chart tools

11. Do not change unrelated systems

Do not change:

* chart rendering except warning state if already needed
* indicators
* market data feeds
* footprint/profile logic
* drawing tools
* settings
* collectors

12. Validation

Run:

`npx.cmd tsc --noEmit`

Expected:

* backend blocks unsafe orders before Binance call
* live trading remains blocked by default
* kill switch blocks new orders
* order ticket and modify modal show risk/live block reasons
* risk status route returns safe non-secret status
* testnet orders still work when within limits
