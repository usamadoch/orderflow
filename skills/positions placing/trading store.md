Implement read-only Binance testnet account snapshot sync.

Context:

* Trading foundation already exists.
* `binance_testnet` is the default mode.
* Live trading is blocked by default.
* Broker adapter currently returns empty snapshot data and rejects order placement/cancellation.
* `/api/trading/health` already exists.

Goal:
Replace the empty snapshot stub with real read-only Binance testnet/demo account sync.

Do not implement order placement yet.

1. Add signed Binance REST client

Create a server-only Binance REST helper for signed requests.

It should support:

* API key header
* HMAC SHA256 signature
* timestamp
* recvWindow
* server time offset if needed
* safe error handling

Keep API secrets server-only.

2. Support Binance testnet/demo endpoints

Use the existing trading config.

For now, support Binance testnet/demo only.

If current mode is `binance_live`, keep it blocked unless live trading is explicitly enabled.

3. Implement account snapshot adapter methods

Update the Binance broker adapter to fetch real read-only testnet data:

* balances
* open orders
* positions if futures mode is supported
* recent trades/fills for selected symbol
* account connection status

Return data using the existing shared app models:

* AccountSnapshot
* Balance
* Order
* Position
* TradeFill

4. Add backend snapshot route

Create a route like:

`/api/trading/account-snapshot`

It should:

* call the broker adapter
* return normalized safe data
* never return API secrets
* return clear error messages if credentials are missing or invalid

5. Add frontend snapshot state

Extend non-persisted trading runtime state with:

* balances
* openOrders
* positions
* recentTrades
* lastSnapshotAt
* snapshotLoading
* snapshotError

Do not persist this state.

6. Add manual refresh action

Add a frontend action/function to manually refresh the account snapshot.

No UI panel is required yet, but it should be callable from code/debug.

7. Keep order actions disabled

Do not implement:

* place order
* cancel order
* modify order
* order ticket UI
* chart order lines

If `placeOrder()` or `cancelOrder()` exists, it must still reject with a clear “not implemented yet” message.

8. Add debug info

Add safe debug info to existing trading/debug state if available:

* tradingMode
* accountSnapshotConnected
* balancesCount
* openOrdersCount
* positionsCount
* recentTradesCount
* lastSnapshotAt
* lastSnapshotError

9. Do not change unrelated systems

Do not change:

* chart rendering
* indicators
* market data feeds
* footprint/profile logic
* drawing tools
* settings
* existing Binance market-data collectors

10. Validation

Run:

`npx.cmd tsc --noEmit`

Expected:

* `/api/trading/account-snapshot` returns real Binance testnet/demo account snapshot when credentials are valid.
* Missing/invalid credentials return safe errors.
* frontend runtime state can store snapshot data.
* no API secrets are exposed.
* no orders can be placed yet.
