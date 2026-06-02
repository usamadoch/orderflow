# OrderFlow Chart - Change Log

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
