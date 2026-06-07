# OrderFlow Chart - Change Log

## [2026-06-08] - Feature: Volume Bars Indicator
- **What changed**:
  - Added a default-off `Volume Bars` indicator to the top-left indicator labels with eye toggle and its own focused settings dialog.
  - Added persisted per-timeframe Volume Bars settings for input data, market source, min/max filters, color mode, opacity, height, value text, text size, average line, and average length.
  - Added a visible-range bottom histogram renderer using candle volume for the cheap default path, existing aggregate-trade buffers for Orders/Aggregate Trades/non-active market-source modes, and optional footprint volume fallback when candle volume is unavailable.
  - Expanded aggregate-trade buffering/hydration gates so Volume Bars can reuse existing aggregate events only when enabled and configured to need them.
  - Added Volume Bars debug snapshots with enabled/input/visible-count/max/average fields.
  - Updated `skills/map.md` for the changed responsibilities and new renderer.
- **Why it changed**:
  - The app needed Volume Bars as an independent indicator, not a signal or global setting, while preserving hidden-work rules when disabled.
- **Impact summary**:
  - New panels keep Volume Bars hidden by default.
  - Enabling Volume Bars renders bottom-aligned volume bars for visible candles and supports Volume, Orders, and Aggregate Trades modes where source data exists.
  - Aggregate trade work remains off unless bubbles or Volume Bars settings require it.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-07] - UI: Crypto Selector Settings-Style Modal
- **What changed**:
  - Changed `PairSelector` so the symbol chooser opens as a fixed settings-style modal/window with backdrop, header, close button, backdrop close, and Escape close.
  - Kept the existing panel-scoped symbol, Spot, and Perpetual Futures selection behavior unchanged.
  - Updated `skills/map.md` for the selector responsibility.
- **Why it changed**:
  - The selector needed to match the existing settings modal style instead of behaving like a small dropdown.
- **Impact summary**:
  - The chart header still shows one rounded current-symbol button.
  - Clicking it now opens a modal-style selector rather than an anchored dropdown.
  - Instrument selection still updates only the active chart panel.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-07] - Feature: Crypto Instrument Selector
- **What changed**:
  - Replaced the chart header BTC/ETH toggle with the existing panel-scoped `PairSelector` rendered as one rounded current-symbol button.
  - Expanded `PairSelector` into a local Binance USDT popup with the supported hardcoded symbols and expandable Spot / Perpetual Futures options.
  - Selecting an option now updates only that panel's pair, contract type, and aligned data source mode, then closes the popup; futures displays with a `.P` suffix.
  - Expanded shared allowed symbols to BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, and LTC USDT markets.
  - Updated `skills/map.md` for the toolbar, selector, and market config responsibilities.
- **Why it changed**:
  - Chart panels needed a simple per-panel Binance symbol/instrument selector instead of a fixed BTC/ETH toggle.
- **Impact summary**:
  - Each chart panel can independently switch between supported Binance Spot and Perpetual Futures instruments.
  - Candle/history validation accepts the new supported symbols.
  - No collector, persistence, comparison overlay, or external symbol search behavior was added.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-07] - Fix: Collector Survives Aggregate Bubble MongoDB TLS Failure
- **What changed**:
  - Changed `scripts/collector/btcusdtCollector.mjs` so the dedicated aggregate bubble MongoDB connection is initialized as an optional persistence path after the main footprint/profile MongoDB connection succeeds.
  - Removed fatal startup validation for `BUBBLES_MONGODB_URI` and `BUBBLES_MONGODB_DB_NAME`; missing or failing bubble DB config now logs a warning and keeps the collector running.
  - Added `aggregateBubbleWritesEnabled` runtime status plus `skippedPersistenceDisabled` aggregate-bubble metrics.
  - Skipped aggregate bubble candidate queuing/writes when bubble persistence is disabled, preventing unbounded in-memory queue growth.
  - Updated `skills/map.md` for the collector responsibility.
- **Why it changed**:
  - A TLS failure on the separate aggregate bubble MongoDB connection stopped the entire BTCUSDT collector even though the main footprint/profile MongoDB connection was healthy.
- **Impact summary**:
  - Footprint and fine Volume Profile collection can continue when aggregate bubble persistence is unavailable.
  - Aggregate bubble history persistence remains disabled until the collector is restarted with a healthy bubbles MongoDB connection.
  - Startup logs now distinguish a non-fatal bubble DB problem from a fatal collector failure.
  - `node --check scripts/collector/btcusdtCollector.mjs` and `npx.cmd tsc --noEmit` pass.
  - A short `COLLECTOR_EXIT_AFTER_MS=5000` collector run continued past the bubble MongoDB TLS warning, connected spot/futures streams, and stopped cleanly.

## [2026-06-07] - Fix: MongoDB Restore Indexes And Footprint Range Guard
- **What changed**:
  - Added `scripts/ensureIndexes.ts` to create/repair MongoDB query indexes for candles, footprint cells, fine profile rows, collector metadata, and aggregate bubble restore/TTL indexes.
  - Added the `db:indexes` npm script and `ts-node` dev dependency entry required to run the index maintenance script.
  - Updated MongoDB restore queries with `allowDiskUse(true)` on find-cursor sorts and background index creation options.
  - Expanded the aggregate bubble restore index to include `aggregateTradeId` after `eventTime`, matching the restore sort.
  - Added a 500-candle server-side maximum range guard to the footprint history API.
  - Updated `skills/map.md` for the changed responsibilities and new script.
- **Why it changed**:
  - Large footprint, fine profile, and aggregate bubble restore queries need indexes that match equality filters followed by range/sort fields, plus disk-sort fallback to avoid MongoDB sort memory crashes.
  - The footprint API needed a hard range bound so unbounded restore requests cannot push excessive rows through MongoDB and the API.
- **Impact summary**:
  - Footprint, fine profile, candle, and aggregate bubble restore query patterns now have centralized index definitions.
  - Aggregate bubble restore is covered for both `eventTime` and `aggregateTradeId` sort order.
  - Oversized footprint range requests return a clear 400 response instead of reaching the storage query.
  - `npm.cmd run db:indexes` completed successfully against the configured MongoDB databases and reported all expected indexes as ensured.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-07] - Feature: Internal Debug Panel v1
- **What changed**:
  - Added `lib/debug/debugPanelAdapter.ts` to summarize existing `window.__MARKET_DEBUG__` metrics, persisted chart settings, and non-persisted runtime store state for display/copy use without copying raw market arrays.
  - Added `components/debug/DebugPanel.tsx`, a gated floating debug panel opened with `Ctrl+Shift+D`, polling at a low cadence with Performance, Restore, Runtime, Bubbles, Signals, and Store/Updates tabs.
  - Mounted the panel from `app/page.tsx` and kept it hidden unless development mode or `NEXT_PUBLIC_ENABLE_DEBUG_PANEL=true` enables it.
  - Added trimmed JSON copy output for shareable debug snapshots and marked future performance/store timing metrics as not instrumented.
  - Updated `skills/map.md` for the new debug panel and adapter responsibilities.
- **Why it changed**:
  - Existing market diagnostics were only practical through console calls, and common restore/runtime/bubble/signal checks needed a visual internal panel without duplicating debug logic or changing chart behavior.
- **Impact summary**:
  - Developers can inspect existing stream, cache, restore, runtime, bubble, signal, and store summaries visually.
  - No performance timers, redraw instrumentation, store counters, chart rendering logic, cache logic, or market-data behavior were changed.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-06] - Performance: Zustand Runtime State Separation
- **What changed**:
  - Added `lib/store/chartRuntime.ts` as a non-persisted Zustand store for panel runtime data: candles, trades, connection/loading/restore status, signal maps, aggregate bubble buffers, liquidity zones, footprint redraw triggers, profile/measurement selection, and the shared crosshair payload.
  - Routed `FeedProvider`, `ChartPanel`, `ConnectionStatus`, keyboard shortcuts, drawing/position toolbars, `ChartCanvas`, and `CvdPanel` runtime reads/writes through the runtime store while leaving user settings in `lib/store/chart.ts`.
  - Moved crosshair sync off the persisted chart store and onto runtime-store selector subscriptions so crosshair redraws stay outside React component selectors.
  - Bumped the persisted settings version and stripped legacy runtime/crosshair keys during migration.
  - Updated `skills/map.md` for the new runtime store and revised store/chart/feed responsibilities.
- **Why it changed**:
  - Live feed, restore, signal, liquidity, bubble, and mouse crosshair updates should not trigger persisted store writes or component-level subscriptions tied to saved settings.
- **Impact summary**:
  - Runtime panel updates no longer write through the persisted settings store.
  - Crosshair sync remains direct-to-canvas and is no longer part of saved settings state.
  - Persisted settings remain responsible for user preferences, layout, drawing configuration, and feature toggles.

## [2026-06-06] - Performance: Need-Based Footprint And Iceberg Work
- **What changed**:
  - Added a per-panel footprint-work predicate covering footprint mode, footprint-cell bubbles, CVD, footprint-dependent signals, liquidity vacuum, and explicit browser market writes.
  - Gated stored footprint restore and live footprint trade ingestion behind that predicate while keeping candle updates, aggregate-trade bubbles, profile trade handling, and raw-trade restore behavior intact.
  - Added restore/debug skip fields for footprint restore, footprint ingestion skips, footprint-work reasons, and disabled Iceberg no-op skips.
  - Stopped disabled Iceberg paths from repeatedly writing empty level arrays when there is no stale level state to clear.
  - Updated `skills/map.md` for the revised FeedProvider and store responsibilities.
- **Why it changed**:
  - Candlestick panels without footprint-dependent features should not restore footprint rows or feed live trades into the footprint aggregation engine.
- **Impact summary**:
  - Footprint restore and live footprint aggregation now run only when the specific panel needs footprint data.
  - Dual-panel layouts avoid forcing footprint work in one panel because another panel needs it.
  - Iceberg behavior remains unchanged when enabled, while disabled no-op state writes are avoided.

## [2026-06-06] - Performance: Phase 1 Chart Restore And Hidden Work Skips
- **What changed**:
  - Disabled raw-trade restore by default and gated it behind `NEXT_PUBLIC_ENABLE_RAW_TRADE_RESTORE=true`.
  - Kept browser-side market writes, including raw trade writes, behind `NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES=true`.
  - Skipped stored Volume Profile restore when no default/custom profile is enabled or visible, while preserving lazy restore for profiles when they are needed later.
  - Moved default Volume Profile building in `ChartCanvas` behind `defaultProfileEnabled`.
  - Guarded disabled absorption, exhaustion, iceberg, liquidity vacuum, bubble, heatmap/orderbook sampling, and profile live work so hidden features do not keep doing heavy calculations.
  - Added lightweight restore/debug skip markers for raw-trade and profile restore skips.
  - Updated `skills/map.md` for the revised FeedProvider responsibilities.
- **Why it changed**:
  - Collector-backed footprint/profile data already covers normal chart usage, and the frontend should avoid replaying raw trades or building hidden overlays during restore/redraw.
- **Impact summary**:
  - Normal chart loads skip the largest raw-trade replay freeze risk unless explicitly opted in.
  - Disabled Volume Profile, bubble, heatmap, and signal features avoid unnecessary restore, buffering, sampling, or calculation work.
  - Existing visuals remain unchanged when features are enabled.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-05] - Fix: Profile Settings And Signal Defaults After Indicator Cleanup
- **What changed**:
  - Restored the global Profiles tab Volume Profile controls that were accidentally hidden during indicator cleanup.
  - Removed the global Indicators tab entirely while keeping per-indicator settings dialogs for Bubbles, CVD, Sessions, Heatmap, and Liquidity.
  - Removed Volume Profile from the per-indicator popup system; VOP gear actions now route to the global Profiles tab.
  - Restored signal defaults for Absorption, Exhaustion, Iceberg, and Liquidity Vacuum while keeping indicators and default profile disabled by default for new panels.
  - Added a settings gear to custom profile controls that opens the global Profiles tab through the existing settings window path.
  - Updated `skills/map.md` for the corrected settings, label, canvas, and store responsibilities.
- **Why it changed**:
  - Profile settings are global profile controls, not indicator settings, and signal behavior should not have changed as part of hiding indicators by default.
- **Impact summary**:
  - Profile settings are available again in global settings.
  - New panels still start with default profile and indicators hidden, while signals keep their previous default behavior.
  - Existing persisted user settings remain authoritative during hydration.

## [2026-06-05] - UI: Focused Indicator Settings And Clean Defaults
- **What changed**:
  - Changed new/default panel visibility so indicators and heavy overlays start disabled: Bubbles, CVD, Sessions, Volume Profile, Liquidity Map, Heatmap, Absorption, Exhaustion, Iceberg, and Liquidity Vacuum.
  - Kept persisted panel values authoritative during hydration while updating missing-value migration fallbacks to the cleaner default-off behavior.
  - Changed indicator label gear buttons to open focused per-indicator settings dialogs that reuse the existing settings controls and Zustand actions.
  - Simplified the global Indicators tab to high-level visibility toggles and hid the duplicated detailed Volume Profile controls from the global Profiles tab.
  - Updated `skills/map.md` for the revised settings, indicator label, and store responsibilities.
- **Why it changed**:
  - Indicator configuration was buried inside the global settings window, and new panels opened with too many visual overlays enabled by default.
- **Impact summary**:
  - New chart panels open cleaner and faster with indicators hidden until the user enables them.
  - Existing saved settings that explicitly contain enabled/disabled values continue to load normally.
  - Indicator-specific settings still update the same underlying persisted panel state, but are now opened from each indicator's own gear button.
