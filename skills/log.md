# OrderFlow Chart - Change Log

## [2026-08-07] - Feature: Native Trade Count for Volume Bars
- **What changed**:
  - Added `trade_count` integer column to the `candles` SQLite schema (and the underlying MongoDB schema/adapter).
  - Updated the Binance REST API history and WebSocket live streams (`@kline`) to parse and populate the native trade count field `candle.tradeCount`.
  - Gutted the fallback `aggregateBubbleEvents` dependency logic from `drawVolumeBars.ts` and `FeedProvider.tsx`.
  - The Volume Indicator's "Orders" and "Aggregate Trades" inputs now read `tradeCount` directly in `O(1)` time from the loaded candles instead of relying on buffered bubble events.
- **Why it changed**:
  - Previously, visualizing volume bars based on Orders or Aggregate Trades required waiting for massive arrays of individual live `aggregateTrades` to buffer, and required history restoration for events just to draw basic candles.
  - Using the native trade count provided by the exchange on the kline object drastically improves performance and makes historical data loading instant and perfect.
- **Impact summary**:
  - Volume bars for Orders and Aggregate Trades are now natively supported, extremely performant, and 100% accurate historically.
  - `npx tsc --noEmit` passes cleanly.

## [2026-08-06] - Artifact: Collector Backfill Analysis
- **What changed**:
  - Created `artifacts/collector_backfill_analysis.md` detailing the current live-only collection state and proposing a REST API pagination approach to backfill 48 hours of historical trades.
- **Why it changed**:
  - The collector runs on a VPS 24/7. When starting, it needs to capture the previous 2 days of sessions and footprint/profile data instead of starting from zero.
- **Impact summary**:
  - An implementation plan is now available for review before modifying the Node.js collector script.

## [2026-08-06] - Feature: Dynamic Size Capping & Smart Pagination
- **What changed**:
  - Implemented dynamic database size capping (~450MB) in `btcusdtCollector.mjs` to automatically prune the oldest data, maximizing historical capacity regardless of a hard time limit.
  - Added an `until` parameter to `GetStoredCandlesInput` and `getCandles` in the `storageAdapter` and `marketStorageMongo` to support backward paginated fetching.
  - Plumbed `until` through the `/api/history/candles` endpoint.
  - Updated `components/FeedProvider.tsx` with a `getScrolledCandlesRestoreWindow` check that automatically background-fetches older candles when the chart is panned near the left edge, providing an infinite scroll experience.
  - Created a stub standalone `scripts/collector/runBackfill.mjs` to backfill trades to that 450MB limit without affecting the live collector.
- **Why it changed**:
  - The user wanted to store as many days of footprint data as possible within the 512MB MongoDB limit instead of hardcoding 2 days, and required the frontend to seamlessly scroll backward without freezing or hanging.
- **Impact summary**:
  - The collector runs safely at capacity, and the frontend smoothly backfills UI history on scroll.
  - `npx tsc --noEmit` passes cleanly.

## [2026-06-13] - Feature: Trading Risk Gates and Live Lock
- **What changed**:
  - Added server-only trading risk config and safe `/api/trading/risk-status` reporting for live lock state, kill switch, max order quantity/notional, daily order count, and non-persistent in-memory counters.
  - Enforced backend risk checks before order placement, including kill switch, live-mode blocks, required confirmation, futures rejection, quantity/notional limits, and daily order count limits; successful placements update the server-side daily counter.
  - Kept cancel existing orders allowed through the kill switch path while still blocking unsupported modes/contracts.
  - Extended non-persisted runtime trading state with risk status/loading/error, live blocked state, kill switch state, and risk block reasons.
  - Updated the order ticket and chart drag-modify confirmation to show risk/live/kill-switch warnings and disable final confirmation when risk status blocks the order; drag modify now preflights risk before the cancel leg.
  - Added safe risk fields to the internal debug summary.
- **Why it changed**:
  - Testnet order placement, cancellation, and cancel+replace modify needed strict safety gates before any future live trading enablement path can exist.
- **Impact summary**:
  - Live trading remains blocked by default and still has no UI enable flow.
  - Kill switch blocks new orders and modify/cancel+replace while existing order cancellation remains available as the safer exception.
  - Daily counters are server-side but intentionally in-memory/non-persistent for now.
  - Futures trading, SL/TP, bracket orders, paper trading, chart tools, indicators, feeds, footprint/profile logic, settings, and collectors remain unchanged.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-13] - Feature: Drag Modify Order Lines
- **What changed**:
  - Added drag hit-testing for active open spot Limit order lines on the matching chart panel.
  - Added preview rendering for dragged order prices while keeping the original order line visible.
  - Added a chart-level modify confirmation modal with original price, new price, side, symbol, quantity, order id, and testnet badge.
  - Added non-persisted runtime modify state plus `modifyOrder()`, implemented as cancel old order then place a replacement spot Limit order at the dragged price.
- **Why it changed**:
  - Open Binance testnet spot Limit orders were visible and cancellable from the chart, but their price could not be modified from the order line.
- **Impact summary**:
  - Only open or partially filled spot Limit orders for the current panel symbol can be drag-modified in Binance testnet mode.
  - Filled/cancelled/non-limit orders, recent fill markers, position lines, futures panels, and non-testnet/live modes are blocked before modify.
  - No API request is sent during dragging; execution happens only after confirmation and then refreshes account snapshot/user-stream status.
  - No new order types, futures modify behavior, drawing tools, indicators, feeds, settings, collectors, or user-stream logic were added.

## [2026-06-13] - Feature: Chart Order and Position Lines
- **What changed**:
  - Added panel-scoped trading overlays to the main chart canvas for open limit order lines, real position entry lines, and lightweight recent fill markers.
  - Filtered chart trading overlays by the active panel symbol; open order and fill overlays are limited to spot panels because the current Binance order path is spot-only.
  - Added compact chart-line cancel controls that reuse the existing runtime `cancelOrder()` action, show inline confirmation/loading feedback, and rely on the existing post-cancel account snapshot/user-stream refresh.
  - Kept Market orders out of active chart lines and did not add drag-to-modify behavior.
- **Why it changed**:
  - Existing Binance testnet trading state was available in runtime state, but the chart did not visualize active orders, real positions, or recent fills.
- **Impact summary**:
  - Open spot Limit orders now appear as buy/sell chart lines only on matching symbol panels and can be cancelled from the line.
  - Real positions render only when runtime positions contain a matching non-flat position; no synthetic spot balance or fill-based position lines are created.
  - Recent fills can appear as small buy/sell markers near the matching candle.
  - Order execution, cancel backend logic, user stream sync, account snapshot sync, indicators, footprint/profile logic, market feeds, drawing tools, settings, and collectors remain unchanged.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-13] - Feature: Binance Testnet Place/Cancel Orders
- **What changed**:
  - Added `/api/trading/orders` with POST placement and DELETE cancellation for validated Binance testnet spot orders, including symbol/side/type/quantity/limit-price/cancel-id checks, credential checks, non-testnet/live execution blocks, and safe normalized `OrderResult` responses.
  - Extended the server-only signed Binance REST client with signed POST/DELETE support and implemented spot Market/Limit placement plus cancel in the Binance adapter.
  - Kept futures execution blocked with the clear `Futures testnet order placement is not implemented yet.` error and kept reduce-only out of spot execution.
  - Added non-persisted runtime order action loading/error/success state plus `placeOrder()` and `cancelOrder()` actions that refresh account snapshot and stream status after successful execution.
  - Updated the order ticket final confirmation to submit real testnet spot orders, show loading/success/error feedback, and stop showing the placeholder execution-not-implemented message.
- **Why it changed**:
  - The existing order ticket could validate and confirm orders but could not execute or cancel against Binance testnet.
- **Impact summary**:
  - Binance testnet spot Market/Limit orders can now be placed from the ticket and cancelled through the runtime/API path.
  - Live and non-testnet execution remain blocked by default, API secrets stay server-only, and futures placement remains explicitly unsupported.
  - Chart rendering, indicators, market data feeds, footprint/profile logic, drawing tools, and settings remain unchanged.

## [2026-06-13] - UI: Basic Order Ticket
- **What changed**:
  - Added a compact panel-scoped order ticket overlay with Buy/Sell side selection, Market/Limit type selection, quantity input, limit price input, market estimated price from the latest chart candle, selected symbol/mode/market display, reduce-only toggle when the active panel is futures, and testnet/live/paper badge display.
  - Added frontend-only validation for missing symbol/mode, non-positive quantity, non-positive limit price, and blocked live trading.
  - Added a confirmation modal that summarizes side, symbol, order type, quantity, price or estimated price, mode, market, badge, and reduce-only state, then shows `Order execution is not implemented yet.` on final confirm.
  - Reads available balance from the existing non-persisted trading runtime snapshot state when present; otherwise shows an empty balance state.
- **Why it changed**:
  - The app needed a safe basic order ticket surface before any backend order placement, cancellation, or modification behavior exists.
- **Impact summary**:
  - Order ticket state remains local UI state and is not persisted.
  - No place/cancel/modify routes, Binance order calls, or broker execution behavior were added.
  - Existing `placeOrder()` and `cancelOrder()` still reject as not implemented.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-13] - Feature: Binance Testnet User Stream Sync
- **What changed**:
  - Added a server-only Binance user data stream manager that creates listenKeys, connects to the configured testnet/live user-stream WebSocket endpoint, normalizes account balance and execution report events, keeps listenKeys alive, reconnects with backoff, prevents duplicate parallel sockets, and reconciles account state through the existing REST snapshot flow after start/reconnect.
  - Added `/api/trading/stream-status` for safe stream status reporting with mode, connected/reconnecting/error state, last event time, reconnect count, listenKey session metadata, reconciliation state, and non-secret error messages.
  - Updated `/api/trading/account-snapshot` to start the backend stream when possible and return the manager's REST-reconciled read-only account snapshot.
  - Extended non-persisted trading runtime state with user-stream status, connection, last event, reconnect count, stream error, reconciliation loading, and last reconciled timestamp fields plus a stream status refresh action.
  - Added safe user-stream connection/reconnect/reconciliation fields to the internal debug runtime summary.
- **Why it changed**:
  - Read-only Binance testnet/demo account data needed live backend updates and recovery after stream disconnects without adding any order execution UI or exposing API secrets.
- **Impact summary**:
  - Backend account state can now be updated from Binance user stream events and repaired with REST reconciliation after reconnects.
  - Frontend runtime/debug state can track stream health separately from account snapshot data.
  - Positions remain empty until futures trading is supported, and order placement/cancellation still reject as not implemented.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-13] - Feature: Binance Testnet Account Snapshot Sync
- **What changed**:
  - Added a server-only signed Binance REST client with API-key headers, HMAC SHA256 signatures, timestamp/recvWindow handling, server-time offset sync, and safe error wrapping.
  - Replaced the empty Binance adapter snapshot stubs with read-only testnet account sync for balances, open orders, and selected-symbol recent fills; positions remain empty until a futures trading mode is supported.
  - Added `/api/trading/account-snapshot` to return normalized account snapshot data and safe error payloads for blocked live mode, missing credentials, or Binance request failures.
  - Extended non-persisted trading runtime state with snapshot arrays, loading/error/timestamp fields, and a callable `refreshAccountSnapshot(symbol, limit)` action.
  - Added safe trading snapshot counts and errors to the internal debug summary.
- **Why it changed**:
  - The trading foundation needed real read-only Binance testnet/demo account synchronization without introducing order execution.
- **Impact summary**:
  - Valid Binance testnet credentials can now populate frontend runtime state with balances, open orders, and recent fills through the new API route.
  - API secrets remain server-only, live mode remains guarded by the existing config safety gate, and order placement/cancellation still reject as not implemented.
  - Chart rendering, indicators, market feeds, footprint/profile logic, drawing tools, and settings remain unchanged.

## [2026-06-13] - Feature: Binance Trading Foundation
- **What changed**:
  - Added shared generic trading models for trading modes, broker adapters, orders, positions, balances, fills, account snapshots, and safe health status payloads.
  - Added server-only Binance trading config with `binance_testnet` as the default mode, testnet/live credential presence checks, and a live-trading safety gate requiring `BINANCE_ENABLE_LIVE_TRADING=true`.
  - Added an inert Binance broker adapter stub that can provide empty snapshot data but rejects order placement and cancellation.
  - Added `/api/trading/health` to return safe mode, badge, credential-presence, Binance server-time, connection, and block status without exposing API secrets.
  - Added non-persisted frontend runtime state for trading mode, connection status, badge, last health check time, and last error message.
- **Why it changed**:
  - The app needs a safe base architecture for Binance-linked testnet/demo trading before any order UI or real execution behavior is introduced.
- **Impact summary**:
  - Binance testnet is the default trading mode, live mode is blocked unless explicitly enabled on the server, and no real orders can be placed by this foundation.
  - Chart rendering, indicators, order-flow feeds, footprint/profile logic, drawing tools, and existing settings remain unchanged.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-09] - UI: Chart Info Row Polish
- **What changed**:
  - Restyled the top-left chart info row to feel more like an independent TradingView legend line with larger text, clearer pair/market/source separation, and a small connection status dot.
  - Kept the Spot/Futures/Both source buttons in the info row but made them lighter inline text controls instead of boxed header-style controls.
- **Why it changed**:
  - The first chart info row was too compact and still read like a small toolbar instead of chart legend information.
- **Impact summary**:
  - The chart info row is easier to scan above indicators while Flow Source behavior, indicator collapse behavior, toolbar behavior, and chart logic remain unchanged.

## 2026-08-06

### What Changed
- Added `<OrdersPanel />` bottom pane component with "Open Orders" and "Trade History" tabs.
- Added `<AccountBalanceWidget />` in the top `Header`.
- Integrated `OrdersPanel` into the `page.tsx` layout spanning the bottom of the main content area.
- Verified limit order lines and labels render properly via `drawTradingOverlays.ts`.
- Verified `DELETE /api/trading/orders` endpoint correctly cancels Binance testnet limit orders.
- Created `useTradingSync` hook to automatically fetch `refreshAccountSnapshot` on mount and poll every 10s.

### Why It Changed
- Implementation of Order Management Phase 1 & 2 to match TradingView's professional UI standards.
- Replaces disconnected prototype behavior with actual open order tracking, trade history logging, and cancellation capability directly from the frontend UI.
- Fixed a bug where orders and balances were completely empty on load because `refreshAccountSnapshot` was never automatically invoked.

### Impact Summary
- New `OrdersPanel.tsx` reads live data from Zustand store to show testnet orders and recent fills.
- New `useTradingSync.ts` hook guarantees the frontend stays in sync with the backend.
- New `AccountBalanceWidget.tsx` calculates available/locked margin natively.
- No structural refactoring; purely additive to UI real estate.

---

## [2026-08-05] - UI: Order Panel Drag and Default Quantity
- **What changed**:
  - Transformed `OrderTicket.tsx` into a draggable floating modal that mimics the TradingView order dialog instead of remaining absolutely positioned.
  - Added smart default quantity calculation logic in `OrderTicket.tsx` so users no longer hit the "Quantity must be greater than 0" error by default.
- **Why it changed**:
  - The static positioning of the order panel was obtrusive and lacked parity with the TradingView drag UX. A default quantity prevents immediate errors upon opening the ticket.
- **Impact summary**:
  - Users can now drag the Order Ticket around the screen naturally.
  - Default quantity auto-populates intelligently based on available balance or defaults to 0.001.

---

## [2026-08-06] — Feature: Chart Order Visualization, Virtual Positions, and SL/TP Drag Handles (Phase 1)

### What changed
- **`types/trading.ts`**: Added `VirtualPosition` (client-side spot position aggregated from fills), `BracketOrder` (decoupled SL/TP model with extensibility for multi-TP and trailing stops), and `BracketDragState` (canvas drag context).
- **`components/chart/drawTradingOverlays.ts`**: Full rewrite into a professional overlay renderer:
  - Limit order lines with buy (bullish) / sell (bearish) colour separation, quantity/status labels, and price-axis badges.
  - Virtual position entry lines (fixed, non-draggable) with PnL text, side marker triangle, and axis badge.
  - Bracket SL (red) and TP (teal) lines with pill-handle drag controls, coloured risk/profit zone fills, and faint nudge indicators when no bracket is set.
  - Drag-modify preview line (existing).
  - Fill markers (existing, moved into new priority order).
  - Returns `TradingOverlayHitZones` with per-frame SL/TP handle bounding boxes.
- **`lib/store/chartRuntime.ts`**: Extended `TradingRuntimeStatus` with `virtualPositions`, `bracketOrders`, `bracketDrag`. Added five new actions: `upsertVirtualPosition`, `removeVirtualPosition`, `upsertBracketOrder`, `removeBracketOrder`, `setBracketDrag`, `updateVirtualPnl`.
- **`components/chart/ChartCanvas.tsx`**: Wired up bracket drag:
  - `bracketDragRef`, `bracketDragEntryPrice`, `bracketDragSide`, `bracketHitZones` refs added.
  - `onMouseDown`: hits SL/TP handles from last frame's `TradingOverlayHitZones` and starts bracket drag.
  - `onMouseMove`: clamps price (Long TP > entry > SL; Short SL > entry > TP) and calls `setBracketDrag` every tick for live canvas feedback.
  - `onMouseUp`: commits clamped price to `upsertBracketOrder`, resets all drag refs, clears `bracketDrag`.
  - Updated `drawTradingOverlays` call with new signature + `priceAxisWidth`.
  - Updated redraw dependency array to include `virtualPositions`, `bracketOrders`, `bracketDrag`.
- **`components/chart/ChartPanel.tsx`**: Added selectors and memos for `chartVirtualPositions`, `chartBracketOrders`, and `tradingBracketDrag`. Passed new props to `ChartCanvas`.

### Why it changed
- Open limit orders and positions existed only in the order list. They had no professional chart representation.
- There was no Virtual Position abstraction to bridge spot fills → tradeable positions.
- SL/TP were requested as interactive draggable chart controls following the TradingView UX model.
- The architecture needed the decoupled `BracketOrder` model upfront to support Phase 4 (backend execution) cleanly.

### Impact summary
- `npx.cmd tsc --noEmit` passes with zero errors.
- Existing Limit order drag-modify, cancel-on-chart, fill markers, indicator layers, drawing tools, feeds, and footprint/profile logic are unchanged.
- Virtual positions and bracket orders are currently UI-only (local store); Phase 4 will connect them to the Binance backend execution engine.

---

## [2026-08-07] — Fix: Lowered Aggregate Bubble Storage Thresholds

### What changed
- **`.env.local`**: Lowered `COLLECTOR_AGG_BUBBLE_MIN_VOLUME_BTC` to `1`, set `COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT` to `25`, and lowered `COLLECTOR_AGG_BUBBLE_MIN_TRADE_COUNT_VOLUME_BTC` to `0.5`.

### Why it changed
- The collector script was dropping all aggregate bubble candidates because the previous thresholds (e.g. 15 BTC) were far too high for normal market conditions, resulting in an empty `aggregate_bubble_events` collection.

### Impact summary
- The collector will now properly store historical aggregate bubbles meeting these realistic thresholds into the `orderflow_bubbles` database.
- The UI chart will now be able to fetch and hydrate these historical bubbles on refresh.

---

## [2026-08-07] — Fix: Collector Index Mismatch

### What changed
- **`scripts/collector/btcusdtCollector.mjs`**: Updated the `idx_aggregate_bubbles_restore` index creation to include `aggregateTradeId: 1` and `background: true`, exactly matching `aggregateBubbleStorage.ts` and `ensureIndexes.ts`.

### Why it changed
- The collector crashed on startup with an `IndexKeySpecsConflict` error because the existing index created by the web app/indexer script included `aggregateTradeId: 1` in the key, but the collector script was attempting to recreate it with just `eventTime: 1`.

### Impact summary
- The collector script now starts up correctly and connects to the bubbles database without index conflict errors.
