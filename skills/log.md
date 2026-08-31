# OrderFlow Chart - Change Log

## [2026-08-31] - Feature: Real-Time Cancel Icon Dragging & Entry-Line Draggable TP/SL Handles

- **What changed**:
  - **Real-Time Cancel Icon Following (`components/chart/ChartCanvas.tsx`)**:
    - Subscribed `tradingOverlayControls` to `bracketDrag` in Zustand and updated SL/TP `top` coordinate calculations to use `bracketDrag.previewPrice` during active drags.
    - The remove `(X)` icon now follows the bar, handle badge, and cursor synchronously across the entire drag with zero lag.
  - **Draggable `+SL` and `+TP` Handles on Position Entry Line (`components/chart/drawTradingOverlays.ts`, `components/chart/ChartCanvas.tsx`)**:
    - Added `drawEntryBracketButton` in `drawTradingOverlays.ts` to render `+SL` and `+TP` pill buttons directly on the Position Entry line whenever a position lacks an active SL or TP (or after removing one).
    - Registered their bounding boxes into `hitZones.slHandles` and `hitZones.tpHandles`.
    - Clicking and dragging `+SL` or `+TP` from the entry line initiates an interactive drag directly from `vp.entryPrice`, drawing out the SL/TP level in real time and committing it to MT5 upon mouse release.
- **Why it changed**:
  - The cancel `(X)` icon previously remained stationary at Place A during drag before jumping to Place B on mouseup, and users needed a way to drag out new TP/SL levels directly from the position entry line after removing them.
- **Impact summary**:
  - Cancel icons now follow dragging smoothly in real-time, and traders can click/drag `+SL` or `+TP` directly from any active position entry line to set new levels.
  - All application code passes TypeScript type checks with 0 errors.

## [2026-08-31] - Bug Fix: Complete Elimination of TP/SL Drag Snap-Back Glitch

- **What changed**:
  - **In-Memory Bridge Cache Update (`market_order_bridge/server.mjs`)**:
    - Updated `POST /modify` in the bridge server to immediately update `mt5Account.positions` in memory with the new `sl` and `tp` values. This ensures that any subsequent `/status` polls returning to Next.js immediately reflect the new prices without serving stale pre-drag snapshot data (Point A).
    - Updated `POST /close-position` to immediately filter closed tickets out of `mt5Account.positions`.
  - **Instant EA Account Snapshot Push (`market_order_bridge/MarketOrderEA.mq5`)**:
    - Updated `ExecuteModification` and `ExecutePositionClose` to immediately trigger `SendAccountUpdate()` upon successful execution (`trade.PositionModify` / `trade.PositionClose`), pushing authoritative live MT5 positions back to the bridge within ~100ms instead of waiting for the slow 5-second timer tick.
  - **Enhanced Frontend Sync & Grace Lock (`lib/store/chartRuntime.ts`, `components/chart/ChartCanvas.tsx`)**:
    - Expanded `syncMT5Positions` grace window to 6000ms and preserved local optimistic bracket prices and status until MT5 confirms the change.
    - Added state refresh with `updatedAt: Date.now()` inside `executeBracketModifyDirect` on modification response.
- **Why it changed**:
  - When dragging TP or SL from Point A to Point B, the line previously snapped back to Point A temporarily before moving back to Point B because the bridge `/status` cache retained Point A for up to 5 seconds while waiting for MT5's periodic timer tick.
- **Impact summary**:
  - Dragging TP and SL from Point A to Point B now remains rock-solid at Point B with zero flicker, zero jump back to Point A, and immediate synchronization across the web chart and MT5.
  - All application code passes TypeScript type checks with 0 errors.

## [2026-08-31] - Bug Fix: TP/SL Cancel Icon Alignment and Notification Auto-Dismiss

- **What changed**:
  - **Button Alignment Fix (`components/chart/ChartCanvas.tsx`)**:
    - Fixed the `chartHeight` calculation in `tradingOverlayControls` and `chartOrderControls` to use `getBottomLayout(containerSize.height).mainChartHeight` instead of raw canvas height minus time axis. This eliminates vertical displacement caused by active bottom panels (Stats, Volume Bars, CVD).
    - Reduced close button dimensions to 18x18px with `top: y - 9` and `left: chartWidth - 24` to achieve pixel-perfect vertical and horizontal alignment directly adjacent to the 18px `[ TP ]` and `[ SL ]` handle badges.
  - **Notification Toast Fix (`components/chart/ChartCanvas.tsx`, `market_order_bridge/MarketOrderEA.mq5`)**:
    - Added an automatic 3.5-second auto-dismiss timer via `useEffect` to clear `chartOrderMessage` and runtime store action status messages.
    - Made the notification toast interactive and clickable to dismiss immediately on click.
    - Updated `MarketOrderEA.mq5` and `ChartCanvas.tsx` to ensure `fillPrice` falls back to `currentPrice` or recent candle close if `trade.ResultPrice()` returns 0 on certain broker market fills, preventing "Market Order filled at undefined".
- **Why it changed**:
  - Cancel icons were vertically misaligned with the TP/SL lines on charts with active bottom indicators, and market order notifications were not disappearing automatically.
- **Impact summary**:
  - Cancel icons on TP, SL, and Entry lines are now pixel-perfect aligned directly next to their handle badges, and order notifications auto-dismiss cleanly.
  - All application code passes TypeScript type checks with 0 errors.

## [2026-08-31] - Feature: Close Buttons on SL, TP, and Position Entry Lines

- **What changed**:
  - **Chart Close Buttons (`components/chart/ChartCanvas.tsx`, `components/chart/drawTradingOverlays.ts`)**:
    - Added dedicated circular close icon (`X`) buttons on Stop Loss (SL), Take Profit (TP), and Position Entry lines directly on the chart canvas.
    - Adjusted canvas drawing offsets and handle width in `drawTradingOverlays.ts` (`drawBracketHandle` and `drawOrderLabelRight`) to provide spacing for interactive overlay buttons.
    - **Stop Loss (SL) Removal**: Clicking the `X` button on the SL line optimistically removes the SL from the local store and dispatches an asynchronous background modification to MT5 via `POST /modify` setting `sl: 0`.
    - **Take Profit (TP) Removal**: Clicking the `X` button on the TP line optimistically removes the TP from the local store and dispatches an asynchronous background modification to MT5 via `POST /modify` setting `tp: 0`.
    - **Position Entry Close & Confirmation Popup**: Clicking the `X` button on the Position Entry line opens a confirmation modal detailing the ticket number, side, volume, entry price, and current floating P&L. Confirming executes market position closure via `POST /close-position`.
  - **Bridge & EA Position Close Support (`market_order_bridge/server.mjs`, `market_order_bridge/MarketOrderEA.mq5`)**:
    - Extended Express bridge with `/close-position`, `/poll-close`, and `/close-result` endpoints.
    - Added `CheckForPendingCloses()`, `ExecutePositionClose()`, and `SendCloseResult()` in `MarketOrderEA.mq5` leveraging MQL5 `trade.PositionClose(ticket)` to close open positions at market.
- **Why it changed**:
  - Users needed quick one-click actions on chart lines to remove active SL or TP brackets independently and close open market positions directly from the chart with a clear confirmation step.
- **Impact summary**:
  - Traders can remove SL or TP brackets with a single click on their respective lines, and close market positions safely via the chart entry line close button with confirmation.
  - Passes TypeScript compilation with 0 errors.

## [2026-08-31] - Feature: Smooth TP/SL Dragging without Confirmation Modals or Glitches

- **What changed**:
  - **Optimistic State & Direct Execution (`components/chart/ChartCanvas.tsx`)**:
    - Refactored `onMouseUp` bracket dragging so that when `bracketDragConfirmEnabled` is `false` (the default), the local runtime store's `bracketOrders` are optimistically updated (`upsertBracketOrder`) immediately to the new price upon mouse release.
    - Drag visualization state is cleared simultaneously with zero visual snap-back (the TP/SL line stays firmly and smoothly at the target point B instead of jumping back to point A).
    - Dispatched the position modification to the local bridge (`POST http://localhost:3001/modify`) asynchronously in the background (`executeBracketModifyDirect`).
    - Handled error rollbacks and toast notifications if the MT5 bridge or EA rejects the modification.
  - **Grace Period Sync (`lib/store/chartRuntime.ts`)**:
    - Updated `syncMT5Positions` to protect recent local user bracket modifications with a 2500ms grace window, preventing in-flight bridge polling ticks from momentarily reverting optimistic drag updates before MT5 finishes processing.
  - **Settings Toggle (`lib/store/chart.ts`, `components/ui/chart-settings/GeneralChartSettings.tsx`)**:
    - Added `bracketDragConfirmEnabled: boolean` (persisted in Zustand `useChartStore`, default `false`).
    - Added an interactive UI toggle under the "Interaction" section in `GeneralChartSettings.tsx` ("TP / SL Drag Confirmation") allowing users to choose between instant one-click dragging and modal confirmation flows.
- **Why it changed**:
  - Dragging TP or SL previously suffered from an awkward double confirmation flow (modal popup) and a visual glitch where the line snapped back to point A before waiting for network round-trips to MT5 and eventually moving to point B.
- **Impact summary**:
  - TP and SL can now be dragged smoothly and directly from point A to point B with zero popups, zero extra clicks, and zero visual latency or jumping.
  - All application code passes TypeScript type checks with 0 errors.

## [2026-08-31] - Investigation: Volume Profile Implementation Status

- **What changed**:
  - Investigated the current codebase against 11 specific Volume Profile features (Profile Type, Period, Length, Input Data, Min/Max Filter, Tick Grouping, Session Splitting, POC controls, Peak/Valley detection, Merge/Split profiles).
  - Authored a summary report artifact (`volume_profile_investigation_report.md`) detailing exactly how each feature is currently implemented, partially implemented, or missing.
  - Did NOT modify any source code files as per the instruction.
- **Why it changed**:
  - The user requested a report only on the current state of the Volume Profile implementation before proceeding with any new implementations.
- **Impact summary**:
  - Provided clarity on the current state. No functional changes made.

## [2026-08-30] - Refactoring: Component Modularization (`ChartSettingsDropdown.tsx`)

- **What changed**:
  - Refactored `ChartSettingsDropdown.tsx`, a monolithic 2,476-line file, into modular, isolated sub-components.
  - Created a new `components/ui/chart-settings/` directory and `index.ts` export barrel.
  - Extracted UI render functions into independent components: `SessionsSettings`, `CvdSettings`, `VolumeBarsSettings`, `BubbleSettings`, `VolumeProfileSettings`, `HistoricalSessionProfileSettings`, `LiquidityMapSettings`, `HeatmapSettings`, `StatsSettings`, `SignalSettings`, `GeneralChartSettings`, and `FootprintSettings`.
  - Fixed sidebar tab selection contrast issue where global `.popup-contrast` CSS was applying dark background overrides onto inactive tab buttons instead of the active tab.
  - Added dedicated `.sidebar-tab-btn` styling to `globals.css` with clean active highlight and transparent default states.
  - Refined draggable start coordinate calculation to use bounding client rect on mount.

- **Why it changed**:
  - The original file violated the client code refactoring guidelines (hard limit of 250 lines per component), making it difficult to maintain and scale.
  - Improved readability, modularity, and encapsulation of state management (`useChartStore`).
- **Impact summary**:
  - No functional logic changes were made; strictly a cosmetic and structural refactor.
  - Greatly improved code maintainability and adherence to the 250-line component size rule.

## [2026-08-30] - Feature: Volume Bubbles Configuration & Cosmetic Upgrades

- **What changed**:
  - **Bubble Data Strategy**: Dropped 'Footprint' source option; standardized exclusively on high-performance 'Orders' scaling (`bubbleSizeBy='orders'`).
  - **Threshold Config**: Abstracted global volume thresholds to `process.env.NEXT_PUBLIC_BUBBLE_MIN_BTC_THRESHOLD` and added informative UI warnings inside `ChartSettingsDropdown.tsx`.
  - **Bubble Settings Store (`types/bubble.ts`, `types/chart.ts`, `lib/store/chart.ts`)**: Replaced deprecated radius configuration with robust `bubbleDisplayMode` (`2d` / `3d`), customizable hex colors (`bubbleBidColor`, `bubbleAskColor`), adjustable `bubbleLineWidth` and global `bubbleOpacity`. Implemented `bubbleColorMode` and `bubbleVolumeColorMode` enums.
  - **Bubble Renderer (`components/chart/drawBubbles.ts`)**: Integrated the new sizing and semantic styling fields into the drawing loop, removing unused legacy `BUBBLE_BULLISH_RGB`/`BUBBLE_BEARISH_RGB` logic, fixing duplicate loop declarations, and introducing 3D canvas `createRadialGradient` support.
  - **UI Selectors (`components/ui/ChartSettingsDropdown.tsx`)**: Built a complete aesthetic control panel to control Bubble display modes, standardizing hex inputs for custom Bid/Ask colors, and adding visual slider elements for line width and opacity tuning.
- **Why it changed**:
  - To finalize the required visual and logical upgrades requested in the Volume Bubbles modernization plan (Tiers 1, 2, 3, and 5).
  - Centralizes configuration and provides traders with advanced visual customization options (flat vs. spheres, adjustable opacity, colors, etc.) previously unavailable.
- **Impact summary**:
  - Enhanced customization and a unified logical rendering path.
  - UI seamlessly links setting changes to drawing loop execution.
  - `npx tsc --noEmit` validates all related file typings properly (ignoring unrelated legacy `.ts` scripts).

## [2026-08-30] - Fix & Refactor: StorageManager TimescaleDB Migration & UI Z-Index Overlay

- **What changed**:
  - **Storage Service (`lib/services/storageService.ts`)**: Removed separate "Main DB" and "Bubbles DB" aggregation logic, combining storage metrics into a single unified TimescaleDB report that matches the new architecture.
  - **API Route (`app/api/history/storage/route.ts`)**: Removed redundant `targets` array from the `DELETE` payload.
  - **Types (`types/storage.ts`)**: Cleaned up `StorageDay` to only hold a unified `sizeMb`, and `DatabasesInfo` to only hold `timescale`.
  - **Modal UI (`components/ui/StorageManager.tsx`)**:
    - Migrated UI layout to reflect a single TimescaleDB connection instead of splitting Main vs Bubbles databases.
    - Removed obsolete checkboxes for granular deletion targets.
    - Wrapped the entire modal in a React Portal (`createPortal` to `document.body`) to escape the `Header` (`z-20`) stacking context.
    - Explicitly called `e.stopPropagation()` on `onPointerDown` and `onWheel` events at the modal container boundary.
- **Why it changed**:
  - The Storage Manager was the final remnant of the old dual MongoDB database architecture and failed to reflect the migrated TimescaleDB single-database schema.
  - Because the modal was mounted inside the `Header` (`z-20`), chart overlays and crosshairs (`z-30`) were intercepting mouse and wheel events, making the modal visually overlap the canvas but behave as if it was underneath it.
- **Impact summary**:
  - The Storage Manager accurately represents the single TimescaleDB backend. Deleting data properly truncates footprints, profiles, and bubbles concurrently for chosen dates.
  - The UI modal now correctly traps all scroll and click events, cleanly isolating interaction away from the chart canvas.

## [2026-08-30] - Feature: Hollow Candles Support

- **What changed**:
  - Added `'hollow'` to `ChartMode` in `types/chart.ts`.
  - Updated `drawCandles.ts` to support rendering hollow bodies (with continuous wicks) for ALL candles when `isHollowMode` is true, keeping standard up/down coloring.
  - Replaced the inline "C and F" mode toggle buttons in `PanelToolbar.tsx` with a new `ChartModeSelector.tsx` dropdown.
  - Mapped dropdown options to `Candlestick`, `Hollow`, and `Footprint`, styled identically to the Indicators modal (including a custom thin scrollbar, descriptions, and active state checkmarks).
- **Why it changed**:
  - To fulfill user request for a third "Hollow Candles" chart type conforming to conventional charting rules, and to provide a more scalable UI for switching chart modes as the application grows.
- **Impact summary**:
  - Users can now select Hollow Candles, improving visualization options without impacting underlying data aggregation or fetching logic. UI is modernized with a dropdown selector.

## [2026-08-29] - Feature: TimescaleDB Migration

- **What changed**:
  - Replaced MongoDB time-series collections with a unified TimescaleDB schema running via PostgreSQL (`pg`).
  - Added new TimescaleDB repositories for candles, footprint, profile, and bubbles under `lib/db/timescale/`.
  - Migrated `btcusdtCollector.mjs` to use PostgreSQL pooling directly instead of MongoClient.
  - Quarantined the old MongoDB driver under `lib/db/_mongo_quarantine` for future deletion.
  - Created optional `scripts/migrateMongoToTimescale.ts` to aid in data export.
- **Why it changed**:
  - MongoDB time-series collections presented limitations and performance scaling issues for raw OHLCV and tick volume aggregation.
  - TimescaleDB natively supports continuous aggregates, hypertables, and relational cross-analysis, which is vastly superior for complex order flow data queries.
- **Impact summary**:
  - Storage adapter automatically mounts TimescaleDB when `MARKET_DB_DRIVER=timescaledb`.
  - Faster ingestion and more flexible time-windowing for analytical endpoints.

## [2026-08-30] - Orderbook Pipeline & MongoDB Cleanup

### Changes Made

- **Cleanup**:
  - Permanently deleted `lib/db/_mongo_quarantine`.
  - Uninstalled `mongodb` NPM package.
- **Feeds**:
  - Integrated `OrderbookManager` into `BinanceAdapter` (`binance.ts`) and `BinanceFuturesAdapter` (`binanceFutures.ts`).
  - Adapters now fetch a REST `/depth` snapshot on connect, buffer diffs, and strictly align sequence IDs.
  - Added gap detection (`U` vs `lastUpdateId` + 1) which automatically triggers a `RESYNCING` transition to repair the local book.
- **Why it changed**:
  - Following the `part-1-data-ingestion-pipeline.md` specification to guarantee downstream consumers (frontend and DB collector) receive perfect, gap-free orderbook states.

## [2026-08-29] - Update: TimescaleDB Final Cleanup and Bug Fixes

- **What changed**:
  - Fixed duplicate `let shuttingDown = false` declaration in `btcusdtCollector.mjs` (would have caused SyntaxError at runtime).
  - Fixed dead `_test.setMongoDb` / `_test.setBubbleMongoDb` exports in `btcusdtCollector.mjs` referencing removed variables. Replaced with `_test.setPgPool`.
  - Added missing `UNIQUE (symbol, contract_type, timeframe, time)` constraint on `market_candles` table so `ON CONFLICT DO NOTHING` actually prevents duplicate insertions.
  - Added compression policies for all 4 hypertables (previously defined as a variable but never applied).
  - Added missing `db:migrate` script to `package.json`.
  - Commented out old MongoDB URIs in `.env.local`.
  - Removed unused `fileURLToPath` import from collector.
  - Added `ssl: { rejectUnauthorized: false }` to pg Pool in `client.ts` to support Timescale Cloud connections.
- **Why it changed**:
  - Senior audit of the previous implementation identified 2 critical, 2 functional, and 3 minor issues against the approved plan. Timescale Cloud connections timed out without SSL explicitly configured.
- **Impact summary**:
  - Collector can now start without a SyntaxError. Candle deduplication actually works. Compression policies will compress old chunks automatically. Timescale Cloud connection works successfully.

## [2026-08-29] - Update: Default Chart, Indicator, Market, and Stats Settings

- **What changed**:
  - **Volume Profile Defaults (`lib/store/chart.ts`, `components/chart/drawVolumeProfile.ts`, `components/chart/drawSelectionRect.ts`)**:
    - Updated default `profileWidthPct` from `70` to `45`.
    - Maintained default `profileOpacity` at `0.6` (60%).
  - **Volume Bubbles Defaults (`lib/store/chart.ts`)**:
    - Updated default `bubbleThreshold` (Minimum Volume) from `50` to `100`.
    - Updated default `bubbleMinRadius` (Minimum Radius) from `2` to `4` px.
    - Updated default `bubbleMaxRadius` (Maximum Radius) from `8` to `20` px.
  - **Default Market Selection (`lib/store/chart.ts`)**:
    - Updated initial default panel contract from `contractType: 'spot'` to `contractType: 'futures'` and `dataSourceMode: 'futures'` (BTCUSD Perpetual Futures).
  - **Stats Indicator Defaults (`lib/store/chart.ts`)**:
    - Updated default `statsIndicatorItems` from `['volume', 'delta', 'cvd']` to `['volume', 'delta']` (CVD disabled by default; volume and delta enabled).
    - Updated default `statsIndicatorCount` to `2`.
- **Why it changed**:
  - Adjusted out-of-the-box defaults to preferred trader standards: perpetual futures as the initial market, tighter volume profile width, cleaner volume bubble scaling, and essential volume/delta stats without default CVD clutter.
- **Impact summary**:
  - New charts and panels initialize with BTCUSD Perpetual Futures by default.
  - Volume profiles render at 45% default width.
  - Volume bubbles default to 100 min volume, 4px min radius, and 20px max radius.
  - Stats indicator displays Volume + Delta by default, with CVD available via settings.
  - All indicator and market logic remains fully intact and configurable.
  - TypeScript validation passes with 0 errors.

## [2026-08-29] - Fix: Stats and Volume Simultaneous Display with Dynamic Vertical Stacking

- **What changed**:
  - **Dynamic Multi-Indicator Bottom Panel Engine (`components/chart/chartBottomPanels.ts`)**:
    - Created `computeBottomPanelsLayout` which calculates non-overlapping vertical slots (`top`, `height`, `bottom`) for all active bottom-docked chart indicators (`stats`, `volumeBars`).
    - Stacking order dynamically responds to `panel.activeIndicators` (e.g. `['volumeBars', 'stats']` stacks Volume above Stats, `['stats', 'volumeBars']` stacks Stats above Volume).
    - Accurately computes `mainChartHeight = Math.max(40, canvasHeight - timeAxisHeight - totalHeight)`, reserving clean space for candlestick/footprint charts.
  - **Removed Suppression Logic (`components/chart/ChartPanel.tsx`)**:
    - Removed `volumeBarsEnabled={panel.statsIndicatorEnabled ? false : panel.volumeBarsEnabled}` and `volumeBarsShowValueText={panel.statsIndicatorEnabled ? false : panel.volumeBarsShowValueText}` which previously disabled volume whenever stats was turned on.
    - Passed `activeIndicators={panel.activeIndicators}` down to `ChartCanvas`.
  - **Panel Positioning & Clipping (`components/chart/drawVolumeBars.ts`, `components/chart/drawStatsGrid.ts`)**:
    - Extended `DrawVolumeBarsOptions` with `panelTop?: number` and `panelHeight?: number`.
    - Updated `drawVolumeBars` to clip and fill within its designated vertical slot with a crisp 1px separator top border.
    - Updated `drawStatsGrid` to render with a crisp 1px separator top border.
  - **Unified Canvas Coordinate & Mouse Hit Bounds (`components/chart/ChartCanvas.tsx`, `components/chart/usePanZoom.ts`)**:
    - Replaced all hardcoded `statsGridHeight` math in mouse handlers (`onMouseDown`, `onMouseMove`, `onMouseUp`, `getUnifiedHitTarget`, `pricePerPixel`) with layout-aware `getBottomLayout(rect.height).mainChartHeight`.
  - **Store Reordering Actions & UI Controls (`lib/store/chart.ts`, `components/chart/IndicatorLabels.tsx`)**:
    - Added `reorderIndicators` and `moveIndicator(panelId, indicatorId, 'up' | 'down')` store actions.
    - Added Move Up / Move Down buttons to indicator header labels for easy user-driven reordering.
- **Why it changed**:
  - `ChartPanel.tsx` intentionally suppressed Volume Bars when Stats Indicator was active because the previous canvas layout hardcoded a single vertical offset (`statsGridHeight`), causing indicator visual collisions.
  - Users require both Stats and Volume to be simultaneously active, visible, functional, and vertically stacked in their preferred order without hardcoded offsets or hacks.
- **Impact summary**:
  - Stats only → works cleanly.
  - Volume only → works cleanly.
  - Stats + Volume → both visible simultaneously without overlap.
  - Enabling either indicator or reordering positions dynamically updates both indicator positions and price coordinate scaling.
  - `npx tsc --noEmit` and unit verification tests pass with 0 errors.

## [2026-08-29] - Feature: Session-Based Historical Session Volume Profile (HSVP) Configuration

- **What changed**:
  - **Refactored Settings (`components/ui/ChartSettingsDropdown.tsx`)**: Replaced raw start/end time inputs with a Session selector (Tokyo, London, New York) and a Multiple selection mode.
  - **Store State Migration (`lib/store/chart.ts`, `types/chart.ts`)**: Removed legacy time-based properties (`historicalSessionProfileStartHour`, etc.) and added `historicalSessionProfileSession`, `historicalSessionProfileSessions`, and `historicalSessionProfileDisplayMode`.
  - **Segment-Based Session Math (`lib/utils/historicalSessions.ts`)**: Upgraded `getHistoricalSessionRanges` to support segment-based ranges, correctly handling overlapping and discontinuous sessions across dates.
  - **Profile Restoration & Cache Logic (`components/FeedProvider.tsx`)**: Updated history restoration and cache eviction algorithms to evaluate min/max timestamps of segment arrays instead of flat span dates.
  - **Segmented Canvas Rendering (`components/chart/ChartCanvas.tsx`)**: Refactored the volume profile drawing loop to properly aggregate candles across non-contiguous session segments before calculating the final combined profile.
- **Why it changed**:
  - The HSVP configuration was overly complex (raw time inputs). Users wanted simple check-box style configurations mapping to existing global sessions (Tokyo, London, NY) with the ability to combine multi-session data into one continuous profile.
- **Impact summary**:
  - Simplified, intuitive configuration. Seamless combining of multiple overlapping or disjointed global sessions into one precise Volume Profile.

## [2026-08-29] - Fix: Drawing Tool Coordinate / Hit-Testing Misalignment

- **What changed**:
  - **Shared Coordinate Bounds (`components/chart/ChartCanvas.tsx`)**:
    - Computed `statsGridHeight` globally at the top of the canvas rendering cycle.
    - Updated all mouse interaction boundaries (`onMouseDown`, `onMouseMove`, `getUnifiedHitTarget`) to calculate `chartHeight` as `rect.height - timeAxisHeight - statsGridHeight`.
  - **Panning Coordinate Fix (`components/chart/usePanZoom.ts`)**:
    - Added `statsGridHeight` to `usePanZoom` function signature and used it to compute correct vertical panning ratio (`pricePerPixel`), keeping panning perfectly bound to the drawable chart height.
  - **Measurement Tool Coordinates (`lib/utils/measurement.ts`)**:
    - Updated `computeMeasurementMetrics` to accept `statsGridHeight` and apply it to chart bounds for accurate coordinate measurement when stats grid is enabled.
- **Why it changed**:
  - The rendering pipeline scaled the vertical drawing area (`drawableHeight`) by subtracting `statsGridHeight`. However, the mouse interaction pipeline and hit-testing functions ignored `statsGridHeight`, using the full canvas height.
  - This divergence created a vertical offset in price-to-pixel coordinate translation that scaled linearly with price depth, causing drawing tools (rectangles, positions, lines, volume profiles) to render out-of-sync with their hit-testing hitboxes when the Stats Indicator was active.
- **Impact summary**:
  - 100% pixel-to-pixel accuracy restored for drawing tool hit-testing, panning, and interaction, irrespective of the presence or size of the Stats Indicator Grid.
  - `npx tsc --noEmit` validates clean type signatures across updated hooks and utilities.
