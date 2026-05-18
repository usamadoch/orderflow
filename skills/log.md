# OrderFlow Chart - Change Log

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
