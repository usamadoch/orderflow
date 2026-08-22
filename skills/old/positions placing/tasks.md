1. Trading architecture + mode design
Define trading modes: `binance_testnet`, `binance_live`, and later optional `local_paper`. Create one internal order/position model so the UI does not care whether the backend is testnet or live.
2. Secure API key setup
Add server-side environment variables for Binance testnet/demo API keys. Never store keys in frontend/localStorage, and never expose secret keys to the browser.
3. Binance testnet connection health check
Create backend route to check Binance connection, server time, account access, and permissions. This confirms keys and endpoint config are correct before placing orders.
4. Trading store + account state
Add frontend state for trading mode, account balance, open orders, open positions, filled trades, selected symbol, leverage, margin mode, and order status.
5. Binance account sync
Fetch account balance, positions, open orders, and recent trades from Binance testnet. This makes your platform show the actual simulated Binance account state.
6. User data stream sync
Add Binance user data stream for live order/position updates. This is needed so fills, cancels, position changes, and account updates appear without manual refresh.
7. Basic order ticket UI
Add Buy/Sell, Market/Limit, quantity, price, reduce-only, SL/TP fields, and confirmation. Keep it simple first; no drag-and-drop yet.
8. Place testnet orders
Implement backend order placement for Binance testnet. Start with Market and Limit orders only. Binance futures uses endpoints like `POST /fapi/v1/order` for real submitted orders, while `/order/test` only validates and does not submit to the matching engine.
9. Cancel/modify orders
Add cancel order, cancel all orders, and later modify price/quantity if supported by the selected market. Show errors clearly in the UI.
10. Chart order lines
Draw open order lines on the chart. Limit orders should appear at their price level, and canceled/filled orders should disappear or change state.
11. Chart position line
Draw active position line with entry price, size, side, unrealized PnL, liquidation estimate if futures data is available, and close button.
12. Drag-to-adjust orders
Allow dragging limit order lines, stop loss lines, and take profit lines. Dragging should open a confirmation before sending the update.
13. Trade panel
Add a bottom/right trading panel with tabs: Positions, Open Orders, Trade History, Account. This is where you manage active trades.
14. Risk controls
Add max order size, max daily loss, confirm-before-order, testnet/live badge, and live-trading disabled by default. This is mandatory before live mode.
15. Live Binance adapter
After testnet is stable, add live Binance endpoints using the same internal adapter. The UI should not change; only the backend mode changes.
16. Live trading safety gate
Add `ENABLE_LIVE_TRADING=false` by default, require manual confirmation, show red “LIVE” badge, and block live trading unless all safety settings are configured.






















Trading foundation + Binance testnet config — modes, adapter interface, server-side env keys, health check.

Trading store + shared models — account, balance, positions, orders, fills, trading mode.
REST account snapshot sync — fetch balances, positions, open orders, recent trades.
User data stream sync — listen for live order/account updates.
WebSocket reconnect + state reconciliation — reconnect safely, then refresh REST snapshot and repair local state.
Basic order ticket UI — Buy/Sell, Market/Limit, qty, price, reduce-only, confirmation.
Place/cancel Binance testnet orders — backend testnet order routes.
Chart order + position lines — show open orders and position entry on chart.
Drag modify order lines — drag limit/SL/TP lines with confirmation.
Risk gates + live-mode lock — live disabled by default, max size, kill switch, warnings.