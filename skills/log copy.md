# OrderFlow Chart - Change Log
# OrderFlow Chart - Change Log



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

## [2026-06-05] - Feature: Aggregate Bubble Collector Persistence
- **What changed**:
  - Added dedicated Aggregate Trade bubble MongoDB storage using `BUBBLES_MONGODB_URI` and `BUBBLES_MONGODB_DB_NAME`, with a regular `aggregate_bubble_events` collection, unique source/id index, restore index, and TTL from `MARKET_DATA_RETENTION_DAYS`.
  - Extended `scripts/collector/btcusdtCollector.mjs` to persist only qualified spot/futures aggTrade bubble candidates once per real stream, using defaults of 15 BTC, or at least 75 trades with at least 3 BTC.
  - Added `/api/history/aggregate-bubbles` for bounded read-only restore of candidate events.
  - Hydrated restored aggregate bubble candidates into the existing frontend aggregate bubble buffer with live/restored dedupe and time-sorted cap behavior.
  - Extended aggregate bubble debug snapshots and restore diagnostics with restored/live counts, source counts, duplicate skips, restore ranges, and storage thresholds.
  - Updated `skills/map.md` for the new route, storage module, collector, feed, store, debug, and bubble type responsibilities.
- **Why it changed**:
  - Aggregate Trade bubbles were live-only and needed refresh/reload history while keeping all aggregate bubble writes in the background collector instead of the chart app.
- **Impact summary**:
  - The frontend only fetches aggregate bubble history; it does not write aggregate bubble records.
  - Existing Footprint Cell bubbles, footprint aggregation/storage/restore, Volume Profile storage/restore, raw trade support, grouping/clustering, tooltip behavior, and iceberg logic were not changed.
  - Restored aggregate candidates remain subject to existing UI filters for market source, volume/orders sizing, min volume/min orders, side, scale mode, and radius.
  - `node --check scripts/collector/btcusdtCollector.mjs` and `npx.cmd tsc --noEmit` pass.

## [2026-06-05] - Audit: Aggregate Bubble Collector Persistence
- **What changed**:
  - Added `artifacts/aggregate_bubble_persistence_audit.md` documenting the current collector, database, restore, and live Aggregate Trade bubble architecture.
  - Identified the standalone BTCUSDT collector as the correct future write path for aggregate bubble persistence.
  - Recommended candidate-only aggregate bubble storage, initial BTCUSDT thresholds, dedupe keys, indexes, retention, and a phased implementation plan.
  - Updated `skills/map.md` with the new audit artifact responsibility.
- **Why it changed**:
  - Aggregate Trade bubbles are live-only today and need a collector-only persistence design before adding schema, API, or frontend hydration changes.
- **Impact summary**:
  - No application code, storage schema, collector write behavior, restore API, or UI behavior changed.
  - The audit confirms aggregate bubble persistence should not be written by the frontend/chart app.
  - Future implementation should add collector candidate writes, a restore API, and frontend hydration while leaving footprint storage unchanged.

## [2026-06-05] - Feature: Aggregate Bubble Market Source And Min Orders Debug
- **What changed**:
  - Added persisted `aggregateBubbleMarketSource` with `active` default and Aggregate Trades-only UI options for Active Chart, Spot, Futures, and Both.
  - Routed the market-source setting and active panel contract/source context through `ChartPanel`, `ChartCanvas`, and `drawAggregateTradeBubbles`.
  - Added aggregate market-source filtering in the renderer while keeping event prices untouched and preserving Volume vs Orders sizing/filtering behavior.
  - Added aggregate-only live subscriptions for explicit Spot/Futures/Both bubble views when the selected bubble source needs a trade stream that footprint aggregation is not currently using.
  - Extended aggregate bubble debug snapshots with market source, active chart source, total/visible/rendered source counts, market-source filter reasons, and existing trade-count fallback/order sizing diagnostics.
  - Updated `skills/map.md` for the revised state, UI, feed, chart, renderer, debug, and bubble type responsibilities.
- **Why it changed**:
  - Aggregate Trade bubbles needed explicit spot/futures selection and clearer debug output without changing Footprint Cell bubbles or footprint aggregation/storage behavior.
- **Impact summary**:
  - Footprint Cells remains the default bubble source and its rendering path is unchanged.
  - Aggregate Trades Volume mode continues using Min Volume and event volume, while Orders mode uses Min Orders and `tradeCount` with missing/invalid counts treated as `1`.
  - Aggregate bubbles can now render Active Chart, Spot, Futures, or Both source views, with stale non-selected source events filtered out and explained in debug output.
  - No tooltip, persistence/history restore, grouping/clustering, raw trade bubbles, iceberg logic, or footprint storage changes were added.

## [2026-06-04] - Feature: Aggregate Bubble Size By Volume Or Orders
- **What changed**:
  - Added persisted `bubbleSizeBy` with `volume` default and `bubbleMinOrders` with `1` default.
  - Exposed `Size By` controls only for Aggregate Trades bubbles and swapped Min Volume for Min Orders when Orders mode is selected.
  - Routed the new settings through panel state, timeframe settings, persistence normalization, `ChartPanel`, `ChartCanvas`, and the aggregate bubble renderer.
  - Updated aggregate bubble rendering so Volume mode keeps the existing min-volume behavior, while Orders mode filters and scales by aggregate event `tradeCount`.
  - Added aggregate bubble debug fields for size mode, min orders, mode-specific visible/rendered counts, rendered sizing value, trade-count fallback count/policy, and separate below-min-volume vs below-min-orders filter reasons.
  - Updated `skills/map.md` for the revised state, UI, chart, renderer, debug, and bubble type responsibilities.
- **Why it changed**:
  - Aggregate trade bubbles needed a live-only order-count sizing/filter mode without changing footprint-cell bubble behavior or faking order counts for footprint data.
- **Impact summary**:
  - Footprint Cells remains the default source and remains volume-based.
  - Aggregate Trades can now render by either event volume or event trade count while keeping side filters, linear/sqrt/log scaling, and min/max radius controls.
  - Missing or invalid aggregate `tradeCount` is treated as `1` as a conservative lower bound; Min Orders greater than `1` filters those events out, and debug output reports the fallback policy/count.
  - No raw trade bubbles, iceberg logic, grouping, clustering, persistence, or aggregate buffer lifecycle changes were added.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-04] - Fix: Aggregate Trade Bubble Reliability And Debug
- **What changed**:
  - Increased the live aggregate bubble buffer cap from 10,000 to 20,000 events per panel.
  - Stopped timeframe changes from clearing aggregate bubble events; symbol, contract type, and data source changes still clear the buffer to prevent stale cross-market bubbles.
  - Added aggregate bubble render/filter diagnostics to `window.__MARKET_DEBUG__.getSnapshot().aggregateBubbles`.
  - Added renderer debug details for visible count, rendered count, latest event, latest rendered x/y, nearest candle, nearest footprint bucket volume, actual threshold, and filter reasons.
  - Kept aggregate bubbles rendered from direct aggTrade event price/quantity/side, without merging into footprint cells or rewriting price through candle alignment.
  - Updated `skills/map.md` for revised renderer, state, canvas, and debug responsibilities.
- **Why it changed**:
  - Busy BTC aggregate trade streams can churn through a 10,000-event buffer in roughly 1-3 minutes, making older live bubbles disappear even though no time-window pruning was intended.
  - Timeframe changes were clearing the aggregate buffer unnecessarily even though aggregate events are timestamp/price based and still valid for the same symbol/source.
  - Debug output was needed to verify whether a bubble came from an event above threshold, where it was rendered, and how it related to nearby footprint-cell volume.
- **Impact summary**:
  - Aggregate bubbles remain live-only and capped, but should persist longer on busy streams and survive same-symbol timeframe changes.
  - Footprint Cells remains the default source and its bubble rendering behavior was not changed.
  - Aggregate bubbles may validly appear near footprint cells below the min-volume threshold because the aggregate source filters individual event volume, not footprint-cell totals.
  - No raw trade bubbles, order sizing, iceberg logic, persistence, grouping, clustering, or spot/futures visual split was added.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-04] - Feature: Aggregate Trade Bubble Source
- **What changed**:
  - Added a `BubbleEvent` model for live aggregate-trade bubbles with time, price, side, volume, optional trade count, source, symbol, and contract type.
  - Added persisted `bubbleSource` selection with Footprint Cells as the backward-compatible default and a live-only capped aggregate bubble buffer per panel.
  - Captured Binance spot/futures `aggTrade` events directly in `FeedProvider`, including aggressive buy/sell side from buyer-maker logic and trade count from first/last trade IDs when available.
  - Added Aggregate Trades rendering beside the existing Footprint Cells bubble path, reusing min volume, side filter, linear/sqrt/log scale, and min/max radius settings.
  - Changed the Bubbles settings source selector from disabled placeholders to Footprint Cells and Aggregate Trades.
  - Updated `skills/map.md` for the revised feed, state, settings, rendering, feed adapter, and type responsibilities.
- **Why it changed**:
  - Bubbles needed a live-only source that visualizes Binance aggregate execution clusters directly without merging them into footprint cells or changing footprint storage/restore behavior.
- **Impact summary**:
  - Footprint Cells remains the default bubble source and keeps the existing `drawBubbles` footprint-cell behavior.
  - Aggregate Trades is in-memory only, capped at 10,000 events per panel, and is not persisted to storage or restore APIs.
  - Raw trade bubbles, iceberg logic, historical aggregate-bubble persistence, and grouping/clustering were not added.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-04] - UI: Volume Bubbles Scale And Radius Controls
- **What changed**:
  - Added `bubbleScaleMode` with `linear`, `sqrt`, and `log` options, defaulting new/legacy panels to `sqrt`.
  - Routed bubble scale mode through persisted chart state, panel props, `ChartCanvas`, and `drawBubbles`.
  - Added guarded linear/sqrt/log bubble radius scaling while keeping the current footprint-cell volume threshold behavior.
  - Exposed existing bubble min/max radius settings in the Bubbles settings UI with bounded sliders.
  - Added a clear `Bubble Source: Footprint Cells` UI section with disabled future source options for Raw Trades and Aggregate Trades.
  - Added `bubbleThresholdMode` to the `ChartCanvas` redraw dependencies so threshold mode changes redraw bubbles immediately.
  - Updated `skills/map.md` for the revised bubble settings/rendering responsibilities.
- **Why it changed**:
  - The bubble system needed safer visual scaling for high-variance crypto volume and clearer settings without rebuilding the underlying footprint-cell implementation.
- **Impact summary**:
  - Bubble source, grouping, threshold logic, side filtering, footprint cache, storage, and live feed behavior were not changed.
  - Orders-based sizing was not added; future support still requires trade/order counts in footprint cells plus aggregation, storage, restore API, and schema changes.
  - `npx.cmd tsc --noEmit` passes.
  - `npm.cmd run lint` still fails on existing unrelated unused variables in `lib/feeds/feedRegistry.ts`.

## [2026-06-04] - UI: Panel Settings And Fine Profile Restore
- **What changed**:
  - Removed the global chart-settings launcher from the header and turned the sidebar into a compact icon rail with active-panel context.
  - Anchored the settings window near the clicked panel button, moved Heatmap and Liquidity Map controls into the Indicators tab, and added clearer Volume Profile auto/manual row-size handling with scaling hints.
  - Changed fine Volume Profile restore to load the most recent 4 hours first, request history in 2-hour chunks, and lazily backfill custom or scrolled ranges while guarding `/api/history/profile` to a 6-hour maximum window.
  - Kept the chart restore badge visible during `volumeProfile` hydration and tightened profile row rendering plus loaded-range coverage so chunked restore does not loop on already-covered spans.
  - Updated `skills/map.md` for the revised responsibilities.
- **Why it changed**:
  - The settings UI needed to be panel-local and less cluttered, and fine profile restore needed bounded requests plus faster initial hydration.
- **Impact summary**:
  - Market data, signal calculations, and storage semantics were unchanged.
  - Profile renderer visuals, indicator toggles, and restore flows improved without changing the underlying profile math or live feed behavior.

## [2026-06-04] - UI: Position Tool Border And Toolbar Spacing
- **What changed**:
  - Removed the outer red/green stroke around Long/Short Position boxes and kept the 1px white entry separator between risk and reward zones.
  - Added extra selected-drawing toolbar offset for Long/Short Position drawings so the style toolbar no longer overlaps the active position labels.
  - Updated `skills/map.md` for the adjusted renderer and toolbar-position responsibilities.
- **Why it changed**:
  - The position boxes needed a cleaner TradingView-like surface, and the selected drawing toolbar could cover the target/entry info labels.
- **Impact summary**:
  - Position behavior, calculations, drag/resize handles, persistence, and visual-only trade independence were not changed.
  - Market data, feeds, storage, Volume Profile, footprint, heatmap, and signal calculations were not changed.

## [2026-06-04] - Fix: Position Tool Layering And Label Design
- **What changed**:
  - Moved Long/Short Position drawings into a later chart drawing pass so they render above candles, footprint cells, bubbles, order-flow overlays, Volume Profile, and the heatmap strip while remaining below React UI overlays.
  - Added darker candle-overlap shading inside risk/reward zones by intersecting each visible candle high/low range with the position box price ranges.
  - Replaced the black details box with selected/hover-only colored rounded labels for target, stop, and main entry/risk-reward details.
  - Removed always-on position price labels from the generic drawing price-label pass so inactive position drawings stay visually clean.
  - Updated `skills/map.md` for the adjusted renderer responsibilities.
- **Why it changed**:
  - The position drawing needed to read like a TradingView-style drawing object on top of chart content, with clearer price-action overlap styling and cleaner active-only detail labels.
- **Impact summary**:
  - Position creation, risk-first drag behavior, reward creation, drag/resize handles, live calculations, persistence, locking, styling, and deletion remain on the existing implementation.
  - Position drawings remain visual-only and are not connected to live trades, current market price, or open positions.
  - Market data, feeds, storage, order placement, Volume Profile calculations, footprint calculations, heatmap collection, and signal calculations were not changed.
  - `npm.cmd run build` compiles successfully, then fails on existing unrelated lint errors in `lib/feeds/feedRegistry.ts` for unused `streamKey`, `subscriberCount`, and `runtime`.

## [2026-06-04] - Fix: Position Tool Risk-First Preview And Details
- **What changed**:
  - Changed Long/Short Position drag preview to render only the red risk/stop-loss zone while the pointer is down.
  - Changed initial entry/stop assignment so the user-drawn risk box becomes the actual stop zone: long uses the upper edge as entry and lower edge as stop, short uses the lower edge as entry and upper edge as stop.
  - Changed finalized drawings to create a smaller default reward box on the opposite side after release.
  - Hid detailed position metrics unless the drawing is selected or hovered; non-active drawings keep the joined boxes and basic price labels.
  - Updated `skills/map.md` for the adjusted drawing responsibilities.
- **Why it changed**:
  - The first implementation showed the reward zone during drag and kept the detailed info panel always visible, which made the tool feel unlike TradingView's visual position drawings.
- **Impact summary**:
  - Position tools remain visual-only drawings and stay disconnected from live trades, current market price, and open positions.
  - Existing selection, lock, style, delete, persistence, and entry/stop/target dragging behavior remains in the current drawing system.
  - Market data, feeds, storage, order placement, Volume Profile, footprint, heatmap, and signal calculations were not changed.
  - `npm.cmd run build` compiles successfully, then fails on existing unrelated lint errors in `lib/feeds/feedRegistry.ts` for unused `streamKey`, `subscriberCount`, and `runtime`.

## [2026-06-04] - Feature: Long/Short Position Drawing Tools
- **What changed**:
  - Added Long Position and Short Position buttons to each panel header.
  - Added persisted `long-position` and `short-position` drawing variants with entry, stop, and target levels.
  - Added risk-first click-drag creation, preview rendering, selectable whole-drawing movement, width resizing, and draggable entry/stop/target handles.
  - Added red risk zones, green reward zones, entry separator lines, price labels, and live risk/reward, price-move, percent-move, and point-distance metrics.
  - Updated `skills/map.md` for the touched file responsibilities.
- **Why it changed**:
  - The chart needed TradingView-style visual position measurement tools that users can draw anywhere without creating orders or binding to current price/open positions.
- **Impact summary**:
  - Position drawings behave like existing drawings for selection, locking, styling, deletion, and persistence.
  - Long drawings keep stop/risk below entry and target/reward above entry; short drawings keep stop/risk above entry and target/reward below entry.
  - Market data, feeds, storage, order placement, live positions, Volume Profile, footprint, heatmap, and signal calculations were not changed.
  - `npm.cmd run build` compiles successfully, then fails on existing unrelated lint errors in `lib/feeds/feedRegistry.ts` for unused `streamKey`, `subscriberCount`, and `runtime`.


## [2026-06-03] - Fix: Volume Profile Phase 1 Rendering
- **What changed**:
  - Task 1: Added auto profile row sizing in `components/chart/ChartCanvas.tsx` for default and custom Volume Profile builds, with `profileResolutionTicks = 0` as auto mode in `lib/store/chart.ts`.
  - Task 2: Added per-row volume-strength opacity gradients to `components/chart/drawVolumeProfile.ts` and `components/chart/drawSelectionRect.ts`, while keeping VA fills and POC/VA/LVN lines separate.
  - Task 3: Changed default and custom profile row rendering to reuse adjacent row boundaries for continuous fills without hairline gaps.
  - Task 4: Changed fresh Volume Profile scaling default from `sqrt` to `linear` and added LINEAR/SQRT setting tooltips in `components/ui/ChartSettingsDropdown.tsx`.
  - Updated `skills/map.md` for the touched file responsibilities.
- **Why it changed**:
  - Fixed noisy sub-pixel fixed row sizing, uniform weak-row opacity, and floating-point row seams so Volume Profile shape reads more clearly by default.
- **Impact summary**:
  - Fresh panels start in auto row sizing and linear scaling; positive manual row sizes remain supported.
  - Default and custom profiles now share the same bucket sizing, opacity gradient, and continuous row-fill behavior.
  - Profile engine internals, cache keys, fine-row aggregation, feeds, storage, heatmap, drawings, and signal logic were not changed.

## [2026-06-03] - Fix: Horizontal And Vertical Drawing Drag
- **What changed**:
  - Made selected horizontal lines draggable up/down by updating their price value.
  - Made selected vertical lines draggable left/right by updating their candle index and timestamp anchor.
- **Why it changed**:
  - The selected drawing toolbar worked, but horizontal and vertical lines still only selected because their hit zones did not enter the existing drawing drag path.
- **Impact summary**:
  - Locked horizontal and vertical lines remain selectable but cannot move.
  - Vertical lines keep timestamp anchors after dragging, so retained candles and new live candles do not make them drift.
  - Styling toolbar, delete, color, width, ray, box, market data, feeds, storage, footprint, Volume Profile, heatmap, indicators, and collector behavior were not changed.

## [2026-06-03] - UI: Selectable Drawing Styling Toolbar
- **What changed**:
  - Added click selection for existing horizontal lines, vertical lines, right-extending rays, and boxes.
  - Added a floating selected-drawing toolbar with delete, lock/unlock, 1-4 px stroke width, and the required drawing color swatches.
  - Added optional `color`, `strokeWidth`, and `locked` fields to drawn lines and boxes.
  - Updated drawing rendering so selected/hovered drawings show active handles/delete dots while preserving each drawing's configured stroke style.
- **Why it changed**:
  - Existing drawing tools could create and edit some drawing shapes, but they lacked TradingView-style selection and direct styling controls.
- **Impact summary**:
  - Drawing creation still uses the existing line/box drawing logic and timestamp anchor resolution.
  - Locked drawings remain selectable and deletable, but movement/resizing and style controls are disabled until unlocked.
  - Existing saved drawings without style fields render with default color and width, so persisted drawing state remains backward-compatible.
  - Market data, feeds, MongoDB/storage, footprint, Volume Profile, heatmap, indicators, and collector code were not changed.

## [2026-06-03] - Fix: Chunked Volume Profile Restore
- **What changed**:
  - Changed default fine Volume Profile restore to load only the most recent four hours first, split into two-hour `/api/history/profile` chunks.
  - Added lazy fine-profile backfill for scrolled-back chart ranges and custom profile selections, using the same chunked fetch/hydrate path.
  - Made profile-only and custom-profile restore progress visible in the existing chart restore badge.
  - Updated the shared Volume Profile cache so loaded ranges are merged and empty restored chunks prevent duplicate fetch loops.
  - Added a six-hour profile history API request cap and kept MongoDB profile reads on the source/timeframe/base-bucket/time compound index with a projected result set and disk-sort fallback only for code-292 failures.
- **Why it changed**:
  - Refresh restore could request one or more days of `profile_rows_ts` at once after the collector had been running for many hours, causing MongoDB to exceed the in-memory sort limit before the chart became usable.
- **Impact summary**:
  - Recent Volume Profile rows hydrate first and the live feed is not blocked by older profile history.
  - Older/default profile rows load only when the user scrolls back, and custom profiles fetch their selected time range in bounded chunks.
  - Sparse or empty profile ranges no longer trigger repeated restore loops.
  - Collector scripts, footprint restore, candle restore, heatmap/liquidity, and Volume Profile calculation/rendering math were not changed.

## [2026-06-03] - UI: Panel-Scoped Settings Layering
- **What changed**:
  - Removed the chart settings button/dropdown ownership from the global header.
  - Added a settings button to each chart panel header next to the Focus button.
  - Opening settings from a panel now immediately targets that panel and anchors the window near that panel's header button.
  - Kept indicator-label settings jumps working by routing them through the owning panel toolbar.
  - Raised the settings window above chart overlays, made its background solid, and stopped pointer events from bubbling through it.
- **Why it changed**:
  - The global settings launcher could target the wrong panel in split-screen layouts and the settings window could visually compete with chart overlays/toolbars.
- **Impact summary**:
  - Split-screen settings now open against the clicked left/right panel without relying on hover-selected active panel state.
  - Signal tooltips, indicator labels, restore badges, the floating drawing toolbar, and canvas overlays remain below the settings window.
  - Settings content, market data, feeds, storage, footprint, Volume Profile, heatmap calculations, and drawing tool logic were not changed.

## [2026-06-03] - UI: Dismiss History Restore Badge
- **What changed**:
  - Added an icon-only close button to the chart history restore status badge.
  - Auto-dismissed the badge a few seconds after a successful restore completes.
- **Why it changed**:
  - The restore status badge remained visible after restore completed and could cover chart content.
- **Impact summary**:
  - Restore progress remains visible while loading, but the completed status no longer stays on-screen indefinitely.
  - No feed, storage, collector, MongoDB, market calculation, footprint/profile, heatmap, or drawing behavior changed.

## [2026-06-02] - UI: History Restore Progress Status
- **What changed**:
  - Added transient per-panel history restore status to the chart store.
  - Published restore stages from `FeedProvider` for connecting, candles, Volume Profile, raw trades, footprint, completion, and failure.
  - Pushed stored candles to the panel immediately after the stored-candle request returns, before waiting for exchange merge or footprint/profile hydration.
  - Added a compact top-right chart badge showing restore status, live-feed state, candle counts, footprint rows, and profile rows.
- **Why it changed**:
  - History restore could be working but look idle while larger footprint/profile windows hydrated after refresh.
- **Impact summary**:
  - Recent candles become visible earlier during refresh restore.
  - Users can see which restore stage is active and whether the live feed is connected.
  - No collector, MongoDB schema, storage write behavior, market calculations, footprint/profile math, heatmap/liquidity, or drawing tool behavior changed.

## [2026-06-02] - Fix: Time-Anchored Chart Drawings
- **What changed**:
  - Added timestamp anchors for vertical lines, horizontal rays, boxes, and custom Volume Profile selections while keeping legacy index fields as fallback.
  - Resolved timestamp anchors back to retained candle indices only at render, hit-test, drag/resize, and custom profile build time.
  - Changed custom Volume Profile selection builds to use the anchored time range instead of stale candle index slices.
- **Why it changed**:
  - Drawing anchors stored as mutable candle array indices drifted when the rolling 500-candle window dropped the oldest candle.
- **Impact summary**:
  - New drawings stay attached to the original candle time as live candles arrive.
  - Timestamped drawings are hidden when their anchor candle falls outside retained candles instead of rebinding to a different candle.
  - Market data, feeds, MongoDB/storage, footprint, heatmap, indicators, and Volume Profile math were not changed.

## [2026-06-02] - Fix: Per-Panel Indicator Collapse State
- **What changed**:
  - Moved indicator-label collapsed/expanded persistence from one global store field into each chart panel's state.
  - Updated the indicator label collapse button to read/write only the owning panel's collapsed state.
- **Why it changed**:
  - In split/multi-chart layouts, minimizing the indicator list on one chart was also minimizing it on the other chart.
- **Impact summary**:
  - Indicator-list collapse now belongs to the specific chart panel and persists independently per panel.
  - Indicator enable/disable state, heatmap/liquidity behavior, market data, feeds, storage, calculations, and rendering logic were not changed.

## [2026-06-02] - UI: Thin Sidebar And Indicator Organization
- **What changed**:
  - Replaced the expandable sidebar with a fixed thin tools/sidebar strip and removed tick-size input plus signal/count summary clutter from it.
  - Moved the global tick-size input into the settings dropdown under Chart > Aggregation.
  - Persisted the top-left indicator label list collapsed/expanded state in the existing chart settings store.
  - Removed the Liquidity Map quick toggle from the panel toolbar.
  - Added Heatmap and Liquidity Map to the top-left indicator list with eye/settings actions.
  - Moved Heatmap and Liquidity Map settings into the Indicators tab with direct section focus support.
- **Why it changed**:
  - Chart UI controls needed to be less cluttered and grouped around indicator UX instead of sidebar/header shortcuts.
- **Impact summary**:
  - This is UI/state organization only. Market data, feeds, MongoDB/storage, footprint calculations, Volume Profile calculations, heatmap calculations, collector code, and chart rendering logic were not changed.
  - Heatmap and Liquidity Map keep the same existing persisted settings fields and toggles; only their control placement changed.
  - `npm.cmd run build` compiled successfully, then failed on existing unrelated lint errors in `lib/feeds/feedRegistry.ts` for unused `streamKey`, `subscriberCount`, and `runtime`.

## [2026-06-02] - Website: Disable Browser Footprint/Profile Writes
- **What changed**:
  - Added a default-off `NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES` gate around website-side footprint and fine Volume Profile persistence in `components/FeedProvider.tsx`.
  - Stopped browser fine profile row queueing/flushing and stopped browser base footprint write requests unless the flag is explicitly set to `true`.
  - Kept live footprint aggregation, live Volume Profile cache promotion, candle/raw-trade storage, and footprint/profile restore paths active.
- **Why it changed**:
  - The standalone BTCUSDT collector is now responsible for writing canonical footprint and profile rows to MongoDB, so the website should not duplicate those writes.
- **Impact summary**:
  - Refresh restore still reads collector-written footprint/profile history from MongoDB.
  - Live browser rendering still updates from WebSocket trade/candle data.
  - The old website persistence code remains available for emergency/debug re-enable via `NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES=true`.

## [2026-06-02] - Collector: BTCUSDT Footprint And Profile Persistence
- **What changed**:
  - Added `scripts/collector/btcusdtCollector.mjs`, a standalone Node.js collector for BTCUSDT Binance spot/futures aggTrade streams.
  - Added `npm run collector:btc` to start the collector.
  - The collector writes canonical `1m/$5` footprint rows and `1m` fine Volume Profile rows with `baseBucketSize = 1.5` across spot/futures/both source identities.
- **Why it changed**:
  - Footprint and Volume Profile persistence need to move toward an always-on server process before website-side writes are disabled later.
- **Impact summary**:
  - Website persistence was not disabled. UI/rendering, heatmap/liquidity, raw trades, and Mongo schema were not changed.

## [2026-06-02] - Design: Node Collector Persistence
- **What changed**:
  - Added `artifacts/node_collector_design.md` for a standalone Node.js collector that persists canonical footprint and fine Volume Profile rows to MongoDB.
  - Updated `skills/map.md` with the collector persistence audit and design artifacts.
- **Why it changed**:
  - Footprint and Volume Profile persistence need a documented plan before moving writes out of the website.
- **Impact summary**:
  - Documentation only. Website runtime code, storage writes, MongoDB adapters, feeds, heatmap/liquidity, and UI/rendering were not changed.

## [2026-06-01] - UI: Indicator Label Size And Hover Contrast
- **What changed**:
  - Reduced the indicator label text, icon, and collapse-button sizing slightly.
  - Darkened the indicator-row hover background so the hover state reads more clearly.
- **Why it changed**:
  - The indicator overlay needed a lighter resting footprint and a stronger hover contrast cue.
- **Impact summary**:
  - This is visual refinement only. Indicator toggles, settings jumps, rendering, calculations, feeds, storage, footprint, volume profile, heatmap, and chart logic were not changed.

## [2026-06-01] - UI: Compact Indicator Labels
- **What changed**:
  - Added a very small collapse/expand button for the chart indicator label list.
  - Changed indicator rows to a text-only default state with no persistent background or always-visible icons.
  - Revealed the row background plus eye/settings controls only on hover, with a short slide/fade-in transition.
- **Why it changed**:
  - Multiple active indicators were creating a bulky visual block in the top-left of the chart.
- **Impact summary**:
  - This is a UX-only refinement of the existing label overlay. Indicator visibility toggles, settings jumps, rendering behavior, calculations, feeds, storage, footprint, volume profile, heatmap, and chart logic were not changed.

## [2026-06-01] - UI: TradingView-Style Indicator Labels
- **What changed**:
  - Added top-left chart indicator labels for Bubbles, CVD, Sessions, and VOP/Volume Profile.
  - Added eye buttons that toggle the existing per-panel indicator visibility settings.
  - Added settings buttons that open the global settings dropdown for the owning panel and focus the relevant Indicators section.
  - Added Volume Profile controls to the Indicators tab so the VOP settings jump lands with the other indicator settings.
- **Why it changed**:
  - Active visual overlays needed TradingView-style on-chart labels with quick visibility and settings access.
- **Impact summary**:
  - This is UX/control organization only. Indicator calculations, chart rendering logic, market data, feeds, MongoDB/storage, footprint, volume profile engine, heatmap, and signals were not changed.

## [2026-06-01] - UI: Wider Settings Dropdown And Thin Scrollbar
- **What changed**:
  - Increased the global settings dropdown width by `104px`, from `440px` to `544px`.
  - Added a scoped `.custom-scrollbar` style for the dropdown content area with a thin dark thumb and transparent track.
- **Why it changed**:
  - The settings panel needed a bit more horizontal room, and the browser-default thick white scrollbar looked out of place in the existing dark UI.
- **Impact summary**:
  - This is visual polish only. Settings behavior, persistence, chart calculations, rendering logic, feeds, storage, footprint, volume profile, heatmap, and signals were not changed.

## [2026-06-01] - UI: Indicators Settings Tab
- **What changed**:
  - Added a global Settings > Indicators tab.
  - Moved Sessions, CVD, and Bubbles controls into the Indicators tab while keeping their existing store actions and persisted settings.
  - Removed the separate Sessions tab, removed CVD settings from Profiles, removed Bubbles settings from Chart, and removed CVD/Sessions quick toggles from the panel toolbar.
- **Why it changed**:
  - Indicator-related controls needed one clean settings location instead of being split across Chart, Profiles, Sessions, and panel header controls.
- **Impact summary**:
  - Settings organization changed only; calculations, rendering logic, market data, feeds, MongoDB/storage, footprint, volume profile, heatmap, and signals were not changed.
  - Existing CVD, session, and bubble settings continue to persist through the same panel state fields.

## [2026-06-01] - UI: Icon-Only Drawing Toolbar Buttons
- **What changed**:
  - Removed the text letters from the floating drawing toolbar buttons and left icon-only controls with hover titles and aria labels.
- **Why it changed**:
  - The toolbar needed a cleaner, denser visual treatment without label clutter.
- **Impact summary**:
  - Toolbar behavior, drag bounds, drawing selection state, and existing drawing logic remain unchanged.

## [2026-06-01] - UI: Draggable Drawing Favorites Toolbar
- **What changed**:
  - Added a draggable per-panel floating drawing favorites toolbar that can move beyond the canvas into header/sidebar space while staying horizontally bounded to its owning panel side.
  - Moved Profile, Measure, Horizontal Line, Vertical Line, existing Line/Right-Ray, and Box selection onto the floating toolbar using the existing drawing store actions.
  - Persisted each panel's floating toolbar position in the existing Zustand settings persistence.
  - Removed the drawing dropdown from the panel header after moving all drawing controls to the floating toolbar.
  - Updated `skills/map.md` with the new toolbar component and adjusted responsibilities.
- **Why it changed**:
  - Common drawing tools needed direct TradingView-style access without reopening the panel dropdown, while preserving the existing drawing creation/rendering mechanics.
- **Impact summary**:
  - Profile, Measure, horizontal, vertical, line/right-ray, and box drawing selection now happens from the floating toolbar and keeps the same active-state/toggle behavior as the old dropdown path.
  - Dragging the toolbar is handled on its drag handle and stops pointer propagation so it does not start chart drawing.
  - The left toolbar is clamped before the left/right panel divider and the right toolbar is clamped after it, so tools do not cross into another panel.
  - Chart rendering, drawing storage, feeds, MongoDB/storage, footprint, volume profile, heatmap, and signal logic were not changed.

## [2026-06-01] - UI: Fix Focus Toggle Scope And Resizable Settings Window
- **What changed**:
  - Removed the mistaken per-panel header hiding behavior and reverted chart panels to always keep their own toolbar visible.
  - Rewired the panel toolbar expand button to toggle a global `focusMode` that hides the app-level header and sidebar while leaving panel toolbars visible.
  - Added `Alt+Shift+Z` focus-mode keyboard support in the existing shortcuts hook.
  - Replaced the fixed settings dropdown height with a draggable bottom resize handle, persisted dropdown height, min/max clamping, and internal scrolling.
  - Added outside-click closing for the settings dropdown while preserving normal button toggle behavior and allowing drag/resize interactions inside the panel.
- **Why it changed**:
  - The previous change solved the wrong problem by hiding the panel toolbar itself instead of reclaiming space from the global layout chrome, and the fixed 400 px settings height was too restrictive.
- **Impact summary**:
  - Global header/sidebar focus toggle now expands chart workspace without removing the chart panel header.
  - Settings height now defaults to `500px`, clamps to a `350px` minimum and viewport-safe maximum, and stays scrollable when content exceeds the visible area.
  - This remains UI/layout-only; market data, feeds, MongoDB/storage, chart calculations, footprint, volume profile, heatmap, and signal logic were not changed.
  - `next build` now succeeds for the touched UI files and still stops only on the existing unrelated lint errors in `lib/feeds/feedRegistry.ts`.

## [2026-06-01] - UI: Cleaner Chart Panel Header And Settings
- **What changed**:
  - Limited the global chart settings dropdown to `min(400px, calc(100vh - 32px))` and kept the inner content area scrollable.
  - Removed the Absorption, Exhaustion, Iceberg, and Liquidity Vacuum quick buttons from the per-panel header toolbar.
  - Added compact signal toggle controls at the top of the Settings > Signals tab while keeping the existing per-signal settings behavior intact.
  - Added a persisted per-panel `panelHeaderCollapsed` UI state, a header collapse button in the panel toolbar, and a small in-canvas restore button when the header is hidden.
- **Why it changed**:
  - The chart toolbar was using too much vertical and horizontal space, and the settings window was too tall for a compact canvas-focused workflow.
- **Impact summary**:
  - This is a UI/layout-only change: market data, feeds, MongoDB/storage, chart calculations, footprint, volume profile, heatmap, and signal logic were not changed.
  - Panel header collapse is independent per panel and does not touch the global page header/sidebar focus mode.
  - `next build` compiled the updated chart UI successfully, but the build still fails at the existing unrelated lint errors in `lib/feeds/feedRegistry.ts`.

## [2026-06-01] - Fix: Mongo Profile Restore Indexing And Fine Bucket Size
- **What changed**:
  - Added canonical fine profile base-bucket sizing with a minimum stored bucket of `1.5`.
  - Changed live fine profile aggregation, shared profile cache keys, storage writes, and `/api/history/profile` restore requests to use the canonical base bucket instead of raw `tickSize`.
  - Kept MongoDB `profile_rows_ts` restore filters source/timeframe/base-bucket scoped, forced the matching compound index hint for the `time, bucketPriceKey` sort, and added `allowDiskUse` only as a code-292 fallback.
  - Relaxed profile row compatibility so stored `1.5` base rows can aggregate into larger visual row sizes such as `2`, `2.5`, and `5`.
- **Why it changed**:
  - Storing/restoring `0.5` fine profile rows created excessive row counts and could trigger MongoDB's in-memory sort limit during profile restore.
- **Impact summary**:
  - New profile writes/restores on `tickSize = 0.5` use `baseBucketSize = 1.5`; old `0.5` Mongo rows remain untouched and are ignored by new canonical restore requests.
  - Volume Profile rendering still uses the existing visual row-size controls, with restored coarse-enough rows aggregated into the requested visual buckets.
  - Candles, footprints, raw trades, heatmap, feeds, and Mongo candle/footprint storage were not changed.

## [2026-06-01] - Audit: Volume Profile Rendering
- **What changed**:
  - Added `artifacts/volume_profile_rendering_audit.md` covering custom/default profile data flow, row-size aggregation, width normalization, visual clamping, POC/VA/LVN behavior, visual noise causes, and recommended fix order.
  - Updated `skills/map.md` with the new audit artifact.
- **Why it changed**:
  - The current Volume Profile display can look noisy because fine row size, sqrt scaling, min width, and min row height visually inflate weak rows.
- **Impact summary**:
  - Documentation-only audit. Runtime chart code, storage, feeds, cache, MongoDB, and profile engine behavior were not changed.

## [2026-05-31] - Polish: Orderbook Heatmap Labels And Intensity
- **What changed**:
  - Reused one orderbook heatmap column/metrics snapshot per chart redraw so the background cell pass and late label pass derive from the same heatmap data.
  - Kept labels tied to the final clipped heatmap rectangle geometry used for visible cells, with existing merge, size, and overlap gates plus draw-count limits for zoomed-out readability.
  - Changed real heatmap coloring from side color plus opacity only to a side-preserving intensity ramp that moves stronger liquidity toward amber and extreme liquidity toward bright yellow.
  - Tightened percentile normalization with a lower-percentile floor and capped high-percentile upper bound so small levels stay subtle while large levels pop.
- **Why it changed**:
  - Final heatmap polish needed labels to remain visually anchored during pan/zoom, avoid unreadable zoomed-out clutter, and make large asset quantities stand out more like a Bookmap heatmap.
- **Impact summary**:
  - Labels still show asset quantity only, not USD/notional and not order count.
  - Zoomed-out labels merge/skip and prioritize stronger visible areas; zoomed-in readable cells can show individual labels.
  - High liquidity now transitions to amber/yellow while weak liquidity remains dark/subtle.
  - Depth adapters, orderbook sync, storage, candles, footprint, volume profile, and trade logic were not changed.

## [2026-05-31] - Fix: Responsive Heatmap Label Settings And Geometry
- **What changed**:
  - Added normal settings for real orderbook heatmap labels: `Show Liquidity Labels`, label visibility mode (`Off`, `Auto`, `Readable`), label detail (`Total quantity` or `Total + max level`), and minimum label quantity.
  - Changed heatmap labels to be built from final visible heatmap rectangle geometry after clipping and pixel-column grouping, instead of drawing one label per raw/render bucket blindly.
  - Added label candidate merging for overlapping/touching horizontal or vertical visible regions, with summed asset quantity for merged labels and max-level quantity preserved as the largest max-level value in the merged group.
  - Added measured text gates and overlap checks so labels are skipped when the visible grouped region cannot fit the text or would collide with a previously drawn label.
  - Kept the force-label path as a development-only fallback; normal labels no longer require console or localStorage flags.
  - Added label metrics for candidates, merged labels, drawn labels, overlap skips, size skips, width/height skips, threshold skips, missing quantity skips, and setting-off skips.
- **Why it changed**:
  - The previous label pass proved text rendering worked, but it behaved like debug/static text and did not adapt to zoomed-out compressed heatmap geometry.
- **Impact summary**:
  - Zoomed-out labels now merge or skip instead of becoming unreadable, while zoomed-in readable regions can show individual labels.
  - Grouped labels sum asset quantity from the final visible label candidates; labels remain BTC/ETH/base-asset quantity only and are not USD/notional or order counts.
  - The real heatmap bar intensity/width calculation, heatmap engine data model, depth adapters, orderbook sync, MongoDB/storage, candles, footprints, and profiles were not changed.

## [2026-05-31] - Fix: Forced Debug And Late-Pass Heatmap Labels
- **What changed**:
  - Added a force-label debug path for the real orderbook heatmap renderer. It can be enabled with `window.__ORDERFLOW_FORCE_HEATMAP_LABELS__ = true` or `localStorage.setItem('orderflow.forceHeatmapLabels', 'true')`, then a chart redraw.
  - Moved the heatmap label pass later in `ChartCanvas`, after candles/footprints, bubbles, signals, profiles, and measurement overlays, while still clipping text to the chart plot area.
  - Forced labels bypass width, height, normalized-strength, and min-quantity gates, but still require a visible heatmap bar with usable quantity.
  - Production labels keep sensible gates for width, height, min quantity, and normalized strength, and use the same total asset quantity that drives heatmap intensity.
  - Added exact debug fields for `heatmapLabelEnabled`, `heatmapBarsDrawn`, `heatmapLabelCandidates`, `heatmapLabelsDrawn`, `labelsSkippedByWidth`, `labelsSkippedByHeight`, `labelsSkippedByThreshold`, and `labelsSkippedByMissingQuantity`.
- **Why it changed**:
  - The heatmap bars proved quantity data was available, so the remaining issue needed a forced text path to separate label gating from draw order, clipping, and coordinate bugs.
- **Impact summary**:
  - Heatmap labels are drawn only by the real time x price heatmap grid renderer, not the right-side liquidity summary.
  - Labels remain asset quantity only, including BTC quantity for BTCUSDT, and are not USD/notional or order counts.
  - Validated in headless Chrome on `http://localhost:3000` with force-label debug enabled: 16 real heatmap bars were drawn and 16 asset-quantity labels were drawn visibly on those bars.
  - Depth adapters, orderbook sync, MongoDB/storage, candle logic, footprint logic, profile logic, heatmap engine data shape, and heatmap bar intensity calculation were not changed.

## [2026-05-31] - Fix: Real Heatmap Asset Quantity Label Overlay
- **What changed**:
  - Split real orderbook heatmap rendering so cells still draw in the background pass while asset-quantity labels draw in a later text-only pass after candles/footprints.
  - Kept labels gated to strong/readable cells, lowered the normalized label strength gate slightly, and continued falling back to total-only labels when total + max-level text is too wide or max-level data is unavailable.
  - Added label debug metrics for labels enabled, label candidates, labels drawn, size skips, threshold skips, and missing-quantity skips.
- **Why it changed**:
  - Labels were being drawn inside the heatmap background pass, then candle/footprint rendering could cover the label text even though the heatmap cells themselves were visible.
- **Impact summary**:
  - Labels now render on the real time x price orderbook heatmap grid and show asset quantity only, such as BTC quantity on BTCUSDT and ETH quantity on ETHUSDT.
  - Heatmap cells remain behind chart candles/footprints; the later label pass is still restricted to strong readable cells to avoid clutter.
  - Depth adapters, orderbook sync, MongoDB/storage, candle logic, footprint logic, volume profile logic, and the legacy right-side liquidity summary were not changed.

## [2026-05-31] - Fix: Orderbook Heatmap Label Visibility
- **What changed**:
  - Relaxed heatmap label readability gates to use the clipped visible cell size, lower the required visible strength, and allow total-only labels on narrower cells.
  - Centered labels inside the actually visible heatmap rectangle and added a small dark text stroke so labels remain legible over colored liquidity cells.
  - Changed the default minimum heatmap label quantity to `0`, and migrated the previous saved default of `10` down to `0`, leaving clutter control to the strength/size gates unless the user raises the threshold.
- **Why it changed**:
  - Labels were enabled but not appearing on the rendered heatmap because visible cells could be wide enough to draw liquidity bands while still failing the prior 52px width, 14px height, 0.82 normalized-strength, and default quantity-10 label gates.
- **Impact summary**:
  - Strong readable cells should now show raw asset-quantity labels sooner, including BTC quantity for BTCUSDT and ETH quantity for ETHUSDT.
  - Total + max-level mode still falls back to total-only on narrow cells to avoid unreadable `total / maxLevel` text.
  - Heatmap collection, depth adapters, orderbook sync, storage, candles, footprints, profiles, and color rendering were not changed.

## [2026-05-31] - Feature: Orderbook Heatmap Asset Quantity Labels
- **What changed**:
  - Added real orderbook heatmap label settings for label enablement, total-only vs total-plus-max-level mode, and a minimum label quantity threshold.
  - Added per-bucket `maxLevelQty` tracking in the heatmap engine so labels can show total bucket asset quantity and the largest single aggregated price-level quantity inside that bucket.
  - Updated the heatmap renderer to draw compact asset-quantity labels only on strong, readable cells, and to report labels drawn plus threshold/visibility skips.
  - Added heatmap coverage debug metrics for visible price range, collection price range, max distance, collected buckets, levels skipped by distance, levels skipped by side, and levels scanned.
- **Why it changed**:
  - Labels needed to show raw orderbook quantity units, not notional value or order counts, and the heatmap needed clearer diagnostics for narrow vertical coverage.
- **Impact summary**:
  - BTCUSDT labels represent BTC quantity, ETHUSDT labels represent ETH quantity, and no USD conversion or individual order-count claim is made.
  - Total + max-level mode renders as `total / maxLevel`, where max-level is the largest aggregated price level inside the heatmap bucket.
  - Vertical heatmap coverage remains controlled by max-distance settings, visible chart price range, bucket size, intensity threshold, and actual depth-source liquidity; depth adapters, sync, storage, candles, footprints, profiles, and color rendering behavior were not changed.

## [2026-05-31] - Feature: Real Orderbook Heatmap Settings
- **What changed**:
  - Added panel-scoped real orderbook heatmap controls in the global settings dropdown for enable/disable, opacity, price bucket size, lookback window, max near-price distance, intensity mode, quantity labels, and bid/ask/both colors.
  - Added persisted store fields and setters for the new heatmap visual/window settings, with migration defaults for existing saved panels.
  - Routed heatmap bucket size, lookback, and max distance into the heatmap engine so those changes reset the rolling heatmap history safely and keep columns capped.
  - Routed intensity mode and side colors into the canvas renderer while keeping the right-side Liquidity Summary controls separate.
- **Why it changed**:
  - The real time x price heatmap was rendering, but key visual and collection parameters were still hardcoded or shared with the separate liquidity overlay.
- **Impact summary**:
  - Users can tune real heatmap visibility, density, history length, near-price collection range, intensity scaling, labels, and colors from Settings > Chart.
  - Bucket size, lookback, max distance, symbol, contract, depth source, and trade source changes rebuild the session heatmap data; opacity, labels, intensity, and colors redraw immediately without resetting collected columns.
  - MongoDB/storage, candles, trades, footprint/profile logic, depth adapters, feed registry, volume profile rendering, and orderbook sync logic were not changed.

## [2026-05-31] - Reliability: Orderbook Depth Synchronization
- **What changed**:
  - Changed depth initialization to subscribe first, buffer incoming depth updates, fetch the REST snapshot, and only mark each local book ready after a valid snapshot-to-stream bridge.
  - Added sequence continuity checks for Binance spot/futures depth, including Binance futures `pu` validation when present, plus stale/gap state and safe resync on broken continuity.
  - Preserved Bybit update IDs and sequence values, uses Bybit WebSocket snapshots as reset snapshots, and applies monotonic Bybit deltas while exposing its weaker gap-detection limits through debug state.
  - Changed Combined depth aggregation to merge only ready per-exchange books; stale or resyncing sources are excluded from the aggregate orderbook and heatmap source.
  - Added orderbook sync metrics to `window.__MARKET_DEBUG__.getSnapshot()` for ready/stale status, gaps, resyncs, buffered updates, active depth sources, and combined ready sources.
- **Why it changed**:
  - Fetching snapshots before opening the depth stream could miss diff updates, and continuing after a sequence gap could show stale or incorrect liquidity in the heatmap.
- **Impact summary**:
  - Binance spot and futures orderbooks now require a valid initial bridge and resync instead of silently applying broken streams.
  - Combined mode can show partial-ready liquidity from healthy sources without mixing stale books.
  - Candles, trades, footprint/profile calculations, MongoDB/storage, settings layout, and heatmap rendering style were left unchanged.

## [2026-05-31] - Refinement: Orderbook Heatmap Readability
- **What changed**:
  - Updated the real orderbook heatmap renderer to compress sub-pixel one-second samples into readable pixel-width time groups.
  - Aggregated grouped columns by peak bid/ask liquidity per price bucket so stable levels render as continuous horizontal zones instead of barcode-like vertical stripes.
  - Changed visible-cell normalization to a percentile/log-scaled basis and faded low-liquidity noise while preserving stronger levels.
  - Added grouped-column render metrics alongside existing visible-column, cell, duration, and skip counters.
- **Why it changed**:
  - The first renderer mapped every sampled column directly to the current zoom scale, which made one-second samples appear as dense 1 px stripes when the chart was zoomed out.
- **Impact summary**:
  - Heatmap time mapping still uses the existing chart time/index scale and price-to-Y scale, but compressed groups make live liquidity easier to read over time.
  - Candles and footprints remain drawn above the heatmap, and the legacy right-side Liquidity Summary remains separate.
  - No heatmap engine sampling, depth adapters, MongoDB/storage, candle, footprint, or profile calculation behavior changed.

## [2026-05-31] - Feature: Real Orderbook Heatmap Rendering
- **What changed**:
  - Added a clipped canvas renderer for the `OrderbookHeatmapEngine` rolling columns so snapshot time maps to chart X and bucket price maps to chart Y.
  - Drew bid liquidity with teal/green tones, ask liquidity with red/orange tones, and mixed buckets with amber tones using log-scaled opacity.
  - Rendered the real heatmap behind candles/footprint while leaving the legacy right-side Liquidity Summary strip separate.
  - Added persisted per-panel controls for real orderbook heatmap enablement, opacity, and optional quantity labels.
  - Added render metrics for cells drawn, visible columns, draw duration, offscreen skips, tiny-cell skips, and max visible quantity.
- **Why it changed**:
  - The heatmap engine already collected time x price orderbook snapshots, but the chart still only rendered the old summary strip.
- **Impact summary**:
  - Real session-memory heatmap cells now appear across the chart from live orderbook samples and stay aligned during pan/zoom through the existing time/index and price scaling logic.
  - The old Liquidity Summary remains available as a separate right-side strip and is not used as the real heatmap.
  - Heatmap data still resets through the existing engine lifecycle on symbol, contract, depth source, trade source mode, bucket size, or range changes, with no storage, MongoDB, depth adapter, candle, footprint, or profile calculation changes.

## [2026-05-31] - Feature: Orderbook Heatmap Engine
- **What changed**:
  - Added `OrderbookHeatmapEngine`, a rolling time x price data model that stores sampled columns of bucketed bid, ask, total quantity, side, notional, and timestamp data.
  - Added fixed-cadence 1000 ms heatmap sampling in the panel feed lifecycle using the active aggregate orderbook from Binance, Bybit, or Combined depth.
  - Capped the rolling window at 900 columns, roughly 15 minutes at the default cadence, and limited sampled buckets to the configured near-price liquidity range.
  - Exposed heatmap sampling metrics through `window.__MARKET_DEBUG__.getSnapshot()` including column count, bucket count, sample interval, source key, near-price range, and memory estimate.
  - Exposed the heatmap engine through `ChartEngineContext` for the future renderer step.
- **Why it changed**:
  - The existing liquidity summary was not a real time x price heatmap. The app needed a durable engine-level model before replacing any renderer.
- **Impact summary**:
  - Heatmap columns now collect on a fixed cadence and reset on symbol, contract, depth source, trade source mode, bucket size, or range changes.
  - Existing liquidity zones, right-side summary/ladder, candles, trades, footprints, profiles, MongoDB/storage, and chart visuals were left unchanged.
  - The next step is rendering these heatmap columns across the chart canvas.

## [2026-05-30] - Feature: Combined Depth Aggregation
- **What changed**:
  - Added a `Combined` per-panel depth source option alongside Binance and Bybit.
  - Kept the shared feed registry limited to concrete exchange depth streams while `FeedProvider` expands Combined into separate Binance and Bybit snapshot/stream subscriptions.
  - Maintained one local orderbook per exchange, then merged ready exchange bid/ask levels by exact price before passing them into the existing bucketed liquidity-zone aggregation.
  - Reset per-exchange books, the aggregate book, and visible liquidity zones when switching depth source, contract, pair, or unmounting the panel.
- **Why it changed**:
  - Liquidity visualization needed an optional multi-exchange orderbook view without changing candles, trades, footprints, profiles, storage, MongoDB, or the heatmap engine.
- **Impact summary**:
  - Binance mode still uses only Binance depth, Bybit mode still uses only Bybit depth, and Combined mode sums available Binance and Bybit levels before bucket filtering.
  - Combined can show larger or more populated liquidity buckets because sizes at matching price levels are added across exchanges.
  - Exchange precision and available depth can differ, so merged bucket strength is useful for visualization but is not a consolidated tradable orderbook.

## [2026-05-30] - Feature: Bybit Depth Source
- **What changed**:
  - Added Bybit spot and USDT linear futures depth adapters using public v5 REST orderbook snapshots and public v5 WebSocket orderbook streams.
  - Added a persisted per-panel depth source setting with Binance and Bybit options in Settings > Chart > Liquidity Map.
  - Routed shared orderbook snapshot dedupe and depth stream keys by depth source, contract type, and symbol so exchange changes do not reuse stale subscriptions.
  - Taught the orderbook manager to reset from WebSocket snapshot messages so Bybit reconnect/service snapshots do not leave stale levels behind.
  - Split the panel orderbook lifecycle from the broader candle/trade feed effect so changing depth source cleans up only the old depth subscription and clears old liquidity zones.
- **Why it changed**:
  - Liquidity depth was limited to Binance. The chart needed a second exchange orderbook source while keeping contract type separate from exchange selection.
- **Impact summary**:
  - Binance depth remains the default and continues to route spot/futures by contract type.
  - Bybit depth can be selected per panel and feeds the existing orderbook manager and liquidity overlay without combining exchanges or changing heatmap, candle, footprint, profile, storage, or MongoDB logic.
  - Unsupported Bybit symbol/category combinations fail closed with an empty liquidity overlay instead of mixing in Binance depth.

## [2026-05-30] - Feature: Contract-Routed Depth Adapters
- **What changed**:
  - Added a dedicated depth adapter abstraction with Binance spot and Binance futures REST snapshot and depth WebSocket implementations.
  - Routed shared orderbook snapshots and depth streams through contract-scoped depth keys in the feed registry.
  - Updated panel feed orderbook initialization so spot charts use spot depth and futures charts use futures depth.
  - Kept candle, aggTrade, footprint, profile, storage, and heatmap-engine behavior unchanged.
- **Why it changed**:
  - The liquidity overlay previously used Binance spot depth even when the selected chart contract was futures, which could show misleading orderbook liquidity.
- **Impact summary**:
  - Existing liquidity zones now consume depth from the selected contract type. Spot panels stay on Binance spot depth, while futures panels use Binance futures depth without adding new exchanges or rebuilding the heatmap engine.

## [2026-05-30] - Cleanup: Liquidity Overlay Near-Price Filtering
- **What changed**:
  - Changed current liquidity zone aggregation to include near-price orderbook levels, cap the range to a small near-price percent, rank by size with a near-price preference, and limit displayed zones per side.
  - Deemphasized the current liquidity renderer from full-width bands into faint fills plus right-edge markers.
  - Renamed the fake heatmap UI to Liquidity Summary and disabled it by default for new panel settings.
  - Updated `skills/map.md` with the adjusted liquidity renderer and summary-strip responsibilities.
- **Why it changed**:
  - The previous liquidity overlay excluded the closest 2 percent around mid price and selected distant zones that were not useful for normal near-price chart context.
- **Impact summary**:
  - This is a small cleanup of the existing spot-only liquidity overlay. It does not add the real time x price heatmap engine and does not change futures orderbook support, storage, candles, footprints, or profiles.

## [2026-05-30] - Audit: Liquidity Heatmap Implementation
- **What changed**:
  - Added `artifacts/liquidity_heatmap_audit.md` documenting the current spot-only orderbook source, liquidity zone aggregation, sparse history snapshots, right-side heatmap strip rendering, root causes, and ranked rebuild plan.
  - Updated `skills/map.md` with the new audit artifact.
- **Why it changed**:
  - The liquidity/heatmap overlay was showing distant horizontal zones and detached right-side heatmap accents instead of behaving like a time x price orderbook heatmap.
- **Impact summary**:
  - Documentation-only audit. Chart rendering, storage, feeds, settings, and liquidity code were not changed.

## [2026-05-30] - Feature: VWAP Chart Overlay
- **What changed**:
  - Added persisted per-panel VWAP settings for enable/disable, line color, line width, and reset mode.
  - Added VWAP controls to the Settings > Chart tab.
  - Added a canvas VWAP renderer that calculates from active panel candles using typical price and volume, with continuous, daily, and session reset modes.
  - Routed VWAP settings through `ChartPanel` into `ChartCanvas` so the overlay redraws with live candle updates.
  - Updated `skills/map.md` with the VWAP store, settings, render, and drawer responsibilities.
- **Why it changed**:
  - The chart needed a basic VWAP line overlay controlled from the existing global/settings dropdown without expanding the market-data or indicator architecture.
- **Impact summary**:
  - VWAP appears when enabled and is skipped when disabled.
  - Live candle updates trigger the existing chart redraw path, so the VWAP line updates with the active panel/timeframe.
  - Footprint, Volume Profile, feeds, storage, MongoDB, and cache behavior were not changed.

## [2026-05-30] - UI: Signals Settings And Persistent Tools
- **What changed**:
  - Removed the Absorption, Exhaustion, Iceberg, and Liquidity Vacuum quick toggles from the per-panel toolbar.
  - Kept those signal controls in the existing Settings > Signals tab, using the same store actions and panel state.
  - Stopped the chart canvas from automatically clearing Horizontal Line, Vertical Line, Right Ray, Box, or Custom Profile tools after placement.
  - Updated `skills/map.md` with the adjusted toolbar, settings, and drawing-interaction responsibilities.
- **Why it changed**:
  - The panel header needed less signal-control clutter, and drawing tools should remain active across redraws, settings changes, timeframe changes, and normal panel updates until manually changed.
- **Impact summary**:
  - Signal behavior is unchanged because the same settings toggles still drive the same store state.
  - Drawing overlays still use the existing creation and render logic, but selected drawing tools now stay selected after drawing.
  - Market data, chart calculations, storage, feeds, cache behavior, and render math were not changed.

## [2026-05-30] - Fix: Footprint Persistence Restore Gaps
- **What changed**:
  - Moved canonical 1m/$5 footprint row persistence out of the selected chart candle-close path.
  - Base footprint rows are now queued only after the selected aggTrade source stream(s) advance past a closed 1m slice, so MongoDB receives the finalized live footprint slice instead of an early kline-close snapshot.
  - Added focused `[FOOTPRINT_RESTORE_DEBUG]` diagnostics for client write eligibility/skips, MongoDB write confirmation, history API restore coverage, hydration acceptance/rejection, renderer visible coverage, and shared cache cleanup removals.
  - Left candle storage, chart visuals, passive redraw throttling, footprint display aggregation, and MongoDB collection schema unchanged.
- **Why it changed**:
  - The regression was at the write stage: live aggTrade rows could arrive after the selected candle close event had already claimed/stored that 1m footprint slice, leaving MongoDB with empty or partial `footprint_cells_ts` rows while the in-memory chart later looked correct until refresh.
- **Impact summary**:
  - Refresh and fresh-tab restore should now fetch and hydrate the same closed 1m footprint cells that were visible live.
  - Restore queries and renderer cache usage are instrumented so any remaining gap can be classified as write, restore, hydration, cache cleanup, or render coverage.
  - Recent rendering/performance optimization logic was not changed except for adding renderer coverage diagnostics.

## [2026-05-29] - Performance: Footprint Passive Redraw Throttle
- **What changed**:
  - Made the main chart passive redraw throttle depend on chart mode.
  - Kept candle/default passive redraws at the existing 125 ms interval.
  - Slowed footprint-mode passive redraws to a 300 ms interval, targeting roughly 2-4 passive redraws per second during live flow.
  - Continued reporting `chartMode`, `passiveRedrawIntervalMs`, `passiveRedrawsPerSecond`, `passiveRedrawThrottledCount`, and `footprintRepaintCount` through the existing render metrics path.
- **Why it changed**:
  - Footprint mode repaints heavier visible footprint cells and bubbles, and recent metrics showed live passive redraws around 7.5/sec without a memory or subscriber leak.
- **Impact summary**:
  - Only main chart passive/live-data redraw scheduling changed.
  - Interaction redraws still use the immediate rAF path for pan, zoom, mousemove/crosshair, wheel, and resize behavior.
  - Footprint calculations, footprint cache, feed registry, MongoDB/storage, raw trades, fine profile persistence, and chart visuals were not changed.

## [2026-05-29] - Feature: Focus Layout Mode
- **What changed**:
  - Added a header Focus button that toggles a layout-only focus mode.
  - Focus mode hides the top header and sidebar, allowing the chart workspace to expand into the freed screen space.
  - Added a small floating `Exit Focus` button while focus mode is active.
  - Added `Alt+Shift+Z` as a focus mode toggle shortcut.
  - Extended the keyboard shortcut typing guard to skip inputs, textareas, selects, combobox/listbox targets, and editable fields.
  - Updated `skills/map.md` with the adjusted layout and shortcut responsibilities.
- **Why it changed**:
  - The chart needs a quick temporary fullscreen-style workspace without altering the existing sidebar collapse state or chart/data behavior.
- **Impact summary**:
  - This is a UI/layout-only change in the page scaffold, header, and keyboard shortcut hook.
  - Existing sidebar expanded/icon-collapsed state is preserved because focus mode conditionally hides the sidebar without changing the stored sidebar collapse setting.
  - Chart rendering, data feeds, cache, storage, settings behavior, and sidebar collapse behavior were not changed.

## [2026-06-02] - Website: Disable Browser Footprint/Profile Writes
- **What changed**:
  - Added a default-off `NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES` gate around website-side footprint and fine Volume Profile persistence in `components/FeedProvider.tsx`.
  - Stopped browser fine profile row queueing/flushing and stopped browser base footprint write requests unless the flag is explicitly set to `true`.
  - Kept live footprint aggregation, live Volume Profile cache promotion, candle/raw-trade storage, and footprint/profile restore paths active.
- **Why it changed**:
  - The standalone BTCUSDT collector is now responsible for writing canonical footprint and profile rows to MongoDB, so the website should not duplicate those writes.
- **Impact summary**:
  - Refresh restore still reads collector-written footprint/profile history from MongoDB.
  - Live browser rendering still updates from WebSocket trade/candle data.
  - The old website persistence code remains available for emergency/debug re-enable via `NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES=true`.

## [2026-06-02] - Collector: BTCUSDT Footprint And Profile Persistence
- **What changed**:
  - Added `scripts/collector/btcusdtCollector.mjs`, a standalone Node.js collector for BTCUSDT Binance spot/futures aggTrade streams.
  - Added `npm run collector:btc` to start the collector.
  - The collector writes canonical `1m/$5` footprint rows and `1m` fine Volume Profile rows with `baseBucketSize = 1.5` across spot/futures/both source identities.
- **Why it changed**:
  - Footprint and Volume Profile persistence need to move toward an always-on server process before website-side writes are disabled later.
- **Impact summary**:
  - Website persistence was not disabled. UI/rendering, heatmap/liquidity, raw trades, and Mongo schema were not changed.

## [2026-06-02] - Design: Node Collector Persistence
- **What changed**:
  - Added `artifacts/node_collector_design.md` for a standalone Node.js collector that persists canonical footprint and fine Volume Profile rows to MongoDB.
  - Updated `skills/map.md` with the collector persistence audit and design artifacts.
- **Why it changed**:
  - Footprint and Volume Profile persistence need a documented plan before moving writes out of the website.
- **Impact summary**:
  - Documentation only. Website runtime code, storage writes, MongoDB adapters, feeds, heatmap/liquidity, and UI/rendering were not changed.

## [2026-06-01] - UI: Indicator Label Size And Hover Contrast
- **What changed**:
  - Reduced the indicator label text, icon, and collapse-button sizing slightly.
  - Darkened the indicator-row hover background so the hover state reads more clearly.
- **Why it changed**:
  - The indicator overlay needed a lighter resting footprint and a stronger hover contrast cue.
- **Impact summary**:
  - This is visual refinement only. Indicator toggles, settings jumps, rendering, calculations, feeds, storage, footprint, volume profile, heatmap, and chart logic were not changed.

## [2026-06-01] - UI: Compact Indicator Labels
- **What changed**:
  - Added a very small collapse/expand button for the chart indicator label list.
  - Changed indicator rows to a text-only default state with no persistent background or always-visible icons.
  - Revealed the row background plus eye/settings controls only on hover, with a short slide/fade-in transition.
- **Why it changed**:
  - Multiple active indicators were creating a bulky visual block in the top-left of the chart.
- **Impact summary**:
  - This is a UX-only refinement of the existing label overlay. Indicator visibility toggles, settings jumps, rendering behavior, calculations, feeds, storage, footprint, volume profile, heatmap, and chart logic were not changed.

## [2026-06-01] - UI: TradingView-Style Indicator Labels
- **What changed**:
  - Added top-left chart indicator labels for Bubbles, CVD, Sessions, and VOP/Volume Profile.
  - Added eye buttons that toggle the existing per-panel indicator visibility settings.
  - Added settings buttons that open the global settings dropdown for the owning panel and focus the relevant Indicators section.
  - Added Volume Profile controls to the Indicators tab so the VOP settings jump lands with the other indicator settings.
- **Why it changed**:
  - Active visual overlays needed TradingView-style on-chart labels with quick visibility and settings access.
- **Impact summary**:
  - This is UX/control organization only. Indicator calculations, chart rendering logic, market data, feeds, MongoDB/storage, footprint, volume profile engine, heatmap, and signals were not changed.

## [2026-06-01] - UI: Wider Settings Dropdown And Thin Scrollbar
- **What changed**:
  - Increased the global settings dropdown width by `104px`, from `440px` to `544px`.
  - Added a scoped `.custom-scrollbar` style for the dropdown content area with a thin dark thumb and transparent track.
- **Why it changed**:
  - The settings panel needed a bit more horizontal room, and the browser-default thick white scrollbar looked out of place in the existing dark UI.
- **Impact summary**:
  - This is visual polish only. Settings behavior, persistence, chart calculations, rendering logic, feeds, storage, footprint, volume profile, heatmap, and signals were not changed.

## [2026-06-01] - UI: Indicators Settings Tab
- **What changed**:
  - Added a global Settings > Indicators tab.
  - Moved Sessions, CVD, and Bubbles controls into the Indicators tab while keeping their existing store actions and persisted settings.
  - Removed the separate Sessions tab, removed CVD settings from Profiles, removed Bubbles settings from Chart, and removed CVD/Sessions quick toggles from the panel toolbar.
- **Why it changed**:
  - Indicator-related controls needed one clean settings location instead of being split across Chart, Profiles, Sessions, and panel header controls.
- **Impact summary**:
  - Settings organization changed only; calculations, rendering logic, market data, feeds, MongoDB/storage, footprint, volume profile, heatmap, and signals were not changed.
  - Existing CVD, session, and bubble settings continue to persist through the same panel state fields.

## [2026-06-01] - UI: Icon-Only Drawing Toolbar Buttons
- **What changed**:
  - Removed the text letters from the floating drawing toolbar buttons and left icon-only controls with hover titles and aria labels.
- **Why it changed**:
  - The toolbar needed a cleaner, denser visual treatment without label clutter.
- **Impact summary**:
  - Toolbar behavior, drag bounds, drawing selection state, and existing drawing logic remain unchanged.

## [2026-06-01] - UI: Draggable Drawing Favorites Toolbar
- **What changed**:
  - Added a draggable per-panel floating drawing favorites toolbar that can move beyond the canvas into header/sidebar space while staying horizontally bounded to its owning panel side.
  - Moved Profile, Measure, Horizontal Line, Vertical Line, existing Line/Right-Ray, and Box selection onto the floating toolbar using the existing drawing store actions.
  - Persisted each panel's floating toolbar position in the existing Zustand settings persistence.
  - Removed the drawing dropdown from the panel header after moving all drawing controls to the floating toolbar.
  - Updated `skills/map.md` with the new toolbar component and adjusted responsibilities.
- **Why it changed**:
  - Common drawing tools needed direct TradingView-style access without reopening the panel dropdown, while preserving the existing drawing creation/rendering mechanics.
- **Impact summary**:
  - Profile, Measure, horizontal, vertical, line/right-ray, and box drawing selection now happens from the floating toolbar and keeps the same active-state/toggle behavior as the old dropdown path.
  - Dragging the toolbar is handled on its drag handle and stops pointer propagation so it does not start chart drawing.
  - The left toolbar is clamped before the left/right panel divider and the right toolbar is clamped after it, so tools do not cross into another panel.
  - Chart rendering, drawing storage, feeds, MongoDB/storage, footprint, volume profile, heatmap, and signal logic were not changed.

## [2026-06-01] - UI: Fix Focus Toggle Scope And Resizable Settings Window
- **What changed**:
  - Removed the mistaken per-panel header hiding behavior and reverted chart panels to always keep their own toolbar visible.
  - Rewired the panel toolbar expand button to toggle a global `focusMode` that hides the app-level header and sidebar while leaving panel toolbars visible.
  - Added `Alt+Shift+Z` focus-mode keyboard support in the existing shortcuts hook.
  - Replaced the fixed settings dropdown height with a draggable bottom resize handle, persisted dropdown height, min/max clamping, and internal scrolling.
  - Added outside-click closing for the settings dropdown while preserving normal button toggle behavior and allowing drag/resize interactions inside the panel.
- **Why it changed**:
  - The previous change solved the wrong problem by hiding the panel toolbar itself instead of reclaiming space from the global layout chrome, and the fixed 400 px settings height was too restrictive.
- **Impact summary**:
  - Global header/sidebar focus toggle now expands chart workspace without removing the chart panel header.
  - Settings height now defaults to `500px`, clamps to a `350px` minimum and viewport-safe maximum, and stays scrollable when content exceeds the visible area.
  - This remains UI/layout-only; market data, feeds, MongoDB/storage, chart calculations, footprint, volume profile, heatmap, and signal logic were not changed.
  - `next build` now succeeds for the touched UI files and still stops only on the existing unrelated lint errors in `lib/feeds/feedRegistry.ts`.

## [2026-06-01] - UI: Cleaner Chart Panel Header And Settings
- **What changed**:
  - Limited the global chart settings dropdown to `min(400px, calc(100vh - 32px))` and kept the inner content area scrollable.
  - Removed the Absorption, Exhaustion, Iceberg, and Liquidity Vacuum quick buttons from the per-panel header toolbar.
  - Added compact signal toggle controls at the top of the Settings > Signals tab while keeping the existing per-signal settings behavior intact.
  - Added a persisted per-panel `panelHeaderCollapsed` UI state, a header collapse button in the panel toolbar, and a small in-canvas restore button when the header is hidden.
- **Why it changed**:
  - The chart toolbar was using too much vertical and horizontal space, and the settings window was too tall for a compact canvas-focused workflow.
- **Impact summary**:
  - This is a UI/layout-only change: market data, feeds, MongoDB/storage, chart calculations, footprint, volume profile, heatmap, and signal logic were not changed.
  - Panel header collapse is independent per panel and does not touch the global page header/sidebar focus mode.
  - `next build` compiled the updated chart UI successfully, but the build still fails at the existing unrelated lint errors in `lib/feeds/feedRegistry.ts`.

## [2026-06-01] - Fix: Mongo Profile Restore Indexing And Fine Bucket Size
- **What changed**:
  - Added canonical fine profile base-bucket sizing with a minimum stored bucket of `1.5`.
  - Changed live fine profile aggregation, shared profile cache keys, storage writes, and `/api/history/profile` restore requests to use the canonical base bucket instead of raw `tickSize`.
  - Kept MongoDB `profile_rows_ts` restore filters source/timeframe/base-bucket scoped, forced the matching compound index hint for the `time, bucketPriceKey` sort, and added `allowDiskUse` only as a code-292 fallback.
  - Relaxed profile row compatibility so stored `1.5` base rows can aggregate into larger visual row sizes such as `2`, `2.5`, and `5`.
- **Why it changed**:
  - Storing/restoring `0.5` fine profile rows created excessive row counts and could trigger MongoDB's in-memory sort limit during profile restore.
- **Impact summary**:
  - New profile writes/restores on `tickSize = 0.5` use `baseBucketSize = 1.5`; old `0.5` Mongo rows remain untouched and are ignored by new canonical restore requests.
  - Volume Profile rendering still uses the existing visual row-size controls, with restored coarse-enough rows aggregated into the requested visual buckets.
  - Candles, footprints, raw trades, heatmap, feeds, and Mongo candle/footprint storage were not changed.

## [2026-06-01] - Audit: Volume Profile Rendering
- **What changed**:
  - Added `artifacts/volume_profile_rendering_audit.md` covering custom/default profile data flow, row-size aggregation, width normalization, visual clamping, POC/VA/LVN behavior, visual noise causes, and recommended fix order.
  - Updated `skills/map.md` with the new audit artifact.
- **Why it changed**:
  - The current Volume Profile display can look noisy because fine row size, sqrt scaling, min width, and min row height visually inflate weak rows.
- **Impact summary**:
  - Documentation-only audit. Runtime chart code, storage, feeds, cache, MongoDB, and profile engine behavior were not changed.

## [2026-05-31] - Polish: Orderbook Heatmap Labels And Intensity
- **What changed**:
  - Reused one orderbook heatmap column/metrics snapshot per chart redraw so the background cell pass and late label pass derive from the same heatmap data.
  - Kept labels tied to the final clipped heatmap rectangle geometry used for visible cells, with existing merge, size, and overlap gates plus draw-count limits for zoomed-out readability.
  - Changed real heatmap coloring from side color plus opacity only to a side-preserving intensity ramp that moves stronger liquidity toward amber and extreme liquidity toward bright yellow.
  - Tightened percentile normalization with a lower-percentile floor and capped high-percentile upper bound so small levels stay subtle while large levels pop.
- **Why it changed**:
  - Final heatmap polish needed labels to remain visually anchored during pan/zoom, avoid unreadable zoomed-out clutter, and make large asset quantities stand out more like a Bookmap heatmap.
- **Impact summary**:
  - Labels still show asset quantity only, not USD/notional and not order count.
  - Zoomed-out labels merge/skip and prioritize stronger visible areas; zoomed-in readable cells can show individual labels.
  - High liquidity now transitions to amber/yellow while weak liquidity remains dark/subtle.
  - Depth adapters, orderbook sync, storage, candles, footprint, volume profile, and trade logic were not changed.

## [2026-05-31] - Fix: Responsive Heatmap Label Settings And Geometry
- **What changed**:
  - Added normal settings for real orderbook heatmap labels: `Show Liquidity Labels`, label visibility mode (`Off`, `Auto`, `Readable`), label detail (`Total quantity` or `Total + max level`), and minimum label quantity.
  - Changed heatmap labels to be built from final visible heatmap rectangle geometry after clipping and pixel-column grouping, instead of drawing one label per raw/render bucket blindly.
  - Added label candidate merging for overlapping/touching horizontal or vertical visible regions, with summed asset quantity for merged labels and max-level quantity preserved as the largest max-level value in the merged group.
  - Added measured text gates and overlap checks so labels are skipped when the visible grouped region cannot fit the text or would collide with a previously drawn label.
  - Kept the force-label path as a development-only fallback; normal labels no longer require console or localStorage flags.
  - Added label metrics for candidates, merged labels, drawn labels, overlap skips, size skips, width/height skips, threshold skips, missing quantity skips, and setting-off skips.
- **Why it changed**:
  - The previous label pass proved text rendering worked, but it behaved like debug/static text and did not adapt to zoomed-out compressed heatmap geometry.
- **Impact summary**:
  - Zoomed-out labels now merge or skip instead of becoming unreadable, while zoomed-in readable regions can show individual labels.
  - Grouped labels sum asset quantity from the final visible label candidates; labels remain BTC/ETH/base-asset quantity only and are not USD/notional or order counts.
  - The real heatmap bar intensity/width calculation, heatmap engine data model, depth adapters, orderbook sync, MongoDB/storage, candles, footprints, and profiles were not changed.

## [2026-05-31] - Fix: Forced Debug And Late-Pass Heatmap Labels
- **What changed**:
  - Added a force-label debug path for the real orderbook heatmap renderer. It can be enabled with `window.__ORDERFLOW_FORCE_HEATMAP_LABELS__ = true` or `localStorage.setItem('orderflow.forceHeatmapLabels', 'true')`, then a chart redraw.
  - Moved the heatmap label pass later in `ChartCanvas`, after candles/footprints, bubbles, signals, profiles, and measurement overlays, while still clipping text to the chart plot area.
  - Forced labels bypass width, height, normalized-strength, and min-quantity gates, but still require a visible heatmap bar with usable quantity.
  - Production labels keep sensible gates for width, height, min quantity, and normalized strength, and use the same total asset quantity that drives heatmap intensity.
  - Added exact debug fields for `heatmapLabelEnabled`, `heatmapBarsDrawn`, `heatmapLabelCandidates`, `heatmapLabelsDrawn`, `labelsSkippedByWidth`, `labelsSkippedByHeight`, `labelsSkippedByThreshold`, and `labelsSkippedByMissingQuantity`.
- **Why it changed**:
  - The heatmap bars proved quantity data was available, so the remaining issue needed a forced text path to separate label gating from draw order, clipping, and coordinate bugs.
- **Impact summary**:
  - Heatmap labels are drawn only by the real time x price heatmap grid renderer, not the right-side liquidity summary.
  - Labels remain asset quantity only, including BTC quantity for BTCUSDT, and are not USD/notional or order counts.
  - Validated in headless Chrome on `http://localhost:3000` with force-label debug enabled: 16 real heatmap bars were drawn and 16 asset-quantity labels were drawn visibly on those bars.
  - Depth adapters, orderbook sync, MongoDB/storage, candle logic, footprint logic, profile logic, heatmap engine data shape, and heatmap bar intensity calculation were not changed.

## [2026-05-31] - Fix: Real Heatmap Asset Quantity Label Overlay
- **What changed**:
  - Split real orderbook heatmap rendering so cells still draw in the background pass while asset-quantity labels draw in a later text-only pass after candles/footprints.
  - Kept labels gated to strong/readable cells, lowered the normalized label strength gate slightly, and continued falling back to total-only labels when total + max-level text is too wide or max-level data is unavailable.
  - Added label debug metrics for labels enabled, label candidates, labels drawn, size skips, threshold skips, and missing-quantity skips.
- **Why it changed**:
  - Labels were being drawn inside the heatmap background pass, then candle/footprint rendering could cover the label text even though the heatmap cells themselves were visible.
- **Impact summary**:
  - Labels now render on the real time x price orderbook heatmap grid and show asset quantity only, such as BTC quantity on BTCUSDT and ETH quantity on ETHUSDT.
  - Heatmap cells remain behind chart candles/footprints; the later label pass is still restricted to strong readable cells to avoid clutter.
  - Depth adapters, orderbook sync, MongoDB/storage, candle logic, footprint logic, volume profile logic, and the legacy right-side liquidity summary were not changed.

## [2026-05-31] - Fix: Orderbook Heatmap Label Visibility
- **What changed**:
  - Relaxed heatmap label readability gates to use the clipped visible cell size, lower the required visible strength, and allow total-only labels on narrower cells.
  - Centered labels inside the actually visible heatmap rectangle and added a small dark text stroke so labels remain legible over colored liquidity cells.
  - Changed the default minimum heatmap label quantity to `0`, and migrated the previous saved default of `10` down to `0`, leaving clutter control to the strength/size gates unless the user raises the threshold.
- **Why it changed**:
  - Labels were enabled but not appearing on the rendered heatmap because visible cells could be wide enough to draw liquidity bands while still failing the prior 52px width, 14px height, 0.82 normalized-strength, and default quantity-10 label gates.
- **Impact summary**:
  - Strong readable cells should now show raw asset-quantity labels sooner, including BTC quantity for BTCUSDT and ETH quantity for ETHUSDT.
  - Total + max-level mode still falls back to total-only on narrow cells to avoid unreadable `total / maxLevel` text.
  - Heatmap collection, depth adapters, orderbook sync, storage, candles, footprints, profiles, and color rendering were not changed.

## [2026-05-31] - Feature: Orderbook Heatmap Asset Quantity Labels
- **What changed**:
  - Added real orderbook heatmap label settings for label enablement, total-only vs total-plus-max-level mode, and a minimum label quantity threshold.
  - Added per-bucket `maxLevelQty` tracking in the heatmap engine so labels can show total bucket asset quantity and the largest single aggregated price-level quantity inside that bucket.
  - Updated the heatmap renderer to draw compact asset-quantity labels only on strong, readable cells, and to report labels drawn plus threshold/visibility skips.
  - Added heatmap coverage debug metrics for visible price range, collection price range, max distance, collected buckets, levels skipped by distance, levels skipped by side, and levels scanned.
- **Why it changed**:
  - Labels needed to show raw orderbook quantity units, not notional value or order counts, and the heatmap needed clearer diagnostics for narrow vertical coverage.
- **Impact summary**:
  - BTCUSDT labels represent BTC quantity, ETHUSDT labels represent ETH quantity, and no USD conversion or individual order-count claim is made.
  - Total + max-level mode renders as `total / maxLevel`, where max-level is the largest aggregated price level inside the heatmap bucket.
  - Vertical heatmap coverage remains controlled by max-distance settings, visible chart price range, bucket size, intensity threshold, and actual depth-source liquidity; depth adapters, sync, storage, candles, footprints, profiles, and color rendering behavior were not changed.

## [2026-05-31] - Feature: Real Orderbook Heatmap Settings
- **What changed**:
  - Added panel-scoped real orderbook heatmap controls in the global settings dropdown for enable/disable, opacity, price bucket size, lookback window, max near-price distance, intensity mode, quantity labels, and bid/ask/both colors.
  - Added persisted store fields and setters for the new heatmap visual/window settings, with migration defaults for existing saved panels.
  - Routed heatmap bucket size, lookback, and max distance into the heatmap engine so those changes reset the rolling heatmap history safely and keep columns capped.
  - Routed intensity mode and side colors into the canvas renderer while keeping the right-side Liquidity Summary controls separate.
- **Why it changed**:
  - The real time x price heatmap was rendering, but key visual and collection parameters were still hardcoded or shared with the separate liquidity overlay.
- **Impact summary**:
  - Users can tune real heatmap visibility, density, history length, near-price collection range, intensity scaling, labels, and colors from Settings > Chart.
  - Bucket size, lookback, max distance, symbol, contract, depth source, and trade source changes rebuild the session heatmap data; opacity, labels, intensity, and colors redraw immediately without resetting collected columns.
  - MongoDB/storage, candles, trades, footprint/profile logic, depth adapters, feed registry, volume profile rendering, and orderbook sync logic were not changed.

## [2026-05-31] - Reliability: Orderbook Depth Synchronization
- **What changed**:
  - Changed depth initialization to subscribe first, buffer incoming depth updates, fetch the REST snapshot, and only mark each local book ready after a valid snapshot-to-stream bridge.
  - Added sequence continuity checks for Binance spot/futures depth, including Binance futures `pu` validation when present, plus stale/gap state and safe resync on broken continuity.
  - Preserved Bybit update IDs and sequence values, uses Bybit WebSocket snapshots as reset snapshots, and applies monotonic Bybit deltas while exposing its weaker gap-detection limits through debug state.
  - Changed Combined depth aggregation to merge only ready per-exchange books; stale or resyncing sources are excluded from the aggregate orderbook and heatmap source.
  - Added orderbook sync metrics to `window.__MARKET_DEBUG__.getSnapshot()` for ready/stale status, gaps, resyncs, buffered updates, active depth sources, and combined ready sources.
- **Why it changed**:
  - Fetching snapshots before opening the depth stream could miss diff updates, and continuing after a sequence gap could show stale or incorrect liquidity in the heatmap.
- **Impact summary**:
  - Binance spot and futures orderbooks now require a valid initial bridge and resync instead of silently applying broken streams.
  - Combined mode can show partial-ready liquidity from healthy sources without mixing stale books.
  - Candles, trades, footprint/profile calculations, MongoDB/storage, settings layout, and heatmap rendering style were left unchanged.

## [2026-05-31] - Refinement: Orderbook Heatmap Readability
- **What changed**:
  - Updated the real orderbook heatmap renderer to compress sub-pixel one-second samples into readable pixel-width time groups.
  - Aggregated grouped columns by peak bid/ask liquidity per price bucket so stable levels render as continuous horizontal zones instead of barcode-like vertical stripes.
  - Changed visible-cell normalization to a percentile/log-scaled basis and faded low-liquidity noise while preserving stronger levels.
  - Added grouped-column render metrics alongside existing visible-column, cell, duration, and skip counters.
- **Why it changed**:
  - The first renderer mapped every sampled column directly to the current zoom scale, which made one-second samples appear as dense 1 px stripes when the chart was zoomed out.
- **Impact summary**:
  - Heatmap time mapping still uses the existing chart time/index scale and price-to-Y scale, but compressed groups make live liquidity easier to read over time.
  - Candles and footprints remain drawn above the heatmap, and the legacy right-side Liquidity Summary remains separate.
  - No heatmap engine sampling, depth adapters, MongoDB/storage, candle, footprint, or profile calculation behavior changed.

## [2026-05-31] - Feature: Real Orderbook Heatmap Rendering
- **What changed**:
  - Added a clipped canvas renderer for the `OrderbookHeatmapEngine` rolling columns so snapshot time maps to chart X and bucket price maps to chart Y.
  - Drew bid liquidity with teal/green tones, ask liquidity with red/orange tones, and mixed buckets with amber tones using log-scaled opacity.
  - Rendered the real heatmap behind candles/footprint while leaving the legacy right-side Liquidity Summary strip separate.
  - Added persisted per-panel controls for real orderbook heatmap enablement, opacity, and optional quantity labels.
  - Added render metrics for cells drawn, visible columns, draw duration, offscreen skips, tiny-cell skips, and max visible quantity.
- **Why it changed**:
  - The heatmap engine already collected time x price orderbook snapshots, but the chart still only rendered the old summary strip.
- **Impact summary**:
  - Real session-memory heatmap cells now appear across the chart from live orderbook samples and stay aligned during pan/zoom through the existing time/index and price scaling logic.
  - The old Liquidity Summary remains available as a separate right-side strip and is not used as the real heatmap.
  - Heatmap data still resets through the existing engine lifecycle on symbol, contract, depth source, trade source mode, bucket size, or range changes, with no storage, MongoDB, depth adapter, candle, footprint, or profile calculation changes.

## [2026-05-31] - Feature: Orderbook Heatmap Engine
- **What changed**:
  - Added `OrderbookHeatmapEngine`, a rolling time x price data model that stores sampled columns of bucketed bid, ask, total quantity, side, notional, and timestamp data.
  - Added fixed-cadence 1000 ms heatmap sampling in the panel feed lifecycle using the active aggregate orderbook from Binance, Bybit, or Combined depth.
  - Capped the rolling window at 900 columns, roughly 15 minutes at the default cadence, and limited sampled buckets to the configured near-price liquidity range.
  - Exposed heatmap sampling metrics through `window.__MARKET_DEBUG__.getSnapshot()` including column count, bucket count, sample interval, source key, near-price range, and memory estimate.
  - Exposed the heatmap engine through `ChartEngineContext` for the future renderer step.
- **Why it changed**:
  - The existing liquidity summary was not a real time x price heatmap. The app needed a durable engine-level model before replacing any renderer.
- **Impact summary**:
  - Heatmap columns now collect on a fixed cadence and reset on symbol, contract, depth source, trade source mode, bucket size, or range changes.
  - Existing liquidity zones, right-side summary/ladder, candles, trades, footprints, profiles, MongoDB/storage, and chart visuals were left unchanged.
  - The next step is rendering these heatmap columns across the chart canvas.

## [2026-05-30] - Feature: Combined Depth Aggregation
- **What changed**:
  - Added a `Combined` per-panel depth source option alongside Binance and Bybit.
  - Kept the shared feed registry limited to concrete exchange depth streams while `FeedProvider` expands Combined into separate Binance and Bybit snapshot/stream subscriptions.
  - Maintained one local orderbook per exchange, then merged ready exchange bid/ask levels by exact price before passing them into the existing bucketed liquidity-zone aggregation.
  - Reset per-exchange books, the aggregate book, and visible liquidity zones when switching depth source, contract, pair, or unmounting the panel.
- **Why it changed**:
  - Liquidity visualization needed an optional multi-exchange orderbook view without changing candles, trades, footprints, profiles, storage, MongoDB, or the heatmap engine.
- **Impact summary**:
  - Binance mode still uses only Binance depth, Bybit mode still uses only Bybit depth, and Combined mode sums available Binance and Bybit levels before bucket filtering.
  - Combined can show larger or more populated liquidity buckets because sizes at matching price levels are added across exchanges.
  - Exchange precision and available depth can differ, so merged bucket strength is useful for visualization but is not a consolidated tradable orderbook.

## [2026-05-30] - Feature: Bybit Depth Source
- **What changed**:
  - Added Bybit spot and USDT linear futures depth adapters using public v5 REST orderbook snapshots and public v5 WebSocket orderbook streams.
  - Added a persisted per-panel depth source setting with Binance and Bybit options in Settings > Chart > Liquidity Map.
  - Routed shared orderbook snapshot dedupe and depth stream keys by depth source, contract type, and symbol so exchange changes do not reuse stale subscriptions.
  - Taught the orderbook manager to reset from WebSocket snapshot messages so Bybit reconnect/service snapshots do not leave stale levels behind.
  - Split the panel orderbook lifecycle from the broader candle/trade feed effect so changing depth source cleans up only the old depth subscription and clears old liquidity zones.
- **Why it changed**:
  - Liquidity depth was limited to Binance. The chart needed a second exchange orderbook source while keeping contract type separate from exchange selection.
- **Impact summary**:
  - Binance depth remains the default and continues to route spot/futures by contract type.
  - Bybit depth can be selected per panel and feeds the existing orderbook manager and liquidity overlay without combining exchanges or changing heatmap, candle, footprint, profile, storage, or MongoDB logic.
  - Unsupported Bybit symbol/category combinations fail closed with an empty liquidity overlay instead of mixing in Binance depth.

## [2026-05-30] - Feature: Contract-Routed Depth Adapters
- **What changed**:
  - Added a dedicated depth adapter abstraction with Binance spot and Binance futures REST snapshot and depth WebSocket implementations.
  - Routed shared orderbook snapshots and depth streams through contract-scoped depth keys in the feed registry.
  - Updated panel feed orderbook initialization so spot charts use spot depth and futures charts use futures depth.
  - Kept candle, aggTrade, footprint, profile, storage, and heatmap-engine behavior unchanged.
- **Why it changed**:
  - The liquidity overlay previously used Binance spot depth even when the selected chart contract was futures, which could show misleading orderbook liquidity.
- **Impact summary**:
  - Existing liquidity zones now consume depth from the selected contract type. Spot panels stay on Binance spot depth, while futures panels use Binance futures depth without adding new exchanges or rebuilding the heatmap engine.

## [2026-05-30] - Cleanup: Liquidity Overlay Near-Price Filtering
- **What changed**:
  - Changed current liquidity zone aggregation to include near-price orderbook levels, cap the range to a small near-price percent, rank by size with a near-price preference, and limit displayed zones per side.
  - Deemphasized the current liquidity renderer from full-width bands into faint fills plus right-edge markers.
  - Renamed the fake heatmap UI to Liquidity Summary and disabled it by default for new panel settings.
  - Updated `skills/map.md` with the adjusted liquidity renderer and summary-strip responsibilities.
- **Why it changed**:
  - The previous liquidity overlay excluded the closest 2 percent around mid price and selected distant zones that were not useful for normal near-price chart context.
- **Impact summary**:
  - This is a small cleanup of the existing spot-only liquidity overlay. It does not add the real time x price heatmap engine and does not change futures orderbook support, storage, candles, footprints, or profiles.

## [2026-05-30] - Audit: Liquidity Heatmap Implementation
- **What changed**:
  - Added `artifacts/liquidity_heatmap_audit.md` documenting the current spot-only orderbook source, liquidity zone aggregation, sparse history snapshots, right-side heatmap strip rendering, root causes, and ranked rebuild plan.
  - Updated `skills/map.md` with the new audit artifact.
- **Why it changed**:
  - The liquidity/heatmap overlay was showing distant horizontal zones and detached right-side heatmap accents instead of behaving like a time x price orderbook heatmap.
- **Impact summary**:
  - Documentation-only audit. Chart rendering, storage, feeds, settings, and liquidity code were not changed.

## [2026-05-30] - Feature: VWAP Chart Overlay
- **What changed**:
  - Added persisted per-panel VWAP settings for enable/disable, line color, line width, and reset mode.
  - Added VWAP controls to the Settings > Chart tab.
  - Added a canvas VWAP renderer that calculates from active panel candles using typical price and volume, with continuous, daily, and session reset modes.
  - Routed VWAP settings through `ChartPanel` into `ChartCanvas` so the overlay redraws with live candle updates.
  - Updated `skills/map.md` with the VWAP store, settings, render, and drawer responsibilities.
- **Why it changed**:
  - The chart needed a basic VWAP line overlay controlled from the existing global/settings dropdown without expanding the market-data or indicator architecture.
- **Impact summary**:
  - VWAP appears when enabled and is skipped when disabled.
  - Live candle updates trigger the existing chart redraw path, so the VWAP line updates with the active panel/timeframe.
  - Footprint, Volume Profile, feeds, storage, MongoDB, and cache behavior were not changed.

## [2026-05-30] - UI: Signals Settings And Persistent Tools
- **What changed**:
  - Removed the Absorption, Exhaustion, Iceberg, and Liquidity Vacuum quick toggles from the per-panel toolbar.
  - Kept those signal controls in the existing Settings > Signals tab, using the same store actions and panel state.
  - Stopped the chart canvas from automatically clearing Horizontal Line, Vertical Line, Right Ray, Box, or Custom Profile tools after placement.
  - Updated `skills/map.md` with the adjusted toolbar, settings, and drawing-interaction responsibilities.
- **Why it changed**:
  - The panel header needed less signal-control clutter, and drawing tools should remain active across redraws, settings changes, timeframe changes, and normal panel updates until manually changed.
- **Impact summary**:
  - Signal behavior is unchanged because the same settings toggles still drive the same store state.
  - Drawing overlays still use the existing creation and render logic, but selected drawing tools now stay selected after drawing.
  - Market data, chart calculations, storage, feeds, cache behavior, and render math were not changed.

## [2026-05-30] - Fix: Footprint Persistence Restore Gaps
- **What changed**:
  - Moved canonical 1m/$5 footprint row persistence out of the selected chart candle-close path.
  - Base footprint rows are now queued only after the selected aggTrade source stream(s) advance past a closed 1m slice, so MongoDB receives the finalized live footprint slice instead of an early kline-close snapshot.
  - Added focused `[FOOTPRINT_RESTORE_DEBUG]` diagnostics for client write eligibility/skips, MongoDB write confirmation, history API restore coverage, hydration acceptance/rejection, renderer visible coverage, and shared cache cleanup removals.
  - Left candle storage, chart visuals, passive redraw throttling, footprint display aggregation, and MongoDB collection schema unchanged.
- **Why it changed**:
  - The regression was at the write stage: live aggTrade rows could arrive after the selected candle close event had already claimed/stored that 1m footprint slice, leaving MongoDB with empty or partial `footprint_cells_ts` rows while the in-memory chart later looked correct until refresh.
- **Impact summary**:
  - Refresh and fresh-tab restore should now fetch and hydrate the same closed 1m footprint cells that were visible live.
  - Restore queries and renderer cache usage are instrumented so any remaining gap can be classified as write, restore, hydration, cache cleanup, or render coverage.
  - Recent rendering/performance optimization logic was not changed except for adding renderer coverage diagnostics.

## [2026-05-29] - Performance: Footprint Passive Redraw Throttle
- **What changed**:
  - Made the main chart passive redraw throttle depend on chart mode.
  - Kept candle/default passive redraws at the existing 125 ms interval.
  - Slowed footprint-mode passive redraws to a 300 ms interval, targeting roughly 2-4 passive redraws per second during live flow.
  - Continued reporting `chartMode`, `passiveRedrawIntervalMs`, `passiveRedrawsPerSecond`, `passiveRedrawThrottledCount`, and `footprintRepaintCount` through the existing render metrics path.
- **Why it changed**:
  - Footprint mode repaints heavier visible footprint cells and bubbles, and recent metrics showed live passive redraws around 7.5/sec without a memory or subscriber leak.
- **Impact summary**:
  - Only main chart passive/live-data redraw scheduling changed.
  - Interaction redraws still use the immediate rAF path for pan, zoom, mousemove/crosshair, wheel, and resize behavior.
  - Footprint calculations, footprint cache, feed registry, MongoDB/storage, raw trades, fine profile persistence, and chart visuals were not changed.

## [2026-05-29] - Feature: Focus Layout Mode
- **What changed**:
  - Added a header Focus button that toggles a layout-only focus mode.
  - Focus mode hides the top header and sidebar, allowing the chart workspace to expand into the freed screen space.
  - Added a small floating `Exit Focus` button while focus mode is active.
  - Added `Alt+Shift+Z` as a focus mode toggle shortcut.
  - Extended the keyboard shortcut typing guard to skip inputs, textareas, selects, combobox/listbox targets, and editable fields.
  - Updated `skills/map.md` with the adjusted layout and shortcut responsibilities.
- **Why it changed**:
  - The chart needs a quick temporary fullscreen-style workspace without altering the existing sidebar collapse state or chart/data behavior.
- **Impact summary**:
  - This is a UI/layout-only change in the page scaffold, header, and keyboard shortcut hook.
  - Existing sidebar expanded/icon-collapsed state is preserved because focus mode conditionally hides the sidebar without changing the stored sidebar collapse setting.
  - Chart rendering, data feeds, cache, storage, settings behavior, and sidebar collapse behavior were not changed.

## [2026-05-30] - Feature: Combined Depth Aggregation
- **What changed**:
  - Added a `Combined` per-panel depth source option alongside Binance and Bybit.
  - Kept the shared feed registry limited to concrete exchange depth streams while `FeedProvider` expands Combined into separate Binance and Bybit snapshot/stream subscriptions.
  - Maintained one local orderbook per exchange, then merged ready exchange bid/ask levels by exact price before passing them into the existing bucketed liquidity-zone aggregation.
  - Reset per-exchange books, the aggregate book, and visible liquidity zones when switching depth source, contract, pair, or unmounting the panel.
- **Why it changed**:
  - Liquidity visualization needed an optional multi-exchange orderbook view without changing candles, trades, footprints, profiles, storage, MongoDB, or the heatmap engine.
- **Impact summary**:
  - Binance mode still uses only Binance depth, Bybit mode still uses only Bybit depth, and Combined mode sums available Binance and Bybit levels before bucket filtering.
  - Combined can show larger or more populated liquidity buckets because sizes at matching price levels are added across exchanges.
  - Exchange precision and available depth can differ, so merged bucket strength is useful for visualization but is not a consolidated tradable orderbook.

## [2026-05-30] - Feature: Bybit Depth Source
- **What changed**:
  - Added Bybit spot and USDT linear futures depth adapters using public v5 REST orderbook snapshots and public v5 WebSocket orderbook streams.
  - Added a persisted per-panel depth source setting with Binance and Bybit options in Settings > Chart > Liquidity Map.
  - Routed shared orderbook snapshot dedupe and depth stream keys by depth source, contract type, and symbol so exchange changes do not reuse stale subscriptions.
  - Taught the orderbook manager to reset from WebSocket snapshot messages so Bybit reconnect/service snapshots do not leave stale levels behind.
  - Split the panel orderbook lifecycle from the broader candle/trade feed effect so changing depth source cleans up only the old depth subscription and clears old liquidity zones.
- **Why it changed**:
  - Liquidity depth was limited to Binance. The chart needed a second exchange orderbook source while keeping contract type separate from exchange selection.
- **Impact summary**:
  - Binance depth remains the default and continues to route spot/futures by contract type.
  - Bybit depth can be selected per panel and feeds the existing orderbook manager and liquidity overlay without combining exchanges or changing heatmap, candle, footprint, profile, storage, or MongoDB logic.
  - Unsupported Bybit symbol/category combinations fail closed with an empty liquidity overlay instead of mixing in Binance depth.

## [2026-05-30] - Feature: Contract-Routed Depth Adapters
- **What changed**:
  - Added a dedicated depth adapter abstraction with Binance spot and Binance futures REST snapshot and depth WebSocket implementations.
  - Routed shared orderbook snapshots and depth streams through contract-scoped depth keys in the feed registry.
  - Updated panel feed orderbook initialization so spot charts use spot depth and futures charts use futures depth.
  - Kept candle, aggTrade, footprint, profile, storage, and heatmap-engine behavior unchanged.
- **Why it changed**:
  - The liquidity overlay previously used Binance spot depth even when the selected chart contract was futures, which could show misleading orderbook liquidity.
- **Impact summary**:
  - Existing liquidity zones now consume depth from the selected contract type. Spot panels stay on Binance spot depth, while futures panels use Binance futures depth without adding new exchanges or rebuilding the heatmap engine.

## [2026-05-30] - Cleanup: Liquidity Overlay Near-Price Filtering
- **What changed**:
  - Changed current liquidity zone aggregation to include near-price orderbook levels, cap the range to a small near-price percent, rank by size with a near-price preference, and limit displayed zones per side.
  - Deemphasized the current liquidity renderer from full-width bands into faint fills plus right-edge markers.
  - Renamed the fake heatmap UI to Liquidity Summary and disabled it by default for new panel settings.
  - Updated `skills/map.md` with the adjusted liquidity renderer and summary-strip responsibilities.
- **Why it changed**:
  - The previous liquidity overlay excluded the closest 2 percent around mid price and selected distant zones that were not useful for normal near-price chart context.
- **Impact summary**:
  - This is a small cleanup of the existing spot-only liquidity overlay. It does not add the real time x price heatmap engine and does not change futures orderbook support, storage, candles, footprints, or profiles.

## [2026-05-30] - Audit: Liquidity Heatmap Implementation
- **What changed**:
  - Added `artifacts/liquidity_heatmap_audit.md` documenting the current spot-only orderbook source, liquidity zone aggregation, sparse history snapshots, right-side heatmap strip rendering, root causes, and ranked rebuild plan.
  - Updated `skills/map.md` with the new audit artifact.
- **Why it changed**:
  - The liquidity/heatmap overlay was showing distant horizontal zones and detached right-side heatmap accents instead of behaving like a time x price orderbook heatmap.
- **Impact summary**:
  - Documentation-only audit. Chart rendering, storage, feeds, settings, and liquidity code were not changed.

## [2026-05-30] - Feature: VWAP Chart Overlay
- **What changed**:
  - Added persisted per-panel VWAP settings for enable/disable, line color, line width, and reset mode.
  - Added VWAP controls to the Settings > Chart tab.
  - Added a canvas VWAP renderer that calculates from active panel candles using typical price and volume, with continuous, daily, and session reset modes.
  - Routed VWAP settings through `ChartPanel` into `ChartCanvas` so the overlay redraws with live candle updates.
  - Updated `skills/map.md` with the VWAP store, settings, render, and drawer responsibilities.
- **Why it changed**:
  - The chart needed a basic VWAP line overlay controlled from the existing global/settings dropdown without expanding the market-data or indicator architecture.
- **Impact summary**:
  - VWAP appears when enabled and is skipped when disabled.
  - Live candle updates trigger the existing chart redraw path, so the VWAP line updates with the active panel/timeframe.
  - Footprint, Volume Profile, feeds, storage, MongoDB, and cache behavior were not changed.

## [2026-05-30] - UI: Signals Settings And Persistent Tools
- **What changed**:
  - Removed the Absorption, Exhaustion, Iceberg, and Liquidity Vacuum quick toggles from the per-panel toolbar.
  - Kept those signal controls in the existing Settings > Signals tab, using the same store actions and panel state.
  - Stopped the chart canvas from automatically clearing Horizontal Line, Vertical Line, Right Ray, Box, or Custom Profile tools after placement.
  - Updated `skills/map.md` with the adjusted toolbar, settings, and drawing-interaction responsibilities.
- **Why it changed**:
  - The panel header needed less signal-control clutter, and drawing tools should remain active across redraws, settings changes, timeframe changes, and normal panel updates until manually changed.
- **Impact summary**:
  - Signal behavior is unchanged because the same settings toggles still drive the same store state.
  - Drawing overlays still use the existing creation and render logic, but selected drawing tools now stay selected after drawing.
  - Market data, chart calculations, storage, feeds, cache behavior, and render math were not changed.

## [2026-05-30] - Fix: Footprint Persistence Restore Gaps
- **What changed**:
  - Moved canonical 1m/$5 footprint row persistence out of the selected chart candle-close path.
  - Base footprint rows are now queued only after the selected aggTrade source stream(s) advance past a closed 1m slice, so MongoDB receives the finalized live footprint slice instead of an early kline-close snapshot.
  - Added focused `[FOOTPRINT_RESTORE_DEBUG]` diagnostics for client write eligibility/skips, MongoDB write confirmation, history API restore coverage, hydration acceptance/rejection, renderer visible coverage, and shared cache cleanup removals.
  - Left candle storage, chart visuals, passive redraw throttling, footprint display aggregation, and MongoDB collection schema unchanged.
- **Why it changed**:
  - The regression was at the write stage: live aggTrade rows could arrive after the selected candle close event had already claimed/stored that 1m footprint slice, leaving MongoDB with empty or partial `footprint_cells_ts` rows while the in-memory chart later looked correct until refresh.
- **Impact summary**:
  - Refresh and fresh-tab restore should now fetch and hydrate the same closed 1m footprint cells that were visible live.
  - Restore queries and renderer cache usage are instrumented so any remaining gap can be classified as write, restore, hydration, cache cleanup, or render coverage.
  - Recent rendering/performance optimization logic was not changed except for adding renderer coverage diagnostics.

## [2026-05-29] - Performance: Footprint Passive Redraw Throttle
- **What changed**:
  - Made the main chart passive redraw throttle depend on chart mode.
  - Kept candle/default passive redraws at the existing 125 ms interval.
  - Slowed footprint-mode passive redraws to a 300 ms interval, targeting roughly 2-4 passive redraws per second during live flow.
  - Continued reporting `chartMode`, `passiveRedrawIntervalMs`, `passiveRedrawsPerSecond`, `passiveRedrawThrottledCount`, and `footprintRepaintCount` through the existing render metrics path.
- **Why it changed**:
  - Footprint mode repaints heavier visible footprint cells and bubbles, and recent metrics showed live passive redraws around 7.5/sec without a memory or subscriber leak.
- **Impact summary**:
  - Only main chart passive/live-data redraw scheduling changed.
  - Interaction redraws still use the immediate rAF path for pan, zoom, mousemove/crosshair, wheel, and resize behavior.
  - Footprint calculations, footprint cache, feed registry, MongoDB/storage, raw trades, fine profile persistence, and chart visuals were not changed.

## [2026-05-29] - Feature: Focus Layout Mode
- **What changed**:
  - Added a header Focus button that toggles a layout-only focus mode.
  - Focus mode hides the top header and sidebar, allowing the chart workspace to expand into the freed screen space.
  - Added a small floating `Exit Focus` button while focus mode is active.
  - Added `Alt+Shift+Z` as a focus mode toggle shortcut.
  - Extended the keyboard shortcut typing guard to skip inputs, textareas, selects, combobox/listbox targets, and editable fields.
  - Updated `skills/map.md` with the adjusted layout and shortcut responsibilities.
- **Why it changed**:
  - The chart needs a quick temporary fullscreen-style workspace without altering the existing sidebar collapse state or chart/data behavior.
- **Impact summary**:
  - This is a UI/layout-only change in the page scaffold, header, and keyboard shortcut hook.
  - Existing sidebar expanded/icon-collapsed state is preserved because focus mode conditionally hides the sidebar without changing the stored sidebar collapse setting.
  - Chart rendering, data feeds, cache, storage, settings behavior, and sidebar collapse behavior were not changed.

## [2026-05-27] - Feature: Filled Volume Profile Rendering
- **What changed**:
  - Added a third Volume Profile scaling/render option, `filled`, beside `linear` and `sqrt` in the Profiles settings panel.
  - Updated the default and custom total-volume profile renderers to draw a stepped filled contour from existing row widths in `filled` mode.
  - Applied the auction-profile palette to total-volume rendering: pale sand outside value, orange/value-area body, stronger orange high-volume rows, amber POC, and muted LVN/VA accents.
  - Kept subtle row-level detail over the filled shape so individual price-row structure remains visible.
  - Routed delta profile drawing through the existing `linear`/`sqrt` path when `filled` is selected so delta remains bar-based.
  - Updated `skills/map.md` with the adjusted rendering/settings responsibilities.
- **Why it changed**:
  - The total volume side looked like separated horizontal bars and did not visually read as a continuous DeepCharts/TradingView-style auction profile shape.
- **Impact summary**:
  - Only total Volume Profile canvas rendering and its settings option changed.
  - Volume Profile calculations, row values, POC/VA/LVN data, cache/storage/restore/MongoDB behavior, and delta calculation were not changed.
  - Filled mode uses a continuous stepped contour/fill with row-detail overlay; no data smoothing or profile-row mutation is performed.

## [2026-05-25] - Performance: Passive Redraw And Enabled-Layer Reuse
- **What changed**:
  - Added passive/live redraw throttling to the main chart canvas and CVD canvas while keeping interaction redraws on the immediate rAF path.
  - Added chart-local runtime reuse keys for default and custom Volume Profile builds so enabled profiles remain visible without rebuilding profile inputs for unrelated redraws.
  - Extended profile render metrics with build reuse/miss, draw invalidation/reuse, and passive redraw details.
  - Reused the per-redraw footprint aggregation resolver for bubbles as well as footprint cells.
  - Added CVD divergence marker memoization alongside the existing CVD series memoization.
  - Summarized repeated fine-profile skipped-open storage diagnostics in a 10-second window per key/reason/open candle.
  - Updated `skills/map.md` with adjusted rendering and diagnostics responsibilities.
- **Why it changed**:
  - Latest debug snapshots still showed heavy long-session redraw activity, high enabled custom profile repaint counts, high visible CVD rebuild pressure, and noisy skipped-open diagnostics.
- **Impact summary**:
  - Chart visuals, feed behavior, MongoDB/storage writes, and shared cache architecture are unchanged.
  - Passive live-flow redraws are capped around 8/sec per surface, interaction redraws remain responsive, profile/CVD rebuild work is reused more aggressively, and repeated skipped-open diagnostics should grow much slower.

## [2026-05-25] - Performance: Small Rendering Optimizations
- **What changed**:
  - Guarded the default Volume Profile build so it only runs when the default profile is enabled.
  - Replaced the one-entry `RawTradeVolumeProfileEngine` profile cache with a bounded keyed cache and exposed cache stats for render metrics.
  - Added CVD series memoization for expanded and compact CVD paths so redraws can reuse the full CVD series when candles/settings/revisions are unchanged.
  - Added a per-redraw footprint candle aggregation cache shared by footprint and bubble drawing.
  - Added render metric details for profile cache hits/misses, skipped default profile builds, CVD series rebuild/reuse, and footprint aggregation cache hits/misses.
  - Updated `skills/map.md` with adjusted rendering responsibilities.
- **Why it changed**:
  - The rendering audit identified avoidable profile, CVD, and footprint recalculation during redraw-heavy long sessions.
- **Impact summary**:
  - Chart appearance, feed behavior, MongoDB/storage logic, and shared market cache architecture are unchanged.
  - Disabled default profiles no longer build hidden default profile data, default/custom profiles can coexist in a small bounded cache, CVD redraws can reuse series data, and repeated visible footprint aggregation within one redraw is avoided.

## [2026-05-24] - Audit: Rendering Performance Path
- **What changed**:
  - Added `artifacts/rendering_performance_audit.md` documenting chart/CVD redraw triggers, rAF coalescing behavior, visible-range rendering boundaries, expensive layers, React re-render risks, long-session risks, and a ranked fix order.
  - Updated `skills/map.md` with the new audit artifact responsibility.
- **Why it changed**:
  - Long sessions can still freeze despite healthy streams, storage, and shared caches, and recent metrics showed high redraw counts with some slow redraws.
- **Impact summary**:
  - Audit only; runtime chart rendering, data/cache/storage logic, and UI behavior were not changed.

## [2026-05-24] - Fix: Browser Debug Growth And Redraw Metrics
- **What changed**:
  - Normalized candle cache `loadedRanges` so duplicate, overlapping, and adjacent ranges merge into compact coverage entries instead of being appended on every restore/live update.
  - Added Volume Profile raw-trade/key pruning around retention cleanup and max-trade enforcement, with metrics for removed trades and seen trade keys.
  - Raised and made configurable the debug `recentRestoreCalls` cap, and added dropped-call counts to the market debug snapshot.
  - Added lightweight per-panel render/redraw metrics for the main chart and CVD canvases, including request counts, coalesced requests, redraw rates, duration, and candle/footprint/profile/CVD repaint counters.
  - Updated `skills/map.md` with the adjusted file responsibilities.
- **Why it changed**:
  - Long browser sessions could accumulate large debug/range/trade identity structures even while MongoDB and streams remained healthy, making the tab vulnerable to freezes and making snapshots hard to read.
- **Impact summary**:
  - MongoDB storage, chart UI behavior, feed registry behavior, and footprint/profile calculations are unchanged.
  - Candle loaded ranges now stay deduped/merged, Volume Profile trade identity tracking is bounded with cleanup visibility, restore diagnostics remain capped, and `window.__MARKET_DEBUG__.getSnapshot()` now exposes render/redraw frequency metrics.

## [2026-05-23] - Migration: MongoDB Footprint/Profile Rows
- **What changed**:
  - Implemented MongoDB storage for canonical `footprint_cells_ts` rows behind `MARKET_DB_DRIVER=mongodb`, keyed by `symbol`, `contractType`, `dataSourceMode`, canonical `1m` timeframe, `$5` bucket size, candle time, and `bucketPriceKey`.
  - Implemented MongoDB storage for canonical `profile_rows_ts` rows behind `MARKET_DB_DRIVER=mongodb`, keyed by `symbol`, `contractType`, `dataSourceMode`, canonical `1m` timeframe, `baseBucketSizeKey`, candle time, and `bucketPriceKey`.
  - Added MongoDB time-series initialization for footprint/profile collections with `timeField: "time"`, `metaField: "meta"`, configurable 7-day default TTL via `MARKET_DATA_RETENTION_DAYS`, and source/time/price restore indexes.
  - Routed footprint/profile Server Actions and history APIs through the selected storage adapter while leaving raw-trade persistence on the existing libSQL path.
  - Updated `skills/map.md` with the new footprint/profile MongoDB responsibilities.
- **Why it changed**:
  - The next MongoDB market-data migration needs source-safe footprint and Volume Profile base rows while preserving the current libSQL fallback and in-memory aggregation behavior.
- **Impact summary**:
  - libSQL remains the default when `MARKET_DB_DRIVER` is unset or `libsql`.
  - With `MARKET_DB_DRIVER=mongodb`, footprint and fine profile writes/restores use MongoDB while chart timeframe, display bucket, and profile row-size changes still aggregate from canonical base rows in memory.
  - Raw trades, candle_delta, chart UI, feed registry behavior, and cache architecture were not migrated or changed.
  - Duplicate protection uses adapter-level source/time/price existence checks before inserting into MongoDB time-series collections.

## [2026-05-23] - Migration: MongoDB Candle/OHLCV Storage
- **What changed**:
  - Implemented MongoDB candle/OHLCV storage in `market_candles_ts` behind `MARKET_DB_DRIVER=mongodb`.
  - Added MongoDB time-series collection initialization with `timeField: "time"`, `metaField: "meta"`, 7-day TTL, and source/time restore index.
  - Added source-scoped Mongo candle writes and restores keyed by `symbol`, `contractType`, `timeframe`, and candle open time.
  - Routed the candle history API, history status API, and closed-candle Server Action through the selected storage adapter for candle data.
  - Updated the panel feed to pass `contractType` to candle history restore and closed-candle storage.
  - Updated `skills/map.md` with the new candle migration responsibilities.
- **Why it changed**:
  - Candles are the first real MongoDB market-data migration and need source-safe storage so spot and futures candle history cannot collide.
- **Impact summary**:
  - libSQL remains the default and keeps existing spot candle behavior when `MARKET_DB_DRIVER` is unset or `libsql`.
  - MongoDB candle writes/restores are active only with `MARKET_DB_DRIVER=mongodb`.
  - Footprint cells, fine profile rows, raw trades, feed registry behavior, chart UI, and cache internals remain on their existing paths.
  - Because MongoDB time-series collections do not support unique indexes or upsert measurement updates, duplicate protection is implemented as an adapter-level source-scoped existence check before insert plus the existing client-side closed-candle claim.

## [2026-05-23] - Foundation: MongoDB Storage Adapter Skeleton
- **What changed**:
  - Added the official MongoDB Node driver dependency and lockfile entries.
  - Added a singleton-safe MongoDB client module using `MONGODB_URI`, `MONGODB_DB_NAME`, and ping verification.
  - Added a market storage adapter abstraction with libSQL delegation as the default and a MongoDB adapter skeleton selected by `MARKET_DB_DRIVER=mongodb`.
  - Updated server startup to initialize the selected adapter while keeping the libSQL cleanup job only on the libSQL driver.
  - Updated `skills/map.md` with the new storage foundation responsibilities.
- **Why it changed**:
  - MongoDB connection and adapter foundations are needed before any market-data collection migration can safely begin.
- **Impact summary**:
  - libSQL remains the default when `MARKET_DB_DRIVER` is unset or set to `libsql`.
  - MongoDB is behind `MARKET_DB_DRIVER=mongodb`; its adapter can verify the connection but market-data read/write methods are still placeholders.
  - No candle, footprint, profile, raw-trade, feed, cache, or chart behavior was migrated to MongoDB in this task.

## [2026-05-23] - Design: MongoDB Time-Series Storage Migration
- **What changed**:
  - Added `artifacts/mongodb_storage_design.md` with MongoDB time-series collection designs for source-scoped candles, canonical footprint cells, canonical fine Volume Profile rows, metadata, and future raw trades.
  - Defined migration strategy, time-series options, meta fields, restore indexes, 7-day TTL policy, duplicate-write strategy, decimal storage guidance, and a storage adapter interface using `MARKET_DB_DRIVER=libsql | mongodb`.
  - Updated `skills/map.md` with the new artifact responsibility.
- **Why it changed**:
  - The MongoDB migration needs a decision-complete schema and adapter design before runtime storage code is introduced.
- **Impact summary**:
  - Documentation only; no runtime behavior, database schema, dependencies, or storage implementation changed.
  - The design keeps libSQL as the default fallback and calls out source-safe MongoDB candle restore as the first migration step.

## [2026-05-23] - Memory: Shared Market Cache TTL Cleanup
- **What changed**:
  - Added shared market cache policy constants/env overrides for retention, cleanup interval, inactive grace, max base slices, and max row/cell/candle caps.
  - Added subscriber-aware cleanup to shared footprint, Volume Profile, and candle caches: active keys are trimmed, zero-subscriber keys remain warm during grace, then inactive keys are evicted from memory.
  - Added acquire/release lifecycle ownership for panel footprint/profile engines and release calls during feed cleanup.
  - Extended `window.__MARKET_DEBUG__` cache metrics with cleanup runs, evictions, removed slices/rows, memory delta, and last cleanup timestamps.
- **Why it changed**:
  - Shared in-memory market caches could grow indefinitely across live use, restores, and panel/source switches even though persisted DB data remains the durable source of truth.
- **Impact summary**:
  - Default in-memory retention keeps recent 1m base context while preserving the newest/current slice, trims extreme growth by oldest data first, and evicts inactive cache keys only after grace.
  - Database retention/storage, chart UI, feed registry behavior, and footprint/profile calculation logic are unchanged.

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
