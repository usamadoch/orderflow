# drawLines.ts — File Navigation & Context Map

## Overview

- **Source File**: [components/chart/drawLines.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts)
- **Total Lines**: ~1,106 lines
- **Primary Responsibility**: Pure HTML5 Canvas renderer for user drawing tools, ray extensions, box annotations, and TradingView-style position tools (Long/Short risk-reward planning). Computes forward position outcome evaluation (tracking whether price touched take-profit or stop-loss first), renders shaded profit/loss backgrounds, excursion trajectories, crisp half-pixel coordinate-aligned axis badges, and interactive drag handles.
- **Rendering Context**: Invoked directly by [components/chart/ChartCanvas.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/ChartCanvas.tsx) during its multi-layer redraw passes.

---

## Quick Navigation Index

| Feature / Task Area | Section | Approximate Line Range |
|---|---|---|
| Position Outcome Evaluation & PnL Math | [Section 1: Position Evaluation Math](#section-1-position-evaluation-math) | Lines 1–96 |
| Main `drawLines` Canvas Rendering Loop | [Section 2: Main drawLines Renderer](#section-2-main-drawlines-renderer) | Lines 97–349 |
| Price & Time Axis Badges for Drawings | [Section 3: Axis & Anchor Price Labels](#section-3-axis--anchor-price-labels) | Lines 350–431 |
| Geometric Primitives, Handles & Contrast Text | [Section 4: Primitives & Interactive Handles](#section-4-primitives--interactive-handles) | Lines 432–615 |
| Position Tool Backgrounds & Excursion Shading | [Section 5: Position Tool Backgrounds](#section-5-position-tool-backgrounds) | Lines 616–922 |
| Risk:Reward Badges & Pill Typography | [Section 6: Metrics Labels & Typography](#section-6-metrics-labels--typography) | Lines 923–1106 |

---

## Logical Section Breakdowns

### Section 1: Position Evaluation Math
- **File Path**: [components/chart/drawLines.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts)
- **Line Range**: Lines 1–96
- **What It Does**:
  - Defines `PositionEvaluation` interface (`outcome: 'tp' | 'sl' | 'open'`, `pnl`, `exitIndex`, `exitPrice`, `riskRewardRatio`, `ticks`, `returnPct`).
  - `evaluatePositionOutcome(line, candles, startIndex)`:
    - Walks historical and live candles forward from the position tool's entry index.
    - Determines if high touched take-profit (TP) or low touched stop-loss (SL) first.
    - Computes exact profit/loss excursion and realized risk-to-reward ratio.
- **When an Agent Should Read This**:
  - When debugging position tool outcome resolution, PnL calculations, or win/loss determination logic.

---

### Section 2: Main `drawLines` Renderer
- **File Path**: [components/chart/drawLines.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts)
- **Line Range**: Lines 97–349
- **What It Does**:
  - Master export `drawLines(ctx, lines, ...)` rendering all active drawings in the panel.
  - Line types handled:
    - Horizontal lines and rays: renders crisp half-pixel line (`alignCoord`) from start index to right canvas edge.
    - Vertical lines: renders time-anchored vertical markers.
    - Box drawings: supports independent `fillOpacity` and `lineOpacity` (border), background fill rectangle, and 4 corner handles.
    - Position tools (Long & Short): renders entry line, TP line, SL line, and directional excursion arrow.
  - Interactive states: renders hover outlines, selection bounding boxes, and delete dots.
- **Intra-file Dependencies**:
  - Calls Section 4 helpers (`drawHandle`, `drawDeleteDot`, `drawTrajectoryArrow`, `alignCoord`).
- **When an Agent Should Read This**:
  - When modifying drawing geometry, opacity defaults, ray extensions, or selection outline styling.

---

### Section 3: Axis & Anchor Price Labels
- **File Path**: [components/chart/drawLines.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts)
- **Line Range**: Lines 350–431
- **What It Does**:
  - Master export `drawDrawingPriceLabels(ctx, selectedLine, ...)`:
    - Renders price badge on the right price axis matching drawing color.
    - Renders time badge on the bottom time axis for rays and boxes.
    - Renders floating anchored badges adjacent to drawing anchor points (e.g. price and date at ray start point).
- **Intra-file Dependencies**:
  - Uses Section 4 badge drawing primitives (`drawPriceAxisBadge`, `drawTimeAxisBadge`).
- **When an Agent Should Read This**:
  - When adjusting drawing price/time axis badges, badge alignment, or label collision offsets.

---

### Section 4: Primitives & Interactive Handles
- **File Path**: [components/chart/drawLines.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts)
- **Line Range**: Lines 432–615
- **What It Does**:
  - Canvas drawing utility primitives:
    - `getContrastTextColor(color)`: determines optimal white vs dark text for maximum WCAG contrast against arbitrary user-selected colors.
    - `drawPriceAxisBadge`, `drawTimeAxisBadge`: crisp TradingView-style rounded badges on axes with integer-aligned coordinates.
    - `drawDeleteDot`: red delete button dot displayed when hovering drawing endpoints.
    - `drawHandle`, `drawPositionHandle`: circular white drag handles with dark borders.
    - `drawTrajectoryArrow`: dashed vector arrow showing price movement from entry to exit.
- **When an Agent Should Read This**:
  - When modifying handle sizes, hit targets, contrast color algorithms, or axis badge typography.

---

### Section 5: Position Tool Backgrounds
- **File Path**: [components/chart/drawLines.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts)
- **Line Range**: Lines 616–922
- **What It Does**:
  - Master export `drawPositionBackgrounds(ctx, lines, candles, ...)`:
    - Renders colored background zones layered behind candlesticks.
    - For Long positions: green TP target box above entry, red SL risk box below entry.
    - For Short positions: green TP target box below entry, red SL risk box above entry.
    - Shaded excursion bands: darkens the active price travel area up to the exit candle index when outcome is resolved.
- **Intra-file Dependencies**:
  - Calls Section 1 `evaluatePositionOutcome` to obtain the resolution status and exit candle index.
- **When an Agent Should Read This**:
  - When adjusting position tool background opacity, profit/stop color overrides, or active excursion shading.

---

### Section 6: Metrics Labels & Typography
- **File Path**: [components/chart/drawLines.ts](file:///c:/Users/d/Documents/ob/orderflowApp/components/chart/drawLines.ts)
- **Line Range**: Lines 923–1106
- **What It Does**:
  - `drawPositionLabels`: renders multi-line summary cards anchored inside position tool boxes:
    - Target profit metrics (price change, tick count, percentage gain, monetary profit).
    - Stop loss risk metrics (risk amount, tick loss, percentage loss).
    - Centered Risk/Reward ratio badge (e.g. `R:R 2.50`).
  - Typography formatters: `formatMove`, `drawPillLabel`, `drawStackedPillLabel`, `drawRoundedRect`, `drawAnchoredBadge`, `drawAnchoredPriceLabel`.
- **When an Agent Should Read This**:
  - When modifying position tool label text, formatting tick/percentage metrics, or styling pill badge containers.
