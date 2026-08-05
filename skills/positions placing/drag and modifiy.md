Implement Task 9: Drag modify order lines.

Context:

* Binance testnet spot Market/Limit order placement works.
* Cancel order backend/runtime path works.
* Open spot Limit orders appear as chart order lines.
* Recent fills can appear as chart markers.
* Futures execution and futures positions are still not supported.

Goal:
Allow dragging existing open Limit order lines to modify their price.

1. Draggable order lines

Make open Limit order chart lines draggable.

Only support:

* open Limit orders
* current panel symbol
* spot testnet orders

Do not allow dragging:

* filled orders
* canceled orders
* market orders
* recent fill markers
* position lines

2. Drag preview

While dragging:

* show the order line following the cursor price
* show the new price label
* keep the original order visible or show clear preview styling
* do not send any API request while dragging

3. Confirm before modifying

On drag release:

* open a confirmation modal
* show original price
* show new price
* show side
* show symbol
* show quantity
* show order id
* show testnet badge

Only modify after user confirms.

4. Modify behavior

Because current support is spot testnet only, implement modify as:

* cancel old order
* place new Limit order with same side, symbol, and remaining quantity
* new price = dragged price

If remaining quantity is not available, use the safest existing quantity field from the normalized open order.

If required fields are missing, block modify and show a clear error.

5. Runtime state

Add non-persisted modify state:

* modifyingOrderId
* dragPreviewPrice
* modifyLoading
* modifyError
* modifySuccess

After successful modify:

* refresh account snapshot
* refresh stream status if useful
* rely on user stream to reconcile final state

6. Safety

Block drag modify when:

* trading mode is live and live trading is not enabled
* order is not open
* order is not Limit
* order is not spot testnet
* price is invalid
* symbol does not match panel
* existing order has missing quantity/order id

7. Do not implement new order types

Do not add:

* SL/TP orders
* bracket orders
* OCO orders
* futures reduce-only modify
* position drag modify
* live trading enable UI

8. Do not change unrelated systems

Do not change:

* chart rendering except order-line drag interaction
* indicators
* market data feeds
* footprint/profile logic
* drawing tools
* settings
* collectors
* user stream logic unless needed for refresh/reconcile

9. Validation

Run:

`npx.cmd tsc --noEmit`

Expected:

* open spot Limit order lines can be dragged
* drag shows preview only
* releasing drag opens confirmation
* confirming performs cancel + replace on Binance testnet
* cancel/replace result updates chart through snapshot/user stream refresh
* no market orders, fills, or positions are draggable
* live trading remains blocked by default
