# OrderFlow Chart - Change Log

## [2026-09-12] - Fix: VWAP Visual Rendering & Incremental Array Truncation
- **What changed**:
  - In `lib/utils/vwap.ts`: enabled fallback to `displayCandles` when `base1mCandles` is empty; eliminated blocking `pending` state on missing 1m storage.
  - In `VwapCalculator.fullRecompute`: pushed all candle points to `this.series` instead of discarding all except the last point (`isLast`).
  - Added array length consistency check to trigger recomputation if series length diverges from candles length.
- **Why it changed**: VWAP was stuck in `pending` because local 1m DB history was empty, and `fullRecompute` produced an array with only 1 point, preventing line strokes.
- **Impact summary**: VWAP line and envelope bands render visibly and update in real-time; 0 tsc/lint errors.

## [2026-09-10] - Fix: Price & Time Axis Cursor Icons (ns/ew-resize) & Wheel Zoom
- **What changed**:
  - In `usePanZoom.ts` & `ChartCanvas.tsx`: added cursor detection setting `'ns-resize'` on price bar and `'ew-resize'` on time bar during hover/drag.
  - In `usePanZoom.ts`: enabled vertical price scale zooming on mouse wheel over price bar (`x >= chartWidth`).
  - Added double-click auto-fit scale reset on price axis and zoom reset on time axis.
  - In `CvdPanel.tsx`: enabled `'ew-resize'` cursor over time axis and vertical scale wheel zoom over CVD price axis.
- **Why it changed**: Cursor was stuck on `crosshair` over axes, and wheel scrolling over the price bar was blocked instead of zooming price.
- **Impact summary**: TradingView-standard `ns-resize`/`ew-resize` cursors and smooth vertical wheel zoom on price bar; 0 tsc/lint errors.

## [2026-09-10] - Fix: Price & Time Axis Blurriness and Low-Pixel Visuals
- **What changed**:
  - Replaced chunky bold font in `drawAxes.ts`, `drawCvd.ts`, and `drawCrosshair.ts` with TradingView standard 11px font stack (`-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`) and `#B2B5BE` contrast color.
  - Aligned axis tick mark strokes to half-pixel coordinates (`+ 0.5`) with explicit 1px line width to prevent 2px boundary blurring.
  - Aligned all price/time labels and badge text coordinates to exact integer pixels (`Math.round`), eliminating subpixel antialiasing blur.
  - In `lib/utils/canvas.ts`, enabled `imageSmoothingQuality = 'high'` on canvas contexts.
- **Why it changed**: Price and time axes appeared blurry and low-resolution due to heavy bold fonts, subpixel fractional text rendering, and unaligned strokes.
- **Impact summary**: Razor-sharp, clean price and time axes matching TradingView clarity across all panels; 0 tsc and lint errors.

## [2026-09-10] - Fix: Tooltip Dark Overlay Removal & Position Offsets
- **What changed**:
  - In `globals.css`: excluded `variant="tooltip"` from `dialog[is="fig-popup"]` 48px box-shadow; disabled `::backdrop` overlay on tooltips.
  - Styled tooltips as compact `#1A1A1A` pills with subtle 2px shadow (`0 2px 6px rgba(0,0,0,0.45)`), 4px radius, and pointer-events none.
  - In `FigTooltip.tsx`: added `position="bottom center"` and `offset="4 4"` support forwarding directly to internal popup dialog.
- **Why it changed**: Tooltips were inheriting large dialog shadow and backdrop overlay, covering buttons instead of appearing cleanly on top/bottom.
- **Impact summary**: Zero darkish overlay; tooltips render cleanly below/above items with button hover states intact; 0 lint/tsc errors.

## [2026-09-10] - Feature: FigUI3 Tooltips for Header, Subheader & Indicator Labels
- **What changed**:
  - In `Header.tsx` & `ConnectionStatus.tsx`: wrapped Storage, Unlock, Submit Key, Lock, MT5 status & Connect button in `<FigTooltip>`.
  - In `PanelToolbar.tsx`, `PairSelector.tsx` & `ChartModeSelector.tsx`: wrapped Timeframe, Pair, Mode, Indicators, Position, BUY/SELL, Refresh, Settings, and Focus in `<FigTooltip>`.
  - In `IndicatorLabels.tsx`: wrapped collapse toggle, live feed dot, source pills, and indicator action buttons in `<FigTooltip>`.
  - In `globals.css`: added `fig-tooltip { display: contents; }`; removed native browser `title` attributes.
- **Why it changed**: Replaced default browser tooltips with FigUI3 tooltips across top header, canvas subheaders, and indicator labels.
- **Impact summary**: Consistent FigUI3 dark-mode tooltips on hover across all controls; 0 tsc and lint errors.

## [2026-09-08] - Fix: Draggable Popups & Toolbar Drag Stop-and-Start Glitch
- **What changed**:
  - In `DrawingFavoritesToolbar.tsx`, `ChartSettingsDropdown.tsx`, and `CanvasDrawingToolbar.tsx`, removed `onPointerMove`/`onMouseMove` `stopPropagation()`.
  - Kept `onPointerDown` and `onMouseDown` `stopPropagation()` intact to prevent background canvas interactions on click.
- **Why it changed**: Recent UI event boundaries added `stopPropagation()` to move events on popup containers. Because drag handlers listen on `window`, move events were blocked whenever the cursor was over the popup, causing it to freeze until the cursor left the popup boundary.
- **Impact summary**: Both draggable favorites toolbar and global settings window drag smoothly without stopping or glitching; zero bloat; clean tsc and lint.

## [2026-09-08] - Fix: Position Tool TP/SL Hit Termination & Vertical Time Shading
- **What changed**:
  - In `drawLines.ts`, implemented `evaluatePositionOutcome` iterating from entry candle and halting tracking the instant candle wicks touch TP or SL.
  - Stopped trajectory arrow at the exact candle and price level of the hit SL/TP, preventing over-extension into subsequent candles.
  - Implemented vertical time-split shading: darker highlight fills active duration up to the exit candle; remainder of the box stays base color.
- **Why it changed**: Position tool kept tracking price after SL was already hit, erroneously drawing arrow into TP zone on subsequent bars.
- **Impact summary**: Positions terminate strictly when SL/TP is hit, matching TradingView vertical shading and trajectory stopping; 0 errors.

## [2026-09-08] - Feature: Single-Box Price Progress Shading & TradingView Drawing Layering
- **What changed**:
  - In `drawLines.ts`, refactored `drawPositionBackgrounds` so darker highlight tracks `currentPrice` solely inside the active box (TP or SL), leaving opposite box in base tint.
  - Refactored trajectory arrow in `drawLines.ts` to directly connect entry to the active candle close price.
  - In `ChartCanvas.tsx`, partitioned drawings: unselected drawings & positions render behind candles on `liveCtx`; selected tools render on overlay `ctx` on top with handles.
  - Added auto-selection on drawing creation and restricted box price badges to selected boxes.
- **Why it changed**: Position tool shaded both boxes simultaneously and arrow didn't track price; drawings obscured candles when unselected.
- **Impact summary**: Visual behavior matches TradingView with crisp candles above unselected tools and single-box price tracking; 0 TS/ESLint errors.

## [2026-09-08] - Feature: TradingView-Style Position Progress Shading & 2-Stage Canvas Layering
- **What changed**:
  - Added `drawPositionBackgrounds` in `drawLines.ts` with progress color differentiation (completed vs remaining profit and drawdown).
  - Implemented true 2-stage canvas layering in `ChartCanvas.tsx`: position backgrounds render behind candles on `liveCtx`, level lines/handles/tooltips on `ctx`.
  - Added trajectory dashed line with arrowhead pointing to the extreme excursion candle (max favorable or adverse excursion).
  - Completely deleted the synthetic `drawPositionCandleOverlap` hack, restoring 100% crisp, un-tinted candle bodies and wicks.
- **Why it changed**: Position tool rendered in front of candles causing murky artifacts, and lacked progress color differentiation.
- **Impact summary**: Candlesticks render crystal-clear over position boxes with completed vs remaining progress shading matching TradingView; 0 TS/ESLint errors.

## [2026-09-08] - Feature: Position Drawing Profit & Stop Loss Color Controls
- **What changed**:
  - Added `profitColor`, `profitOpacity`, `stopColor`, and `stopOpacity` fields to `DrawnLine` in `types/chart.ts`.
  - In `CanvasDrawingToolbar.tsx`, added dedicated Profit and Stop color & opacity pickers for position drawings.
  - In `drawLines.ts`, rendered profit/stop loss box fills, level lines, candle overlap, target/stop pill tooltips, and open P&L badge using selected colors with dynamic contrast text.
- **Why it changed**: Position tool floating bar lacked separate color selection for loss and profit boxes and their respective labels.
- **Impact summary**: Users can independently customize profit and stop loss colors/opacities with live canvas reflection; `npx tsc --noEmit` and `npm run lint` clean.

## [2026-09-08] - Fix: UI Overlay Canvas Isolation, Drawing Drag Sticking Fix & Layout Sync Controls
- **Drawing Drag Detachment Fix**: Fixed bug where dragging drawings stuck to cursor. When `onMouseDown` selected a drawing, React re-rendered, unmounting dynamically attached `window.mouseup` listeners and dropping the release event. Maintained persistent `window.mouseup` and dragging-only `window.mousemove` listeners across `ChartCanvas`, `usePanZoom`, and `CvdPanel`.
- **Event Boundary Isolation**: Scoped hover/crosshair listeners directly to `canvas`. Window mousemove listeners are active strictly during active drags, preventing canvas interaction when hovering over UI overlays.
- **Continuous Multi-Timeframe Drawing Sync**: Refactored `chartCanvasUtils.ts` to continuous fractional index interpolation (`resolveIndexFromTime`) from timestamps.
- **Ephemeral Drawing Drag**: Added `drawingDrag` state to `chartRuntime.ts` for real-time overlay streaming without React re-renders or `localStorage` latency; committed once on mouseup.
- **Sync Drawings Toggle**: Added independent "Drawings" switch under "Sync In Layout" in `ChartLayoutDropdown.tsx`.
- **Validation**: `npx tsc --noEmit` and `npm run lint` pass with 0 errors and 0 warnings.

## [2026-09-07] - Feature: TradingView Candle-to-Candle Vertical Crosshair Snapping & Placed Vertical Lines on Top of CVD Panel
- **What changed**:
  - **TradingView-Style Candle-to-Candle Vertical Crosshair Snapping**:
    - In [`components/chart/ChartCanvas.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx):
      - Snapped crosshair X coordinate (`mx`) to the exact candle center: `const snappedIndex = xToIndex(mouseX.current, candles, ...); mx = indexToX(snappedIndex);`.
      - Kept crosshair Y coordinate (`my = mouseY.current`) moving completely freely anywhere on the canvas.
      - As the cursor moves left or right, the vertical crosshair remains locked to the center of the current candle as long as the mouse is within its boundary, jumping cleanly to the neighboring candle once crossed.
      - Enabled crosshair synchronization between `ChartCanvas` and `CvdPanel` within the same panel (`crosshair.activePanel === panelId`), ensuring the vertical dotted line extends seamlessly across both canvases without distortion.
    - In [`components/chart/CvdPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CvdPanel.tsx):
      - Snapped crosshair X coordinate to candle center `mx = indexToX(xToIndex(mouseX.current, ...))` on mouse move over CVD while allowing `my = mouseY.current` to move freely.
      - Connected crosshair styles (`color, opacity, thickness, style`) from `useChartStore` to `drawCrosshair`.
      - Updated crosshair broadcast in `updateCrosshair` to unconditionally sync with `ChartCanvas` within the panel.
    - In [`components/chart/useCoordinates.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/useCoordinates.ts):
      - Enhanced `timeToIndex` to support time extrapolation beyond first and last candles so crosshair alignment remains continuous in right-margin and past empty space.
  - **Placed Vertical Line (`line.type === 'vertical'`) on Top of CVD Panel**:
    - In [`components/chart/ChartPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartPanel.tsx):
      - Passed `drawnLines={panel.drawnLines}` prop to `CvdPanel`.
    - In [`components/chart/CvdPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CvdPanel.tsx):
      - Added `drawnLines?: PanelState['drawnLines']` to `CvdPanelProps` and retrieved live drawn lines with `useMemo`.
      - In the `overlay` layer (`canvasRef` `z-20`), filtered vertical lines (`line.type === 'vertical'`), resolved coordinates with `resolveLineForRender(line, candles)`, and rendered them on top of CVD indicator series via `drawLines`.
      - Rendered the corresponding TradingView-style date/time badge on the bottom time axis via `drawDrawingPriceLabels`.
- **Why it changed**:
  - Direct user feedback:
    1. Crosshair behavior on the main chart moved freely in both directions, whereas CVD snapped candle-by-candle. This caused the vertical crosshair line to misalign and appear distorted between the chart and the CVD panel. Vertical crosshairs in TradingView stay locked on a candle until the boundary to the next candle is crossed, while the horizontal line moves freely.
    2. Placed vertical line drawings disappeared at the CVD boundary as if going "behind the CVD" rather than continuing down across the CVD panel to the bottom time axis with its date/time badge.
- **Impact summary**:
  - Vertical crosshairs now stay locked to candle centers on both chart and CVD, providing an aligned, unified line between panels.
  - Placed vertical lines render cleanly on top of CVD and terminate with their date/time badges on the bottom time axis.
  - Both `npx tsc --noEmit` and `npm run lint` pass with 0 errors and 0 warnings.


## [2026-09-07] - Fix: Candle Overlap on Price/Time Axes (Layer Clipping) & CVD Missing Horizontal Time Bar
- **What changed**:
  - **Candles Overlapping Price Axis & Time Axis Layering Fix**:
    - In [`components/chart/ChartCanvas.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx):
      - Enforced strict chart area clipping `[0, 0, chartWidth, chartHeight]` via `liveCtx.save()`, `liveCtx.rect(0, 0, chartWidth, chartHeight)`, `liveCtx.clip()`, and `liveCtx.restore()` across all main chart series (`drawCandles`, `drawFootprint`, `drawAggregateTradeBubbles`, `drawAbsorption`, `drawExhaustion`, `drawIceberg`, and `drawVwap`).
      - Prevented overscan candles (calculated by `getVisibleRange`) and panning candles from rendering into the price axis region (`x >= chartWidth`) or bottom panels/time axis (`y >= chartHeight`).
      - Fixed the issue where candles on `liveCanvasRef` (`z-10`) sat physically in front of `bgCanvasRef` (`z-0`), eliminating the artifact where hollow candles showed price numbers through their bodies or solid candles obscured price numbers.
      - Applied chart area clipping `[0, 0, chartWidth, chartHeight]` to live volume profiles (`drawVolumeProfile`, session profiles) and custom profiles on `ctx` (`canvasRef`).
  - **CVD Horizontal Time Axis Occlusion Fix**:
    - In [`components/chart/drawCvd.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawCvd.ts):
      - Removed `ctx.fillStyle = '#0F0F0F'; ctx.fillRect(0, 0, canvasWidth, canvasHeight);` from `drawCvd` on `liveCtx` (`z-10`). This opaque fill previously wiped out and occluded `drawTimeAxis` rendered on `bgCanvasRef` (`z-0`).
      - Kept `liveCtx` transparent in the bottom time axis area (`[0, chartHeight, chartWidth, timeAxisHeight]`), allowing `bgCtx`'s time axis to shine through.
      - Removed unused `canvasWidth` option.
    - In [`components/chart/CvdPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CvdPanel.tsx):
      - Filled `DEFAULT_CANVAS_BG` (`#0F0F0F`) on `bgCtx` before rendering `drawTimeAxis` so the CVD panel has a proper dark canvas background while the time axis remains fully visible.
  - **Axis Boundary Clamping & Corner Protection**:
    - In [`components/chart/drawAxes.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawAxes.ts):
      - In `drawTimeAxis`: wrapped in `ctx.save()`, `ctx.rect(0, chartHeight, chartWidth, timeAxisHeight)`, `ctx.clip()`, and added `if (x < 0 || x > chartWidth) continue;` to ensure time labels and ticks never bleed into the right-side price axis corner.
      - In `drawPriceAxis`: added boundary check `if (y < 8 || y > chartHeight - 8) continue;` to ensure price ticks and labels never bleed into the bottom time axis corner.
- **Why it changed**:
  - Direct user feedback:
    1. When the CVD indicator is on the chart, the horizontal time bar at the bottom was not showing up.
    2. When candles are scrolled or panned close to the price and time bars, candles were rendering on top of the price/time bars (candles on `liveCanvasRef` `z-10` rendered without clipping over `bgCanvasRef` `z-0` price/time axes, causing hollow candles to reveal price numbers through their interior and solid candles to obscure them).
- **Impact summary**:
  - When CVD is open, the horizontal time axis displays clearly at the bottom with timestamps, ticks, and borders intact.
  - Candlesticks, footprints, bubbles, VWAP, and profiles are cleanly clipped at the price axis and time axis boundaries, matching standard financial charting behavior (e.g. TradingView) with zero layer bleed or see-through artifacts.
  - `npx tsc --noEmit` passed with exit code 0; `npm run lint` passed with 0 warnings and 0 errors.

## [2026-09-07] - Fix: Crosshair Tooltip Alignment & Style, Hollow Candlestick Sharpness, Retina/DPI Blur & Indicator Grid Borders
- **What changed**:
  - **Crosshair Tooltip Redesign & Price Axis Text Alignment**:
    - In [`components/chart/drawCrosshair.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawCrosshair.ts):
      - Removed the `#8A8A8A` border stroke (`ctx.strokeRect` and `CROSSHAIR_BORDER` eliminated).
      - Added subtle 2px rounded corners using `ctx.roundRect(badgeX, badgeY, badgeWidth, rectHeight, 2)`.
      - Corrected price text horizontal coordinate to `chartWidth + 12`, perfectly aligning the crosshair price label with the price numbers on the price axis (`drawPriceAxis.ts`).
      - Set badge bounds to `badgeX = chartWidth + 2` and `badgeWidth = Math.max(textWidth + 16, priceAxisWidth - 4)` matching active pricing (`drawPriceLine.ts`) and line badges (`drawLines.ts`).
      - Updated time badge to use `ctx.roundRect` with 2px radius and no border stroke.
    - In [`components/chart/drawCvd.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawCvd.ts):
      - Updated `drawCvdCrosshairValueLabel` to match `drawCrosshairPriceLabel` with borderless background, 2px border radius, and text alignment at `chartWidth + 12`.
  - **Hollow Candlestick Sharpness & Standard Financial Rendering**:
    - In [`components/chart/drawCandles.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawCandles.ts):
      - Added half-pixel coordinate alignment (`Math.floor(coord) + 0.5`) for 1px wick lines and hollow stroke rectangles to eliminate 50% opacity antialiasing blur.
      - Enforced explicit `ctx.lineWidth = 1` and wrapped candle rendering in `ctx.save()` / `ctx.restore()`.
      - Followed standard financial charting (TradingView) behavior: bullish candles (`Close >= Open`) render as crisp hollow outlines with vibrant `bodyRgba`, and bearish candles (`Close < Open`) render as solid filled bodies.
  - **Retina Display & Multi-Monitor (1K vs 2K) Crispness**:
    - In [`lib/utils/canvas.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/lib/utils/canvas.ts) (`initCanvas`):
      - Rounded logical dimensions `logicalWidth` and `logicalHeight` to integers, set `canvas.style.width` and `canvas.style.height` strictly to integer pixels, and set `canvas.width` and `canvas.height` to exact physical buffer dimensions (`Math.round(logical * dpr)`). Scaled context by the exact physical-to-logical ratio to prevent browser GPU bilinear interpolation blurring on 1K screens (`dpr = 1`).
    - In [`components/chart/ChartCanvas.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx) and [`components/chart/CvdPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CvdPanel.tsx):
      - Ensured `setupCanvas` and `ResizeObserver` use integer-rounded dimensions.
      - Added continuous `window.devicePixelRatio` checking on window `resize` and `matchMedia` to immediately rescale canvas when dragged between 1K and 2K monitors.
    - In [`app/page.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/app/page.tsx):
      - Updated split container styles so panel 2 uses `flex: 1` rather than fixed percentage plus 5px divider, eliminating subpixel positioning offsets.
  - **Unified 28% Opacity Grid Borders for Stats & CVD Indicators**:
    - In [`components/chart/drawStatsGrid.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawStatsGrid.ts):
      - Replaced 100% opaque `DEFAULT_BORDER_COLOR` with `chartColorToRgba(gridColor, gridOpacity)` using global chart settings (`horizontalGridLineColor` and `horizontalGridLineOpacity`, defaulting to 28% opacity `#444444`) for top border and internal row dividers.
    - In [`components/chart/drawCvd.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawCvd.ts) & [`types/cvd.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/types/cvd.ts):
      - Added `gridColor`, `gridOpacity`, and `gridStyle` to `DrawCvdOptions`.
      - Updated `drawCvdGrid` and `drawCvdAxis` to use `chartColorToRgba(gridColor, gridOpacity)`.
    - In [`components/chart/CvdPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CvdPanel.tsx):
      - Subscribed to `horizontalGridLineColor`, `horizontalGridLineOpacity`, and `horizontalGridLineStyle` from `useChartStore` and forwarded them to `drawCvd`.
    - In [`components/chart/ChartPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartPanel.tsx):
      - Styled the CVD container top border `borderTopColor` using `chartColorToRgba(horizontalGridLineColor, horizontalGridLineOpacity)`.
    - In [`components/chart/drawAxes.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawAxes.ts):
      - Updated `drawTimeAxis` horizontal border to use `chartColorToRgba(gridColor, gridOpacity)`.
- **Why it changed**:
  - Direct user feedback: crosshair tooltip border looked unpolished, lacked border radius, and price text was horizontally misaligned with the price axis numbers; hollow candlesticks appeared washed-out/opacitated; dragging split charts between 1K and 2K screens caused blurring; and Stats indicator and CVD borders were 100% opaque rather than inheriting the 28% opacity global grid setting.
- **Impact summary**:
  - Crosshair tooltips now render with clean 2px rounded corners and zero border outline, with price text aligned pixel-perfect to `chartWidth + 12`.
  - Hollow candlesticks are razor sharp with vibrant colors, and canvas stays pixel-crisp across 1K and 2K monitors.
  - Stats indicator, CVD horizontal gridlines, and time axis borders now cohesively adhere to the global 28% opacity theme token.
  - Zero TypeScript compiler errors (`npx tsc --noEmit` exited 0) and zero ESLint errors (`npm run lint` clean).

## [2026-09-07] - UI Refinement: Dropdown Padding, Row Heights (+50%), Text Alignment, Layout Positioning Fix & Cursor Pointer
- **What changed**:
  - **Overall Dropdown Padding, Rounding & Width Expansion**:
    - In [`components/ui/IndicatorsModal.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/IndicatorsModal.tsx) and [`components/ui/ChartModeSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartModeSelector.tsx): increased overall padding from `p-1.5` to `p-2.5` (10px), rounded corners to `rounded-xl`, and expanded width from `w-52` (208px) to `w-56` (224px).
    - In [`components/ui/ChartLayoutDropdown.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartLayoutDropdown.tsx): increased overall padding to `p-3.5` (14px), rounded corners to `rounded-xl`, and expanded width to `w-60` (240px).
    - In [`app/globals.css`](file:///c:/Users/d/Documents/ob/orderflowApp/app/globals.css): added `border-radius: 12px !important;` to `dialog[is="fig-popup"]` and `dialog[is="fig-dialog"]`.
  - **Left-Aligned Text for Indicators & Candlesticks**:
    - In [`components/ui/IndicatorsModal.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/IndicatorsModal.tsx) and [`components/ui/ChartModeSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartModeSelector.tsx): added `justify-start text-left` to button containers and `text-left select-none` to text labels.
    - In [`app/globals.css`](file:///c:/Users/d/Documents/ob/orderflowApp/app/globals.css): added global rule `dialog[is="fig-popup"] button { text-align: left !important; justify-content: flex-start !important; cursor: pointer !important; }` to override user-agent center alignment on native `<button>`.
  - **+50% Row Height (Spacious & Comfortable)**:
    - In [`IndicatorsModal.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/IndicatorsModal.tsx) and [`ChartModeSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartModeSelector.tsx): increased row height by 50% from `py-2` (~32px) to `py-2.5 min-h-[38px] px-3` (38–40px), eliminating narrow/squeezed rows.
    - In [`ChartLayoutDropdown.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartLayoutDropdown.tsx): enlarged layout buttons by ~50% from `h-8 w-9` (32x36px) to `h-10 w-12` (40x48px) with `p-2 rounded-lg`, increased icon sizes from `20` to `22`, and increased Crosshair sync row to `px-3 py-2.5 min-h-[38px]`.
  - **Fixed Layout Dropdown Position Jump**:
    - In [`components/ui/fig/FigPopup.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/FigPopup.tsx): updated `updatePosition()` to support horizontal positioning modes (`right`, `center`, `left`) and parse `offset` parameters (`offsetX`, `offsetY`). For `position="bottom right"`, `left` is now computed as `rect.right - popupWidth - offsetX`, matching FigUI3's calculation.
    - Added `position` and `offset` to the `useIsomorphicLayoutEffect` dependency array in `FigPopup.tsx`.
    - Dropdown opens with its top-right corner directly under the trigger icon and remains anchored there without jumping to the center.
  - **Universal Cursor Pointer Across Panel Toolbar Controls**:
    - In [`app/globals.css`](file:///c:/Users/d/Documents/ob/orderflowApp/app/globals.css): enforced `cursor: pointer !important;` across `fig-button`, `fig-button *`, `fig-segment`, `fig-segment *`, `fig-segmented-control`, and `.fig-button`.
    - In [`components/ui/fig/FigButton.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/FigButton.tsx): added `style={{ cursor: disabled ? 'default' : 'pointer' }}` and an effect penetrating the open shadow DOM to guarantee the inner `.fig-button-control` button has `cursor: pointer`.
    - In [`components/ui/fig/FigSegmentedControl.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/FigSegmentedControl.tsx): added `cursor-pointer` class and `style={{ cursor: 'pointer' }}` to `fig-segment` and `fig-segmented-control`.
    - In [`components/ui/PanelToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/PanelToolbar.tsx): ensured all action triggers (`PairSelector`, `FigSegmentedControl`, `ChartModeSelector`, `Indicators`, `Position`, `BUY`, `SELL`, `Refresh`, `Settings`, `Focus`) have `cursor-pointer`.
  - **Documentation & Map Synchronization**:
    - Updated [`skills/map.md`](file:///c:/Users/d/Documents/ob/orderflowApp/skills/map.md) with updated responsibilities for `FigPopup.tsx`, `FigButton.tsx`, `FigSegmentedControl.tsx`, `IndicatorsModal.tsx`, `ChartModeSelector.tsx`, and `ChartLayoutDropdown.tsx`.
- **Why it changed**:
  - Direct user feedback:
    1. Provide overall rounded padding to Candlestick, Indicators, and Chart Layout dropdowns.
    2. Left-align text for indicators and candlesticks instead of center-aligned.
    3. Add 0.5 (+50%) to the height of individual items to fix squeezed/narrow rows.
    4. Fix the Chart Layout dropdown glitch where it opened underneath the icon on the left, but then moved to the center.
    5. Change cursor to pointer for all icons and controls on the chart panel (timeframes, symbol, candlestick, indicators, position, buy/sell, refresh, settings, focus).
- **Impact summary**:
  - All three dropdowns are spacious, beautifully padded, and consistently rounded.
  - Text is cleanly left-aligned across all dropdown rows.
  - Rows are +50% taller and comfortably readable without feeling cramped.
  - Chart Layout dropdown is rock-solidly positioned at the top-right corner under the icon with zero jump or center-shift.
  - Hovering over any interactive element on the chart panel shows a hand/pointer cursor.
  - `npx tsc --noEmit` passed with 0 errors; `npm run lint` passed with 0 warnings and 0 errors.

## [2026-09-07] - Feature: Chart Layout Selector Relocation & Indicator/Candlestick Dropdown UI Refinement
- **What changed**:
  - **Relocated Chart Layout Selector**:
    - Removed `<ChartLayoutDropdown />` and its import from [`components/layout/Header.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Header.tsx). Preserved the semantic single `<h1>` (`OrderFlow Terminal`).
    - Updated [`components/ui/ChartLayoutDropdown.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartLayoutDropdown.tsx) to accept an optional `panelId?: PanelId` prop, generating unique trigger anchor IDs (`chart-layout-dropdown-trigger-${panelId}`) to prevent ID collision in split-screen layouts.
    - Removed the `<ChevronDown>` down-arrow icon next to the layout icon on the trigger button, keeping only the layout preview icon.
    - Styled trigger button as `variant="ghost" icon` with comfortable padding (`px-1.5`) and set dropdown popup position to `position="bottom right"`.
    - Mounted `<ChartLayoutDropdown panelId={panelId} />` in [`components/ui/PanelToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/PanelToolbar.tsx) on the chart panel toolbar, placed directly to the left of the right action group (Refresh, Settings, and Expand buttons).
  - **Indicator Dropdown UI Refinement**:
    - Updated [`components/ui/IndicatorsModal.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/IndicatorsModal.tsx):
      - Removed the "Indicators" title/header from the dropdown.
      - Removed the one-line descriptions/explanations under each indicator name.
      - Removed plus icons (`+`) and checkmark/tick icons (`Check`).
      - Added persistent selected state styling on active indicators (`bg-[#2A2A2A] border border-[#383838] text-white`) matching the timeframe button visual pattern.
      - Preserved instant click-to-add/toggle and dropdown dismiss behavior.
  - **Candlestick / Chart Mode Dropdown UI Refinement**:
    - Updated [`components/ui/ChartModeSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartModeSelector.tsx):
      - Added custom TradingView-style SVG icons for Candlestick, Hollow Candlestick, and Footprint positioned on the left of each option row.
      - Removed "Chart Mode" title/header.
      - Removed descriptions/subtext for each chart mode.
      - Removed checkmark/tick icons on the right.
      - Added persistent selected state styling on the active mode (`bg-[#2A2A2A] border border-[#383838] text-white`) matching the timeframe button visual pattern.
      - Maintained FigUI 3 design system tokens and spacing (dark theme, crisp left-aligned button rows).
  - **Documentation & Map Synchronization**:
    - Updated [`skills/map.md`](file:///c:/Users/d/Documents/ob/orderflowApp/skills/map.md) with updated responsibilities for `Header.tsx`, `PanelToolbar.tsx`, `ChartLayoutDropdown.tsx`, `ChartModeSelector.tsx`, and `IndicatorsModal.tsx`.
- **Why it changed**:
  - Direct user requirements:
    1. Move the "Select chart layout" button from the top-left header to the chart panel toolbar on the left side next to the Refresh, Settings, and Expand buttons.
    2. Remove the chevron down-arrow next to the layout icon on the trigger button.
    3. Refine Indicator dropdown: remove "Indicators" title, remove descriptions, remove plus/check icons, add persistent selected background matching timeframe buttons, and keep simple click-to-add.
    4. Refine Candlestick dropdown: remove "Chart Mode" title, remove descriptions, remove check icons, add TradingView-style SVGs on the left for Candlestick, Hollow Candlestick, and Footprint, add persistent selected background matching timeframe buttons.
- **Impact summary**:
  - Layout selector is conveniently located on each chart panel's action bar without cluttering the global header.
  - Indicator and Candlestick dropdowns now have a clean, concise, high-density TradingView-inspired layout with FigUI 3 dark-theme design tokens and active state pill styling.
  - Clean TypeScript verification (`npx tsc --noEmit` exited 0) and ESLint verification (`npm run lint` exited 0).

## [2026-09-07] - Fix: Dropdown Centering Glitch, Toolbar Z-Index Stacking, and Pricing Sidebar Color
- **What changed**:
  - **Eliminated Dropdown Centering Flash & Glitch**:
    - Updated [`components/ui/fig/FigPopup.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/FigPopup.tsx):
      - Added explicit `mode?: 'dropdown' | 'modal'` prop (with backward-compatible support for `dropdown={true}`).
      - Forwarded `anchor={typeof anchor === 'string' ? anchor : undefined}` directly onto the `<dialog>` element in JSX so FigUI3's `connectedCallback()` and `showPopup()` resolve the anchor element immediately during DOM connection rather than falling back to centered viewport coordinates.
      - Forwarded `data-mode={isDropdown ? 'dropdown' : 'modal'}` and applied base fixed positioning in inline styles (`...(isDropdown ? { position: 'fixed', margin: 0 } : {})`).
      - Switched dropdown positioning to `useIsomorphicLayoutEffect` (`useLayoutEffect`), calculating and setting `top`, `left`, `position = 'fixed'`, and `margin = '0'` synchronously before browser paint, eliminating `requestAnimationFrame` and `setTimeout(30)` initial delays.
    - Updated [`components/ui/ChartLayoutDropdown.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartLayoutDropdown.tsx), [`components/ui/ChartModeSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartModeSelector.tsx), and [`components/ui/IndicatorsModal.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/IndicatorsModal.tsx) to explicitly pass `mode="dropdown"`.
  - **Corrected Draggable Toolbar vs Header Stacking Order**:
    - Updated [`components/ui/DrawingFavoritesToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/DrawingFavoritesToolbar.tsx): changed z-index from `z-40` to `z-[70]`.
    - Preserved Header at `z-[60]` and Global Settings at `z-[1000]`. Stacking order is now strictly: Global Settings (`z-[1000]`) > Draggable Toolbar (`z-[70]`) > Header (`z-[60]`) > Normal page content (`z-0` – `z-10`). Dragging the toolbar over/near the header keeps the toolbar rendered above the header while remaining beneath Global Settings.
  - **Updated Pricing Sidebar Color to Existing Global Token #2C2C2C**:
    - Updated [`components/chart/drawAxes.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawAxes.ts): imported `DEFAULT_HEADER_SIDEBAR_BG` (`#2C2C2C`, matching root `--bg-surface`) from [`lib/config/chartColors.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/lib/config/chartColors.ts).
    - Defined `PRICE_AXIS_BG_COLOR = DEFAULT_HEADER_SIDEBAR_BG` and updated `drawPriceAxis` background fill to `PRICE_AXIS_BG_COLOR`, rendering the vertical pricing sidebar in `#2C2C2C` while preserving `DEFAULT_CANVAS_BG` (`#0F0F0F`) on the horizontal time axis and chart canvas.
  - **Documentation & Map Synchronization**:
    - Updated [`skills/map.md`](file:///c:/Users/d/Documents/ob/orderflowApp/skills/map.md) with updated responsibilities for all modified components.
- **Why it changed**:
  - Direct user requirements:
    1. Fix Indicator, Candlestick, and Chart Layout dropdowns popping open in the center of the application before jumping underneath their triggers.
    2. Fix draggable toolbar sliding underneath the header when dragged near the top.
    3. Change pricing sidebar color to `#2C2C2C` using the existing global CSS variable/token without altering unrelated styles.
- **Impact summary**:
  - Dropdowns open directly underneath triggers on the first frame with zero flicker, jumping, or centered intermediate state. Modal mode remains supported for centered/modal dialogs.
  - Draggable toolbar stays layered above the header and beneath Global Settings.
  - Pricing sidebar cleanly renders with the `#2C2C2C` design token.
  - Zero TypeScript compiler errors (`npx tsc --noEmit` exited 0) and zero ESLint errors or warnings (`npm run lint` exited 0).

## [2026-09-07] - UI Improvements: Chart Layout Select Styling, Tooltip & Browser Tooltip Removal
- **Layout Select Styling**: Updated `ChartLayoutDropdown.tsx` with toolbar-matched icon thickness (`strokeWidth="1.5"`), comfortable padding (`h-8 w-9 p-1.5`), full-area hover covers, `cursor-pointer`, and active blue border/glow.
- **Closed Dropdown Tooltip**: Wrapped header trigger in `<FigTooltip text={!isOpen ? 'Select chart layout' : ''}>` for clean FigUI3 tooltip only when closed.
- **Removed Default Tooltips**: Stripped all `title` attributes inside the dropdown so hovering options shows no default/browser tooltip.
- **Validation**: Verified with `npx tsc --noEmit` (exit 0) and `npm run lint` (exit 0).

## [2026-09-07] - UI Fixes: 28% Grid Opacity & Draggable Toolbar Sizing Fix
- **Default Grid Opacity**: Updated `DEFAULT_GRID_OPACITY = 0.28` (28%) in `chartColors.ts`, `chart.ts` (store v38 migration), and `drawAxes.ts`.
- **Draggable Toolbar Fix**: Removed `popup-contrast` causing drag handle grey card; styled buttons with 32x32px hit area, full-area hover, strokeWidth 1.5 icons, and active border/glow inside `FigTooltip`.
- **Dropdowns, Header & Crosshair**: Header `#0F0F0F`, hidden Sidebar, `dropdown` prop on `FigPopup` selectors, crosshair extended through indicators with bottom-aligned time label.
- **Validation**: Verified with `npx tsc --noEmit` (exit 0) and `npm run lint` (exit 0).

## [2026-09-06] - Fix: Timeframe Switching, Drawing Axis Badge Contrast, TradingView Pair Selector, and Main Padding

- **What changed**:
  - **Timeframe Click Fix**:
    - Updated [`components/ui/fig/FigSegmentedControl.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/FigSegmentedControl.tsx): added explicit `onClick` prop forwarding to [`FigSegment`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/FigSegmentedControl.tsx#L26), bound delegated native `click` listener on host `<fig-segmented-control>`, and added synthetic React click handling on the host to ensure timeframe pill clicks reliably invoke `onChange` / `setTimeframe(panelId, tf)` and update the chart.
  - **Drawing Badge Text Contrast Fix**:
    - Updated [`components/chart/drawLines.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts): implemented `getContrastTextColor(color)` relative luminance calculator. Updated `drawTimeAxisBadge` and `drawPriceAxisBadge` to dynamically calculate text fill color based on badge background (`accentColor`) instead of hardcoded `#FFFFFF`. When drawing badges have white `#FFFFFF` fill (e.g. vertical lines or box boundaries), text now renders in `#0F0F0F`, completely eliminating the invisible white-on-white text bug.
  - **TradingView Symbol Search Redesign via FigUI3**:
    - Reimplemented [`components/ui/PairSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/PairSelector.tsx) adhering to FigUI3 architecture and TradingView's symbol search layout (without a searchbar):
      - Uses `<FigPopup>` anchored directly to `#pair-selector-trigger-${panelId}` with `offset="0 4"` and solid `#181818` background.
      - Uses `<FigSegmentedControl full size="small">` for category filter tabs: `All`, `Perpetual Futures`, `Spot`.
      - Uses `<FigButton variant="ghost" size="medium">` for each instrument row, featuring circular crypto badges (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, LTC), bold bright blue tickers (`#2962FF`, e.g. `BTCUSDT.P`), contract descriptions, `swap crypto defi` / `spot crypto` tags, and Binance exchange badges with yellow logos.
      - Active and hover selection states adhering to FigUI3 design tokens and TradingView aesthetics.
  - **Main Tag Vertical Padding Removal**:
    - Updated [`app/page.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/app/page.tsx): added `p-0 py-0` to `<main>` to ensure no vertical padding is applied.
  - **Documentation & Map Synchronization**:
    - Updated [`skills/map.md`](file:///c:/Users/d/Documents/ob/orderflowApp/skills/map.md) to record updated responsibilities for `FigSegmentedControl.tsx`, `drawLines.ts`, `PairSelector.tsx`, and `app/page.tsx`.
- **Why it changed**:
  - User requested:
    1. Fix clicking on timeframes not changing the chart.
    2. Fix white-on-white invisible text in time axis badges from attached screenshot.
    3. Fix pair selection popup dialog with inspiration from TradingView symbol search, omitting searchbar.
    4. Remove unnecessary vertical padding on `<main>` tag.
- **Impact summary**:
  - Timeframe pills immediately switch chart timeframes on click.
  - Time and price axis badges for white drawing objects render readable dark text.
  - Pair selection dialog is now an expansive, polished TradingView-style modal with instant tab filtering.
  - Main app view operates with zero vertical padding.
  - Clean TypeScript verification (`npx tsc --noEmit` exited 0) and ESLint verification (`npm run lint` exited 0).

## [2026-09-06] - Feature: On-Canvas Volume Overlay, Drawing Tool 1px White Defaults, Auth-Gated Storage, and FigUI Tooltips

- **What changed**:
  - **On-Canvas Volume Indicator Overlay**:
    - Updated [`chartBottomPanels.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/chartBottomPanels.ts): volume bars no longer deduct layout height from `mainChartHeight`. The main price canvas retains its full height (only reduced by docked stats grid items if active). `volumePanel` calculates `panelHeight` and anchors directly to the bottom of the main canvas (`panelTop = mainChartHeight - panelHeight`).
    - Updated [`drawVolumeBars.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawVolumeBars.ts): removed opaque `DEFAULT_CANVAS_BG` background fill and `DEFAULT_BORDER_COLOR` top border so volume bars render transparently on canvas.
    - Updated [`ChartCanvas.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx): relocated `drawVolumeBars` invocation directly before candlesticks/footprints on `liveCtx` so volume bars sit at the bottom of the main chart canvas layered behind candlesticks (matching TradingView and user capture).
  - **Drawing Object Defaults & Trash Delete Icon**:
    - In [`ColorPickerPopover.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ColorPickerPopover.tsx) and [`drawLines.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts), updated `DEFAULT_DRAWING_COLOR` to `'#FFFFFF'` (white) and `DEFAULT_DRAWING_STROKE_WIDTH` to `1` (1px).
    - In [`CanvasDrawingToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CanvasDrawingToolbar.tsx), replaced close `X` icon with `Trash2` icon on the delete action buttons in both `DrawingToolbar` and `CustomProfileToolbar`.
  - **Manage Storage Unlock Gating**:
    - In [`Header.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Header.tsx), conditionally gated the Manage Storage database button behind `isAuthenticated` so it only displays when unlocked.
  - **Draggable Drawing Toolbar Spacing & Native FigUI Tooltips**:
    - Added `FigTooltipProps` and `'fig-tooltip'` element declarations to [`types/figui3.d.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/types/figui3.d.ts).
    - Built reusable [`FigTooltip.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/FigTooltip.tsx) wrapper and exported from [`components/ui/fig/index.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/index.ts).
    - In [`DrawingFavoritesToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/DrawingFavoritesToolbar.tsx), expanded horizontal room with `gap-1.5`, `px-2 py-1`, and `mx-0.5` dividers. Wrapped all buttons in `<FigTooltip text="...">` and removed redundant native `title="..."` attributes to replace default browser tooltips with FigUI tooltips.
    - Wrapped action buttons in [`CanvasDrawingToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CanvasDrawingToolbar.tsx) with `<FigTooltip text="...">`.
  - **Documentation & Map Synchronization**:
    - Updated [`skills/map.md`](file:///c:/Users/d/Documents/ob/orderflowApp/skills/map.md) to describe new responsibilities across the modified files.
- **Why it changed**:
  - Direct user request:
    1. Fix volume indicator to render directly on canvas instead of taking separate bottom layout space.
    2. Set default drawing objects to 1px white stroke with a delete/trash icon instead of close icon.
    3. Make Manage Storage button visible only when unlocked.
    4. Give draggable drawing toolbar horizontal room and replace browser default tooltips with FigUI tooltips.
- **Impact summary**:
  - Main price chart is full height with volume bars sitting directly at the bottom behind candles.
  - Drawing tools default to 1px white lines and have clear trash icons.
  - Storage button is safely hidden until authenticated.
  - Draggable favorites toolbar has comfortable horizontal spacing and modern FigUI tooltips on hover.
  - TypeScript checks clean (`npx tsc --noEmit` exited 0) and ESLint clean (`next lint` exited 0).

## [2026-09-06] - Typography & Header: MacFont (BlinkMacSystemFont) Replacement & Header Logo Removal

- **What changed**:
  - **MacFont (`BlinkMacSystemFont`) Integration**:
    - Replaced Google `Inter` font in [`app/layout.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/app/layout.tsx) with Next.js `localFont` loading `MacFont` files (`app/fonts/MacFont/fonts/BlinkMacSystemFont-*.woff2`) spanning weights 100 to 900 in normal and italic styles.
    - Imported `app/fonts/MacFont/stylesheet.css` in [`app/layout.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/app/layout.tsx) to register the native `@font-face` `'BlinkMacSystemFont'` family in CSS and `document.fonts`.
    - Configured `--font-sans` CSS variable on `<html>` and applied `macFont.className` to `<body>`.
    - Updated [`app/globals.css`](file:///c:/Users/d/Documents/ob/orderflowApp/app/globals.css) `body` font family to `var(--font-sans), 'BlinkMacSystemFont', -apple-system, sans-serif` and removed Inter-specific `font-feature-settings`.
    - Updated [`tailwind.config.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/tailwind.config.ts) `fontFamily.sans` to `["var(--font-sans)", "BlinkMacSystemFont", "-apple-system", "sans-serif"]`.
  - **Canvas Renderer Font Family Standardization**:
    - Replaced hardcoded `"Inter"` with `"BlinkMacSystemFont"` across canvas rendering utilities:
      - [`drawAxes.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawAxes.ts) (`AXIS_FONT`)
      - [`drawCrosshair.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawCrosshair.ts) (`CROSSHAIR_FONT`)
      - [`drawCvd.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawCvd.ts) (`AXIS_FONT`)
      - [`drawLines.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts) (price badges, time badges, stacked pills, anchored badges)
      - [`drawPriceLine.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawPriceLine.ts) (`PRICE_LINE_FONT`, `COUNTDOWN_FONT`)
      - [`drawStatsGrid.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawStatsGrid.ts) (row labels)
      - [`drawTradingOverlays.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawTradingOverlays.ts) (`LABEL_FONT`, `SMALL_FONT`, `BADGE_FONT`)
      - [`drawVolumeBars.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawVolumeBars.ts) (volume values and fallback warnings)
  - **Header Logo & Name Removal**:
    - In [`components/layout/Header.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Header.tsx), removed the pulsating dot logo, the visible "OrderFlow" text heading, and the vertical divider from top-left.
    - Preserved `<h1 className="sr-only">OrderFlow</h1>` to maintain semantic single-h1 SEO heading hierarchy without visual clutter.
  - **Documentation & Map Synchronization**:
    - Updated [`skills/map.md`](file:///c:/Users/d/Documents/ob/orderflowApp/skills/map.md) to record the new responsibilities for `tailwind.config.ts`, `app/layout.tsx`, and `components/layout/Header.tsx`.
- **Why it changed**:
  - Direct user request: replace the current font across the application with the custom font added to `app/fonts/MacFont` (`mcfont`), and remove the logo/name from the top-left header.
- **Impact summary**:
  - Entire application UI (menus, toolbars, settings dialogs, tables, popovers) and HTML5 canvas overlays (price badges, axes, crosshair, line tools) now render with Apple San Francisco style `BlinkMacSystemFont`.
  - Header top-left is clean and minimal, displaying only layout controls while maintaining SEO heading accessibility.
  - TypeScript compiler passed with 0 errors (`npx tsc --noEmit` clean).
  - ESLint passed with 0 errors or warnings (`npm run lint` clean).

## [2026-09-06] - Style: Canvas Background Restored to #0F0F0F with #444444 Borders Preserved

- **What changed**:
  - Updated central canvas background token in [`lib/config/chartColors.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/lib/config/chartColors.ts):
    - `DEFAULT_CANVAS_BG = '#0F0F0F'` (restored from `#1E1E1E`).
    - Preserved `DEFAULT_BORDER_COLOR = '#444444'`, `DEFAULT_GRID_COLOR = '#444444'`, and `DEFAULT_HEADER_SIDEBAR_BG = '#2C2C2C'`.
  - Updated root CSS variable in [`app/globals.css`](file:///c:/Users/d/Documents/ob/orderflowApp/app/globals.css):
    - `--bg-base: #0F0F0F;` (restored from `#1E1E1E`).
    - Preserved `--border: #444444;`, `--grid-color: var(--border);`, and `--bg-surface: #2C2C2C;`.
- **Why it changed**:
  - User feedback: Revert canvas background to `#0F0F0F` while maintaining the current `#444444` borders and grid styling.
- **Impact summary**:
  - The canvas surface, store defaults, and layout backgrounds seamlessly revert to deep dark `#0F0F0F` via the design token architecture, while header, sidebar, and grid borders remain crisp `#444444`.
  - Clean TypeScript verification (`npx tsc --noEmit` exited 0).

## [2026-09-06] - Architecture: Theme Color Reusability, Canvas #1E1E1E Background, and Grid Border Sync

- **What changed**:
  - **Design Token & Constant Architecture**:
    - Defined central reusable theme constants in [`lib/config/chartColors.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/lib/config/chartColors.ts):
      - `DEFAULT_CANVAS_BG = '#1E1E1E'`
      - `DEFAULT_BORDER_COLOR = '#444444'`
      - `DEFAULT_GRID_COLOR = DEFAULT_BORDER_COLOR` (`#444444`)
      - `DEFAULT_HEADER_SIDEBAR_BG = '#2C2C2C'`
    - Updated CSS variables in [`app/globals.css`](file:///c:/Users/d/Documents/ob/orderflowApp/app/globals.css):
      - `--bg-base: #1E1E1E;` (mapped to Tailwind `bg-background`)
      - `--bg-surface: #2C2C2C;` (mapped to Tailwind `bg-surface`)
      - `--border: #444444;` (mapped to Tailwind `border-border`)
      - `--grid-color: var(--border);`
  - **Store & Canvas Engine Integration**:
    - Updated [`lib/store/chart.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts) defaults to use `DEFAULT_CANVAS_BG` for `chartBackgroundColor` and `DEFAULT_GRID_COLOR` for `verticalGridLineColor` and `horizontalGridLineColor`.
    - Updated canvas renderers ([`drawAxes.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawAxes.ts), [`drawCvd.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawCvd.ts), [`drawVolumeBars.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawVolumeBars.ts), [`drawStatsGrid.ts`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawStatsGrid.ts), and [`ChartCanvas.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx)) to reference `DEFAULT_CANVAS_BG` and `DEFAULT_GRID_COLOR` instead of hardcoded hex codes.
  - **UI Layouts & Semantic Token Refactoring**:
    - Replaced hardcoded hex classes in [`Header.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Header.tsx) and [`Sidebar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Sidebar.tsx) with semantic tokens: `bg-surface`, `border-border`, and `bg-border`.
    - Standardized container backgrounds in [`app/page.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/app/page.tsx), [`ChartPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartPanel.tsx), and [`CvdPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CvdPanel.tsx) to `bg-background` and `bg-border`.
- **Why it changed**:
  - User requirement: Apply `#1E1E1E` for canvas background and match grid line color to the border color (`#444444`), implemented strictly via reusable tokens and constants rather than hardcoded hex values across files.
- **Impact summary**:
  - Pure reusable design token architecture: changing a color in one source of truth (`app/globals.css` and `lib/config/chartColors.ts`) cascades across all UI layouts, store defaults, canvas rendering passes, and axis grids.
  - TypeScript checks pass cleanly (`npx tsc --noEmit` exited 0).

## [2026-09-06] - Style: Border Color Adjustment to #444444 for Header and Sidebar

- **What changed**:
  - Updated [`components/layout/Header.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Header.tsx):
    - Adjusted header bottom border to `border-[#444444]`.
    - Adjusted internal vertical divider between logo and layout dropdown to `bg-[#444444]`.
    - Adjusted unlock container border to `border-[#444444]`.
    - Adjusted MT5 account widget border to `border-[#444444]` and divider to `bg-[#444444]`.
  - Updated [`components/layout/Sidebar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Sidebar.tsx):
    - Adjusted sidebar right border to `border-[#444444]`.
    - Adjusted tool hover tooltip border to `border-[#444444]`.
- **Why it changed**:
  - User feedback: previous `#e6e6e6` border appeared too stark/white against the `#2C2C2C` background; updated to `#444444` for a smoother, balanced dark-mode border.
- **Impact summary**:
  - Provides subtle, cohesive mid-tone borders framing the header and sidebar.
  - Zero TypeScript errors (`npx tsc --noEmit` clean).

## [2026-09-06] - Style: #2C2C2C Background and #e6e6e6 Borders for Header and Sidebar

- **What changed**:
  - Updated [`components/layout/Header.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Header.tsx):
    - Changed `<header>` background to `#2C2C2C` and bottom border to `border-[#e6e6e6]`.
    - Updated internal vertical divider between logo and layout dropdown to `bg-[#e6e6e6]`.
    - Updated password unlock container border to `border-[#e6e6e6]`.
    - Updated MT5 account widget border to `border-[#e6e6e6]` and divider to `bg-[#e6e6e6]`.
  - Updated [`components/layout/Sidebar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Sidebar.tsx):
    - Changed `<aside>` background to `#2C2C2C` and right border to `border-[#e6e6e6]`.
    - Updated tool hover state to `hover:bg-white/10` to ensure clean contrast on `#2C2C2C`.
    - Updated tool hover tooltip to `#2C2C2C` background and `border-[#e6e6e6]` border.
- **Why it changed**:
  - Direct user requirement to apply `#2C2C2C` as the background color to the header and sidebar, and `#e6e6e6` for borders.
- **Impact summary**:
  - Header and sidebar now have the requested dark grey `#2C2C2C` background framed by crisp `#e6e6e6` borders, cleanly separating navigation/controls from the chart workspace.
  - Zero TypeScript errors (`npx tsc --noEmit` clean).

## [2026-09-06] - Feature: FigUI3 Migration (Phase 6 — Toolbar, Header, and Overlay Compound Buttons)

- **What changed**:
  - Migrated remaining toolbar, header, overlay compound, and dropdown action buttons to `<FigButton>` across 17 component files:
    - [`components/layout/Header.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/layout/Header.tsx): Password auth unlock trigger converted to `<FigButton variant="ghost" size="small" icon>`.
    - [`components/ui/StorageManager.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/StorageManager.tsx): Manual "Delete Data" action converted to `<FigButton variant="destructiveSecondary" size="medium">`.
    - [`components/debug/DebugPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/debug/DebugPanel.tsx): Debug tab buttons converted to `<FigButton variant={activeTab === tab.id ? 'secondary' : 'ghost'} size="small">`.
    - [`components/ui/PanelToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/PanelToolbar.tsx): Drawing tool mode triggers (`Position`, `BUY`, `SELL`) migrated to `<FigButton size="compact" variant="ghost">`.
    - [`components/ui/ChartLayoutDropdown.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartLayoutDropdown.tsx): Layout mode buttons (single, vertical split, horizontal split) migrated to `<FigButton variant="ghost" size="medium" icon>`.
    - [`components/ui/PairSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/PairSelector.tsx): Expandable symbol accordion buttons migrated to `<FigButton variant="ghost" size="medium">`.
    - [`components/ui/ChartModeSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartModeSelector.tsx): Chart mode option list buttons migrated to `<FigButton variant="ghost" size="medium">`.
    - [`components/ui/IndicatorsModal.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/IndicatorsModal.tsx): Indicator selection item buttons migrated to `<FigButton variant="ghost" size="medium">`.
    - [`components/ui/ChartModeToggle.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartModeToggle.tsx): Legacy CANDLES and FOOTPRINT buttons migrated to `<FigButton size="small" variant="ghost">`.
    - [`components/ui/DrawingFavoritesToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/DrawingFavoritesToolbar.tsx): Expand button, Profile toggle, Measure toggle, and favorite drawing tools (Horizontal line, Vertical line, Ray, Box) migrated to `<FigButton variant="ghost" icon size="compact">`.
    - [`components/chart/IndicatorLabels.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/IndicatorLabels.tsx): Data source switcher buttons (`Spot`, `Futures`, `Both`) migrated to `<FigButton variant="ghost" size="small">`.
    - [`components/chart/ChartPanel.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartPanel.tsx): Compact CVD expand strip button migrated to `<FigButton variant="ghost" size="compact">`.
    - [`components/chart/CanvasDrawingToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CanvasDrawingToolbar.tsx): Box drawing fill toggle button migrated to `<FigButton variant="ghost" icon size="compact">`.
    - [`components/ui/ChartSettingsDropdown.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartSettingsDropdown.tsx): Sidebar category navigation tabs migrated to `<FigButton variant="ghost" size="medium">`.
    - [`components/ui/TimeInput.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/TimeInput.tsx): 12h AM and PM period toggle buttons migrated to `<FigButton variant="ghost" size="compact">`.
    - [`components/ui/chart-settings/BubbleSettings.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/chart-settings/BubbleSettings.tsx): "DOCS" link trigger migrated to `<FigButton variant="link" size="small">`.
    - [`components/ui/chart-settings/SignalSettings.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/chart-settings/SignalSettings.tsx): Microstructure signal toggle rows (Absorption, Exhaustion, Iceberg, Liquidity Vacuum) migrated to `<FigButton variant="ghost" size="medium">`.
- **Why it changed**:
  - Phase 6 of FigUI3 migration plan (`skills/new/figui3 migration.md:L199-L221`): Unified buttons across toolbars, header, overlays, and modal/dropdown options with design system tokens while keeping Phase 5 (color pickers) and Phase 7 (trade execution & canvas overlay actions) strictly demarcated.
- **Impact summary**:
  - All compound toolbar and overlay buttons now leverage `<FigButton>` with standard FigUI3 variants (`ghost`, `secondary`, `primary`, `destructiveSecondary`, `link`) and responsive sizing tokens (`small`, `compact`, `medium`).
  - No visual regression in compact toolbar height, alignment, or keyboard accessibility.
  - Zero TypeScript compiler errors (`npx tsc --noEmit` clean) and zero ESLint warnings (`npm run lint` clean).

## [2026-09-06] - Fix: Anchored Dropdowns for Chart/Symbol Selection & Global Glass Effect Removal

- **What changed**:
  - **Chart/Symbol Selection Dropdown Conversion**:
    - Converted [`PairSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/PairSelector.tsx) from a centered full-screen modal (`fixed inset-0 ... flex items-center justify-center bg-black/20`) into a small anchored dropdown using `<FigPopup>` positioned directly underneath its trigger button (`anchor="#pair-selector-trigger-${panelId}"`, `position="bottom left"`, `offset="0 4"`).
    - Added configurable `position` prop (`'bottom left' | 'bottom right' | 'bottom center'`) to [`PairSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/PairSelector.tsx), [`ChartModeSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartModeSelector.tsx), and [`IndicatorsModal.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/IndicatorsModal.tsx) for flexible anchor positioning.
  - **Glass Effect Removal Across Popovers & Modals**:
    - Removed `backdrop-blur-*` filters and translucent background overlays from [`StorageManager.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/StorageManager.tsx), [`ColorPickerPopover.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ColorPickerPopover.tsx), [`BubblesDocsModal.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/BubblesDocsModal.tsx), [`OrderTicket.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/OrderTicket.tsx), [`DrawingFavoritesToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/DrawingFavoritesToolbar.tsx), and [`CanvasDrawingToolbar.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CanvasDrawingToolbar.tsx).
    - Preserved indicator settings modals and global settings dialog in [`ChartSettingsDropdown.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartSettingsDropdown.tsx) as centered/floating dialogs per instructions.
- **Why it changed**:
  - Direct user requirement: Chart selection must open as a small anchored dropdown under the trigger button (not a centered modal dialog); Candlestick and Indicator selections must also be anchored dropdown lists directly under their triggers; glass effect must be removed; and indicator settings/global settings modals must remain centered dialogs.
- **Impact summary**:
  - Chart/Symbol selection, Candlestick selection, and Indicator selection all behave consistently as anchored popover dropdowns directly underneath their respective buttons.
  - No background bleed-through or glass textures anywhere.
  - All TypeScript checks clean (`npx tsc --noEmit` exits 0).

## [2026-09-06] - Fix: Solid Popup Backgrounds, Duplicate Dialog Header Elimination, and Pixel-Perfect List Alignment

- **What changed**:
  - **Eliminated Glass Texture & Enforced Pure Solid Dark Backgrounds**:
    - Removed all `backdrop-blur-*` filters and translucent `bg-white/10` styling from [`ChartModeSelector.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartModeSelector.tsx), [`IndicatorsModal.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/IndicatorsModal.tsx), [`ChartLayoutDropdown.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartLayoutDropdown.tsx), and [`ChartSettingsDropdown.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/ChartSettingsDropdown.tsx).
    - Enforced `opacity: 1 !important`, `backdrop-filter: none !important`, and solid `background: #181818 !important` on `dialog[is="fig-popup"]` and `dialog[is="fig-dialog"]` in [`app/globals.css`](file:///c:/Users/d/Documents/ob/orderflowApp/app/globals.css) so no chart candles or grid lines bleed through.
  - **Pixel-Perfect Popup Alignment & Spacing**:
    - Corrected FigUI3 `offset` token orientation from `"6 0"` to `"0 4"` across all popups. FigUI3 parses offsets as `[x, y]`; `"6 0"` pushed popups 6px horizontally away from the trigger button and 0px vertically, whereas `"0 4"` aligns flush with the trigger button's left edge and creates a clean 4px vertical margin below it.
    - Standardized list item spacing with `p-1.5` padding, `gap-1` column layout, refined section headers (`text-[10px] font-black uppercase tracking-[0.18em] text-[#787B86]`), solid hover states (`hover:bg-[#242424]`), and solid active states (`bg-[#282828] border border-[#383838]`).
  - **Duplicate Header Bar Elimination in Settings**:
    - Confirmed `ChartSettingsDropdown.tsx` uses custom floating tool window structure without wrapping `fig-dialog`, eliminating the duplicate auto-generated `<fig-header data-auto><h3>Dialog</h3><fig-button close-dialog>` bar seen above the Settings header. Cleaned up unused `FigDialog` import.
  - **Stray Label Artifact Fix in PropsKit Numbers**:
    - Verified `PropskitNumber.tsx` sets `label: label ?? ''` to trigger FigUI3's internal `LJ` class `#Q.remove()`, eliminating stray "La" text (e.g. "La0.5", "La10") in numeric inputs.
- **Why it changed**:
  - Direct user feedback: user requested pure solid background colors instead of glassmorphism/translucent textures, removal of the duplicate dialog header, and pixel-perfect spacing/alignment for Footprint and Indicator dropdown lists.
- **Impact summary**:
  - Popups are 100% opaque, eliminating background chart bleed-through.
  - Footprint and Indicator popup lists open flush with trigger buttons and have clean, tight row spacing.
  - Zero TypeScript compiler errors (`npx tsc --noEmit` clean).

## [2026-09-05] - Feature: FigUI3 Migration (Phase 3 — Popup/Modal Unification Part 1)

- **What changed**:
  - **Empirical Shadow/Light DOM Analysis & Contrast Protection**:
    - Checked `class FigPopup` (`n0`) and `class FigDialog` (`a0`) in `@rogieking/figui3/dist/fig.js`: confirmed both are **100% Light DOM** (no shadow root attached).
    - Patched `.popup-contrast` exclusions in [`app/globals.css`](file:///c:/Users/d/Documents/ob/orderflowApp/app/globals.css) to explicitly exclude `dialog[is="fig-popup"] *`, `dialog[is="fig-dialog"] *`, `fig-popup *`, and `fig-dialog *` from blanket `!important` button/container overrides, and added base transparent/borderless resets for dialogs.
  - **TypeScript Declarations (`types/figui3.d.ts`)**:
    - Added `FigPopupProps` and `FigDialogProps` interfaces.
    - Augmented JSX intrinsic elements for `fig-popup`, `fig-dialog`, and standard `dialog` to support FigUI3 custom attributes (`is`, `anchor`, `position`, `offset`, `closedby`, `modal`, `drag`, `handle`, `autoresize`).
  - **Reusable React Wrappers (`components/ui/fig/`)**:
    - Built [`FigPopup.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/FigPopup.tsx): React wrapper for `<dialog is="fig-popup">` syncing `open`, `anchor` (string selector or element ref), `position`, `offset`, `closedby`, and bridging native `close`/`toggle` events to `onClose`.
    - Built [`FigDialog.tsx`](file:///c:/Users/d/Documents/ob/orderflowApp/components/ui/fig/FigDialog.tsx): React wrapper for `<dialog is="fig-dialog">` managing modal/non-modal mode (`showModal()` vs `show()`), native pointer dragging (`drag`, `handle`), `position`, and `close`/`cancel` events.
    - Exported `FigPopup` and `FigDialog` from `components/ui/fig/index.ts`.
  - **Sequential Migrations (4 Target Components)**:
    - **ChartLayoutDropdown (`ChartLayoutDropdown.tsx`)**: Migrated dropdown to `<FigPopup>` anchored to `#chart-layout-dropdown-trigger`. Removed hand-rolled `keydown` (Escape) and `mousedown` (click-outside) `useEffect` listeners.
    - **ChartModeSelector (`ChartModeSelector.tsx`)**: Migrated dropdown to `<FigPopup>` anchored to `#chart-mode-selector-trigger-${panelId}`. Removed hand-rolled `keydown` (Escape) and `mousedown` (click-outside) `useEffect` listeners.
    - **ChartSettingsDropdown (`ChartSettingsDropdown.tsx`)**:
      - Centered indicator dialog mode migrated to `<FigDialog open modal position="center center" closedby="any">`.
      - Floating settings window mode migrated to `<FigDialog open drag handle=".settings-drag-handle" closedby="any">`. Window dragging is now driven natively by `fig-dialog`'s pointer capture and coordinate logic.
      - Retained custom bottom vertical resize bar (`handleResizeMouseDown` / `isResizing` / `setSettingsDropdownHeight`) since `fig-dialog`'s `a0` class does not implement interactive pointer resizing.
    - **IndicatorsModal (`IndicatorsModal.tsx` & `PanelToolbar.tsx`)**: Migrated indicator picker to `<FigPopup>` anchored to `#panel-indicators-trigger-${panelId}`. Removed manual `mousedown` click-outside hook.
- **Why it changed**:
  - Implements Phase 3 of the approved FigUI3 migration plan to unify popups and modals with standard Web Components (`fig-popup` and `fig-dialog`), replacing bespoke Escape and click-outside handling.
- **Impact summary**:
  - Eliminates duplicate window event listeners and ad-hoc absolute/fixed positioning math.
  - Zero TypeScript compiler errors (`npx tsc --noEmit` clean).
  - All four popups/modals maintain identical opening triggers and clean dismiss behaviors.

## [2026-09-06] - Feature: FigUI3 Migration (Phase 4 — All 14 Settings Panels & PropsKit Rollout)

- **What changed**:
  - **Sequential Panel Verification & PropsKit Migration (All 14 Panels)**:
  - **CVD Settings (`CvdSettings.tsx`)**:
    - Migrated CVD Mode (`Session`, `Continuous`) to `<FigSegmentedControl full>`.
    - Migrated Reset Mode (`Session`, `None`) and Scale Mode (`Auto`, `Fixed`) to `<FigSegmentedControl full>`.
    - Migrated Height and Smoothing sliders to `<PropskitSlider>`.
    - Migrated Fixed Range limit to `<PropskitNumber>`.
    - Migrated Divergence Markers and Compact Mode toggles to `<FigSwitch>`, with lookback slider on `<PropskitSlider>`.
  - **Volume Bars Settings (`VolumeBarsSettings.tsx`)**:
    - Migrated Input Data (`Volume`, `Orders`, `Agg Trades`) and Filter Mode (`Absolute`, `Relative`) to `<FigSegmentedControl full>`.
    - Migrated Moving Average Length, Min Filter, and Max Filter to `<PropskitNumber>`.
    - Migrated Color Mode (`Delta`, `Volume`) to `<FigSegmentedControl full>`.
    - Migrated Opacity, Height, Text Size, and Average Line Length to `<PropskitSlider>`.
    - Migrated Show Values and Average Line toggles to `<FigSwitch>`.
  - **Heatmap Settings (`HeatmapSettings.tsx`)**:
    - Migrated Base Opacity, Age Fade Factor, Strip Width, and History Depth sliders to `<PropskitSlider>`.
    - Migrated Show Pulled, Show Consumed, Show CURRENT, Profile Sync, and Persistence Bars toggles to `<FigSwitch>`.
  - **Liquidity Map Settings (`LiquidityMapSettings.tsx`)**:
    - Migrated Opacity and Range sliders to `<PropskitSlider>`.
    - Migrated Bucket Size and Min Size to `<PropskitNumber>`.
  - **Footprint Settings (`FootprintSettings.tsx`)**:
    - Migrated Footprint Mode (`Bid/Ask`, `Delta`, `Volume`, `Volume Profile`) to `<FigSegmentedControl full>`.
  - **Volume Profile Settings (`VolumeProfileSettings.tsx`)**:
    - Migrated Profile Type and POC Width to `<FigSegmentedControl full>`.
    - Migrated Scaling (`Linear`, `Logarithmic`) to `<FigSegmentedControl>`.
    - Migrated Row Size, Width, Opacity, Min Row Width, Min Row Height, Node Sensitivity, and Delta Width to `<PropskitSlider>`.
    - Migrated Periodic Profile Period Value to `<PropskitNumber>` and Period Unit to `<FigSelect>`.
    - Migrated Threshold Filter Min and Max to `<PropskitNumber>`.
    - Migrated POC Highlight, VA Area Fill, POC Line, and VA Lines toggles to `<FigSwitch>`.
  - **Signal Settings (`SignalSettings.tsx`)**:
    - Migrated Absorption Side and Exhaustion Side (`Both`, `Bid`, `Ask`) to `<FigSegmentedControl full>`.
    - Migrated Absorption Min Score, Exhaustion Min Score, Exhaustion Lookback to `<PropskitSlider>`.
    - Migrated Iceberg Min Score, Lookback, Size Ratio to `<PropskitSlider>`.
    - Migrated Sweeps Min Depth, Min Speed, Lookback to `<PropskitSlider>`.
    - Migrated Absorption, Exhaustion, Provisional, Iceberg, and Sweeps toggles to `<FigSwitch>`.
  - **General Chart Settings (`GeneralChartSettings.tsx`)**:
    - Migrated Tick Size and Bucket Size inputs to `<PropskitNumber>`.
    - Migrated Bucket Size Auto toggle button to `<FigButton>`.
  - **Canvas Settings (`CanvasSettings.tsx`)**:
    - Migrated Vertical and Horizontal Grid Line checkboxes to `<FigSwitch>`.
  - **ColorPicker Boundary Preservation (`CanvasSettings.tsx` & `SessionsSettings.tsx`)**:
    - Preserved integration with child `ColorPickerPopover` completely untouched per Phase 4 boundary requirements (reserved for Phase 5 consolidation).
  - **Lint & TypeScript Cleanup (`BubbleSettings.tsx`)**:
    - Removed unused `useState` and `useEffect` imports in `BubbleSettings.tsx`.
- **Why it changed**:
  - Completes FigUI3 and PropsKit component integration across all remaining indicator settings popup modals and global chart settings panels following the Phase 2 standard.
- **Impact summary**:
  - Replaces legacy HTML range inputs, checkboxes, selects, and unstyled number inputs across the entire settings modal suite with FigUI3/PropsKit controls.
  - Zero TypeScript compiler errors (`npx tsc --noEmit` exits 0).
  - Zero ESLint warnings or errors (`npm run lint` passes).
  - All 14 settings panels verified for correct store actions and behavioral updates.

## [2026-09-05] - Feature: FigUI3 Migration (Volume Bubbles, Sessions, HSVP, and Stats Settings)

- **What changed**:
  - **Volume Bubbles Settings (`BubbleSettings.tsx`)**:
    - Migrated Size By selection to `<FigSegmentedControl full>` (`Volume`, `Orders`).
    - Migrated Bubble Mode to `<FigSegmentedControl full>` (`Ask/Bid Split`, `Delta`, `Volume`).
    - Migrated Volume Color Mode to `<FigSegmentedControl full>` (`Delta Absolute`, `Delta Percentual`).
    - Migrated Side Filter to `<FigSegmentedControl full>` (`Buy`, `Sell`, `Both`).
    - Migrated Scale Mode to `<FigSegmentedControl>` (`Linear`, `SQRT`, `Log`).
    - Migrated Display Mode to `<FigSegmentedControl>` (`2D`, `3D`).
    - Migrated Min Volume threshold mode from raw button toggle to `<FigSegmentedControl>` (`Fixed (BTC)` vs `Adaptive (x Avg)`).
    - Migrated numeric slider controls (`Filter Bubble (px)`, `Std Dev Val`, `Outlier Cap %`, `Min Orders`, `Line Width`, `Opacity`) to `<PropskitSlider>`.
  - **Sessions Settings (`SessionsSettings.tsx` & `TimeInput.tsx`)**:
    - Migrated per-session enabled toggles to `<FigSwitch>`.
    - In `TimeInput.tsx`, replaced high-intensity accent blue AM/PM active toggle styling with clean, neutral ghost styling (`bg-[#2A2A2A]` border `#383838`).
  - **Historical Session Volume Profile Settings (`HistoricalSessionProfileSettings.tsx`)**:
    - Migrated Session dropdown and Sessions to Display to `<FigSelect>`.
    - Migrated Profile Display mode to `<FigSegmentedControl full>` (`Separate`, `Combined`).
    - Migrated multiple session checkbox list to clean individual `<FigSwitch>` toggles with high-contrast card borders.
  - **Stats Indicator Settings (`StatsSettings.tsx`)**:
    - Migrated Master toggle to `<FigSwitch>`.
    - Migrated Stats items (`Volume`, `Delta`, `CVD`) to individual `<FigSwitch>` cards with refined dark borders and contrast.
- **Why it changed**:
  - Extends FigUI3 and PropsKit component integration across remaining key indicator settings panels (Volume Bubbles, Sessions, HSVP, and Stats Indicator) as requested.
- **Impact summary**:
  - Eliminates raw HTML inputs, ranges, checkboxes, and buttons across all 4 target panels.
  - Consistent visual design, animated segmented states, and elastic numeric scrub sliders.
  - `npx tsc --noEmit` verified clean with 0 errors.

## [2026-09-05] - Feature: FigUI3 Phase 2 Migration (Segmented Controls & First Full Panel: VwapSettings)

- **What changed**:
  - **Standing Rule 1 Empirical Shadow/Light DOM Check & Contrast Protection**:
    - Inspected installed package source in `@rogieking/figui3`: confirmed `fig-segmented-control` (class `FigSegmentedControl`), `fig-segment` (class `FigSegment`), `fig-select` (class `FigSelect`), `propskit-slider` (class `PropskitSlider`), and `propskit-number` (class `PropskitNumber`) all render in **Light DOM** (no shadow root).
    - Patched `.popup-contrast` in [`app/globals.css`](file:///c:/Users/d/Documents/ob/orderflowApp/app/globals.css) to explicitly exclude `fig-segmented-control *`, `fig-segment *`, `fig-select *`, `fig-select-option *`, `propskit-slider *`, `propskit-number *`, `propskit-switch *`, `propskit-select *`, `[data-propskit] *`, and `[class*="propskit-"] *` from blanket `!important` color/border overrides.
  - **Shared Wrapper Hook & Bundle Setup (`components/ui/fig/`, `app/layout.tsx`, `types/figui3.d.ts`)**:
    - Extended `types/figui3.d.ts` with custom element JSX declarations for `fig-segmented-control`, `fig-segment`, `fig-select`, `fig-select-options`, `fig-select-option`, `propskit-slider`, `propskit-number`, `propskit-switch`, and `propskit-select`.
    - Extended `app/layout.tsx` to import `@rogieking/figui3/fig-editor.css` and `@rogieking/figui3/fig-lab.css`.
    - Extended `useFigElement.ts` to dynamically import core `@rogieking/figui3`, `@rogieking/figui3/fig-editor.js`, and `@rogieking/figui3/fig-lab.js` together.
    - Built `FigSegmentedControl.tsx` & `FigSegment.tsx`: reusable React wrapper for `<fig-segmented-control>` and `<fig-segment>` supporting radio-group selection, animated selection indicators, and custom segment options with native change/input event forwarding.
    - Built `FigSelect.tsx`: reusable React wrapper for `<fig-select>` supporting options array/slotted options, labels, and change event forwarding.
    - Built `PropskitSlider.tsx`: reusable React wrapper for `<propskit-slider>` labeled numeric range slider with elastic scrub and text field support.
    - Built `PropskitNumber.tsx`: reusable React wrapper for `<propskit-number>` labeled exact numeric input with precision, unit, and stepper support.
    - Exported all new wrappers from `components/ui/fig/index.ts`.
  - **Segmented Controls Migrated across App (11 controls)**:
    - `PanelToolbar.tsx`: Migrated timeframe pills (`1m`, `5m`, `15m`, `1h`, `4h`) to `<FigSegmentedControl>`.
    - `TimeframeSelector.tsx`: Migrated timeframe pills (`1m`, `5m`, `15m`, `1h`, `4h`) to `<FigSegmentedControl>`.
    - `PairSelector.tsx`: Migrated Spot / Perpetual contract options to full-width `<FigSegmentedControl>`.
    - `ChartSettingsDropdown.tsx`: Migrated sidebar category navigation tabs (`General`, `Canvas`, `Alerts`, `Profiles`, `Signals`) to `<FigSegmentedControl>` with vertical layout and `<FigSegment>`.
  - **Full Panel Migration: `VwapSettings.tsx` (100% FigUI3 & PropsKit)**:
    - Replaced all raw HTML `<button>`, `<input>`, `<select>` controls:
      - Master VWAP Toggle: `<FigSwitch>`
      - Period Mode (Session vs Rolling): `<FigSegmentedControl>`
      - Session Anchor (Day, Week, Month): `<FigSelect>`
      - Rolling Lookback (Days): `<PropskitSlider>`
      - Envelope Mode (Standard Deviation vs Percentage): `<FigSelect>`
      - Bands 1, 2, 3 Toggles: `<FigSwitch>`
      - Bands 1, 2, 3 Multipliers: `<PropskitNumber>`
- **Why it changed**:
  - Phase 2 of the approved FigUI3 migration plan to migrate all segmented/tab controls to `<fig-segmented-control>` and prove a complete settings panel end-to-end with PropsKit components before scaling to other panels.
- **Impact summary**:
  - Unifies segmented controls with animated active pill indicators.
  - Zero raw HTML form controls remain in `VwapSettings.tsx`.
  - All store actions and canvas rendering loops validated via behavioral test.
  - Passes ESLint and `npx tsc --noEmit` with 0 errors.

## [2026-09-05] - Feature: FigUI3 Phase 1 Migration (Switches & Icon/Toolbar Ghost Buttons)

- **What changed**:
  - **Shared Wrapper Hook & Components (`components/ui/fig/`)**:
    - Built `useFigElement.ts`: reusable React hook ensuring single dynamic import of `@rogieking/figui3`, Light/Shadow DOM property synchronization (`checked`, `disabled`, `selected`), attribute reflection, and native custom event binding (`change`, `click`).
    - Built `FigSwitch.tsx`: clean React wrapper for `<fig-switch>` with controlled/uncontrolled state support and change event forwarding.
    - Built `FigButton.tsx`: clean React wrapper for `<fig-button>` supporting `variant` (primary, secondary, ghost, destructive, etc.), `size` (small, compact, medium, large), `icon` mode, `selected` state, and native click dispatch.
    - Exported from `components/ui/fig/index.ts`.
  - **Pill Toggle Switches Migrated to `<FigSwitch>` (17 total across 13 settings panels)**:
    - `BubbleSettings.tsx` (volume bubbles toggle)
    - `CvdSettings.tsx` (divergences toggle)
    - `GeneralChartSettings.tsx` (drawings synchronization toggle)
    - `GeneralChartSettings.tsx` (bracket close confirmation toggle)
    - `HeatmapSettings.tsx` (liquidity heatmap toggle)
    - `HistoricalSessionProfileSettings.tsx` (historical profile toggle)
    - `LiquidityMapSettings.tsx` (liquidity map toggle)
    - `SessionsSettings.tsx` (sessions toggle)
    - `SignalSettings.tsx` (exhaustion provisional toggle, plus 4 signal row toggles: Absorption, Exhaustion, Sweeps, Trap Delta)
    - `StatsSettings.tsx` (stats grid toggle)
    - `VolumeBarsSettings.tsx` (moving average toggle)
    - `VwapSettings.tsx` (rolling VWAP toggle)
    - `ChartLayoutDropdown.tsx` (crosshair sync toggle)
  - **Icon-Only Utility Buttons Migrated to `<FigButton variant="ghost" icon>` (19 total)**:
    - Close 'X' buttons: `ChartSettingsDropdown.tsx` (2 instances), `BubblesDocsModal.tsx`, `PairSelector.tsx`, `StorageManager.tsx`, `DebugPanel.tsx`
    - Action buttons: `DebugPanel.tsx` (RefreshCw, Copy)
    - Panel/Indicator controls: `ChartPanel.tsx` (CVD minimize), `IndicatorLabels.tsx` (collapse chevron, visibility eye toggle, remove indicator 'X')
    - Canvas drawing toolbar buttons: `CanvasDrawingToolbar.tsx` (drawing lock, delete X, profile lock, profile settings gear, remove profile X)
    - Toolbar collapse buttons: `DrawingFavoritesToolbar.tsx` (collapse chevron)
    - PanelToolbar buttons: `PanelToolbar.tsx` (focus mode maximize/minimize toggle, panel refresh button, panel settings gear button)
  - **Toolbar Navigation Buttons Migrated to `<FigButton variant="ghost">` (`components/ui/PanelToolbar.tsx`)**:
    - Timeframe selector buttons (`1m`, `5m`, `15m`, `1h`, `4h`) with `variant="ghost"`, `size="small"`, and active `selected={panel.timeframe === tf}` state.
    - Indicators modal trigger button with `variant="ghost"` and active `selected={showIndicatorsModal}` state.
  - **CSS Enhancements (`app/globals.css`)**:
    - Added `:root` tokens for `--figma-color-bg-switch: #3A3A3A`, `--figma-color-bg-transparent-hover: rgba(255, 255, 255, 0.08)`, and `--figma-color-bg-transparent-pressed: rgba(255, 255, 255, 0.14)`.
    - Added safety reset rule targeting raw `button` elements to prevent FigUI3's package-level button rules from styling unmigrated native buttons.
- **Why it changed**:
  - Phase 1 of the approved FigUI3 migration plan to replace bespoke inline toggle switches and icon utility buttons with unified, accessible, and theme-compliant FigUI3 custom elements.
- **Impact summary**:
  - Consistent switch and icon button design language across all panels and toolbars.
  - Passes all ESLint checks and `npx tsc --noEmit` with 0 errors.

## [2026-09-12] - Docs: 800+ Line Source Files Section Maps

- **What changed**:
  - Audited codebase and mapped all 6 source files exceeding 800 lines into `skills/maps/`.
  - Created detailed section maps for ChartCanvas, FeedProvider, chartStore, btcusdtCollector, drawLines, and chartRuntimeStore.
  - Updated `skills/map.md` with direct section map navigation links for all 6 files.
- **Why it changed**:
  - Reduce LLM context/token consumption by enabling section-targeted inspection without loading entire multi-thousand-line files.
- **Impact summary**:
  - Establishes `map.md → relevant file map → relevant section → exact source lines` workflow.
  - Zero source code changes or behavior alterations.

