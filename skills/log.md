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
