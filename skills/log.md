# Project Changelog

## [2026-05-07] - Initial Project Bootstrap

### Added
- **Project Setup**: Initialized Next.js 14 App Router project (`orderflowApp`) using `pnpm` with TypeScript, Tailwind CSS, and ESLint.
- **Dependencies**: Installed `lightweight-charts` and `zustand`.
- **Design System**: 
  - Overhauled `tailwind.config.ts` to strictly enforce `darkMode: 'class'`.
  - Added strict dark mode color palette (Background, Surface, Border, Text variations, Bull/Bear/Accent colors).
  - Updated `app/globals.css` with matching CSS variables.
  - Configured `app/layout.tsx` to load Google Fonts: `Inter` for UI and `JetBrains Mono` for numbers/data. Applied dark mode to the root HTML.
- **Project Structure**: Created directories for `components/chart`, `components/layout`, `components/ui`, `lib/feeds`, `lib/store`, `lib/utils`, and `types`.
- **Data Interfaces**: 
  - Added `types/candle.ts` (OHLCV interface).
  - Added `types/trade.ts` (Individual trade tick interface).
  - Added `lib/feeds/adapter.ts` (`FeedAdapter` contract for swappable data sources).
- **UI Scaffold**: Replaced the default Next.js `app/page.tsx` with the minimal OrderFlow layout.
  - Added a top toolbar with Pair Selector, Timeframe Selector, and Connection Status placeholders.
  - Added a collapsible sidebar for data settings (e.g., Tick Size).
  - Added the main chart container placeholder.

### Changed
- **UI Tweaks**: Made the header and sidebar skinnier in `app/page.tsx` for a denser, more professional trading tool layout.
  - Reduced header height from `h-14` to `h-10`.
  - Reduced sidebar width from `w-64` to `w-48`.
  - Scaled down padding, gaps, and font sizes across the header and sidebar.

## [2026-05-07] - Phase 2: Binance Feed Adapter

### Added
- **Feed Adapter**: Implemented `BinanceAdapter` in `lib/feeds/binance.ts` to connect to Binance's combined stream WebSocket for real-time kline and aggTrade data. Exported as a singleton in `lib/feeds/index.ts`.
- **State Management**: Created a Zustand store in `lib/store/chart.ts` to manage pair, timeframe, candles, trades, and connection status state. Includes array size caps (500 for candles, 5000 for trades) to prevent memory issues.
- **Data Initialization**: Added `components/FeedProvider.tsx` client component to orchestrate the feed connection based on the global Zustand store state.
- **UI Components**: Built `ConnectionStatus`, `PairSelector`, and `TimeframeSelector` components in `components/ui/` to interact with the chart store.

### Changed
- **Interfaces**: Added `isClosed` field to `Candle` interface in `types/candle.ts` to correctly track complete vs live candles.
- **UI Layout**: Wrapped `app/page.tsx`'s main layout with `<FeedProvider>` and integrated the live `PairSelector`, `TimeframeSelector`, and `ConnectionStatus` components into the header.

### Impact Summary
The application now supports real-time market data streaming from Binance. The frontend has an automated WebSocket lifecycle tied to a global Zustand store, updating data structures (candles and trades) correctly as messages arrive. The UI dynamically reflects the active pair, timeframe, and socket connection status.

## [2026-05-07] - Phase 3: Candlestick Chart

### Added
- **Dependencies**: Installed `lightweight-charts` v4.
- **Components**: Created `ChartContainer` layout component to house the candlestick chart.
- **Components**: Created `CandleChart` component connecting Zustand store data to chart rendering.
- **Hooks**: Created `useChartInit` custom hook extracting `lightweight-charts` creation, styling, and `ResizeObserver` lifecycle management.

### Changed
- **UI Layout**: Replaced the placeholder chart area in `app/page.tsx` with `<ChartContainer />`.

### Impact Summary
Real-time candles streamed from Binance now render in an interactive chart. The chart cleanly replaces data on pair/timeframe swaps and optimally updates in place during live market ticks without forcing React re-renders.

## [2026-05-07] - Phase 4: Trade Aggregation Engine

### Added
- **Types**: Added `FootprintCell` and `FootprintCandle` types in `types/footprint.ts` to define footprint data structures.
- **Aggregation Logic**: Implemented `AggregationEngine` in `lib/aggregation/engine.ts` to transform raw trade and candle streams into bucketed footprint data (bid/ask volume per price level).
- **Utility**: Added `normalizePriceToBucket` and `getCandleTimeForTrade` helper functions in `lib/utils/aggregation.ts`.

### Changed
- **State Management**: Added `bucketSize` state and `setBucketSize` action to `lib/store/chart.ts`.
- **Feed Integration**: Modified `components/FeedProvider.tsx` to instantiate `AggregationEngine` and wire it into the `handleCandle` and `handleTrade` callbacks. The engine automatically resets on pair, timeframe, or bucket size changes.

### Impact Summary
The application now includes a pure data aggregation engine that processes real-time trades into structured footprint data (price buckets split into bid and ask volume) in-memory, computing delta per candle. This forms the foundational data layer for subsequent footprint and volume profile rendering phases without affecting the UI's performance.

## [2026-05-07] - Phase 5: Footprint Canvas

### Added
- **Components**: Created `FootprintCanvas` and `useFootprintRenderer` to render footprint blocks perfectly aligned with `lightweight-charts`.
- **Context**: Added `ChartEngineContext` to expose `AggregationEngine` without prop-drilling.
- **Canvas Utils**: Created `lib/utils/canvas.ts` for efficient DPi-scaled 2D rendering and footprint cell/delta drawing logic.

### Changed
- **Chart Infrastructure**: Lifted `useChartInit` up to `ChartContainer` to share `chartRef` and `seriesRef` between `CandleChart` and `FootprintCanvas`.
- **FeedProvider**: Wrapped children with `ChartEngineContext.Provider` to supply the engine.

### Impact Summary
The application now visually overlays footprint data (bid/ask volume per price level) directly on top of the candlestick chart. The secondary canvas uses hardware-accelerated 2D rendering strictly aligned to the lightweight-charts coordinate system, responding seamlessly to zooming and scrolling while scaling opacity based on live market volume.

## [2026-05-07] - Architecture Correction

### Changed
- **Architecture**: Replaced lightweight-charts and multi-canvas approach with a custom single-canvas architecture.
- **Documents Updated**: Updated `skills/tasks/phase3.md`, `skills/tasks/phase5.md`, and `skills/map.md` to reflect the new `ChartCanvas.tsx` and custom draw functions (`drawCandles.ts`, `drawFootprint.ts`, `drawAxes.ts`, `useCoordinates.ts`, `usePanZoom.ts`).

### Impact Summary
A single canvas now acts as the central renderer, drastically simplifying coordinate math and eliminating scroll-sync issues between multiple canvases.

## [2026-05-07] - Phase 5 (Revised): Footprint Draw Mode

### Added
- **Components**: Created `ChartModeToggle` and `BucketSizeInput` components in `components/ui/` and integrated them into the toolbar in `app/page.tsx`. Removed old `ModeSelector`.
- **Chart Logic**: Implemented `drawFootprint` in `components/chart/drawFootprint.ts` to render bid/ask volume footprint cells scaling opaqueness with max visible volume.
- **State Management**: Added `footprintTrigger` and `triggerFootprintRedraw` in `lib/store/chart.ts` to allow specific footprint-related redraws when trades arrive without unnecessarily updating whole candle structures.
- **Feed Provider**: Added throttled redraw logic (`setInterval` ~100ms) in `components/FeedProvider.tsx` using `pendingFootprintRedraw` to smoothly update footprint charts as live trades pour in.

### Changed
- **ChartCanvas**: Added `footprintTrigger` as a dependency for the redraw hook so that the chart renders trades coming in live while in footprint mode.

### Impact Summary
Footprint charts are now cleanly rendered within the exact same canvas infrastructure as candlestick charts. Real-time rendering throttling guarantees stable 60FPS UI performance during high-volume trade influxes without unnecessary React state overhead.

## [2026-05-07] - Feature: Price Line Indicator

### Added
- **Components**: Created `components/chart/drawPriceLine.ts` to render a real-time horizontal line at the current market price.
- **UI**: Added a high-visibility price badge on the Y-axis that follows the live price.

### Changed
- **ChartCanvas**: Integrated `drawPriceLine` into the main redraw loop, ensuring it renders on top of the grid and axes for better visibility.

### Impact Summary
Users can now easily track the current market price relative to historical data and footprint cells via a dedicated horizontal price line and axis badge. This improves situational awareness during live trading.

## [2026-05-07] - Feature: Axis Dragging (Vertical/Horizontal Zoom)

### Added
- **Hooks**: Enhanced `usePanZoom.ts` to detect clicks on the Price Axis (right) and Time Axis (bottom).
- **Interaction**: 
  - Dragging on the Price Axis stretches or squeezes the chart vertically by adjusting a new `priceZoom` multiplier.
  - Dragging on the Time Axis adjusts `barWidth` to zoom horizontally.
  - Added specialized cursors (`ns-resize`, `ew-resize`) for axis interaction.

### Changed
- **ChartCanvas**: Updated to apply the `priceZoom` factor to the auto-calculated visible price range, enabling manual vertical scaling while maintaining focus on the visible data.

### Impact Summary
The chart is now much more interactive, allowing users to manually scale price and time axes with intuitive drag gestures, similar to professional trading platforms.

## [2026-05-08] - Phase 6: Volume Profile

### Added
- **Aggregation**: Implemented `lib/utils/volumeProfile.ts` to aggregate visible candles into a volume distribution. Includes fallback logic to distribute OHLCV volume when footprint data is missing.
- **Math**: Added `findPOC` (Point of Control) and `findValueArea` (70% volume range) algorithms.
- **Rendering**: Created `components/chart/drawVolumeProfile.ts` to render horizontal bars on the right side of the chart.
- **Visuals**: Added bid/ask volume split coloring within bars, a dashed POC line, and VA High/Low boundary lines with axis labels.

### Changed
- **Coordinate System**: Updated `useCoordinates.ts` and `ChartCanvas.tsx` to reserve a fixed `profileWidth` (120px) on the right side, ensuring candles and volume bars don't overlap awkwardly.
- **Redraw Loop**: Integrated the volume profile into the main 60FPS redraw cycle, positioned between candle/footprint rendering and axis painting for clean clipping.

### Impact Summary
Users now have a real-time Volume Profile that updates dynamically as they scroll or zoom. The profile identifies key liquidity zones (POC and Value Area) and works seamlessly in both candlestick and footprint modes, providing deep order flow context alongside price action.

## [2026-05-07] - Feature: TradingView Style Scaling & Panning

### Added
- **State Management**: Implemented persistent `priceCenter` and `priceRange` refs in `usePanZoom.ts` to replace volatile auto-scaling logic.
- **Coordinate Math**: Added `rawFirstIndex` and `rawLastIndex` to `getVisibleRange` in `useCoordinates.ts` to support rendering beyond the data boundaries.
- **Extrapolation**: Added time label extrapolation and dynamic price axis scaling (1-2-5 series) in `drawAxes.ts` to support rendering in future space when panning right.

### Changed
- **Interaction Model**: 
  - **Free Panning**: Panning in 'chart' mode now allows moving the chart freely in all directions without bounding constraints or auto-snapping to candle extremes.
  - **Fixed Scaling**: Vertical scaling is now fixed based on `priceCenter` and `priceRange`. Dragging the price axis directly modifies the range, while panning modifies the center price.
  - **Horizontal Scaling**: Removed `barWidth` constraints to allow more granular horizontal zoom levels.
- **Rendering**:
  - **Continuous Grid**: Grid lines and time labels are now drawn across the entire visible canvas area, even where no candles exist.
  - **Price Initialization**: Added logic to initialize the price scale from the first set of visible candles, then hold that scale until manually adjusted.

### Impact Summary
The chart interaction now mirrors professional platforms like TradingView. Scaling is stable and manual, panning is free and unrestricted, and the grid remains continuous regardless of data presence, providing a much smoother and more predictable user experience.

## [2026-05-07] - Feature: Dynamic Price Axis Scaling

### Added
- **Tick Spacing**: Implemented `calculatePriceStep` in `drawAxes.ts` using the 1-2-5 series (e.g., 0.1, 0.2, 0.5, 1, 2, 5).
- **Adaptive Precision**: Added logic to automatically adjust decimal precision on price labels based on the current zoom/step level.

### Changed
- **Axis Rendering**: Replaced hardcoded price steps with dynamic calculations that target a consistent pixel spacing (minimum ~50px) between ticks. This prevents "aggressive" jumps in the grid and labels when zooming vertically.

### Impact Summary
The price axis now behaves exactly like professional charting platforms (TradingView), providing a smooth, progressive scaling experience. Grid lines and labels transition naturally between values as the user zooms or pans vertically, maintaining visual clarity at all scales.
## [2026-05-07] - Feature: Footprint UI Enhancements

### Added
- **Visuals**: Added a thin candlestick (body + wick) aligned to the left of the footprint boxes in `drawFootprint.ts`. This provides visual context for the bar while keeping it distinct from the bid/ask volume data.
- **Formatting**: Updated `drawFootprintCell` to format bid and ask volumes with exactly one decimal place (e.g., `12.5`).
- **Layout**: Centered the bid and ask volume text within their respective halves of the footprint box and shifted the boxes to the right to accommodate the left-aligned candle.

### Changed
- **Canvas Utils**: Improved `formatVol` logic and text alignment in `lib/utils/canvas.ts`.
- **Rendering Logic**: Unified candle rendering and shifted footprint box coordinates in `drawFootprint.ts`.

### Impact Summary
The footprint chart now features a professional left-aligned candlestick structure. This layout prevents the candle from obscuring volume numbers while still providing essential OHLC context, significantly improving the scannability of the order flow data.

## [2026-05-08] - Feature: TradingView-style Crosshair

### Added
- **Components**: Created `components/chart/drawCrosshair.ts` for rendering horizontal and vertical crosshair guide lines.
- **UI**: Added dynamic, highlighted axis labels for both Price (right axis) and Time (bottom axis) that track the crosshair position.
- **Math**: Added `yToPrice` and `xToIndex` inverse coordinate functions in `useCoordinates.ts` to convert mouse pixels back to market data values.
- **Interaction**: Enhanced `usePanZoom.ts` to track real-time mouse movement across the canvas and manage crosshair visibility via `mouseenter`/`mouseleave`.

### Changed
- **ChartCanvas**: Integrated the crosshair and highlighted label rendering into the main 60FPS redraw loop. Added checks to hide the crosshair and its axis labels when the cursor is over the Price or Time axes.
- **usePanZoom**: Enhanced cursor logic to show `ns-resize` and `ew-resize` "stretch" icons when hovering over the axes, improving discoverability of scaling features.

### Impact Summary
Users now have a precision crosshair tool that provides instant price and time context at any cursor position. The behavior is identical to TradingView, remaining perfectly aligned during panning, zooming, and in both candlestick and footprint chart modes.

## [2026-05-08] - Phase 7: UI Polish

### Added
- **Components**: Created Toolbar.tsx as a unified control center for pairs, timeframes, chart modes, and connection status.
- **Components**: Created Sidebar.tsx to display live session statistics (Delta, HVN, LVN, B/S ratio).
- **Components**: Created SettingsPanel.tsx providing a slide-in interface for visual customizations (colors, VA threshold, profile width).
- **Hooks**: Implemented useKeyboardShortcuts.ts for professional hotkey navigation (1-5 for timeframes, C/F for modes, R for reset).
- **Persistence**: Integrated zustand/middleware/persist to save user preferences to localStorage.

### Changed
- **Store**: Lifted barWidth and scrollOffset state into Zustand to allow external control and persistence.
- **Rendering**: Updated all draw functions (drawCandles, drawFootprint, drawVolumeProfile) to use customizable color tokens from the store.
- **Layout**: Overhauled app/page.tsx to integrate the new UI components and keyboard listener.
- **FeedProvider**: Added a throttled 500ms update cycle to lastTradeTime to drive the sidebar stats without excessive re-renders.

### Impact Summary
The application is now a complete, professional-grade trading tool. Users can customize their visual experience, navigate quickly with hotkeys, and monitor live session order flow statistics in real-time. All settings persist across sessions, providing a seamless and personalized user experience.
## [2026-05-08] - Feature: Dynamic Price Line & Live Countdown

### Added
- **Utility**: Created `lib/utils/format.ts` for centralized timeframe parsing and countdown formatting.
- **Visuals**: Added a real-time countdown timer to the live price badge on the Y-axis, showing the time remaining for the active candle to close.

### Changed
- **Price Line**: Updated `drawPriceLine.ts` to dynamically match the color of the active candle (green for bullish, red for bearish).
- **Price Badge**: Redesigned the axis price label to include both the live price and the countdown, using high-visibility colors that reflect market direction.
- **Rendering**: Modified `ChartCanvas.tsx` to include a 1-second interval redraw cycle, ensuring the countdown timer updates smoothly in real-time even when there is no new trade data.

### Impact Summary
The live price indicator now provides significantly better situational awareness by visually reflecting the active candle's direction and providing a TradingView-style countdown. This allows traders to anticipate candle closes and track market direction more intuitively.

## [2026-05-08] - Feature: Axis Polish & Typography Improvements

### Added
- **Formatting**: Implemented `formatPrice` with thousands separators and `formatTime12h` with AM/PM support in `lib/utils/format.ts`.
- **Typography**: Mapped `Inter` and `JetBrains Mono` fonts in `tailwind.config.ts` to ensure professional-grade typography across the UI and chart.

### Changed
- **Axes**: Updated `drawAxes.ts` and `drawCrosshair.ts` to use `Inter` font and new formatting for a cleaner, TradingView-style look.
- **Price Label**: Redesigned the live price badge in `drawPriceLine.ts` with increased height, better padding, and refined vertical alignment between the price and countdown.
- **Layout**: Increased `priceAxisWidth` to 85px to accommodate larger, formatted price labels with separators.

### Impact Summary
The chart axes now feature professional-grade formatting and typography, significantly improving readability. Prices are now easier to parse with thousand separators, and time labels are more intuitive in 12h format. The overall visual polish now matches industry-standard trading platforms.

## [2026-05-08] - Phase 8: Typography & Persistence

### Added
- **Components**: Created `components/layout/Header.tsx` and `components/layout/Sidebar.tsx` to modularize the UI and improve maintainability.
- **Feature**: Implemented a **collapsible sidebar** with smooth transitions. In minimized state, it displays high-density icons while preserving access to critical settings.
- **Persistence**: Integrated `zustand/middleware/persist` in `lib/store/chart.ts` to save user preferences (pair, timeframe, chart mode, bucket size, tick size, and sidebar state) to `localStorage`.
- **Dependencies**: Installed `lucide-react` for professional-grade iconography.

### Changed
- **Typography**: 
  - Overhauled `app/globals.css` with `-webkit-font-smoothing` and increased base font weight (`500`) for a more premium, high-end feel.
  - Updated all header and sidebar labels with `bold` and `extrabold` weights to match professional trading platforms.
  - Updated `drawAxes.ts` and `drawPriceLine.ts` to use `bold` weights for better readability on high-DPI displays.
- **UI Styling**: 
  - Refined `PairSelector`, `TimeframeSelector`, `ChartModeToggle`, and `BucketSizeInput` with subtle shadows, better spacing, and a more curated color palette.
  - Improved the `Sidebar` with sectioned settings (Data Settings, Analysis) and professional hover states.
- **Layout**: Updated `app/page.tsx` to use the new layout components and handle responsive sidebar states.

### Impact Summary
The application now feels significantly more polished and "professional." Settings persist across refreshes, eliminating redundant configuration. The new collapsible sidebar maximizes chart real estate while keeping tools accessible. Typography across the entire app has been tuned for maximum readability and a premium aesthetic.


## [2026-05-08] - Feature: Axis Readability Improvements

### Changed
- **Typography**: 
  - Increased `AXIS_FONT` from 11px to 12px in `drawAxes.ts` for clearer price/time ticks.
  - Significantly increased `PRICE_LINE_FONT` (11px -> 13px) and `COUNTDOWN_FONT` (9px -> 11px) in `drawPriceLine.ts` for the main live indicator.
  - Increased `CROSSHAIR_FONT` from 11px to 12px in `drawCrosshair.ts`.
- **Layout & Spacing**:
  - Added more "gap" by increasing horizontal padding in the live price badge (6px -> 8px).
  - Increased live price badge height from 24px to 30px to accommodate larger fonts and provide better vertical breathing room.
  - Increased crosshair label padding and height for better contrast and visibility.
  - Increased horizontal gap between chart and axis price labels from 10px to 12px.

### Impact Summary
The live price and time indicators on the right axis are now significantly easier to read at a glance. The increased font sizes and improved padding provide better visual separation and clarity, especially on high-resolution displays, matching the "high-readability" standards of professional trading platforms.

## [2026-05-08] - Phase 8: Historical Data Loading

### Added
- **Feed Logic**: Implemented `fetchHistory` in `FeedAdapter` and `BinanceAdapter` to load historical klines via Binance REST API.
- **State Management**: Added `setCandles` action in `lib/store/chart.ts` to allow bulk loading of historical data into the store.
- **Backfill Orchestration**: Updated `FeedProvider.tsx` to perform an asynchronous backfill of historical candles before establishing the live WebSocket stream.

### Changed
- **FeedProvider**: Integrated historical data into the `AggregationEngine` on load, ensuring Volume Profile and other indicators have context immediately upon connection.
- **Stability**: Added a cleanup flag in `FeedProvider` to prevent state updates if the user switches pairs or timeframes while a history fetch is in progress.

### Impact Summary
The chart no longer starts empty. On connect or pair/timeframe change, the application instantly backfills the last 500 candles via REST, providing immediate market context and a fully populated Volume Profile. The live stream then takes over seamlessly, creating a professional and "instant-on" user experience.
## [2026-05-08] - Revert: Synthetic Footprint Rendering
### Changed
- **Footprint Logic**: Reverted synthetic historical footprint generation. Footprint boxes and delta labels will now only appear for candles that have received live streamed trades.
- **Data Model**: Removed `takerBuyVolume` from `Candle` interface and `BinanceAdapter` as it is no longer required for footprint visualization.
- **Authenticity**: Guaranteed that all rendered footprint cells are based strictly on actual trade flow data, ensuring a professional and non-misleading chart representation.

### Fixed
- **Settings Persistence (Maintained)**: Kept the fix where changing `bucketSize` re-populates the engine from existing candles, ensuring that OHLCV context is preserved even if historical footprint cells are empty.

## [2026-05-08] - Feature: Anchored Horizontal Zoom (TradingView-style)

### Added
- **Logic**: Implemented anchored horizontal zoom in `usePanZoom.ts`. The chart now maintains the logical candle index under the mouse cursor during horizontal zoom, preventing jumps and shifts.
- **Math**: Derived and implemented the `scrollOffset` adjustment formula: `scrollOffset' = scrollOffset + (scrollOffset + drawableWidth - x) * (newBarWidth / oldBarWidth - 1)`.

### Changed
- **Interaction**: 
  - **Wheel Zoom**: Now anchors perfectly to the cursor position within the chart area.
  - **Time Axis Zoom**: Anchors to the horizontal position of the mouse on the axis, providing a smooth "stretch/squeeze" effect from that point.
- **Architecture**: Updated `usePanZoom` to accept `profileWidth` to ensure coordinate math accounts for the volume profile area.

### Impact Summary
The horizontal zoom behavior now perfectly matches TradingView. Candles expand and contract smoothly in place relative to the cursor position, regardless of whether the user is at the latest candle or deep in historical data. This significantly improves the navigation experience and precision of the chart.

## [2026-05-08] - Phase 9: Multiple Chart Panels

### Added
- **Components**: Created `ChartPanel.tsx` wrapper component that reads panel-scoped state and passes it as props to `ChartCanvas`.
- **Components**: Created `PanelToolbar.tsx` — a compact 32px toolbar strip per panel with pair, timeframe, mode, and bucket size selectors.
- **State Management**: Introduced `PanelState` interface and panel-scoped store architecture in `lib/store/chart.ts`. Two independent panels (`left`, `right`) each hold their own pair, timeframe, chartMode, bucketSize, barWidth, scrollOffset, candles, and connection state.
- **State Management**: Added `layoutMode: 'single' | 'dual'` and `activePanel: 'left' | 'right'` to the global store.
- **Feed Layer**: Refactored `FeedProvider` into `PanelFeedProvider` — each panel manages its own independent `BinanceAdapter` instance (via `clone()`) and `AggregationEngine`.
- **Feed Interface**: Added `clone()` method to `FeedAdapter` interface and `BinanceAdapter` to enable independent WebSocket connections per panel.
- **Hooks**: Created `hooks/useKeyboardShortcuts.ts` — all hotkeys (1-5 timeframes, C/F modes, R reset, [/] bucket) target `activePanel`.
- **Layout**: Added layout toggle button (single/dual) with SVG icons in the main `Header`.

### Changed
- **Store Architecture**: Migrated from single top-level state to nested `panels.left` / `panels.right` structure. All per-panel actions now take `panelId` as first argument. Persist version bumped to `2` to auto-clear stale localStorage.
- **ChartCanvas**: Refactored from direct store access to a pure props-based rendering component. Receives candles, chartMode, bucketSize, engine, barWidth, scrollOffset, and callbacks.
- **usePanZoom**: Extended to accept initial `barWidth`/`scrollOffset` from props and sync changes back via callbacks.
- **Header**: Stripped pair, timeframe, mode, and bucket selectors (moved to `PanelToolbar`). Now only holds logo, layout toggle, and connection status.
- **Sidebar**: Reads from `activePanel`. Shows LEFT/RIGHT indicator in dual mode with active panel's pair and timeframe.
- **ConnectionStatus**: Shows combined status — LIVE if either panel is connected.
- **UI Components**: Updated `PairSelector`, `TimeframeSelector`, `ChartModeToggle`, `BucketSizeInput` to accept panel-scoped `panelId` prop.
- **page.tsx**: Rewrote to render two `PanelFeedProvider` + `ChartPanel` blocks with a 1px divider; right panel gated on `layoutMode === 'dual'`.

### Fixed
- **Lint**: Cleaned up pre-existing unused variable warnings in `drawFootprint.ts` and `drawVolumeProfile.ts`.
- **Lint**: Added eslint-disable for Binance REST response `any` type.

### Impact Summary
The application now supports dual independent chart panels. Each panel has its own pair, timeframe, chart mode, data feed, and zoom/scroll state. Users can monitor two markets simultaneously (e.g., BTC and ETH) with independent candle/footprint rendering. Switching between single and dual mode is instant via the header toggle. Keyboard shortcuts automatically target the panel under the cursor. All panel configurations persist across refreshes.

## [2026-05-08] - Phase 9 Polish: Layout Persistence, Default Symbols, Draggable Split

### Fixed
- **Layout Persistence**: `layoutMode` and `splitRatio` are now correctly persisted to localStorage with a `migrate` function (persist v3). Previously the version bump without a migrator caused data loss on refresh.
- **Default Symbols**: Both panels now default to `BTCUSDT` instead of mixed `BTCUSDT`/`ETHUSDT`. Users must manually change a panel's pair.

### Added
- **Draggable Split Divider**: The divider between panels is now a 5px draggable handle with a subtle accent glow on hover. Users can drag it horizontally to resize panels (clamped 15%–85%). The `splitRatio` is stored and persisted so the layout survives refresh.
- **Store**: Added `splitRatio: number` state and `setSplitRatio` action to the Zustand store. Clamped to `[0.15, 0.85]`.

### Changed
- **page.tsx**: Panels now use `style={{ width }}` driven by `splitRatio` instead of fixed `w-1/2` classes. Divider uses window-level mouse tracking for smooth drag performance.
- **Store Version**: Bumped persist version from `2` → `3` with a migration function that clears stale v1/v2 data.

### Impact Summary
The dual panel layout is now production-quality. Layout mode persists across refreshes, both panels start on the same symbol by default, and users can freely resize panel widths with a smooth, professional drag interaction.

## [2026-05-08] - Feature: Footprint Display Modes (Delta Mode)

### Added
- **Feature**: Implemented a **Display Mode switch** in the header for footprint charts, allowing users to toggle between **Bid/Ask mode** and **Delta mode**.
- **Visuals**: Added **Delta mode rendering** where bid/ask numbers are replaced by a single centered delta value with a color-coded horizontal background bar.
- **Rendering**: Created `drawDeltaCell` in `lib/utils/canvas.ts` to draw proportional delta bars:
  - Positive delta: Green bar extending right, prefixed with "+".
  - Negative delta: Red bar extending right, prefixed with "−" (proper minus sign).
- **Proportional Scaling**: The width of delta bars scales dynamically based on the maximum delta magnitude within the currently visible chart range.

### Changed
- **State Management**: Added `footprintMode: 'bid-ask' | 'delta'` to `PanelState` in `lib/store/chart.ts`. Added persistence and migration for the new state.
- **UI**: Updated `PanelToolbar.tsx` to include the `B/A` and `Δ` mode toggle buttons next to the bucket size input.
- **Rendering Loop**: Updated `drawFootprint.ts` and `ChartCanvas.tsx` to propagate and handle the active footprint display mode.

### Impact Summary
Traders can now switch between detailed bid/ask volume breakdown and a high-level delta pressure visualization. Delta mode provides a cleaner, "volume profile" style view of aggressive buying and selling pressure within each candle, making it significantly easier to identify market imbalances at a glance.

## [2026-05-08] - Feature: Absorption Detection System (Signals 1–3)

### Added
- **Types**: Created `types/absorption.ts` with `AbsorptionResult`, `AbsorptionDirection`, `AbsorptionRank` interfaces for structured detection output.
- **Detection Engine**: Implemented `lib/absorption/engine.ts` with three scoring functions:
  - **Signal 1 — Delta Extremity** (max 25 pts): Compares candle delta against a 20-candle rolling average. Flags extreme, high, or elevated delta ratios.
  - **Signal 2 — Volume Extremity** (max 15 pts): Compares candle volume against the rolling average. Confirms meaningful participant involvement.
  - **Signal 3 — Poor Price Progression** (max 30 pts): Checks body-to-range ratio (tight body = indecision), wick rejection (directional), and price-against-aggressor movement.
- **Map Builder**: Added `buildAbsorptionMap` for initial full-scan and `scoreLatestCandle` for incremental single-candle scoring.
- **Canvas Renderer**: Created `components/chart/drawAbsorption.ts` rendering markers with three visual tiers:
  - Minor (40–60): small circle, half opacity, no label.
  - Strong (60–80): larger circle, `ABS` label.
  - Extreme (80+): largest circle, glow effect, `ABS <score>` label.
  - Provisional (live candle): dashed stroke, reduced opacity.
- **State Management**: Added `absorptionEnabled`, `absorptionMinScore`, `absorptionSide`, `absorptionShowLabels`, and `absorptionMap` to `PanelState` in `lib/store/chart.ts`. Settings are persisted (v5); map is session-only.

### Changed
- **FeedProvider**: Wired absorption lifecycle — builds map after history load, scores incrementally on candle close, re-scores provisional results every 100ms during live trading.
- **ChartCanvas**: Integrated `drawAbsorption` into the render loop between candles/footprint and volume profile, matching the spec draw order.
- **ChartPanel**: Passes absorption props through to ChartCanvas.
- **Store Migration**: Bumped persist version 4 → 5 with migration that initializes absorption defaults for existing users.

### Impact Summary
The application now automatically detects candles where aggressive order flow failed to move price — a key absorption signal. Markers appear on the chart scaled by severity (minor/strong/extreme) with direction-aware positioning (above or below candles). The detection runs on Signals 1–3 (delta extremity, volume extremity, poor price progression); Signals 4 (imbalance clusters) and 5 (repeated defense) are stubbed for future implementation.

## [2026-05-09] - Bug Fix: FeedProvider TypeError

### Fixed
- **State Rehydration**: Fixed a critical bug in `lib/store/chart.ts` where the `zustand/persist` middleware's shallow merge was wiping out non-persisted fields (`candles`, `trades`, `absorptionMap`) of the `PanelState` upon page refresh. Added a custom deep-merge function to the `persist` configuration to preserve defaults.
- **Runtime Error**: Resolved `TypeError: Cannot read properties of undefined (reading 'forEach')` in `components/FeedProvider.tsx` by adding defensive null checks (defaulting to empty arrays) for the `candles` array.

### Impact Summary
Resolved a common runtime crash that occurred when users refreshed the page or changed bucket sizes. The application is now significantly more stable during state rehydration and initialization phases.

## [2026-05-09] - Bug Fix: WebSocket Reconnect Storm

### Fixed
- **Reconnect Loop**: Fixed an infinite reconnect cycle in `lib/feeds/binance.ts` caused by `subscribeCandles()` and `subscribeTrades()` both calling `connect()` independently. The second call would tear down the socket just opened by the first (still in `CONNECTING` state), firing `onclose` → `scheduleReconnect` → loop.
- **"Ping received after close"**: Fixed by detaching all event handlers (`onopen`, `onmessage`, `onerror`, `onclose`) from old WebSocket instances before closing them, preventing ghost events from firing on replaced sockets.

### Changed
- **Connection Coalescing**: Added `deferConnect()` using `queueMicrotask()` to batch rapid subscribe calls into a single WebSocket connection. Multiple `subscribe*()` calls within the same microtask tick now result in exactly one `connect()`.
- **Close Code Guard**: `onclose` handler now checks `event.code !== 1000` (normal closure) to avoid reconnecting when the adapter intentionally closes a socket.
- **Error Filtering**: `onerror` only logs when the socket isn't already in `CLOSED` state, eliminating noise from replaced connections.
- **Clean Disconnect**: `disconnect()` now also detaches all handlers and clears `connectPending` flag.

### Impact Summary
Eliminated the WebSocket reconnect storm that caused rapid connect/disconnect cycles on startup and pair/timeframe changes. The adapter now establishes a single stable connection per subscription change.

## [2026-05-09] - Phase 11: Volume Bubbles

### Added
- **Draw Function**: Created `components/chart/drawBubbles.ts` — renders circles at price levels where single-side volume crosses a user-defined threshold. Radius and opacity scale with volume relative to the visible session max. Large bubbles (radius ≥ 12) show abbreviated volume labels inside.
- **State Management**: Added `bubblesEnabled`, `bubbleThreshold`, `bubbleMinRadius`, `bubbleMaxRadius`, and `bubbleSide` fields to `PanelState` in `lib/store/chart.ts`. All settings are persisted (v6).
- **Toolbar Controls**: Added inline bubble controls to `PanelToolbar.tsx`:
  - Circle toggle icon (teal when active, muted when off).
  - `VOL ≥` threshold input (JetBrains Mono, debounced 300ms).
  - Side selector: `B` (buy), `S` (sell), `B+S` (both) with `#3D7EFF` active state.

### Changed
- **ChartCanvas**: Integrated `drawBubbles` into the render loop between absorption markers and volume profile, matching the spec draw order.
- **ChartPanel**: Passes all bubble props through to `ChartCanvas`.
- **Store Migration**: Bumped persist version 5 → 6 with migration that initializes bubble defaults for existing users.

### Performance
- Bubbles skip rendering entirely when `barWidth < 4` (bars too small for readable bubbles).
- Capped at 20 bubbles per candle — if more cells cross threshold, only the 20 highest volume cells render.

### Impact Summary
The chart now highlights significant volume activity at specific price levels via colored circles. Teal = buy aggression (ask volume), red = sell aggression (bid volume). Bubbles work in both candle and footprint modes, providing order flow context without scanning individual footprint cells. The threshold filter keeps the chart clean — only levels that matter are shown. All settings persist across refresh.

## [2026-05-09] - Bug Fix: Global Font Rendering Consistency

### Fixed
- **Root Layout Font**: Moved font variables from `body` to `html` to ensure better inheritance across all app sections, including those with absolute positioning or complex z-indexing.
- **Direct Application**: Applied `inter.className` directly to the `body` in `layout.tsx` to guarantee `Inter` is the base font for the entire document.
- **Explicit Fallbacks**: Added `Inter` and `JetBrains Mono` as explicit fallbacks in `tailwind.config.ts` and set a global `font-family` rule in `globals.css` using the font variables.
- **Weight Loading**: Explicitly specified a full range of weights (400-900) for `Inter` to ensure professional-grade rendering of bold and extra-bold UI elements.

### Impact Summary
The application now consistently renders the intended `Inter` font family across the main header, sidebar, and all panel toolbars. By moving from a utility-only approach to a direct root-level application, font inheritance issues have been eliminated, providing a cohesive and professional aesthetic throughout the tool.

## [2026-05-09] - Phase 12: Custom Range Profile (Task 1)


### Added
- **Drawing Mode**: Implemented "Profile Draw Mode" for the chart. When active, users can click and drag to draw a selection rectangle on the canvas.
- **Components**: Created `components/chart/drawSelectionRect.ts` for rendering a subtle, dashed blue rectangle overlay.
- **UI**: Added a `PROFILE` toggle button to the `PanelToolbar` with dedicated active/inactive styling.
- **State Management**: Added `isDrawMode` and `setDrawMode` to `PanelState` in `lib/store/chart.ts`.
- **Interactions**: 
  - Mouse down/move/up logic in `ChartCanvas.tsx` using refs to handle smooth drag rendering without React state overhead.
  - `Escape` key shortcut to clear the current selection.
  - Automatic clearing of the selection when toggling draw mode off.
  - Clicking without dragging clears the selection.

### Changed
- **usePanZoom**: Updated to skip panning, vertical zoom, and horizontal zoom while `isDrawMode` is active. Enforces a `crosshair` cursor in draw mode.
- **ChartCanvas**: Integrated `drawSelectionRect` into the redraw loop, positioned between the grid and candles.
- **ChartPanel**: Propagates `isDrawMode` state to the canvas renderer.

### Impact Summary
Phase 1 of the Custom Range Profile feature is complete. Users can now enter a dedicated drawing mode and select a range on the chart with a visual rectangle. This provides the foundational interaction layer for upcoming calculation and coordinate-anchoring tasks.

## [2026-05-09] - Phase 12: Custom Range Profile (Task 2)

### Added
- **Coordinate Anchoring**: Converted the custom profile selection rectangle from pixel-based coordinates to chart-based coordinates (index and price).
- **Inverse Coordinates**: Refined `xToIndex` and `yToPrice` in `useCoordinates.ts` to support accurate pixel-to-data conversion with rounding and clamping.
- **State Management**: Added `customProfileRange` to `PanelState` in `lib/store/chart.ts` to persist the anchored selection.

### Changed
- **Interaction Logic**: Updated `ChartCanvas.tsx` to convert the selection rectangle into chart coordinates on mouse release. 
- **Drawing Logic**: Updated `drawSelectionRect.ts` to support re-projecting the anchored `customProfileRange` back into pixel coordinates on every frame, ensuring the rectangle stays locked to the candles and price levels during panning and zooming.
- **Persistence**: Finalized ranges now persist across sessions and are correctly re-rendered upon reload.

### Impact Summary
The selection rectangle is now fully "anchored" to the chart data. It no longer drifts when the user pans or zooms, providing a stable visual reference for the custom volume profile calculation in Phase 3.

## [2026-05-09] - Phase 12: Custom Range Profile (Task 3)

### Added
- **Custom Volume Profile**: Implemented volume profile calculation and rendering specifically for the user-selected chart range.
- **Interactive UI**:
  - Added a `✕ CLEAR` button inside the selection rectangle for easy removal.
  - Added a `CUSTOM` label to identify the range-based profile.
  - Hover detection for the clear button (button brightens and cursor changes to pointer).
- **Profile Rendering**:
  - Bars render along the right inner edge of the selection, growing leftward.
  - POC and VA High/Low lines are scoped specifically to the selection width.
  - Higher opacity (`0.5`) for custom profile bars to make them stand out.

### Changed
- **Visual Hierarchy**: Updated the draw stack to render the selection background behind candles and the profile/UI on top of candles.
- **Default Profile Dimming**: When a custom profile is active, the main volume profile and its POC/VA lines render at reduced opacity to minimize visual competition.
- **Interaction Flow**: Clearing the custom profile automatically exits drawing mode and restores the default profile's prominence.

The Custom Range Profile feature is now complete. Traders can define specific market segments to analyze localized volume distribution without losing the context of the overall session profile.

## [2026-05-09] - Phase 12: Custom Range Profile (Task 4)

### Added
- **Repositioning & Resizing**: Implemented drag-to-move and edge-resize functionality for the custom profile rectangle.
- **Resize Handles**: Added visual handle indicators on all four edges when the profile is selected and hovered.
- **Lock State**: Added a `customProfileLocked` state to prevent accidental movement/resizing, with a toggleable 🔒/🔓 button and "LOCKED" indicator.
- **Selection State**: Added `isProfileSelected` to distinguish between active and inactive profiles on the chart.
- **Hover Feedback**: Increased background and border opacity when hovering over the profile area.

### Changed
- **Bar Direction**: Flipped volume bars to grow from left-to-right (anchored to the left edge) for better visual balance.
- **UX Flow**:
  - Auto-exit "Draw Mode" after completing the first profile draw.
  - Decoupled `customProfileRange` from `isDrawMode`, allowing the profile to persist even when the draw tool is deactivated.
  - Border style now changes from solid (selected) to dashed (unselected).
- **Interaction Priority**: Refined `onMouseDown` logic to prioritize profile buttons (lock/clear) and dragging over global chart panning.

### Impact Summary
The Custom Range Profile is now a fully interactive tool. Users can not only draw ranges but also fine-tune them through resizing, move them to different time segments, and lock them in place once satisfied. This completes the feature with a premium, professional UX.



