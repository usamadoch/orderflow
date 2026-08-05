Implement Task 7: Place/cancel Binance testnet orders.

Context:

* Trading foundation is done.
* REST account snapshot sync is done.
* Binance user data stream sync + reconnect/reconciliation is done.
* Basic order ticket UI is done.
* Order ticket currently validates input and shows confirmation, but final confirm says order execution is not implemented yet.

Goal:
Connect the existing order ticket to real Binance testnet order placement/cancel routes.

Only support testnet/demo execution.
Do not enable live trading.

1. Implement backend place order route

Add a backend route like:

`POST /api/trading/orders`

It should:

* accept the existing normalized `OrderRequest`
* validate symbol, side, type, quantity, and limit price when needed
* use the current trading mode
* reject live mode unless `BINANCE_ENABLE_LIVE_TRADING=true`
* call the broker adapter `placeOrder()`
* return normalized `OrderResult`

2. Implement Binance testnet order placement

Update the Binance broker adapter.

Support only:

* Market order
* Limit order

Map internal order fields to Binance testnet params:

* symbol
* side
* type
* quantity
* price for limit orders
* timeInForce for limit orders if needed

Use the existing server-only signed REST client.

Do not expose API secrets.

3. Spot/futures handling

If current supported trading adapter is spot only:

* place spot testnet orders only
* reject futures orders with clear error:
  `Futures testnet order placement is not implemented yet.`

If futures adapter support already exists cleanly:

* support futures testnet orders through the futures endpoint
* keep reduce-only only for futures

Do not fake futures positions or fills.

4. Connect confirmation modal

Update the final confirmation button in the order ticket.

Instead of showing only:

`Order execution is not implemented yet.`

It should:

* call the new backend place order route
* show loading state
* show success message with order id/status
* show safe error message on failure
* refresh account snapshot after successful placement
* refresh stream status if useful

5. Implement cancel order route

Add a backend route like:

`DELETE /api/trading/orders`

or similar existing project style.

It should:

* accept symbol and orderId/clientOrderId
* use broker adapter `cancelOrder()`
* reject live mode unless explicitly enabled
* return normalized cancel result

6. Add cancel method to adapter

Implement Binance testnet cancel order in the adapter.

Keep it server-only and signed.

7. Minimal UI for cancel

Do not build chart order lines yet.

Add cancel support only where open orders already appear if available.

If there is no open-orders UI yet, expose the cancel action in runtime/store only and keep UI minimal.

8. Runtime state updates

After place/cancel:

* refresh account snapshot
* allow user stream to update state naturally
* avoid duplicate orders/fills
* store last order action loading/error/success in non-persisted runtime state

Do not persist order action state.

9. Safety

Block order execution when:

* credentials are missing
* trading mode is live and live flag is false
* quantity is invalid
* limit price is invalid
* symbol is missing
* unsupported contract type is selected

10. Keep scope tight

Do not implement:

* chart order lines
* position lines
* drag modify
* SL/TP bracket orders
* risk gates
* live trading enable UI
* local paper engine

11. Do not change unrelated systems

Do not change:

* chart rendering
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

* order ticket can submit Market/Limit orders to Binance testnet
* order ticket shows loading/success/error
* cancel route exists and works for testnet open orders
* live mode remains blocked by default
* account snapshot refreshes after place/cancel
* API secrets stay server-only
