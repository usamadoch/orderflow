# OrderFlow Chart - Change Log

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
