# OrderFlow Chart - Change Log

## [2026-05-21] - Fix: Source-Scoped Volume Profile History
- **What changed**:
  - Scoped fine-grain Volume Profile row restore/storage by the active Candles & Prices contract and Aggregate Trades source selection.
  - Updated live closed-candle profile row handoff so full-coverage rows are retained in the profile engine for spot, futures, and combined source modes.
  - Updated the profile engine to merge compatible hydrated fine rows with hydrated raw trades for candles that do not already have fine rows, while keeping source-aware live trade dedupe.
- **Why it changed**:
  - Volume Profiles could fall back to only the active candle because historical fine rows were not consistently retained/restored after source-routing changes, and unscoped restored rows could mix incompatible Spot/Futures source combinations.
- **Impact summary**:
  - Default and custom Volume Profiles can rebuild across historical candles from source-matched fine rows or safe spot/spot raw-trade fallback without changing candle price alignment or aggregate-trade source behavior.

## [2026-05-21] - Fix: Routed Binance Futures Market WebSocket
- **What changed**:
  - Updated the Binance futures adapter to connect kline/aggTrade combined streams through the routed `/market/stream` WebSocket endpoint.
  - Left futures REST history, message parsing, reconnect handling, and feed routing unchanged.
- **Why it changed**:
  - The previous unrouted `fstream.binance.com/stream` URL could open without delivering futures market kline or aggTrade messages, leaving Futures/Futures mode with REST candles but no live footprint flow or live connection state.
- **Impact summary**:
  - Futures candle and aggregate-trade WebSocket messages can now reach the existing provider callbacks, allowing Futures/Futures mode to populate footprint/delta cells and report `LIVE` once messages arrive.

## [2026-05-21] - Fix: Futures Live Connection Status
- **What changed**:
  - Updated the panel feed lifecycle so the connected flag flips to live when any selected live stream message arrives, including futures aggTrades.
  - Kept candle handling unchanged for price/chart updates while allowing trade-only live flow to report an active connection.
- **Why it changed**:
  - Futures/Futures mode could display REST-loaded candle data while the header still showed `DISCONNECTED` because connection state was only updated from live candle messages.
- **Impact summary**:
  - Futures-only aggregate trade mode can now report `LIVE` once futures live data is flowing, without changing working spot routing or chart rendering behavior.

## [2026-05-21] - Fix: Separate Contract Type From Aggregate Trades
- **What changed**:
  - Added a persisted per-panel Contract Type setting for `Spot` or `Futures` candles/price, defaulting to spot.
  - Extended the futures adapter to support futures REST kline history and WebSocket kline streams in addition to aggTrades.
  - Updated the feed lifecycle so candles/history follow Contract Type while aggregate trades still use `Spot`, `Futures`, or `Both`.
  - Aligned non-contract aggTrades to the selected contract candle price before footprint/profile aggregation so mixed sources do not create hybrid price buckets.
  - Cleared spot/futures live-stream callbacks on disconnect so changing modes cannot accidentally reconnect stale streams.
- **Why it changed**:
  - Combined spot and futures aggTrades were using their own market prices, which could distort footprint price buckets away from the selected tradeable reference chart.
- **Impact summary**:
  - Candle OHLCV and the price axis now come from one clean contract source, while footprint volume, delta, CVD, profiles, and signals can still use spot-only, futures-only, or combined aggression without price-axis drift.

## [2026-05-21] - Feature: Binance Futures AggTrade Feed
- **What changed**:
  - Added a Binance futures trade-only feed adapter using the public futures aggTrade WebSocket.
  - Added persisted per-panel data source mode with `Spot`, `Futures`, and default `Both` options in chart settings.
  - Updated the panel feed lifecycle to keep spot candles/history/orderbook active while routing selected spot and/or futures trades into the existing aggregation engine.
  - Made live trade dedupe source-aware and kept raw-trade DB writes spot-only to avoid schema changes.
- **Why it changed**:
  - The chart needed optional Binance perpetual futures flow combined with existing spot aggTrades without changing aggregation, rendering, candle, or adapter interfaces.
- **Impact summary**:
  - Delta, footprint cells, volume profile, CVD, and signals can now reflect spot-only, futures-only, or combined live trade activity. Switching the source setting reconnects the active trade streams while candles and liquidity remain spot-based.

## [2026-05-20] - Fix: CVD Compact Bar Time-Axis Position
- **What changed**:
  - Moved the minimized CVD compact bar from a bottom flex row to an absolute overlay directly above the chart time axis.
- **Why it changed**:
  - The compact bar was rendering underneath the horizontal timestamp axis instead of collapsing above it.
- **Impact summary**:
  - Minimized CVD now preserves the time axis at the absolute bottom while keeping minimize/expand behavior lightweight and isolated to layout positioning.
