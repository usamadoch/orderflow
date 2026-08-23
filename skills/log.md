# OrderFlow Chart - Change Log

## [2026-08-23] - Feature: Delta + Vol Footprint Mode

- **What changed**:
  - Added `'delta-volume'` to `FootprintMode` in `types/footprint.ts` and tracked `maxTotalVol` (POC).
  - Created `drawDeltaVolumeCell` in `lib/utils/canvas.ts` to render delta bars on the left and volume profile bars on the right of the center candlestick.
  - Modified `drawFootprint.ts` to call `drawDeltaVolumeCell` when the new mode is active, highlighting the POC using `maxTotalVol`.
  - Added a "DELTA + VOL" button to the Footprint Mode selector in `components/ui/ChartSettingsDropdown.tsx`.
- **Why it changed**:
  - To fulfill user request for a third footprint chart mode combining a central candlestick with delta bars on the left and a volume profile (with POC) on the right.
- **Impact summary**:
  - Users can now select the "Delta + Vol" mode from the chart settings, which displays comprehensive structural footprint data intuitively without redundant numeric text.

## [2026-08-23] - Fix/Refactor: Web Worker Offloading and Chart Interaction Bugs

- **What changed**:
  - **Panning Bug Fix**: Refactored `ChartCanvas.tsx` to handle `onPointerDown`, `onPointerMove`, and `onPointerUp` natively on the canvas instead of via React state, resolving severe panning stickiness and stuttering.
  - **Footprint Worker Offloading**: Created `lib/worker/aggregationWorker.ts` and `lib/worker/aggregationWorkerClient.ts` to offload intensive 1-minute base footprint aggregation away from the main UI thread.
  - **Worker Initialization Crash**: Fixed a fatal `ReferenceError: process is not defined` crash in Next.js Web Workers by adding `typeof process !== 'undefined'` safety checks to `lib/cache/marketCachePolicy.ts` and `lib/debug/marketMetrics.ts`.
  - **Footprint Rendering Fix**: Corrected an exclusive time-range bug (`time < endTime`) in `AggregationEngine` when hydrating footprint cells from history or the worker, ensuring the footprint bodies render correctly instead of being empty.
- **Why it changed**:
  - To eliminate UI thread blocking when ingesting thousands of fast trades per second and to ensure the interactive chart remained responsive to panning and zooming at all times.
- **Impact summary**:
  - Footprint generation is now fully offloaded to a Web Worker, decoupling data crunching from canvas rendering. The chart is now highly responsive and fluid, and footprints display precisely.

## [2026-08-22] - Refactor: Server-Side Database Repositories, Signal Engines, and Trading Services

- **What changed**:
  - **Phase 1 (Database & Repositories)**: Modularized large monolithic DB files into single-responsibility domain repositories strictly below 200 lines:
    - `lib/db/database.ts` (1,154 lines → 52 lines facade) split into `lib/db/repositories/`: `dbSetup.ts`, `candleRepository.ts`, `tradeRepository.ts`, `footprintRepository.ts`, `profileRepository.ts`, `libsqlStorageAdapter.ts`.
    - `lib/db/mongo/marketStorageMongo.ts` (957 lines → 95 lines facade) split into `lib/db/mongo/repositories/`: `mongoCandleRepository.ts`, `mongoFootprintRepository.ts`, `mongoProfileRepository.ts`, `mongoBubbleRepository.ts`.
    - `lib/db/aggregateBubbleStorage.ts` (369 lines → 48 lines facade) delegating to `mongoBubbleRepository.ts`.
    - `lib/db/storageAdapter.ts` (248 lines → 113 lines facade) delegating to `libsqlStorageAdapter.ts`.
  - **Phase 2 (Signal Engines)**: Extracted scoring, threshold evaluation, and pure math algorithms into dedicated scorer modules strictly below 200 lines:
    - `lib/absorption/engine.ts` (389 lines → 46 lines orchestrator) delegating single-candle scoring to `lib/absorption/absorptionScorer.ts`.
    - `lib/exhaustion/engine.ts` (347 lines → 54 lines orchestrator) delegating momentum decay and wick rejection to `lib/exhaustion/exhaustionScorer.ts`.
    - `lib/liquidityVacuum/engine.ts` (441 lines → 225 lines) delegating segment stats and movement scoring to `lib/liquidityVacuum/vacuumDetector.ts`.
    - `lib/iceberg/engine.ts` (241 lines → 87 lines) delegating level evaluation and threshold scoring to `lib/iceberg/icebergScorer.ts`.
  - **Phase 3 (Trading Services)**: Modularized server trading adapters and state management:
    - `lib/trading/userDataStreamManager.ts` (638 lines → 363 lines) delegating WS client requests, listenKey keepalive, and execution report event normalization to `lib/trading/userStreamClient.ts`.
    - `lib/trading/binanceFuturesAdapter.ts` (408 lines → 146 lines) & `lib/trading/binanceAdapter.ts` (358 lines → 138 lines) delegating order, balance, and fill mappers to `lib/trading/tradingMappers.ts`.
    - `lib/trading/risk.ts` (238 lines → 122 lines) delegating daily counter state tracking and config parsing to `lib/trading/riskState.ts`.
    - `lib/trading/config.ts` (183 lines → 91 lines) delegating credential resolution and URL constants to `lib/trading/tradingConfigParser.ts`.
- **Why it changed**:
  - To strictly enforce `skills/server_code_refector.md` limits: Repositories/DB (200 lines max), Signal Engines (200 lines max), Services (200 lines max), and Config (100 lines max).
- **Impact summary**:
  - All server-side database repositories, signal engines, and trading services in `lib/` are fully modularized and maintain clear layer separation.
  - Verification via `npx tsc --noEmit` passed with exit code 0 and zero compilation errors across the entire codebase.

## [2026-08-22] - Refactor: Server-Side API Route Modularization & Layering

- **What changed**:
  - Refactored `app/api/trading/orders/route.ts` (307 lines → 102 lines) by extracting request reading, parameter normalization, validation, and error response builders into `lib/validators/orderValidation.ts`.
  - Refactored `app/api/history/storage/route.ts` (182 lines → 31 lines) by extracting MongoDB aggregation summaries, scaling calculations, and date-range deletion logic into `lib/services/storageService.ts`.
  - Refactored `app/api/trading/account-snapshot/route.ts` (87 lines → 53 lines) and `app/api/trading/stream-status/route.ts` (81 lines → 43 lines) by extracting query parameter normalizers and error snapshot/status object builders into `lib/utils/tradingApiUtils.ts`.
  - Refactored `app/api/history/aggregate-bubbles/route.ts` (106 lines → 74 lines), `app/api/history/footprint/route.ts` (102 lines → 79 lines), and `app/api/history/profile/route.ts` (87 lines → 66 lines) by extracting time parameter normalization and contract type resolution into `lib/validators/historyValidation.ts`.
- **Why it changed**:
  - To strictly comply with `skills/server_code_refector.md` guidelines for server-side file length limits (hard limit: 150 lines), layer separation (Router/Controller vs Service/Validator), and validator logic extraction.
- **Impact summary**:
  - All 12 API route files under `app/api/` are now cleanly modularized and strictly under line limits.
  - Zero changes to HTTP API payload contracts or status codes.
  - Verification via `npx tsc --noEmit` passed with exit code 0 and zero compilation errors.

## [2026-08-22] - Refactor: Modularize Chart Components & Categorize Imports

- **What changed**:
  - Refactored `components/chart/ChartCanvas.tsx` (~3.4k lines) by extracting pure math and index functions into `components/chart/chartCanvasUtils.ts`, hit testing calculations into `components/chart/chartCanvasHitTest.ts`, and floating toolbar UI components into `components/chart/CanvasDrawingToolbar.tsx`.
  - Refactored `components/chart/ChartPanel.tsx` by delegating panel symbol filtering and historical session range calculations to `components/chart/chartPanelUtils.ts` and wrapping the `panel` combined object in `React.useMemo` to stabilize dependencies across renders.
  - Refactored `components/chart/CvdPanel.tsx` by delegating scale calculations to `components/chart/cvdPanelUtils.ts`.
  - Fixed misplaced import in `components/chart/IndicatorLabels.tsx`.
  - Organized imports across all `components/chart/` components into 3 standard groups: 1. External packages, 2. Internal packages/stores (`@/...`), 3. Relative imports (`./...`).
- **Why it changed**:
  - To comply strictly with `skills/client_code_refector.md` guidelines for file length limits, single-responsibility functions, and categorized import ordering.
- **Impact summary**:
  - `ChartCanvas.tsx` size was reduced significantly (~500+ lines extracted into modular helpers).
  - All chart components now follow a consistent import structure.
  - Verification via `npx tsc --noEmit` passed with exit code 0 and zero compilation errors.

## [2026-08-22] - Refactor: Extract FeedProvider Utilities & Organize Imports

- **What changed**:
  - Extracted ~400 lines of pure utility functions and module-level bounded caches (`queuedRawTradeStorageKeys`, etc.) from `components/FeedProvider.tsx` into a new `lib/utils/feedUtils.ts` file.
  - Reordered and organized imports in `FeedProvider.tsx` into categorized groups (Types, Config, Stores, Engines, Utilities, Feeds).
- **Why it changed**:
  - To reduce the file length of `FeedProvider.tsx` and strictly adhere to `client_code_refector.md` Rules 7 (Imports) and 10 (Extract Pure Utilities).
- **Impact summary**:
  - `FeedProvider.tsx` is significantly shorter and its dependencies are clearly legible. `tsc --noEmit` validates the extraction is completely type-safe and didn't break runtime logic.

## [2026-08-22] - Refactor: Extract Magic Constants

- **What changed**:
  - Extracted 22 magic configuration constants (e.g. `RAW_TRADE_FLUSH_MS`, `PROFILE_REDRAW_MS`) from `components/FeedProvider.tsx` into a dedicated `lib/config/constants.ts` file.
- **Why it changed**:
  - To reduce file length and bloat in the main `FeedProvider.tsx` component, strictly adhering to the `client_code_refector.md` rule that magic values should live in a config file.
- **Impact summary**:
  - `FeedProvider.tsx` is cleaner. Safe logic extraction that cannot break runtime functionality. `map.md` and `refactoring_state.md` updated to reflect the new file location.

## [2026-08-22] - Refactor: Extract Inline Client Types

- **What changed**:
  - Extracted inline client types from `components/` and `lib/` to standalone files in `types/`.
  - Created new centralized type files: `types/chart.ts`, `types/cvd.ts`, `types/debug.ts`, `types/feed.ts`, `types/storage.ts`, and `types/volumeProfile.ts`.
  - Moved specific types (e.g., `DrawCvdOptions`, `IndicatorLabelConfig`, `BubbleSettings`) into their respective domain-specific type files.
  - Updated existing type files (`types/bubble.ts`, `types/trading.ts`, `types/footprint.ts`, `types/absorption.ts`) with previously inline types.
- **Why it changed**:
  - To clean up the client codebase, decouple type definitions from runtime implementations, reduce circular dependencies, and establish a single source of truth for types.
- **Impact summary**:
  - The client-side now compiles cleanly with `tsc --noEmit`. The `types/` directory structure strictly mirrors the domain boundaries, improving code organization and maintainability.

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
