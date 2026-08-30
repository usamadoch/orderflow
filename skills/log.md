# OrderFlow Chart - Change Log

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

## [2026-08-29] - Fix: HSVP & Current-Candle Stats Indicator Canvas Blinking & Render Lifecycle

- **What changed**:
  - **Stats Indicator Grid Lifecycle Alignment (`components/chart/ChartCanvas.tsx`)**:
    - Relocated `drawStatsGrid` into the primary `liveCtx` rendering block before `liveCtx.restore()`.
    - On `redraw('live-dirty')` market ticks, `drawStatsGrid` executes within the active candle's column clip (`colStartX`), preventing the bottom statistics cells from being cleared to transparent and left blank on live ticks.
    - On full canvas redraws (`redraw('all')` / `redraw('live')`), `drawStatsGrid` renders all visible candle cells and axis labels cleanly without clipping.
  - **HSVP & Volume Profile Render Layer Restriction (`components/chart/ChartCanvas.tsx`)**:
    - Restricted Historical Session Volume Profiles (HSVP) and default Volume Profiles to full live canvas redraws (`if (drawAll || layersToDraw.has('live'))`), eliminating redundant overdrawing on partial `live-dirty` column ticks.
    - Prevented opacity compounding and flashing by ensuring semi-transparent session profiles (`rgba(..., 0.3)`) are only painted over fully cleared canvas frames.
    - Removed an extraneous secondary `liveCtx.restore()` call that corrupted the Canvas 2D transform stack.
  - **Eliminated Tick-Rate React Re-renders (`components/chart/ChartPanel.tsx`)**:
    - Removed `dataVersion` React state subscription from `ChartPanel.tsx` and its `React.useMemo` dependency array, freeing the React UI tree from high-frequency market tick reconciliations while preserving imperative canvas redraw subscriptions.
  - **Default Indicator State & Store Persistence (`lib/store/chart.ts`)**:
    - Defaulted `historicalSessionProfileEnabled` and `statsIndicatorEnabled` to `true` in `ensurePanel`.
    - Added `statsIndicatorEnabled`, `statsIndicatorCount`, and `statsIndicatorItems` to `partialize` for robust multi-tab and reload persistence.
- **Why it changed**:
  - High-frequency market ticks triggered `redraw('live-dirty')`, which cleared the full vertical column of the active candle (erasing the live stats cell). Because `drawStatsGrid` was previously gated behind `drawAll || layersToDraw.has('live')`, the live stats cell remained blank during dirty ticks and flickered whenever full redraws occurred.
  - HSVP was executing on unclipped `live-dirty` ticks without full canvas clearing, causing alpha blending to stack repeatedly and darken the profile until full wipes caused a visible flash.
- **Impact summary**:
  - Both HSVP and Stats indicator render with 100% visual stability, zero blinking/flickering, and instant live stat updates.
  - `npx tsc --noEmit` and browser runtime verification passed with 0 errors.

## [2026-08-28] - Feature & Fix: Global Time Zone & Time Format Consistency Across Entire Application

- **What changed**:
  - **Unified Time Formatting Utilities & Zero-Allocation Timezone Caching (`lib/utils/format.ts`)**:
    - Implemented high-speed `getTimezoneOffsetMs` with hourly timezone bucket caching and reusable `Intl.DateTimeFormat` memoization, eliminating 1,500+ expensive `new Intl.DateTimeFormat` allocations per frame.
    - Enhanced `formatTime` and `formatDateTime` to respect both `globalTimezone` and `globalTimeFormat` (`12h` with AM/PM vs `24h`) across milliseconds and seconds timestamps without allocating new formatters per call.
    - Added bijective 12h/24h conversion helpers `to12Hour(hour24)` and `to24Hour(hour12, period)` with 100% test coverage.
  - **Trading Sessions Timezone Alignment (`lib/utils/sessions.ts` & `lib/draw/drawSessions.ts`)**:
    - Updated `getSessionOccurrences` and `drawSessions` to accept `timezone` parameter, replacing hardcoded `'UTC'` with the active `globalTimezone`, and added early-exit bounds guards.
    - Added support for overnight / midnight-crossing session ranges (`sessionEndTime <= sessionStartTime`).
  - **Historical Session Volume Profile (HSVP) Timezone Alignment (`lib/utils/historicalSessions.ts` & `components/FeedProvider.tsx`)**:
    - Updated `getHistoricalSessionRanges` and `computeHistoricalSessionRanges` to accept and prioritize `globalTimezone`.
    - Updated `FeedProvider.tsx` cache range calculations to compute protected and restore ranges using `state.globalTimezone`.
  - **CVD Reset Timezone Alignment (`lib/utils/delta.ts`)**:
    - Added `timezone` parameter to `BuildCvdSeriesOptions` in `buildCvdSeries`.
    - Replaced UTC day keying with `getZonedDayKey(time, timezone)` and updated `getActiveSessionKey` to use `getZonedTimeParts(time, timezone)`.
  - **Interactive 12h/24h Time Inputs (`components/ui/TimeInput.tsx`)**:
    - Created reusable `TimeInput` component supporting 24-hour inputs (00-23) and 12-hour inputs (01-12 with AM/PM pill toggle) that bijectively syncs to store state.
  - **Settings & Timezone UI Context (`components/ui/ChartSettingsDropdown.tsx`)**:
    - Integrated `TimeInput` across Sessions (Tokyo, London, NY) and HSVP start/end times.
    - Added timezone context indicator badges in Sessions and HSVP headers displaying the active global timezone and format.
    - Added live clock preview and expanded world timezones in the Global Time settings section.
  - **Trade History & Order Tables (`components/ui/OrdersPanel.tsx`)**:
    - Updated Open Orders and Trade History timestamps to format via `formatDateTime(time, globalTimezone, globalTimeFormat)`.
  - **Imperative Canvas Reactive Redraws (`components/chart/ChartCanvas.tsx`, `components/chart/CvdPanel.tsx`, `components/chart/ChartPanel.tsx`)**:
    - Passed `globalTimezone` and `globalTimeFormat` props into `ChartCanvas` and `CvdPanel`.
    - Added reactive effects triggering instant canvas `redraw()` whenever global timezone or time format changes.
  - **Store Sanitization & Overnight Validation (`lib/store/chart.ts`)**:
    - Removed artificial start < end time restrictions in `setSessionTime` to allow overnight trading sessions.
    - Cleaned up legacy `historicalSessionProfileTimezone` in persisted state sanitizer.
- **Why it changed**:
  - The application previously had disjointed timezone handling (some features using UTC, others using local PC time, and canvas failing to re-render on setting changes).
  - Users required strict consistency: when changing global Time Zone or 12h/24h Time Format, every feature (chart axes, crosshair tooltips, sessions, HSVP, CVD resets, settings inputs, trade history) must reflect the selected settings immediately.
- **Impact summary**:
  - Single authoritative source of truth for time display, calculation, and input across the entire application.
  - Full support for 12h (AM/PM) and 24h formats and overnight session configurations.
  - `npx tsc --noEmit` and targeted automated verification tests passed with 0 errors.

## [2026-08-24] - Feature: Direct Chart BUY/SELL Order Placement & Overlay Visual Refinement

- **What changed**:
  - **Toolbar Trade Tools**: Added dedicated `BUY` (green) and `SELL` (red) buttons in `PanelToolbar.tsx` next to the `Position` tool, allowing traders to toggle buy/sell placement mode.
  - **Instant Execution on Chart Drop/Click**: Updated `ChartCanvas.tsx` `onMouseDown` so that when `BUY` or `SELL` mode is active, clicking or dropping on the chart canvas sets the exact clicked price as the Stop Loss (SL) and immediately executes the market order via `POST http://localhost:3001/order` without requiring any separate confirmation modal.
  - **Removed Live Price Line Drag & Confirm Popup**: Removed the live dotted price line drag hit-testing to prevent accidental or missed order placements during fast market volatility, and removed `MarketOrderConfirmRow` from `CanvasDrawingToolbar.tsx` and `ChartCanvas.tsx`.
  - **Overlay Visual Refinement**:
    - Removed background translucent shaded rectangular fills (danger/profit zones) between Entry and SL/TP in `drawTradingOverlays.ts`.
    - Relocated all order information labels (Side, Volume, Entry Price, Live PnL, SL, TP, Limit Orders, and Liquidation) from the far left of the chart to the **right side**, positioned directly adjacent to the SL/TP pill handles and price badges for a clean, unobstructed chart.
- **Why it changed**:
  - Dragging the fast-moving live price line during high volatility caused missed clicks and awkward order execution.
  - Users wanted a direct one-click trade placement flow (pick BUY/SELL $\rightarrow$ drop Stop Loss level on chart $\rightarrow$ instant execution) without redundant confirm popups.
  - Background shading cluttered historical footprint and candlestick visibility; moving information labels to the right keeps the main chart clean while keeping all relevant metrics glanceable next to the price axis.
- **Impact summary**:
  - Fast, reliable chart-based trade execution in MetaTrader 5 via the local bridge with minimal friction.
  - Chart canvas overlays are cleaner with clear horizontal bars, right-aligned information badges, and no obscuring background fills.
  - `npx tsc --noEmit` passed with 0 errors.

## [2026-08-24] - Fix: MT5 Order Canvas Persistence, Live PnL Tracking, & Bridge Position Synchronization

- **What changed**:
  - **Fixed Canvas Order Disappearance**: Corrected `handleConfirmMarketOrder` in `ChartCanvas.tsx` to construct valid `VirtualPosition` (`quantity`, `openedAt`, `fillIds`) and `BracketOrder` (`stopLossPrice`, `takeProfitPrice`, `stopLossStatus: 'active'`, `takeProfitStatus: 'active'`) payloads, allowing `drawTradingOverlays` to validate and render entry, SL, and TP lines on the canvas after confirmation.
  - **Live Floating PnL**: Updated `ChartCanvas.tsx` to invoke `updateVirtualPnl` on canvas redraws / candle ticks, dynamically updating floating unrealized PnL on chart position labels.
  - **Full MT5 Position Synchronization**:
    - Added `syncMT5Positions` store action to `lib/store/chartRuntime.ts`.
    - Updated `hooks/useTradingSync.ts` to sync open MT5 positions from `http://localhost:3001/status` every 2 seconds.
    - Updated `market_order_bridge/server.mjs` `/account-update` and `/status` handlers to support open position arrays, set strict `/pending` polling endpoint, and bound server listener to `0.0.0.0` for IPv4/localhost compatibility.
    - Extended `MarketOrderEA.mq5` and `MarketOrderBridgeEA.mq5` `SendAccountUpdate()` methods to serialize active open positions (ticket, symbol, type, openPrice, sl, tp, profit, volume), resolved MQL5 const input variable modification errors via `g_bridgeUrl`, and aligned polling endpoints strictly to `/pending`.
  - **Header PnL Display**: Ensured live MT5 account name & floating PnL are rendered cleanly in `Header.tsx` whenever MT5 is connected via the local bridge.
  - **Type Safety**: Resolved `lib/store/chart.ts` `updatePanel` type merging warnings.
- **Why it changed**:
  - Placed MT5 market orders disappeared after confirmation due to mismatched property keys in `VirtualPosition` (`amount` vs `quantity`) and `BracketOrder` (`slPrice` vs `stopLossPrice`), causing canvas overlay drawing filters to exclude them.
  - Users had no persistent record or live PnL display of active MT5 trades on the web application across reloads.
- **Impact summary**:
  - Placed market orders stay permanently visible on the chart with active SL and TP lines, live floating unrealized PnL, risk/profit shaded zones, and interactive drag handles.
  - Reloading the page or opening trades directly in MT5 automatically syncs and displays active trades on the web chart, and closing a trade in MT5 removes it from the chart canvas.
  - `npx tsc --noEmit` checks pass cleanly with 0 compilation errors.

## [2026-08-24] - Fix: MT5 Bridge Order Overlay Rendering & Dynamic Relative Stops

- **What changed**:
  - Updated `ChartCanvas.tsx` to unconditionally include `virtualPositions` (used by MT5 bridge) in the `activePositions` list rendered on the chart overlay, regardless of contract type (`futures`/`spot`).
  - Updated `MarketOrderBridgeEA.mq5` and `MarketOrderEA.mq5` to compute SL/TP levels dynamically relative to the broker's live market execution price using risk distance (`MathAbs(entryPrice - slPrice)`).
  - Fixed `useTradingSync.ts` to isolate MT5 bridge status polling from Binance trading disable environment flag without sending custom CORS headers.
- **Why it changed**:
  - `virtualPositions` was being omitted from canvas drawing when viewing USDT pairs, causing placed bridge orders to disappear immediately after confirmation.
  - Absolute SL price transmission caused `10016 invalid stops` errors in MT5 due to small price feed offsets between Binance and MT5 brokers.
- **Impact summary**:
  - Placed MT5 bridge orders stay visible on the chart as active positions with SL/TP overlays, and market order execution against MT5 brokers reliably succeeds without invalid stop rejections.

## [2026-08-23] - Feature: Client-Side Market Order & Local Bridge

- **What changed**:
  - Implemented client-side chart interaction for dragging a market order stop-loss (SL) line, calculating buy/sell direction based on drag vector, and displaying a confirmation UI (`ChartCanvas.tsx`, `CanvasDrawingToolbar.tsx`).
  - Added `marketOrderDrag` state to `types/trading.ts` and `lib/store/chartRuntime.ts`.
  - Added new local Node.js bridge server (`market_order_bridge/server.mjs`) to handle POST requests from the client and serve them via polling to an EA.
  - Implemented the MetaTrader 5 Expert Advisor (`market_order_bridge/MarketOrderEA.mq5`) to poll the bridge, dynamically calculate lot sizes based on 1% risk and the provided SL distance, and execute the market order.
- **Why it changed**:
  - To enable fast, chart-based execution of market orders where the client only specifies the Stop Loss price, and the MT5 EA automatically calculates the correct position sizing and places the trade with a default 1R Take Profit.
- **Impact summary**:
  - Users can click and drag from the current price line on the chart to define an SL, hit Confirm, and have a trade automatically executed in MetaTrader 5 with exact risk management applied.

## [2026-08-23] - Feature: Chart Tab Isolation and Position Tool Simplification

- **What changed**:
  - Implemented `tabAwareStorage` in `lib/store/chart.ts` to split persist keys: global settings are saved to `localStorage` while tab-specific settings (like `panels` and `layoutMode`) are saved to `sessionStorage`.
  - Added `'position'` to `LineDrawMode` in `types/chart.ts`.
  - Replaced separate Long/Short position buttons in `PanelToolbar.tsx` with a single unified Position tool.
  - Updated `ChartCanvas.tsx` to handle the new `'position'` drawing mode, dynamically resolving it to `long-position` (drag down) or `short-position` (drag up) based on the vertical drag delta upon mouse release.
- **Why it changed**:
  - To prevent duplicated browser tabs from fighting over the same `localStorage` space, ensuring each tab maintains an independent workspace state.
  - To improve the user experience for the Position drawing tool by reducing click interactions and inferring intent naturally through drag direction.
- **Impact summary**:
  - Users can now safely operate multiple chart tabs/windows simultaneously without unexpected state bleeding. The Position tool is much faster for practice and mock trading.

## [2026-08-23] - Refactor: Complete Imperative Canvas Rendering Migration

- **What changed**:
  - Removed `candles` and `footprintTrigger` from `CvdPanelProps` and fetched them directly from `useChartRuntimeStore` inside the component.
  - Removed `dataVersion` prop from `ChartCanvasProps` and `ChartPanel.tsx`.
  - Replaced React dependencies on `candles` inside `ChartCanvas.tsx` and `CvdPanel.tsx` with a `useChartRuntimeStore.subscribe` hook that listens directly to `dataVersion` changes and triggers the imperative `redraw` method.
- **Why it changed**:
  - To prevent React re-renders on every high-frequency market data tick. The UI thread is now completely free of React reconciliations for tick-rate state updates, relying solely on imperative canvas drawing via store subscriptions.
- **Impact summary**:
  - Major performance improvement during high-volatility events. UI interactions remain buttery smooth since chart panels no longer re-render on ticks.

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

## [2026-08-29] - Feat: Data Pipeline Gap Recovery

- **What changed**:
  - Wired up gap recovery for Candles and Trades in FeedProvider.tsx by listening to onConnectionStateChange from eedRegistry.
  - Implemented Orderbook Sequence Gap Checking in lib/liquidity/orderbook.ts with diff buffering.
  - Integrated GAP_DETECTED event to re-fetch the orderbook snapshot on sequence mismatch.
- **Why it changed**:
  - To implement robust gap recovery so that data is not lost (or rendered stale) during short internet disconnects.
- **Impact summary**:
  - Intermittent connection drops will now automatically heal the visual gap by fetching missing history upon reconnection, and the orderbook will correctly self-heal if websocket events skip a sequence.

## [2026-08-29] - Fix: Multiple State Listeners & Reconnection Gap Recovery

- **What changed**:
  - Fixed `BinanceAdapter` and `BinanceFuturesAdapter` to support multiple connection state listeners using `Set` collections instead of a single callback variable that was getting overwritten by simultaneous trade and candle streams.
  - Added `window.addEventListener('online')` listener to automatically trigger immediate reconnect upon network recovery.
  - Fixed `CandleCache` to track `wasDisconnected` flag so that transitioning to `LIVE` from intermediate reconnection states reliably triggers history refetching.
- **Why it changed**:
  - The candle cache state listener was being overwritten by trade streams and failing to trigger history fetch when internet dropped and reconnected.
- **Impact summary**:
  - Turning off and on internet now reliably refetches the missing candle range and updates the chart without gaps.
