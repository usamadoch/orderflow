Implement Task 8: Chart order and position lines.

Context:

* Binance testnet spot Market/Limit order placement works.
* Cancel order backend/runtime path exists.
* Account snapshot and user stream sync exist.
* Open orders and recent fills are already available in trading runtime state.
* Futures positions are still not supported.

Goal:
Draw existing trading state on the chart.

1. Draw open order lines

For open Limit orders in runtime state:

* draw a horizontal line at the order price
* show side: Buy or Sell
* show quantity
* show order type
* show order status
* show small cancel button on the line if cancel action already exists

Only draw orders for the current panel symbol.

2. Do not draw Market orders

Market orders fill immediately or become fills.

Do not draw old market orders as active chart lines.

3. Cancel from chart line

If cancel action already exists:

* allow cancel from the order line
* show confirmation before cancel
* show loading/error/success state
* refresh snapshot after cancel

Do not add new cancel backend logic unless something is missing.

4. Draw position line only if position exists

If runtime positions contain a position for the current symbol:

* draw entry price line
* show side, size, entry price, and unrealized PnL if available

If positions are empty because futures is not supported yet:

* do nothing
* do not fake a position line from spot balances or fills

5. Filled order/history markers

Optional but simple:

* show small markers for recent fills on the chart
* buy fill marker below/near candle
* sell fill marker above/near candle

Keep this lightweight.

6. Panel scoped

Each chart panel should only show orders/fills/positions for its own selected symbol.

Dual panel mode should not mix lines between panels.

7. Styling

Use existing chart colors:

* buy/bullish green: `#089981`
* sell/bearish red: `#f23645`

Keep labels compact and readable.

8. No drag modify yet

Do not implement drag-to-modify in this task.

Order lines can be visible and cancellable, but not draggable.

9. Do not change order execution

Do not change:

* place order logic
* cancel order backend logic unless required for wiring
* user stream logic
* account snapshot logic
* trading models unless a small missing field is needed

10. Do not change unrelated systems

Do not change:

* indicators
* footprint/profile logic
* market data feeds
* drawing tools
* settings
* collectors

11. Validation

Run:

`npx.cmd tsc --noEmit`

Expected:

* open limit orders appear as chart lines
* chart order lines are panel/symbol scoped
* cancel from order line works if cancel action exists
* positions only appear if real position data exists
* recent fills can appear as lightweight markers
* no drag modify is added yet
