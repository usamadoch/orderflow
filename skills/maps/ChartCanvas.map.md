# ChartCanvas.tsx — File Navigation & Context Map

## Overview

- **Source File**: [components/chart/ChartCanvas.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx)
- **Total Lines**: ~4,336 lines
- **Primary Responsibility**: Main interactive HTML5 Canvas chart coordinator. Orchestrates multi-layer rAF rendering (candles, footprint, volume profiles, CVD, VWAP, liquidity heatmap, orderbook, drawings, brackets), view coordinates and scaling, hit testing, drag-and-drop interactions, and trading popups.
- **Key Store Dependencies**:
  - [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts) (`useChartStore` for settings, layout, and drawings)
  - [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts) (`useChartRuntimeStore` for live candles, trades, brackets, drag state)
- **Engine Context**: [components/ChartEngineContext.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/ChartEngineContext.tsx) (footprint/profile engines, caches)

---

## Quick Navigation Index

| Feature / Task Area | Section | Approximate Line Range |
|---|---|---|
| Props, Types, Performance Observers | [Section 1: Setup & Instrumentation](#section-1-setup--instrumentation) | Lines 1–225 |
| State Hooks, Coordinate Refs, Bottom Layout | [Section 2: Component State & Layout](#section-2-component-state--layout) | Lines 226–573 |
| Redraw Pipeline Setup & Coordinate Mapping | [Section 3A: Redraw Init & Coordinates](#section-3a-redraw-init--coordinates) | Lines 574–740 |
| Background, Gridlines, Sessions & Liquidity | [Section 3B: Background & Environment Layers](#section-3b-background--environment-layers) | Lines 741–883 |
| Candlesticks, Footprint & Unselected Drawings | [Section 3C: Candles, Footprint & Drawings](#section-3c-candles-footprint--drawings) | Lines 884–1017 |
| Bubbles, Signals (Absorption, Iceberg), VWAP | [Section 3D: Bubbles, Markers, VWAP & Bottom Panels](#section-3d-bubbles-markers-vwap--bottom-panels) | Lines 1018–1120 |
| Volume Profiles & Historical Session Profiles | [Section 3E: Volume Profiles & Sessions](#section-3e-volume-profiles--sessions) | Lines 1121–1475 |
| Measurement, Heatmap Strip & Price Axis | [Section 3F: Measurement, Heatmap & Price Line](#section-3f-measurement-heatmap--price-line) | Lines 1476–1720 |
| Pan/Zoom, Viewport Sync & Live Redraw Triggers | [Section 4: Synchronization & Triggers](#section-4-synchronization--triggers) | Lines 1721–2064 |
| Overlay Controls & Toolbar Context Menus | [Section 5: Controls & Toolbars Memo](#section-5-controls--toolbars-memo) | Lines 2065–2240 |
| Order Execution, Bracket Sl/TP & Position Closes | [Section 6: Trading Actions & Bridge Handlers](#section-6-trading-actions--bridge-handlers) | Lines 2241–2695 |
| Mouse Events, Hit Testing, Dragging & Hotkeys | [Section 7: Canvas Interaction Listeners](#section-7-canvas-interaction-listeners) | Lines 2696–3945 |
| JSX Markup, Context Toolbars & Modals | [Section 8: JSX Composition & Return](#section-8-jsx-composition--return) | Lines 3946–4336 |

---

## Logical Section Breakdowns

### Section 1: Setup & Instrumentation
- **File Path**: [components/chart/ChartCanvas.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx)
- **Line Range**: Lines 1–225
- **What It Does**:
  - External and internal imports (Lucide icons, stores, drawing helpers, hit testing).
  - TypeScript interfaces: `ChartCanvasProps` (panel ID, dimensions, timeframe settings, drag props), drawing and bracket types.
  - Performance profiling wrappers: `markMeasurement` and `measureAsync` for frame budget and render timing.
- **Important Functions / Classes / Types**:
  - `ChartCanvasProps`
  - `markMeasurement`, `measureAsync`
- **Relevant Dependencies**:
  - [components/chart/chartCanvasUtils.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/chartCanvasUtils.ts)
  - [components/chart/chartCanvasHitTest.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/chartCanvasHitTest.ts)
- **When an Agent Should Read This**:
  - When inspecting props passed to `ChartCanvas`.
  - When debugging render performance instrumentation or modifying canvas type contracts.

---

### Section 2: Component State & Layout
- **File Path**: [components/chart/ChartCanvas.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx)
- **Line Range**: Lines 226–573
- **What It Does**:
  - Initializes DOM refs: `canvasRef`, `overlayRef`, `priceCenter`, `priceRange`, `scrollOffset`, `barWidth`, `isDragging`.
  - Bracket drag state refs (`bracketDragRef`, `bracketSnapRef`, `bracketHoverRef`).
  - VWAP hydration and calculation memoization (`vwapSeries`).
  - Calculates non-overlapping vertical indicator panel slots via `getBottomLayout`.
- **Important Functions / Classes / Types**:
  - `ChartCanvas` component root.
  - `getBottomLayout(canvasHeight)`: Determines `mainChartHeight` and vertical offsets for docked bottom panels (Volume Bars, Stats Grid).
  - `vwapSeries` calculation.
- **Intra-file Dependencies**:
  - Provides layout bounds and coordinate refs consumed directly by Section 3 (`redraw`) and Section 7 (`handleMouseMove`).
- **Relevant Dependencies**:
  - [components/chart/chartBottomPanels.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/chartBottomPanels.ts)
  - [components/chart/usePanZoom.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/usePanZoom.ts)
- **When an Agent Should Read This**:
  - When modifying canvas layout dimensions, bottom indicator panel docking heights, or VWAP series generation.

---

### Section 3: Multi-Layer Canvas Rendering Pipeline (`redraw`)
The central `redraw` callback (Lines 574–1720) executes via `requestAnimationFrame` and coordinates the visual stack in strict order:

#### Section 3A: Redraw Init & Coordinates (Lines 574–740)
- **What It Does**: Handles canvas clearing, HiDPR scaling (`devicePixelRatio`), price scaling initialization, coordinate boundary math (`xToIndex`, `yToPrice`), and viewport range clipping.
- **When an Agent Should Read This**: When troubleshooting canvas blurriness, DPR scaling, or viewport coordinate clipping bugs.

#### Section 3B: Background & Environment Layers (Lines 741–883)
- **What It Does**: Renders background color/gradient, horizontal/vertical gridlines, TradingView-style session background highlights (`drawSessions`), and live orderbook liquidity zones (`drawLiquidity`).
- **Important Functions**: `drawSessions`, `drawLiquidity`.
- **When an Agent Should Read This**: When styling session boxes, canvas grids, or adjusting orderbook depth shading behind price.

#### Section 3C: Candles, Footprint & Drawings (Lines 884–1017)
- **What It Does**: Renders selection rectangles, volume bars overlay, candlesticks (hollow/solid with half-pixel alignment via `drawCandles`), footprint clusters (`drawFootprint`), and unselected drawing tools/position tools (`drawPositionBackgrounds`, `drawLines`).
- **Important Functions**: `drawCandles`, `drawFootprint`, `drawLines`, `drawPositionBackgrounds`.
- **When an Agent Should Read This**: When adjusting candlestick rendering, footprint cluster visuals, or drawing tool layering order.

#### Section 3D: Bubbles, Markers, VWAP & Bottom Panels (Lines 1018–1120)
- **What It Does**: Renders trade volume bubbles (`drawBubbles`), signal markers (`drawAbsorption`, `drawExhaustion`, `drawIceberg`), VWAP line and std-dev bands (`drawVwap`), and docked bottom panels (`drawStatsGrid`).
- **Important Functions**: `drawBubbles`, `drawAbsorption`, `drawExhaustion`, `drawIceberg`, `drawVwap`, `drawStatsGrid`.
- **When an Agent Should Read This**: When modifying indicator markers, VWAP bands, or stats grid canvas rendering.

#### Section 3E: Volume Profiles & Sessions (Lines 1121–1475)
- **What It Does**: Coordinates custom user-drawn volume profiles, session-based volume profiles, and historical session profiles (`drawVolumeProfile`, `drawSelectionRect`). Manages throttled background worker profile building.
- **Important Functions**: `drawVolumeProfile`, `drawSelectionRect`, throttled custom profile computation.
- **When an Agent Should Read This**: When investigating Volume Profile calculation lag, POC line styling, or multi-session range rendering.

#### Section 3F: Measurement, Heatmap & Price Line (Lines 1476–1720)
- **What It Does**: Renders measurement tool overlays (`drawMeasurement`), orderbook depth heatmap strip (`drawLiquidityHeatmap`), active/selected drawing handles, current market price line with countdown badge (`drawPriceLine`), and crosshairs (`drawCrosshair`).
- **Important Functions**: `drawMeasurement`, `drawLiquidityHeatmap`, `drawPriceLine`, `drawCrosshair`.
- **When an Agent Should Read This**: When modifying the measurement tool, right-side heatmap strip, current price line, or crosshair axis badges.

---

### Section 4: Synchronization & Viewport Triggers
- **File Path**: [components/chart/ChartCanvas.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx)
- **Line Range**: Lines 1721–2064
- **What It Does**:
  - Wires `usePanZoom` with axis cursors (`ns-resize`, `ew-resize`).
  - Multi-chart crosshair synchronization listener (`useChartRuntimeStore.subscribe`).
  - Canvas resize and window DPR listener for sharp display across monitor switches.
  - Subscribes to live candle ticks in `chartRuntimeStore` with optimized dirty-layer redraws.
  - Real-time candle countdown timer (1s interval).
- **Intra-file Dependencies**:
  - Triggers Section 3 (`redraw`) on tick or resize events.
- **When an Agent Should Read This**:
  - When debugging live candle update redraw latency, multi-panel crosshair sync, or window resize behavior.

---

### Section 5: Controls & Toolbars Memo
- **File Path**: [components/chart/ChartCanvas.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx)
- **Line Range**: Lines 2065–2240
- **What It Does**:
  - Memoizes floating contextual toolbar states and positioning:
    - `customProfileControls`: Custom profile lock, settings, delete.
    - `selectedDrawing`: Properties and coordinates for active line/box/position tool toolbar.
    - `chartOrderControls`: On-chart limit order cancel/modify buttons.
    - `tradingOverlayControls`: Position close button, TP/SL badges.
- **Intra-file Dependencies**:
  - Feeds into Section 8 JSX rendering overlays.
- **When an Agent Should Read This**:
  - When repositioning floating context toolbars or adding controls to the active drawing toolbar.

---

### Section 6: Trading Actions & Bridge Handlers
- **File Path**: [components/chart/ChartCanvas.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx)
- **Line Range**: Lines 2241–2695
- **What It Does**:
  - Executes and modifies orders: `handleCancelOrder`, `confirmModifyOrder`, `executeMarketOrder`.
  - Bracket SL/TP modification handlers: `handleConfirmBracketModify`, `executeBracketModifyDirect`.
  - Direct position operations: `handleRemoveStopLoss`, `handleRemoveTakeProfit`, `handleExecuteClosePosition`.
  - Notification toast auto-dismiss (3.5s timer).
- **Relevant Dependencies**:
  - [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts) (`upsertBracketOrder`, `removeVirtualPosition`)
- **When an Agent Should Read This**:
  - When modifying on-chart trading interactions, optimistic SL/TP bracket dragging, or MT5/Binance order execution flows.

---

### Section 7: Canvas Interaction Listeners
- **File Path**: [components/chart/ChartCanvas.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx)
- **Line Range**: Lines 2696–3945
- **What It Does**:
  - Primary DOM event attachment (`mousedown`, `mousemove`, `mouseup`, `mouseleave`, `contextmenu`, `keydown`).
  - `onMouseDown` (Lines 2701–2942): Starts drawing creation, hits drawings, handles, bracket orders, or selection rects.
  - `onMouseMove` (Lines 2943–3445): Dynamic hit testing (drawings, signals, tooltips), updates cursor (`crosshair`, `grab`, `move`, `ns-resize`), handles active drag coordinate translation.
  - `onMouseUp` (Lines 3446–3804): Commits drawing placement, finalizes bracket SL/TP dragging with optimistic update, closes drag states.
  - `handleKeyDown` (Lines 3805–3921): Keyboard shortcuts (Escape to cancel, Delete/Backspace to remove selected drawing, Ctrl+Z undo/redo).
- **Intra-file Dependencies**:
  - Consumes hit testing from `chartCanvasHitTest.ts` and updates drawing state in `useChartStore`.
  - Commits bracket drags into Section 6 handlers.
- **When an Agent Should Read This**:
  - When fixing mouse coordinate hit testing, drawing placement bugs, bracket drag jitter, or keyboard shortcut handling.

---

### Section 8: JSX Composition & Return
- **File Path**: [components/chart/ChartCanvas.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx)
- **Line Range**: Lines 3946–4336
- **What It Does**:
  - Assembles canvas DOM structure: container div, `<canvas id="chart-canvas">`, overlay layers.
  - Floating UI components:
    - [CanvasDrawingToolbar](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/CanvasDrawingToolbar.tsx)
    - [MeasurementPanel](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/MeasurementPanel.tsx)
    - Signal tooltips: [AbsorptionTooltip](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/AbsorptionTooltip.tsx), [ExhaustionTooltip](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ExhaustionTooltip.tsx), [IcebergTooltip](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/IcebergTooltip.tsx)
    - Trading confirmation dialogs and notification toasts.
- **When an Agent Should Read This**:
  - When modifying the DOM hierarchy, adding a new floating overlay to the chart canvas, or altering modal dialog placement.
