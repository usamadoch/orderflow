# OrderFlow Chart - Change Log

## [2026-05-23] - Observability: Market Debug Metrics Snapshot
- **What changed**:
  - Added a central dev-only `lib/debug/marketMetrics.ts` metrics registry exposed as `window.__MARKET_DEBUG__`.
  - Instrumented the shared feed registry with stream creation/reuse/close counts, subscriber counts, last event timestamps, and per-stream event rates.
  - Instrumented candle, footprint, and Volume Profile shared caches with active keys, slice/row/cell counts, approximate memory size, coverage ranges, cache hit/miss counts, restore requests, restore dedupe counts, and live trade dedupe counts.
  - Added restore/storage diagnostics from the panel feed lifecycle for candle/history restores, raw trade restores, footprint/profile restores, row write requests, skipped rows, and failed writes.
- **Why it changed**:
  - Shared feeds and caches needed a browser-console snapshot for validating split-panel reuse, restore dedupe, cache coverage, subscriber changes, and storage health without changing runtime behavior.
- **Impact summary**:
  - In development, DevTools can inspect `window.__MARKET_DEBUG__.getSnapshot()` and clear counters with `window.__MARKET_DEBUG__.reset()`. Production remains no-op unless explicitly enabled with market debug env flags.
  - Chart rendering, database schema, storage format, and feed/cache behavior are unchanged; only lightweight counters and derived summaries were added.

## [2026-05-23] - Architecture: Shared Candle/OHLCV Cache
- **What changed**:
  - Added a shared in-memory candle cache keyed by `contractType::symbol::timeframe`.
  - Routed panel candle history restore and live kline updates through the cache while syncing snapshots back into panel Zustand candle state.
  - Added `[CANDLE_CACHE]` diagnostics for cache creation/reuse, subscriber add/remove, history restore, live updates, candle counts, cache keys, and in-flight restore reuse.
  - Promoted candle cache verification output to visible console logs and added `[CANDLE_CACHE_VERIFY:left/right]` panel sync logs for restore results, snapshot syncs, and live candle fanout.
  - Re-enabled `[FEED_REGISTRY]` console logs so stream creation/reuse and subscriber counts are visible alongside candle cache logs.
- **Why it changed**:
  - Matching split panels could still restore, merge, and maintain duplicate OHLCV candle arrays even though their live kline WebSocket stream was already shared.
  - Manual validation needed obvious browser-console markers for cache reuse and panel fanout.
- **Impact summary**:
  - Panels with the same contract, symbol, and timeframe reuse one capped merged candle base and one live kline cache update path. Panel-specific viewport, scroll, zoom, drawings, overlays, signals, footprint/profile settings, and render state remain local.
  - The extra logs are verification-only and do not change footprint cache, Volume Profile cache, feed registry, chart UI, or storage behavior.

## [2026-05-23] - Architecture: Shared Live Feed Registry
- **What changed**:
  - Added a shared ref-counted feed registry for Binance kline, aggTrade, and spot depth streams.
  - Routed panel feed subscriptions through registry keys so identical panels reuse live streams while each panel keeps its own callbacks.
  - Added in-flight reuse for Binance candle history and orderbook snapshot fetches to reduce duplicate concurrent API requests.
- **Why it changed**:
  - Split panels with matching symbol/source/timeframe were opening duplicate WebSocket subscriptions and doing duplicate live network work.
- **Impact summary**:
  - Matching panels now share underlying live feed subscriptions until the final subscriber unsubscribes, while footprint/profile caches, contract alignment, signals, orderbook managers, storage, and chart rendering remain panel-local.

## [2026-05-23] - Architecture: Shared Volume Profile Base Cache
- **What changed**:
  - Added a shared in-memory Volume Profile base cache keyed by `symbol::contractType::dataSourceMode::baseBucketSize`.
  - Updated `RawTradeVolumeProfileEngine` to keep panel-local build/cache state while reading and writing canonical 1m fine rows through the shared cache.
  - Routed fine-profile history restore through cache-level coverage checks and in-flight restore dedupe with `[VPROFILE_CACHE]` diagnostics.
- **Why it changed**:
  - Matching split panels still owned separate Volume Profile memory, causing duplicate fine-row restore calls and duplicate base profile aggregation work.
- **Impact summary**:
  - Panels with the same symbol/source/base bucket reuse restored and live fine Volume Profile rows while keeping independent timeframe, visible/profile range, display row size, chart settings, drawings, and render state. Different symbol/source/base-bucket combinations remain isolated.

## [2026-05-22] - Architecture: Shared Footprint Base Cache
- **What changed**:
  - Added a shared source-scoped in-memory footprint cache keyed by `symbol::contractType::dataSourceMode`.
  - Updated `AggregationEngine` to keep panel-specific display settings and candle metadata while reading/writing canonical 1m/$5 base slices through the shared cache.
  - Added cache-level live trade dedupe and in-flight restore dedupe so panels sharing a source do not double-count trades or duplicate matching restore requests.
- **Why it changed**:
  - Each panel still owned separate base footprint memory, so matching symbol/source panels could duplicate 1m/$5 restore and live base data.
- **Impact summary**:
  - Panels with the same symbol/source can reuse loaded base footprints while keeping independent timeframes, display bucket sizes, signals, overlays, and render state. Different symbol/source combinations remain isolated.

## [2026-05-22] - Architecture: Source-Scoped Base Footprints
- **What changed**:
  - Added `contractType` and `dataSourceMode` to footprint persistence and query identity, with a schema migration that isolates old rows under `legacy/legacy`.
  - Changed footprint storage/restore to use canonical `1m` timeframe and `$5` bucket rows only.
  - Updated the aggregation engine to keep 1m/$5 base footprint slices and derive selected chart timeframes and larger display buckets in memory.
- **Why it changed**:
  - Footprint rows were source-unsafe and still tied to selected chart timeframe, which could mix spot/futures/both data or create direct 5m/15m footprint storage.
- **Impact summary**:
  - Source combinations no longer overwrite each other in `footprint_cells`. 5m/15m/etc. chart footprints are derived from restored/live 1m/$5 base slices, while display bucket changes remain DB-free.

## [2026-05-22] - Architecture: Fixed Base Footprint Bucket
- **What changed**:
  - Updated the footprint aggregation engine to ingest and hydrate footprint cells at a fixed $5 base bucket size.
  - Added in-memory display aggregation so larger selected bucket sizes combine existing $5 cells instead of changing the stored footprint resolution.
  - Updated footprint restore, the storage action bridge, and closed-candle storage to request/write only the $5 base bucket, and prevented bucket-size changes from restarting the feed restore path.
- **Why it changed**:
  - Footprint history restore/storage was tied to the selected display bucket size, so switching from $5 to larger buckets could miss stored data or trigger bucket-specific restore behavior.
- **Impact summary**:
  - Changing display bucket size now re-aggregates loaded $5 footprint data in memory. $10 combines two $5 levels, $25 combines five $5 levels, and stored/restored DB footprint rows stay on one base resolution.

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
