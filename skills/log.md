# OrderFlow Chart - Change Log

## [2026-05-20] - Refinement: Softer Footprint Visual Strength Scaling
- **What changed**:
  - Replaced hard per-candle max stretching with soft candle scales blended against visible-range percentiles.
  - Added smooth opacity curves for bid/ask footprint cells so small values stay light and larger values brighten gradually.
  - Changed delta-bar width and opacity curves so local candle maxima no longer automatically fill the whole cell when absolute delta is small.
- **Why it changed**:
  - The prior stability fix stopped movement-related instability, but the per-candle max made colors too flat and exaggerated weak local maxima.
- **Impact summary**:
  - Footprint cells should keep the improved pan/resize stability while reading more like professional orderflow displays: weak values are subtle, medium values are proportional, and true stronger values stand out without visual overreach.

## [2026-05-20] - Fix: Stable Volume Bubble and Footprint Cell Rendering
- **What changed**:
  - Clamped drawable-width calculations when profile/heatmap space is reserved and added small render overscan around the visible candle range.
  - Changed footprint cell visuals to normalize bid/ask opacity and delta-bar width per candle instead of by the currently culled viewport.
  - Preserved fractional footprint cell geometry and switched cell labels to fit-based rendering so values do not disappear at arbitrary rounded thresholds.
  - Stabilized volume bubble sizing with high-percentile scaling and finite coordinate guards.
  - Placed footprint bottom delta labels against the chart height instead of the full canvas height.
- **Why it changed**:
  - Visuals were depending too heavily on viewport edge culling, rounded cell widths, and reserved profile width math, so panning or slight panel resizing could make bubbles, labels, and delta bars abruptly resize or disappear even when the underlying data was present.
- **Impact summary**:
  - Volume bubbles and footprint cells should render more consistently while dragging, scrolling, resizing, and zooming. The change is isolated to canvas coordinate/drawing behavior and does not alter aggregation, feed, persistence, or stored data.

## [2026-05-20] - Feature: Fine Volume Profile Persistence
- **What changed**:
  - Added persisted `fine_profile_rows` storage keyed by symbol, timeframe, candle time, base bucket size, and bucket price.
  - Added a fine-profile history API plus server action/storage helpers for batched row writes and range hydration.
  - Updated `FeedProvider` to aggregate live trades into tick-size per-candle profile rows, persist closed fully-covered candles in batches, and hydrate stored fine rows on refresh.
  - Updated the Volume Profile engine to build profiles from hydrated fine rows and only use live raw trades for current unpersisted candles.
  - Removed coarse footprint/candle Volume Profile fallback from default and custom profiles so missing fine data renders no misleading profile body.
  - Added a persisted default attached Volume Profile visibility toggle that does not affect custom/drawn profiles.
- **Why it changed**:
  - Fine-grain Volume Profile rendering had been decoupled from chart bucket size, but the fine source was not persisted as aggregated rows, so refreshes fell back to coarse profile structures.
- **Impact summary**:
  - New closed candles can restore fine Volume Profile history after refresh without replaying large raw-trade windows in the browser. Default/custom profiles now avoid inaccurate coarse fallback, and users can hide the default right-side profile while keeping custom profiles available.

## [2026-05-20] - Fix: Stored History Restore Hydration
- **What changed**:
  - Changed panel startup to restore stored DB candles first, then merge Binance history on top for freshness while live streams stay connected.
  - Added cursor-paged, newest-first raw-trade history hydration so large stored windows are not truncated at the oldest `50000` trades.
  - Added range-based stored footprint fallback hydration for candles that still have no raw-trade footprint cells at the active bucket size.
  - Added restore diagnostics for candle sources, raw-trade pages/counts/ranges, footprint bucket matches/misses, and final footprint coverage.
  - Extended history APIs/database helpers with raw-trade order/cursor pagination and range footprint-cell queries.
- **Why it changed**:
  - Stored rows existed, but refresh restore preferred Binance candles, ignored stored footprint cells, and capped raw-trade hydration to the oldest single page, leaving recent chart history without footprint/profile detail.
- **Impact summary**:
  - Refreshes should hydrate recent stored candles, footprints, CVD, and fine Volume Profile history from the database before relying on new realtime data, without rewriting the rendering architecture.

## [2026-05-20] - Improvement: CVD Panel Interactions
- **What changed**:
  - Added a draggable top-edge resize handle for the attached CVD panel height.
  - Added CVD-only vertical scale zooming from the delta axis and mouse wheel.
  - Added CVD-only vertical drag/pan inside the panel while leaving horizontal position controlled by the main chart sync.
  - Added double-click scale reset for returning the CVD viewport to automatic scaling.
- **Why it changed**:
  - Cumulative delta can expand beyond a comfortable visible range, so the lower indicator needs professional-style local scaling without breaking horizontal chart alignment.
- **Impact summary**:
  - The CVD panel can now be resized and navigated vertically for readability while candles, footprint rendering, main chart pan/zoom, and cross-panel time synchronization remain unchanged.

## [2026-05-20] - Feature: Dedicated CVD Panel
- **What changed**:
  - Added a lower CVD canvas panel under each chart panel with shared horizontal pan/zoom, crosshair sync, and bottom time axis rendering.
  - Added CVD series construction from existing footprint/order-flow delta with daily, session, or no reset plus optional smoothing.
  - Added CVD candle, bar, line, and histogram rendering modes with configurable positive/negative colors and auto/fixed scale controls.
  - Wired persisted CVD settings through Zustand, the panel toolbar quick toggle, and the chart settings window.
  - Hid the main chart time axis while the attached CVD panel is visible so both panels share one aligned bottom time axis.
- **Why it changed**:
  - Cumulative Volume Delta needed its own professional-style lower indicator panel instead of being mixed into the main chart overlays.
- **Impact summary**:
  - Each chart panel now shows realtime cumulative buying/selling pressure from the existing trade/footprint pipeline without adding per-trade React state churn or interfering with existing candles, footprint rendering, profiles, or signal overlays.

## [2026-05-19] - Feature: Liquidity Vacuum Detection
- **What changed**:
  - Added a dedicated Liquidity Vacuum result type and detector that scores fast, directional, low-participation movement between active volume anchors.
  - Added a lightweight canvas renderer for vacuum zones with subtle fill, directional edges, optional labels, revisit fading, and score/rank filtering.
  - Wired vacuum zones through panel state, feed recomputation, chart props, toolbar quick toggle, settings controls, sidebar stats, and the `V` keyboard toggle.
  - Kept the detector separate from Volume Profile LVN detection and existing LVN markers.
- **Why it changed**:
  - Auction inefficiency needs a zone-based signal that accounts for movement speed, footprint thinness, participation quality, delta behavior, and active anchors instead of only low-volume totals.
- **Impact summary**:
  - Charts can now highlight likely rejection/revisit areas created by fast, inefficient movement while preserving existing footprint, Volume Profile, LVN, absorption, exhaustion, iceberg, and liquidity-map behavior.

## [2026-05-19] - Fix: Long-Running Realtime Performance
- **What changed**:
  - Removed unused per-trade Zustand writes from the Binance aggTrade hot path.
  - Chunked stored raw-trade hydration so large DB restores yield back to the browser between batches.
  - Throttled raw-trade Volume Profile redraw revisions independently from footprint redraws.
  - Optimized the raw-trade Volume Profile engine with batched retention pruning, binary-search time-window lookup, and profile result caching.
  - Removed a high-frequency liquidity update console log.
- **Why it changed**:
  - Live trade handling and restored raw-trade hydration were doing too much synchronous React/store/profile work, which could block canvas interaction and grow CPU pressure during long sessions.
- **Impact summary**:
  - Persistence and realtime recovery remain intact, while long-running charts should stay more responsive during dragging, scrolling, hydration, and active Binance trade bursts.

## [2026-05-19] - Fix: Live-First Candle Consistency and Footprint Persistence Guards
- **What changed**:
  - Changed panel startup to subscribe to Binance candle/trade streams before background history loading.
  - Made Binance REST history secondary to live data by merging candles by open time and preserving closed candle state.
  - Removed the blocking canvas "Loading history..." render path so live candles can draw immediately.
  - Added aggregate-trade dedupe, cross-panel raw-trade storage dedupe, closed-candle storage dedupe, and a guard that skips storing footprint cells for the first partially observed realtime candle.
  - Rebuilt available footprint/profile history from stored raw trades instead of hydrating many per-candle stored footprint snapshots.
- **Why it changed**:
  - Persisted candle/footprint restore could replace accurate Binance state, hydrate partial footprint cells as complete data, and delay live rendering until history requests finished.
- **Impact summary**:
  - Candles now remain aligned to Binance/TradingView open times across timeframes, live rendering starts immediately, and storage request pressure is reduced while avoiding new partial-footprint corruption.

## [2026-05-18] - Improvement: Volume Profile Resolution Controls and Readability
- **What changed**:
  - Added persisted Volume Profile row-size settings in ticks, separate from chart candle/footprint bucket size.
  - Added a minimum row-height rendering control so high-detail profiles remain readable when rows become subpixel thin.
  - Updated visible, custom, and delta profile renderers to clamp bar widths to the actual available profile area and respect the new row-height setting.
  - Wired the new settings through `ChartSettingsDropdown`, store persistence, `ChartPanel`, and `ChartCanvas`.
- **Why it changed**:
  - Fine raw-trade profile aggregation made profiles more precise, but very small rows and width scaling made the rendered profile hard to read and visually inconsistent.
- **Impact summary**:
  - Users can now tune profile aggregation detail independently from chart buckets while keeping profile width, opacity, scaling, POC/VA/LVN, and delta rendering compatible with the existing settings system.

## [2026-05-18] - Improvement: Fine-Grain Volume Profile Aggregation
- **What changed**:
  - Added a raw-trade Volume Profile engine that aggregates Binance `aggTrade` data at tick-size resolution behind a replaceable `VolumeProfileSource` interface.
  - Parsed Binance aggregate trade ids, stored raw trades in an idempotent `raw_trades` table, added a raw-trade history API, and hydrated stored trades on panel startup.
  - Updated `FeedProvider`, `ChartEngineContext`, `ChartPanel`, and `ChartCanvas` so visible/custom profiles use fine raw-trade data first and fall back to the existing footprint/candle profile when raw trades are unavailable.
  - Kept chart candles, footprint buckets, absorption/exhaustion/iceberg logic, and profile drawing controls on their existing bucket behavior.
- **Why it changed**:
  - Volume Profile rows were tied to chart bucket size, so larger auto buckets made the profile blocky and less precise.
- **Impact summary**:
  - Volume Profile rendering can now stay smooth at `tickSize` resolution even when chart/footprint buckets are larger. The new per-panel source is isolated today but structured so a shared raw-trade cache can replace it later without rewriting rendering integration.

## [2026-05-18] - Improvement: Drawing Price Label Placement
- **What changed**:
  - Moved horizontal ray price labels from the right price scale to the ray's left starting point, slightly above the line.
  - Moved box top/bottom price labels to the left edge outside the rectangle, above the top edge and below the bottom edge.
  - Kept existing drawing creation, movement, resizing, deletion, and toolbar behavior unchanged.
- **Why it changed**:
  - Multiple drawing labels on the right-side price scale became visually crowded.
- **Impact summary**:
  - Drawing labels are now clearer and stay associated with their own line or box instead of stacking on the chart price axis.

## [2026-05-18] - Feature: Compact Drawing Tools, Horizontal Rays, and Boxes
- **What changed**:
  - Added a new right-extending horizontal ray drawing mode that starts at the clicked candle position, extends to the right edge, and renders a price-axis label.
  - Added a box drawing mode with live drag preview, top/bottom price labels, delete dot, hover handles, movement, and edge resizing.
  - Extended drawing state with `horizontal-ray` and `box` while leaving the existing horizontal and vertical line cases intact.
  - Replaced the separate profile, line, and measurement buttons in `PanelToolbar.tsx` with a compact drawing-tool dropdown.
- **Why it changed**:
  - More drawing tools were making the per-panel header crowded and hard to use while resizing or dragging chart panels.
- **Impact summary**:
  - Users can create labeled right-side rays and labeled price boxes from the drawing selector. Existing horizontal and vertical line tools still use their original creation and delete behavior.

## [2026-05-18] - Fix: Custom Volume Profile Interaction and LVN Support
- **What changed**:
  - Added shared custom profile hit-testing in `ChartCanvas.tsx` so cursor state, drag blocking, move/resize starts, and crosshair suppression use the same profile bounds.
  - Fixed the cursor fallback that was overwriting profile `grab` / resize cursors with the default chart crosshair.
  - Stabilized the lock/remove profile overlay position by clamping it inside the chart area.
  - Repaired side resizing by clamping left/right and top/bottom drags so the profile range cannot invert or collapse below the minimum size.
  - Added LVN detection to `buildProfile` and rendered LVN dashed levels in both visible and custom volume profiles.
- **Why it changed**:
  - Later interaction refactors left profile hover state disconnected from cursor/crosshair and resize start behavior, and the profile metrics did not expose low-volume nodes.
- **Impact summary**:
  - Custom Volume Profile interactions now show the correct cursor, block chart crosshair/panning while interacting, expose lock/remove controls reliably, resize from all four sides, and display LVNs without changing unrelated chart systems.

## [2026-05-18] - Fix: Reliable Remote Candle Snapshot Storage
- **What changed**:
  - Added `persistClosedCandleSnapshot` in `lib/db/database.ts` to write the candle row, footprint rows, candle delta row, and `last_candle_stored` metadata in one `db.batch(..., 'write')`.
  - Added a very small transient-error retry around that batch for remote Turso write failures such as `fetch failed`, timeouts, and connection resets.
  - Updated `lib/db/marketStorage.ts` to use the new single-write helper instead of separate sequential insert calls.
  - Tightened the storage error wording in `components/FeedProvider.tsx` so failed save requests are easier to distinguish from chart/runtime issues.
- **Why it changed**:
  - Remote Turso writes were happening as multiple separate requests, so a single timeout could leave one closed candle partially saved or not saved at all.
- **Impact summary**:
  - Closed-candle persistence is now atomic per candle snapshot and gets one small retry for transient network issues, which should reduce intermittent missing entries without changing chart behavior.

## [2026-05-18] - Feature: DB History APIs, Cleanup Job, and Startup Restore
- **What changed**:
  - Added a server cleanup job that runs on startup and then on the configured retention interval.
  - Added dynamic history API routes for stored candles, per-candle footprint cells, and collector status.
  - Extended database helpers with recent-candle loading, bucket-size footprint filtering, collector metadata reads, candle counts, and local DB size reporting.
  - Updated `FeedProvider` to load stored candles first on connect, hydrate available stored footprint cells into `AggregationEngine`, and fall back to Binance history when no stored data exists.
  - Added shared market validation constants and a pm2 Raspberry Pi deployment note.
- **Why it changed**:
  - Task 3 requires persisted rows to be queryable and used by the frontend after refresh, while also keeping local database growth bounded for 24/7 Pi operation.
- **Impact summary**:
  - Refreshes can now repopulate the chart from stored database candles instead of only Binance history. Footprint cells are available through the API and restored into the engine when the stored bucket size matches. Cleanup starts with the server process; Pi deployment commands are documented but reboot survival was not executed in this Windows workspace.

## [2026-05-18] - Feature: Closed-Candle Database Storage
- **What changed**:
  - Added `lib/db/marketStorage.ts` to orchestrate best-effort storage for closed candles, serialized footprint cells, candle delta summaries, and `last_candle_stored` metadata.
  - Added `lib/actions/storageActions.ts` as the server action bridge so the client-side `FeedProvider` can request storage without importing server-only libSQL code.
  - Updated `components/FeedProvider.tsx` to serialize footprint cells from `AggregationEngine` when a candle closes and fire the storage action without awaiting it.
  - Added the database startup confirmation log to `instrumentation.ts`.
- **Why it changed**:
  - Task 2 requires live feed candle-close events to persist existing OHLCV and footprint data to Turso/libSQL without creating a new data pipeline or blocking chart updates.
- **Impact summary**:
  - Active-view candles now store server-side as a side effect of the existing feed flow. Storage failures are logged and swallowed so live chart rendering can continue. Direct verification inserted one candle, two footprint cells, and one candle delta row.

## [2026-05-18] - Feature: Turso/libSQL Database Foundation
- **What changed**:
  - Installed `@libsql/client` and updated the pnpm lockfile.
  - Added `lib/db/database.ts` with a singleton libSQL client, local file-directory setup, idempotent schema creation for `candles`, `footprint_cells`, `candle_delta`, and `collector_meta`, plus indexes and startup metadata rows.
  - Added exported helper functions for candle inserts, footprint batch inserts, candle delta inserts, retention cleanup, historical candle reads, footprint cell reads, and collector metadata updates.
  - Added `.env.local` defaults for local file-mode storage and retention hours.
  - Added `instrumentation.ts` and enabled Next's instrumentation hook so Next initializes the database during Node server startup.
  - Added `scripts/testDb.ts` to verify schema creation and a candle round-trip.
  - Ignored generated `data/` database files in `.gitignore`.
- **Why it changed**:
  - Task 1 requires the local Turso/libSQL foundation before later storage and API tasks can persist market data.
- **Impact summary**:
  - The app now has a reusable database layer and startup schema initialization. Verification created `data/market.db`, returned the test candle successfully, and rerunning the script did not create duplicate candle keys.

## [2026-05-17] - Fix: Iceberg Detection Logic and Key Lookup
- **What changed**:
  - **Key Normalization**: Fixed a critical floating-point precision bug in [engine.ts](file:///c:/Users/d/Documents/orderflowApp/lib/iceberg/engine.ts) by normalizing the scanned loop `bucketPrice` using `normalizePriceToBucket` before retrieving the cell from the `cells` Map.
  - **Volume Math Bug**: Corrected the double-division bug where average bucket volume was divided by `lookbackWindow` inside `getAverageBucketVolume` and then the ratio was divided again.
  - **Historical Data Safety**: Restricted `visitedVolumes` to only push candle volume if the footprint candle has active, populated cell data, preventing historical candles (with empty footprint cell maps) from corrupting the Volume Stability standard deviation.
- **Why it changed**:
  - Precision drift on loops, combined with the lack of price-level footprint cells on historical REST API candles, prevented any icebergs from being detected.
- **Impact summary**:
  - Iceberg levels now successfully scan and detect real-time passive absorption events correctly after live trade data is accumulated, with accurate scoring metrics and no false-positive inflation.

## [2026-05-17] - Feature: Iceberg Visual Markers, Tooltip, and Controls (Task 2)
- **What changed**:
  - Added `lib/draw/drawIceberg.ts` to render iceberg levels as horizontal defense lines with rank-based opacity/style, confirmed tints, end caps, labels, and absorption handoff extensions.
  - Added `components/chart/IcebergTooltip.tsx` and wired 2D hover detection in `ChartCanvas.tsx` for iceberg line spans.
  - Passed iceberg settings and levels from `ChartPanel.tsx` into the canvas renderer.
  - Added persisted iceberg display settings: show suspected, show labels, and show tint, with store persistence bumped to v18.
  - Added ICE toolbar toggle, `K` keyboard toggle, and retained `I` console logging for level inspection.
  - Added Iceberg Detection controls to `ChartSettingsDropdown.tsx` and iceberg stats to `Sidebar.tsx`.
  - Added detection window start/end indices to `IcebergLevel` so markers span the analyzed candle range.
- **Why it changed**:
  - Iceberg signals are price-level patterns across multiple candles, so they need horizontal level visualization, hover explanation, and controls separate from candle-specific absorption/exhaustion markers.
- **Impact summary**:
  - Iceberg levels now render on the chart with configurable visual noise controls and sidebar summaries. No changes were made to unrelated rendering systems.

## [2026-05-17] - Feature: Iceberg Detection Scoring Engine (Task 1)
- **What changed**:
  - Added `types/iceberg.ts` with structured iceberg level output, ranks, side classification, signal breakdowns, active/provisional flags, and reasons.
  - Added `lib/iceberg/engine.ts` with per-price-bucket iceberg scoring across a 5-20 candle lookback window using volume accumulation, side consistency, price persistence, delta neutralization, and volume stability.
  - Wired per-panel `IcebergEngine` instances into `FeedProvider`, rebuilding on history load, bucket size changes, lookback changes, and each closed candle.
  - Added store settings/state for `icebergEnabled`, `icebergMinScore`, `icebergLookback`, and session-only `icebergLevels`, persisted relevant settings as store v17.
  - Exposed `icebergEngine` through `ChartEngineContext` and added the `I` keyboard shortcut to log detected levels, scores, and reasons.
- **Why it changed**:
  - Iceberg detection needs a multi-candle, price-level analysis unit instead of the single-candle absorption/exhaustion flow.
- **Impact summary**:
  - No chart rendering was added yet. Closed candles now produce top iceberg levels in state and console verification output for Task 1 validation.
