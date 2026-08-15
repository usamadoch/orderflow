# OrderFlow Chart - Change Log

## [2026-08-16] - Feature/UI: Bubble Customization and Docs
- **What changed**:
  - Replaced semantic bubble colors with custom hex values `#0D5B0B` (Buy) and `#4A1E6F` (Sell) in `drawBubbles.ts`.
  - Updated default bubble radius limits in `lib/store/chart.ts` to `bubbleMinRadius: 2` and `bubbleMaxRadius: 8`.
  - Created `BubblesDocsModal.tsx` containing a detailed tutorial/reference on bubble sizing and opacity.
  - Added a "DOCS" link to the Bubbles section of `ChartSettingsDropdown.tsx` to toggle the new modal.
- **Why it changed**:
  - The user requested specific color replacements for bubbles and desired smaller default sizes (2px - 8px) with a dedicated pop-up modal to explain the relationship between volume, opacity, and bubble radius for future reference.
- **Impact summary**:
  - The bubbles feature is visually updated and easier to understand thanks to the integrated documentation modal accessible directly from the settings panel.

## [2026-08-15] - Fix: Pagination Infinite Fetch Loop on Scroll
- **What changed**:
  - Updated `alignFootprintRange` and `alignFineProfileRange` in `FeedProvider.tsx` to align requested ranges to fixed 2-hour chunk boundaries (`FOOTPRINT_RESTORE_MAX_CHUNK_SECONDS` / `FINE_PROFILE_RESTORE_CHUNK_SECONDS`) instead of 1-minute bounds.
  - Updated `skills/map.md` to reflect the fixed chunk boundaries change.
- **Why it changed**:
  - The previous 1-minute snapping caused the `requestedRange` (and thus the `restoreKey`) to change on nearly every scroll frame. This repeatedly triggered chunked network requests for slightly-shifted 2-hour windows, bypassing the cache deduplication and spamming infinite overlapping GET requests.
- **Impact summary**:
  - The footprint and volume profile restores now correctly snap to absolute 2-hour time boundaries. Scrolling back smoothly fires one single GET request per 2-hour window and properly skips network fetching if the data is already cached.
## [2026-08-15] - UI: Remove Floating Footprint Delta Numbers
- **What changed**:
  - Removed the `drawDelta` function from `lib/utils/canvas.ts`.
  - Removed the call to `drawDelta` inside `drawFootprint.ts` that rendered floating green/red delta numbers at the bottom of the chart canvas.
  - Updated `skills/map.md` to reflect these responsibility changes.
- **Why it changed**:
  - The floating delta numbers above the time axis were redundant and visually confusing now that the dedicated Stats Indicator Dashboard provides a clear, color-coded "Delta" row for every candle.
- **Impact summary**:
  - The chart canvas is cleaner at the bottom.
  - Delta is now exclusively read from the Stats grid, improving visual consistency and reducing clutter above the time axis.

## [2026-08-15] - Fix: Candlestick Body Width
- **What changed**:
  - Increased the body width multiplier in `drawCandles.ts` from 0.6 to 0.82 of the available bar width.
- **Why it changed**:
  - The Japanese candlesticks had too much empty gap between them, making them look thin and disconnected. The user wanted a tighter, more traditional TradingView-style spacing.
- **Impact summary**:
  - Candlesticks now render significantly wider, filling more of the available column width and making the chart visually cleaner and easier to read.

## [2026-08-15] - Redesign: Stats Indicator Dashboard
- **What changed**:
  - Redesigned `drawStatsGrid.ts` to render the Stats indicator as a compact row of large, equal-sized colored cells instead of plain text.
  - Implemented intensity-based background coloring for Delta, Volume, and CVD cells using the existing order-flow color palette.
  - Reused the normalization logic from `drawFootprint.ts` (`percentile`, `getSoftScale`) to scale color intensity dynamically based on the current visible range rather than hardcoded thresholds.
  - Passed `currentBarWidth` from `ChartCanvas.tsx` to `drawStatsGrid.ts` to ensure cells map exactly to the candlestick horizontal grid.
  - Updated typography and spacing to improve glanceability.
  - Updated `skills/map.md` to reflect that `drawStatsGrid.ts` acts as the stats canvas overlay.
- **Why it changed**:
  - The previous Stats indicator was plain text and visually weak. The user requested a professional, dashboard-like array of colored cells for faster visual scanning of market conditions (e.g., strong vs. weak Delta, positive vs. negative CVD).
- **Impact summary**:
  - Traders can now immediately assess volume magnitude and buying/selling dominance per candle through color intensity without needing to read individual numbers.

## [2026-08-14] - Fix: Large Custom Volume Profile Cache Eviction (Revised)
- **What changed**:
  - Implemented a "protected ranges" mechanism in `lib/volumeProfile/profileCache.ts`. The `VolumeProfileBaseCache` now accepts registered time windows that are strictly immune to normal background size-based eviction sweeps (`cleanup` and `deleteRowsBefore`).
  - Updated `lib/volumeProfile/profileEngine.ts` to own the protected ranges state. `RawTradeVolumeProfileEngine` now intercepts `setProtectedRanges`, stores them, and automatically re-applies them whenever its internal base cache instance is swapped (`setBaseCache`), fixing a critical synchronization bug.
  - Added a reactive `useEffect` to `components/FeedProvider.tsx` that monitors Custom/Default Volume Profile bounds and calls `volumeProfileEngineRef.current.setProtectedRanges(...)`.
- **Why it changed**:
  - A bug caused large custom volume profiles to sporadically disappear. The custom profile relies on the global shared cache, which limits data to a rolling 12-hour window. The initial fix failed because the UI registered ranges on a temporary dummy cache just before the engine asynchronously swapped it out for the real shared cache.
- **Impact summary**:
  - Custom Volume Profiles can now span arbitrary lengths of time without being destroyed by the rolling cache limits.
  - The engine robustly maintains UI data constraints regardless of background cache lifecycle events.

## [2026-08-14] - Audit: Large Custom Volume Profile Bug
- **What changed**:
  - Created `artifacts/large_profile_bug_diagnosis.md` detailing the root cause of the disappearing volume profile bug.
  - Updated `skills/map.md` to track the new artifact.
- **Why it changed**:
  - The user requested an investigation into why large custom volume profiles would initially render correctly, then disappear, and temporarily reappear upon dragging. The root cause was diagnosed as a conflict between the UI's static data requirements and the shared 12-hour rolling cache eviction policy.
- **Impact summary**:
  - A definitive root cause has been established and documented without making any premature code changes. Recommended architectural fixes (decoupling caches or pinning active ranges) are presented in the artifact.

## [2026-08-13] - Feature: Stats Indicator
- **What changed**:
  - Added `statsIndicatorEnabled`, `statsIndicatorCount`, and `statsIndicatorItems` to `lib/store/chart.ts` with default state and persistence mapping.
  - Added Stats toggle to `IndicatorLabels.tsx`.
  - Added Stats settings tab to `ChartSettingsDropdown.tsx` allowing users to choose up to 4 compact stats (Volume, Delta, CVD, Liquidity) and their order.
  - Created `StatsIndicator.tsx` to render a floating overlay of the selected stats using existing chart engine and liquidity history calculations.
  - Integrated `StatsIndicator` into `ChartPanel.tsx`.
- **Why it changed**:
  - The user requested a compact, customizable stats box at the bottom of the chart to display real-time metrics without duplicating existing data calculations.
- **Impact summary**:
  - Users can now track key aggregate metrics (Volume, Delta, CVD, Liquidity) globally across the visible chart range in a customizable floating overlay.


## [2026-08-10] - Feature: Panel-Specific Refresh Buttons
- **What changed**:
  - Added a `refreshKey` property to each panel's `PanelRuntimeState` in `lib/store/chartRuntime.ts`, initialized to `0`.
  - Added a new `triggerPanelRefresh` action in `useChartRuntimeStore` to increment a specific panel's `refreshKey`.
  - Bound the `refreshKey` as a React `key` prop on the `<PanelFeedProvider>` for the left and right panels in `app/page.tsx` (`key={"left-refresh-" + leftRefreshKey}`).
  - Added a "Refresh panel data" button using the `RefreshCw` icon from `lucide-react` to `components/ui/PanelToolbar.tsx`, positioned next to the settings button.
- **Why it changed**:
  - Users experienced transient glitches (e.g., three candles rendering next to each other, Volume Profiles hanging on load) that were easily resolved by refreshing the page. However, a full page refresh disrupts the entire application.
  - Adding a panel-specific refresh button that forcefully deletes the shared memory caches (candles, footprint, volume profile) for that panel's configuration and then completely unmounts/recreates the `<PanelFeedProvider>`, acting as a clean slate for just that panel. This forces a true database re-fetch and resolves glitches without affecting the global store settings.
- **Impact summary**:
  - The UI now has a dedicated refresh button per panel.
  - Clicking the refresh button destroys the in-memory shared caches for that panel's active symbol/timeframe, as well as all transient runtime data, local caches, and engines for that panel, forcing a fresh connection and restore lifecycle from the database.
  - Global application state (like the `chartStore` settings and `tradingStatus`) remains completely unaffected.

## [2026-08-09] - Feature: Manual Storage Management

- **What changed**:
  - Removed all size-based automated pruning functions (`enforceSizeRetention`, `pruneOldestDataHour`) and related config values from `btcusdtCollector.mjs`.
  - Created a new full-stack feature for manual storage management:
    - `app/api/history/storage/route.ts` API that aggregates DB usage per day for footprint, profile, and bubble collections and allows deletion of specific days.
    - `StorageManager.tsx` UI component that presents daily usage metrics in a modal and allows the user to selectively delete days.
    - Added a trigger for the Storage Manager inside `Header.tsx`.
- **Why it changed**:
  - Automated deletion loops (both time-based and size-based) had proven dangerous on the 512MB Atlas tier, repeatedly compounding transient errors into complete historical data loss. The user wanted full control to prune old days manually (e.g., every week or two).
- **Impact summary**:
  - The collector is now purely a write-only daemon with no risk of deleting its own data.
  - The user has direct visibility into storage consumption and full control over retention through the UI.


## [2026-08-09] - Fix: Collector Reconnect Discard and Size-Based Retention
- **What changed**:
  - Replaced the fixed oldest-hour prune with a size-based rolling retention in `btcusdtCollector.mjs` (defaulting to 500MB) that runs every 5 minutes. Kept `pruneOldestDataHour()` as a safety net on write quota errors.
  - Stopped discarding all unflushed pre-gap slices on WebSocket reconnect. The collector now accurately tracks the specific `taintedRangesBySource` and only discards slices that fall strictly inside the disconnected window, persisting everything else normally.
- **Why it changed**:
  - The previous reconnect handling incorrectly collapsed the entire runtime's coverage start forward, causing the collector to throw away completely valid data sitting in memory just because a gap occurred before it was flushed.
  - The retention mechanism needed to be purely size-based to maximize historical capacity within the 512MB Atlas M0 hard limit, rather than relying on fixed time cutoffs.
- **Impact summary**:
  - WebSocket reconnects no longer cause unnecessary data loss for slices that were fully covered before the gap.
  - The database safely accumulates data until it hits the configured 500MB ceiling, after which it smoothly prunes 50MB chunks.

## [2026-08-09] - Hotfix: Collector Status Bug and Spot WebSocket AWS Block
- **What changed**:
  - Fixed a `ReferenceError: status is not defined` crash in `btcusdtCollector.mjs` caused by the previous logging compression.
  - Swapped the Binance Spot WebSocket URL from `stream.binance.com:9443` to `data-stream.binance.vision`.
- **Why it changed**:
  - The `status` object was removed from the logging output but was still referenced in the database metadata upsert.
  - The standard Binance Spot WebSocket endpoint aggressively blocks AWS EC2 IP ranges (especially in the US), causing an immediate `1006` disconnect loop on startup. `data-stream.binance.vision` is the official alternative for market data that doesn't strictly geo-block cloud providers.
- **Impact summary**:
  - The collector should no longer infinitely disconnect on AWS for spot data.
  - The status logging is now clean and crash-free.

## [2026-08-15] - Architecture: Unlimited Historical Retention & On-Demand Pagination
- **What changed**:
  - Removed MongoDB TTL indexes (`expireAfterSeconds`) on all time-series collections (`marketStorageMongo.ts`) and disabled automatic libSQL background deletion (`cleanupJob.ts`).
  - Removed the artificial 4-hour scrolling limit clamp in `FeedProvider.tsx` (`getFootprintRestorePlan`) to allow continuous backward pagination.
  - Increased `MARKET_CACHE_MAX_CANDLES` to 50,000 candles to provide a much larger anchor for the index-based canvas coordinate system, ensuring unbounded UI scrolls don't break.
  - Verified `footprintCache` dynamically evicts oldest data when bounds (100k cells) are exceeded, while seamlessly reloading chunks from the local DB via `getMissingBaseCandleTimes` when scrolled back into view.
- **Why it changed**:
  - The previous architecture utilized a strict 7-day TTL and a 4-hour fetch clamp to prevent memory overload, limiting historical capability. The new design shifts to unlimited DB persistence with dynamic on-demand front-end chunk loading to satisfy unlimited user-controlled retention.
- **Impact summary**:
  - The database is now the permanent source of truth for all fetched history. The UI seamlessly infinite-scrolls backwards over weeks of data without memory runaway or infinite fetch loops.
  - `npx tsc --noEmit` passes cleanly.

## [2026-08-09] - Fix: Collector Erroneously Deleting Data on Transient Errors
- **What changed**:
  - Updated the error handling in `writeClosedSlice` inside `btcusdtCollector.mjs` to check if a write error is actually a quota/size error (e.g., checking for keywords like "quota", "limit", "size") before invoking `pruneOldestDataHour()`.
  - Non-quota errors (such as transient network drops or duplicate key errors) now bypass pruning and are simply re-thrown, allowing the collector to safely retry the slice write on its next interval without losing any historical data.
- **Why it changed**:
  - The previous fix to prevent data loss (which removed the size manager) mistakenly assumed *any* write error was an Atlas quota error (512MB limit hit).
  - When frequent transient network drops or duplicate key errors occurred on the AWS EC2 instance, the catch block blindly pruned 1 hour of data. Because the pruning cooldown is only 10 minutes, periodic transient errors caused the collector to constantly eat its own historical data, leaving the user with only ~1.5 hours of footprint data despite running for 24 hours.
- **Impact summary**:
  - The collector will no longer silently delete hours of historical data during normal network hiccups.
  - Data accumulation will now properly continue up to the true Atlas limit without being derailed by transient connection errors.
  
## [2026-08-08] - Fix: Collector Only Retaining 4 Hours of Data
- **What changed**:
  - Removed the entire "Size Manager" pruning block from `logStatus()` in `btcusdtCollector.mjs`. This code ran every 30 seconds, checked `dbStats`, and deleted the oldest 1 hour of data if the metric exceeded 450MB.
  - Changed `DEFAULT_RETENTION_DAYS` from `7` to `90` so the MongoDB time-series TTL does not prematurely delete data â€” the 512MB Atlas limit is the real constraint, not a time window.
  - Changed `MARKET_DATA_RETENTION_DAYS` in `.env.local` from `7` to `90` to match, preventing the web app from resetting the TTL back to 7 days via `collMod`.
  - Removed `DEFAULT_MAX_DB_SIZE_BYTES` constant and `config.maxDbSizeBytes` (no longer used).
  - Added `pruneOldestDataHour()` with a 10-minute cooldown, triggered only when an actual write fails (Atlas quota reached).
  - Wrapped `writeClosedSlice` to catch write failures â†’ prune oldest hour â†’ retry once.
  - Replaced the size-cap block with an informational `database size report` log (dataSize, storageSize, indexSize) for monitoring without any automatic deletion.
- **Why it changed**:
  - **Root cause 1**: The pruning code used `storageSize` (Gemini's fix) or `dataSize` (original code) from `dbStats`, both of which are unreliable for this purpose. `dataSize` is inflated for time-series internal bucket overhead. `storageSize` does not decrease after WiredTiger deletes (freed pages are reused, not released). Both metrics caused the pruning to trigger in an infinite loop every 30 seconds, creating a death spiral that stabilized at ~4 hours of data.
  - **Root cause 2**: The pruning ran every 30 seconds inside `logStatus()`. Even one false trigger would delete 1 hour, and since the metric never decreased after deletion, every subsequent check also triggered, compounding the data loss.
  - **Root cause 3**: The 7-day TTL on the time-series collections conflicted with the goal of "store until 512MB fills up."
- **Impact summary**:
  - The collector will now accumulate data for days/weeks until the Atlas 512MB limit is actually reached. Only then will a write failure trigger a single oldest-hour prune with retry. The status log now reports actual database sizes for monitoring.
  - `.env.local` updated to `MARKET_DATA_RETENTION_DAYS=90` for the web app side.


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

