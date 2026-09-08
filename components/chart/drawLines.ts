// import { DrawnLine } from '../store/chart';

import { DrawnLine } from "@/lib/store/chart";
import type { Candle } from "@/types/candle";
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR, chartColorToRgba } from "@/lib/config/chartColors";
import { formatPrice, formatTime, formatTradingViewDateTime } from "@/lib/utils/format";
import { candleTimeAt } from "./chartCanvasUtils";

const DEFAULT_DRAWING_COLOR = '#FFFFFF';
const DEFAULT_DRAWING_STROKE_WIDTH = 1;
const POSITION_RISK_COLOR = CHART_BEARISH_COLOR;
const POSITION_REWARD_COLOR = CHART_BULLISH_COLOR;

export interface PositionEvaluation {
  status: 'open' | 'sl' | 'tp';
  evalIndex: number;
  evalPrice: number;
}

export function evaluatePositionOutcome(
  line: DrawnLine,
  candles: Candle[]
): PositionEvaluation {
  const entry = line.value;
  const stop = line.stopPrice ?? entry;
  const hasTarget = line.targetPrice !== undefined;
  const target = hasTarget ? line.targetPrice! : entry;

  const startIndex = Math.max(0, Math.min(Math.round(line.firstIndex ?? 0), Math.round(line.lastIndex ?? 0)));
  const endIndex = Math.max(0, Math.max(Math.round(line.firstIndex ?? 0), Math.round(line.lastIndex ?? 0)));

  if (candles.length === 0 || startIndex >= candles.length) {
    return { status: 'open', evalIndex: startIndex, evalPrice: entry };
  }

  const lastCandleIdx = candles.length - 1;
  const maxCheckIdx = Math.min(lastCandleIdx, endIndex);
  const isLong = line.type === 'long-position';

  let evalIndex = startIndex;
  let evalPrice = candles[startIndex]?.close ?? entry;
  let status: 'open' | 'sl' | 'tp' = 'open';

  for (let i = startIndex; i <= maxCheckIdx; i++) {
    const c = candles[i];
    if (!c) continue;

    evalIndex = i;
    evalPrice = c.close;

    if (isLong) {
      const hitSl = c.low <= stop;
      const hitTp = hasTarget && target > entry && c.high >= target;
      if (hitSl && hitTp) {
        const slFirst = Math.abs(c.open - stop) <= Math.abs(c.open - target);
        status = slFirst ? 'sl' : 'tp';
        evalPrice = slFirst ? stop : target;
        evalIndex = i;
        break;
      } else if (hitSl) {
        status = 'sl';
        evalPrice = stop;
        evalIndex = i;
        break;
      } else if (hitTp) {
        status = 'tp';
        evalPrice = target;
        evalIndex = i;
        break;
      }
    } else {
      const hitSl = c.high >= stop;
      const hitTp = hasTarget && target < entry && c.low <= target;
      if (hitSl && hitTp) {
        const slFirst = Math.abs(c.open - stop) <= Math.abs(c.open - target);
        status = slFirst ? 'sl' : 'tp';
        evalPrice = slFirst ? stop : target;
        evalIndex = i;
        break;
      } else if (hitSl) {
        status = 'sl';
        evalPrice = stop;
        evalIndex = i;
        break;
      } else if (hitTp) {
        status = 'tp';
        evalPrice = target;
        evalIndex = i;
        break;
      }
    }
  }

  return { status, evalIndex, evalPrice };
}

export function drawLines(
  ctx: CanvasRenderingContext2D,
  drawnLines: DrawnLine[],
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  timeAxisHeight: number,
  priceAxisWidth: number,
  barWidth: number,
  hoveredLineId: string | null,
  selectedLineId: string | null,
  isHoveringDeleteDot: boolean,
  candles: Candle[] = []
) {
  const drawableWidth = canvasWidth - priceAxisWidth;
  const drawableHeight = canvasHeight - timeAxisHeight;

function alignCoord(coord: number, strokeWidth: number): number {
  return strokeWidth % 2 === 1 ? Math.floor(coord) + 0.5 : Math.round(coord);
}

  drawnLines.forEach((line) => {
    const isHovered = line.id === hoveredLineId;
    const isSelected = line.id === selectedLineId;
    const isActive = isHovered || isSelected;
    const strokeWidth = line.strokeWidth ?? DEFAULT_DRAWING_STROKE_WIDTH;
    ctx.save();
    ctx.lineWidth = strokeWidth;
    ctx.setLineDash([]);
    ctx.strokeStyle = line.color ?? DEFAULT_DRAWING_COLOR;
    const lineOpacity = line.opacity ?? 1;

    if (line.type === 'horizontal') {
      const y = priceToY(line.value);
      if (y < 0 || y > drawableHeight) {
        ctx.restore();
        return;
      }
      const alignedY = alignCoord(y, strokeWidth);

      // Draw Line
      ctx.globalAlpha = lineOpacity;
      ctx.beginPath();
      ctx.moveTo(0, alignedY);
      ctx.lineTo(drawableWidth, alignedY);
      ctx.stroke();

      // Draw Delete Dot if hovered (reset alpha to 1 for UI handles)
      if (isActive) {
        ctx.globalAlpha = 1;
        const dotX = drawableWidth - 6;
        const dotY = alignedY;
        drawDeleteDot(ctx, dotX, dotY, isHoveringDeleteDot);
      }
    } else if (line.type === 'vertical') {
      const x = indexToX(line.value);
      if (x === null || x < 0 || x > drawableWidth) {
        ctx.restore();
        return;
      }
      const alignedX = alignCoord(x, strokeWidth);

      // Draw Line
      ctx.globalAlpha = lineOpacity;
      ctx.beginPath();
      ctx.moveTo(alignedX, 0);
      ctx.lineTo(alignedX, drawableHeight);
      ctx.stroke();

      // Draw Delete Dot if hovered
      if (isActive) {
        ctx.globalAlpha = 1;
        const dotX = alignedX;
        const dotY = 10;
        drawDeleteDot(ctx, dotX, dotY, isHoveringDeleteDot);
      }
    } else if (line.type === 'horizontal-ray') {
      const startIndex = line.startIndex ?? 0;
      const x = indexToX(startIndex);
      const y = priceToY(line.value);
      if (x === null || x > drawableWidth || y < 0 || y > drawableHeight) {
        ctx.restore();
        return;
      }

      const startX = Math.max(0, x);
      const alignedY = alignCoord(y, strokeWidth);
      ctx.globalAlpha = lineOpacity;
      ctx.beginPath();
      ctx.moveTo(startX, alignedY);
      ctx.lineTo(drawableWidth, alignedY);
      ctx.stroke();

      if (isActive) {
        ctx.globalAlpha = 1;
        drawHandle(ctx, startX, alignedY);
        drawDeleteDot(ctx, drawableWidth - 6, alignedY, isHoveringDeleteDot);
      }
    } else if (line.type === 'box') {
      if (
        line.firstIndex === undefined ||
        line.lastIndex === undefined ||
        line.priceHigh === undefined ||
        line.priceLow === undefined
      ) {
        ctx.restore();
        return;
      }

      const x1 = indexToX(line.firstIndex);
      const x2 = indexToX(line.lastIndex);
      if (x1 === null || x2 === null) {
        ctx.restore();
        return;
      }

      const left = Math.max(0, Math.min(x1, x2) - barWidth / 2);
      const right = Math.min(drawableWidth, Math.max(x1, x2) + barWidth / 2);
      const top = priceToY(line.priceHigh);
      const bottom = priceToY(line.priceLow);
      if (right < 0 || left > drawableWidth || bottom < 0 || top > drawableHeight) {
        ctx.restore();
        return;
      }

      const rectTop = Math.max(0, Math.min(top, bottom));
      const rectBottom = Math.min(drawableHeight, Math.max(top, bottom));
      const rectW = Math.max(1, right - left);
      const rectH = Math.max(1, rectBottom - rectTop);

      // Fill: only render if showFill !== false (legacy drawings default to true)
      // Independent fillOpacity: uses line.fillOpacity if set, falling back to lineOpacity
      if (line.showFill !== false) {
        ctx.save();
        const fillAlpha = line.fillOpacity ?? lineOpacity;
        ctx.globalAlpha = fillAlpha;
        if (line.fillColor) {
          ctx.fillStyle = line.fillColor;
        } else {
          ctx.fillStyle = isActive ? 'rgba(61, 126, 255, 0.10)' : 'rgba(120, 123, 134, 0.08)';
        }
        ctx.fillRect(Math.round(left), Math.round(rectTop), Math.round(rectW), Math.round(rectH));
        ctx.restore();
      }

      // Border: uses lineOpacity (line.opacity ?? 1) independently
      ctx.save();
      ctx.globalAlpha = lineOpacity;
      if (strokeWidth % 2 === 1) {
        ctx.strokeRect(Math.floor(left) + 0.5, Math.floor(rectTop) + 0.5, Math.round(rectW), Math.round(rectH));
      } else {
        ctx.strokeRect(Math.round(left), Math.round(rectTop), Math.round(rectW), Math.round(rectH));
      }
      ctx.restore();

      if (isActive) {
        ctx.globalAlpha = 1;
        drawHandle(ctx, left, rectTop);
        drawHandle(ctx, right, rectTop);
        drawHandle(ctx, left, rectBottom);
        drawHandle(ctx, right, rectBottom);
        drawDeleteDot(ctx, right, rectTop, isHoveringDeleteDot);
      }
    } else if (
      (line.type === 'long-position' || line.type === 'short-position') &&
      line.firstIndex !== undefined &&
      line.lastIndex !== undefined &&
      line.stopPrice !== undefined
    ) {
      const x1 = indexToX(line.firstIndex);
      const x2 = indexToX(line.lastIndex);
      if (x1 === null || x2 === null) {
        ctx.restore();
        return;
      }

      const left = Math.max(0, Math.min(x1, x2) - barWidth / 2);
      const right = Math.min(drawableWidth, Math.max(x1, x2) + barWidth / 2);
      const entryY = priceToY(line.value);
      const stopY = priceToY(line.stopPrice);
      const hasTarget = line.targetPrice !== undefined;
      const targetY = hasTarget ? priceToY(line.targetPrice!) : entryY;
      const minY = hasTarget ? Math.min(entryY, stopY, targetY) : Math.min(entryY, stopY);
      const maxY = hasTarget ? Math.max(entryY, stopY, targetY) : Math.max(entryY, stopY);
      if (right < 0 || left > drawableWidth || maxY < 0 || minY > drawableHeight) {
        ctx.restore();
        return;
      }

      const stopColor = line.stopColor ?? CHART_BEARISH_COLOR;
      const profitColor = line.profitColor ?? CHART_BULLISH_COLOR;

      // Trajectory excursion line from entry to position outcome / current price
      const startIndex = Math.max(0, Math.min(Math.round(line.firstIndex), Math.round(line.lastIndex)));
      const evalOutcome = evaluatePositionOutcome(line, candles);

      if (candles.length > 0 && startIndex <= evalOutcome.evalIndex) {
        const startX = indexToX(startIndex);
        const endX = indexToX(evalOutcome.evalIndex);
        const startY = priceToY(line.value);
        const endY = priceToY(evalOutcome.evalPrice);

        if (startX !== null && endX !== null && (Math.abs(endX - startX) > 2 || Math.abs(endY - startY) > 2)) {
          const arrowEndX = Math.min(right, Math.max(left, endX));
          const arrowEndY = Math.min(maxY, Math.max(minY, endY));
          drawTrajectoryArrow(ctx, startX, startY, arrowEndX, arrowEndY);
        }
      }

      ctx.lineWidth = strokeWidth;
      ctx.strokeStyle = '#D1D4DC';
      drawLevelLine(ctx, left, right, entryY, []);
      ctx.strokeStyle = stopColor;
      drawLevelLine(ctx, left, right, stopY, [4, 3]);
      if (hasTarget) {
        ctx.strokeStyle = profitColor;
        drawLevelLine(ctx, left, right, targetY, [4, 3]);
      }
      ctx.setLineDash([]);

      if (isActive && hasTarget) {
        drawPositionLabels(
          ctx,
          line,
          left,
          right,
          entryY,
          stopY,
          targetY,
          drawableWidth,
          drawableHeight,
          stopColor,
          profitColor
        );
      }

      if (isActive) {
        drawPositionHandle(ctx, left, entryY);
        drawPositionHandle(ctx, right, entryY);
        drawPositionHandle(ctx, left, stopY);
        drawPositionHandle(ctx, right, stopY);
        if (hasTarget) {
          drawPositionHandle(ctx, left, targetY);
          drawPositionHandle(ctx, right, targetY);
        }
        drawDeleteDot(ctx, right, Math.max(0, minY), isHoveringDeleteDot);
      }
    }
    ctx.restore();
  });
}

export function drawDrawingPriceLabels(
  ctx: CanvasRenderingContext2D,
  drawnLines: DrawnLine[],
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  canvasWidth: number,
  canvasHeight: number,
  timeAxisHeight: number,
  priceAxisWidth: number,
  barWidth: number,
  candles?: Candle[],
  timezone: string = 'local',
  timeFormat: '12h' | '24h' = '24h',
  selectedLineId: string | null = null
) {
  const chartWidth = canvasWidth - priceAxisWidth;
  const chartHeight = canvasHeight - timeAxisHeight;

  drawnLines.forEach((line) => {
    const accent = line.color ?? DEFAULT_DRAWING_COLOR;

    if (line.type === 'horizontal') {
      const y = priceToY(line.value);
      if (y >= 0 && y <= chartHeight) {
        drawPriceAxisBadge(ctx, y, line.value, chartWidth, priceAxisWidth, canvasHeight, accent);
      }
    } else if (line.type === 'vertical') {
      const x = indexToX(line.value);
      if (x !== null && x >= 0 && x <= chartWidth && timeAxisHeight > 0) {
        let time = line.time;
        if (time === undefined && line.value !== undefined && candles && candles.length > 0) {
          time = candleTimeAt(line.value, candles);
        }
        if (time !== undefined) {
          const timeText = formatTradingViewDateTime(time, timezone, timeFormat);
          drawTimeAxisBadge(ctx, x, chartHeight, timeAxisHeight, timeText, chartWidth, accent);
        }
      }
    } else if (line.type === 'horizontal-ray') {
      const startX = indexToX(line.startIndex ?? 0);
      const y = priceToY(line.value);

      if (startX !== null) {
        // Price badge above the ray anchor point
        drawAnchoredPriceLabel(ctx, Math.max(0, startX), y - 4, line.value, chartWidth, chartHeight, 'above', accent);

        // Time badge below the ray anchor point (symmetrically offset, no visual collision)
        let time = line.startTime;
        if (time === undefined && line.startIndex !== undefined && candles && candles.length > 0) {
          time = candleTimeAt(line.startIndex, candles);
        }
        if (time !== undefined) {
          const timeText = formatTime(time, timezone, timeFormat);
          drawAnchoredBadge(ctx, Math.max(0, startX), y + 4, timeText, chartWidth, chartHeight, 'below', accent);
        }
      }

      // Price badge on the right price axis
      if (y >= 0 && y <= chartHeight) {
        drawPriceAxisBadge(ctx, y, line.value, chartWidth, priceAxisWidth, canvasHeight, accent);
      }
    } else if (
      line.type === 'box' &&
      line.firstIndex !== undefined &&
      line.lastIndex !== undefined &&
      line.priceHigh !== undefined &&
      line.priceLow !== undefined
    ) {
      // Anchored price labels for box only appear when the box is selected (matching TradingView)
      if (selectedLineId && line.id === selectedLineId) {
        const x1 = indexToX(line.firstIndex);
        const x2 = indexToX(line.lastIndex);
        if (x1 === null || x2 === null) return;

        const left = Math.max(0, Math.min(x1, x2) - barWidth / 2);
        drawAnchoredPriceLabel(ctx, left, priceToY(line.priceHigh) - 6, line.priceHigh, chartWidth, chartHeight, 'above', accent);
        drawAnchoredPriceLabel(ctx, left, priceToY(line.priceLow) + 6, line.priceLow, chartWidth, chartHeight, 'below', accent);
      }
    }
  });
}

function getContrastTextColor(color: string): string {
  if (!color) return '#FFFFFF';

  let hex = color.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }

  if (hex.length >= 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#0F0F0F' : '#FFFFFF';
    }
  }

  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#0F0F0F' : '#FFFFFF';
  }

  return '#FFFFFF';
}

function drawPriceAxisBadge(
  ctx: CanvasRenderingContext2D,
  y: number,
  price: number,
  chartWidth: number,
  priceAxisWidth: number,
  canvasHeight: number,
  accentColor: string
) {
  const badgeHeight = 20;
  const badgeWidth = Math.max(30, priceAxisWidth - 4);
  const badgeX = chartWidth + 2;
  const badgeY = Math.max(1, Math.min(canvasHeight - badgeHeight - 1, Math.round(y - badgeHeight / 2)));

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
  } else {
    drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 3);
  }
  ctx.fill();

  const priceLabel = formatPrice(price);
  ctx.font = 'bold 12px "BlinkMacSystemFont", -apple-system, system-ui, sans-serif';
  if (ctx.measureText(priceLabel).width > badgeWidth - 4) {
    ctx.font = 'bold 11px "BlinkMacSystemFont", -apple-system, system-ui, sans-serif';
  }
  ctx.fillStyle = getContrastTextColor(accentColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(priceLabel, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
  ctx.restore();
}

function drawTimeAxisBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  chartHeight: number,
  timeAxisHeight: number,
  timeText: string,
  chartWidth: number,
  accentColor: string
) {
  const badgeHeight = Math.min(22, Math.max(18, timeAxisHeight - 2));
  const badgeY = chartHeight + 1;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.font = 'bold 11px "BlinkMacSystemFont", -apple-system, system-ui, sans-serif';
  const paddingX = 8;
  const textWidth = ctx.measureText(timeText).width;
  const badgeWidth = textWidth + paddingX * 2;
  const rawX = Math.round(x - badgeWidth / 2);
  const badgeX = Math.max(2, Math.min(chartWidth - badgeWidth - 2, rawX));

  ctx.fillStyle = accentColor;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
  } else {
    drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 3);
  }
  ctx.fill();

  ctx.fillStyle = getContrastTextColor(accentColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
  ctx.restore();
}


function drawDeleteDot(ctx: CanvasRenderingContext2D, x: number, y: number, isHovered: boolean) {
  const radius = 5;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  if (isHovered) {
    ctx.fillStyle = CHART_BEARISH_COLOR;
    ctx.fill();
  } else {
    ctx.fillStyle = '#1F1F1F';
    ctx.fill();
    ctx.strokeStyle = '#4A4A4A';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#1F1F1F';
  ctx.strokeStyle = '#3D7EFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(x - 3, y - 3, 6, 6);
  ctx.fill();
  ctx.stroke();
}

function drawPositionHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#1F1F1F';
  ctx.strokeStyle = '#2962FF';
  ctx.lineWidth = 1.5;
  ctx.fillRect(x - 4, y - 4, 8, 8);
  ctx.strokeRect(x - 4, y - 4, 8, 8);
}

function drawLevelLine(ctx: CanvasRenderingContext2D, left: number, right: number, y: number, dash: number[]) {
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
}

function drawTrajectoryArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
) {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  const angle = Math.atan2(toY - fromY, toX - fromX);
  const headLen = 6;
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLen * Math.cos(angle - Math.PI / 6),
    toY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLen * Math.cos(angle + Math.PI / 6),
    toY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawPositionBackgrounds(
  ctx: CanvasRenderingContext2D,
  drawnLines: DrawnLine[],
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  barWidth: number,
  drawableWidth: number,
  drawableHeight: number,
  hoveredLineId: string | null,
  selectedLineId: string | null,
  candles: Candle[] = []
) {
  drawnLines.forEach((line) => {
    if (
      (line.type !== 'long-position' && line.type !== 'short-position') ||
      line.firstIndex === undefined ||
      line.lastIndex === undefined ||
      line.stopPrice === undefined
    ) {
      return;
    }

    const x1 = indexToX(line.firstIndex);
    const x2 = indexToX(line.lastIndex);
    if (x1 === null || x2 === null) return;

    const left = Math.max(0, Math.min(x1, x2) - barWidth / 2);
    const right = Math.min(drawableWidth, Math.max(x1, x2) + barWidth / 2);
    const width = Math.max(1, right - left);
    if (right < 0 || left > drawableWidth) return;

    const entry = line.value;
    const stop = line.stopPrice;
    const hasTarget = line.targetPrice !== undefined;
    const target = hasTarget ? line.targetPrice! : entry;

    const entryY = priceToY(entry);
    const stopY = priceToY(stop);
    const targetY = priceToY(target);

    const isLong = line.type === 'long-position';
    const isHovered = line.id === hoveredLineId;
    const isSelected = line.id === selectedLineId;
    const isActive = isHovered || isSelected;

    const stopColor = line.stopColor ?? CHART_BEARISH_COLOR;
    const profitColor = line.profitColor ?? CHART_BULLISH_COLOR;

    const baseProfitOpacity = line.profitOpacity ?? (isActive ? 0.24 : 0.18);
    const baseStopOpacity = line.stopOpacity ?? (isActive ? 0.24 : 0.18);
    const darkerProfitAlpha = Math.min(0.60, Math.max(baseProfitOpacity + 0.12, baseProfitOpacity * 1.6));
    const darkerStopAlpha = Math.min(0.60, Math.max(baseStopOpacity + 0.12, baseStopOpacity * 1.6));

    const evalOutcome = evaluatePositionOutcome(line, candles);
    const evalXRaw = indexToX(evalOutcome.evalIndex);
    const evalRight = evalXRaw !== null
      ? Math.min(right, Math.max(left, evalXRaw + barWidth / 2))
      : right;

    const activeWidth = Math.max(0, evalRight - left);
    const remainingWidth = Math.max(0, right - evalRight);

    ctx.save();

    if (isLong) {
      if (evalOutcome.status === 'tp') {
        // Long reached TP: active band is darker green across full target height
        if (hasTarget && target > entry) {
          const top = Math.max(0, Math.min(entryY, targetY));
          const bot = Math.min(drawableHeight, Math.max(entryY, targetY));
          if (bot > top && activeWidth > 0) {
            ctx.fillStyle = chartColorToRgba(profitColor, darkerProfitAlpha);
            ctx.fillRect(left, top, activeWidth, bot - top);
          }
          if (bot > top && remainingWidth > 0) {
            ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
            ctx.fillRect(evalRight, top, remainingWidth, bot - top);
          }
        }

        // SL Box: 100% base lighter red across full width
        const stopTop = Math.max(0, Math.min(entryY, stopY));
        const stopBot = Math.min(drawableHeight, Math.max(entryY, stopY));
        if (stopBot > stopTop) {
          ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
          ctx.fillRect(left, stopTop, width, stopBot - stopTop);
        }
      } else if (evalOutcome.status === 'sl') {
        // Long reached SL: active band is darker red across full stop height
        const stopTop = Math.max(0, Math.min(entryY, stopY));
        const stopBot = Math.min(drawableHeight, Math.max(entryY, stopY));
        if (stopBot > stopTop && activeWidth > 0) {
          ctx.fillStyle = chartColorToRgba(stopColor, darkerStopAlpha);
          ctx.fillRect(left, stopTop, activeWidth, stopBot - stopTop);
        }
        if (stopBot > stopTop && remainingWidth > 0) {
          ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
          ctx.fillRect(evalRight, stopTop, remainingWidth, stopBot - stopTop);
        }

        // TP Box: 100% base lighter green across full width
        if (hasTarget && target > entry) {
          const targetTop = Math.max(0, Math.min(entryY, targetY));
          const targetBot = Math.min(drawableHeight, Math.max(entryY, targetY));
          if (targetBot > targetTop) {
            ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
            ctx.fillRect(left, targetTop, width, targetBot - targetTop);
          }
        }
      } else {
        // Open Long position
        const inProfit = evalOutcome.evalPrice > entry;
        const inLoss = evalOutcome.evalPrice < entry;

        if (hasTarget && target > entry) {
          if (inProfit) {
            const progressPrice = Math.min(target, evalOutcome.evalPrice);
            const progressY = priceToY(progressPrice);

            const completedTop = Math.max(0, Math.min(entryY, progressY));
            const completedBottom = Math.min(drawableHeight, Math.max(entryY, progressY));
            if (completedBottom > completedTop && activeWidth > 0) {
              ctx.fillStyle = chartColorToRgba(profitColor, darkerProfitAlpha);
              ctx.fillRect(left, completedTop, activeWidth, completedBottom - completedTop);
            }

            const remainingTop = Math.max(0, Math.min(progressY, targetY));
            const remainingBottom = Math.min(drawableHeight, Math.max(progressY, targetY));
            if (remainingBottom > remainingTop && activeWidth > 0) {
              ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
              ctx.fillRect(left, remainingTop, activeWidth, remainingBottom - remainingTop);
            }

            const targetTop = Math.max(0, Math.min(entryY, targetY));
            const targetBottom = Math.min(drawableHeight, Math.max(entryY, targetY));
            if (targetBottom > targetTop && remainingWidth > 0) {
              ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
              ctx.fillRect(evalRight, targetTop, remainingWidth, targetBottom - targetTop);
            }
          } else {
            const targetTop = Math.max(0, Math.min(entryY, targetY));
            const targetBottom = Math.min(drawableHeight, Math.max(entryY, targetY));
            if (targetBottom > targetTop) {
              ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
              ctx.fillRect(left, targetTop, width, targetBottom - targetTop);
            }
          }
        }

        if (inLoss) {
          const adversePrice = Math.max(stop, evalOutcome.evalPrice);
          const adverseY = priceToY(adversePrice);

          const incurredTop = Math.max(0, Math.min(entryY, adverseY));
          const incurredBottom = Math.min(drawableHeight, Math.max(entryY, adverseY));
          if (incurredBottom > incurredTop && activeWidth > 0) {
            ctx.fillStyle = chartColorToRgba(stopColor, darkerStopAlpha);
            ctx.fillRect(left, incurredTop, activeWidth, incurredBottom - incurredTop);
          }

          const remainingRiskTop = Math.max(0, Math.min(adverseY, stopY));
          const remainingRiskBottom = Math.min(drawableHeight, Math.max(adverseY, stopY));
          if (remainingRiskBottom > remainingRiskTop && activeWidth > 0) {
            ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
            ctx.fillRect(left, remainingRiskTop, activeWidth, remainingRiskBottom - remainingRiskTop);
          }

          const stopTop = Math.max(0, Math.min(entryY, stopY));
          const stopBottom = Math.min(drawableHeight, Math.max(entryY, stopY));
          if (stopBottom > stopTop && remainingWidth > 0) {
            ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
            ctx.fillRect(evalRight, stopTop, remainingWidth, stopBottom - stopTop);
          }
        } else {
          const stopTop = Math.max(0, Math.min(entryY, stopY));
          const stopBottom = Math.min(drawableHeight, Math.max(entryY, stopY));
          if (stopBottom > stopTop) {
            ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
            ctx.fillRect(left, stopTop, width, stopBottom - stopTop);
          }
        }
      }
    } else {
      // Short position
      if (evalOutcome.status === 'tp') {
        // Short reached TP: active band is darker green across full target height
        if (hasTarget && target < entry) {
          const top = Math.max(0, Math.min(entryY, targetY));
          const bot = Math.min(drawableHeight, Math.max(entryY, targetY));
          if (bot > top && activeWidth > 0) {
            ctx.fillStyle = chartColorToRgba(profitColor, darkerProfitAlpha);
            ctx.fillRect(left, top, activeWidth, bot - top);
          }
          if (bot > top && remainingWidth > 0) {
            ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
            ctx.fillRect(evalRight, top, remainingWidth, bot - top);
          }
        }

        // SL Box: 100% base lighter red across full width
        const stopTop = Math.max(0, Math.min(entryY, stopY));
        const stopBot = Math.min(drawableHeight, Math.max(entryY, stopY));
        if (stopBot > stopTop) {
          ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
          ctx.fillRect(left, stopTop, width, stopBot - stopTop);
        }
      } else if (evalOutcome.status === 'sl') {
        // Short reached SL: active band is darker red across full stop height
        const stopTop = Math.max(0, Math.min(entryY, stopY));
        const stopBot = Math.min(drawableHeight, Math.max(entryY, stopY));
        if (stopBot > stopTop && activeWidth > 0) {
          ctx.fillStyle = chartColorToRgba(stopColor, darkerStopAlpha);
          ctx.fillRect(left, stopTop, activeWidth, stopBot - stopTop);
        }
        if (stopBot > stopTop && remainingWidth > 0) {
          ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
          ctx.fillRect(evalRight, stopTop, remainingWidth, stopBot - stopTop);
        }

        // TP Box: 100% base lighter green across full width
        if (hasTarget && target < entry) {
          const targetTop = Math.max(0, Math.min(entryY, targetY));
          const targetBot = Math.min(drawableHeight, Math.max(entryY, targetY));
          if (targetBot > targetTop) {
            ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
            ctx.fillRect(left, targetTop, width, targetBot - targetTop);
          }
        }
      } else {
        // Open Short position
        const inProfit = evalOutcome.evalPrice < entry;
        const inLoss = evalOutcome.evalPrice > entry;

        if (hasTarget && target < entry) {
          if (inProfit) {
            const progressPrice = Math.max(target, evalOutcome.evalPrice);
            const progressY = priceToY(progressPrice);

            const completedTop = Math.max(0, Math.min(entryY, progressY));
            const completedBottom = Math.min(drawableHeight, Math.max(entryY, progressY));
            if (completedBottom > completedTop && activeWidth > 0) {
              ctx.fillStyle = chartColorToRgba(profitColor, darkerProfitAlpha);
              ctx.fillRect(left, completedTop, activeWidth, completedBottom - completedTop);
            }

            const remainingTop = Math.max(0, Math.min(progressY, targetY));
            const remainingBottom = Math.min(drawableHeight, Math.max(progressY, targetY));
            if (remainingBottom > remainingTop && activeWidth > 0) {
              ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
              ctx.fillRect(left, remainingTop, activeWidth, remainingBottom - remainingTop);
            }

            const targetTop = Math.max(0, Math.min(entryY, targetY));
            const targetBottom = Math.min(drawableHeight, Math.max(entryY, targetY));
            if (targetBottom > targetTop && remainingWidth > 0) {
              ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
              ctx.fillRect(evalRight, targetTop, remainingWidth, targetBottom - targetTop);
            }
          } else {
            const targetTop = Math.max(0, Math.min(entryY, targetY));
            const targetBottom = Math.min(drawableHeight, Math.max(entryY, targetY));
            if (targetBottom > targetTop) {
              ctx.fillStyle = chartColorToRgba(profitColor, baseProfitOpacity);
              ctx.fillRect(left, targetTop, width, targetBottom - targetTop);
            }
          }
        }

        if (inLoss) {
          const adversePrice = Math.min(stop, evalOutcome.evalPrice);
          const adverseY = priceToY(adversePrice);

          const incurredTop = Math.max(0, Math.min(entryY, adverseY));
          const incurredBottom = Math.min(drawableHeight, Math.max(entryY, adverseY));
          if (incurredBottom > incurredTop && activeWidth > 0) {
            ctx.fillStyle = chartColorToRgba(stopColor, darkerStopAlpha);
            ctx.fillRect(left, incurredTop, activeWidth, incurredBottom - incurredTop);
          }

          const remainingRiskTop = Math.max(0, Math.min(adverseY, stopY));
          const remainingRiskBottom = Math.min(drawableHeight, Math.max(adverseY, stopY));
          if (remainingRiskBottom > remainingRiskTop && activeWidth > 0) {
            ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
            ctx.fillRect(left, remainingRiskTop, activeWidth, remainingRiskBottom - remainingRiskTop);
          }

          const stopTop = Math.max(0, Math.min(entryY, stopY));
          const stopBottom = Math.min(drawableHeight, Math.max(entryY, stopY));
          if (stopBottom > stopTop && remainingWidth > 0) {
            ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
            ctx.fillRect(evalRight, stopTop, remainingWidth, stopBottom - stopTop);
          }
        } else {
          const stopTop = Math.max(0, Math.min(entryY, stopY));
          const stopBottom = Math.min(drawableHeight, Math.max(entryY, stopY));
          if (stopBottom > stopTop) {
            ctx.fillStyle = chartColorToRgba(stopColor, baseStopOpacity);
            ctx.fillRect(left, stopTop, width, stopBottom - stopTop);
          }
        }
      }
    }

    ctx.restore();
  });
}

function drawPositionLabels(
  ctx: CanvasRenderingContext2D,
  line: DrawnLine,
  left: number,
  right: number,
  entryY: number,
  stopY: number,
  targetY: number,
  chartWidth: number,
  chartHeight: number,
  stopColor: string = line.stopColor ?? POSITION_RISK_COLOR,
  profitColor: string = line.profitColor ?? POSITION_REWARD_COLOR
) {
  const entry = line.value;
  const stop = line.stopPrice ?? entry;
  const target = line.targetPrice ?? entry;
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  const rr = risk > 0 ? reward / risk : 0;
  const riskPct = entry !== 0 ? (risk / Math.abs(entry)) * 100 : 0;
  const rewardPct = entry !== 0 ? (reward / Math.abs(entry)) * 100 : 0;
  const centerX = (left + right) / 2;
  const topY = Math.min(entryY, stopY, targetY);
  const bottomY = Math.max(entryY, stopY, targetY);

  drawPillLabel(
    ctx,
    `Target: ${formatPrice(target)} (${rewardPct.toFixed(3)}%) ${formatMove(reward)}`,
    centerX,
    Math.max(4, topY - 22),
    profitColor,
    chartWidth,
    'center'
  );
  drawPillLabel(
    ctx,
    `Stop: ${formatPrice(stop)} (${riskPct.toFixed(3)}%) ${formatMove(risk)}`,
    centerX,
    Math.min(chartHeight - 23, bottomY + 6),
    stopColor,
    chartWidth,
    'center'
  );
  drawStackedPillLabel(
    ctx,
    [
      `${line.type === 'long-position' ? 'Long' : 'Short'}  Open P&L: --, Qty: --`,
      `Entry: ${formatPrice(entry)}  Risk/reward ratio: ${rr.toFixed(2)}`,
    ],
    centerX,
    Math.max(4, Math.min(chartHeight - 42, entryY - 40)),
    stopColor,
    chartWidth
  );
}

function formatMove(value: number) {
  if (!Number.isFinite(value)) return '0 pts';
  const abs = Math.abs(value);
  if (abs >= 100) return `${abs.toFixed(2)} pts`;
  if (abs >= 1) return `${abs.toFixed(3)} pts`;
  return `${abs.toFixed(5)} pts`;
}

function drawPillLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  chartWidth: number,
  align: 'left' | 'center'
) {
  ctx.save();
  ctx.font = '700 11px "BlinkMacSystemFont", -apple-system, system-ui, sans-serif';
  const paddingX = 7;
  const height = 20;
  const width = Math.min(chartWidth - 8, ctx.measureText(text).width + paddingX * 2);
  const rawX = align === 'center' ? x - width / 2 : x;
  const labelX = Math.max(4, Math.min(chartWidth - width - 4, rawX));
  const labelY = Math.max(3, Math.min(y, Number.MAX_SAFE_INTEGER));

  drawRoundedRect(ctx, labelX, labelY, width, height, 3);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = getContrastTextColor(fill);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, labelX + paddingX, labelY + height / 2);
  ctx.restore();
}

function drawStackedPillLabel(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  fill: string,
  chartWidth: number
) {
  ctx.save();
  ctx.font = '700 11px "BlinkMacSystemFont", -apple-system, system-ui, sans-serif';
  const paddingX = 7;
  const height = 34;
  const width = Math.min(chartWidth - 8, Math.max(...lines.map((line) => ctx.measureText(line).width)) + paddingX * 2);
  const labelX = Math.max(4, Math.min(chartWidth - width - 4, x - width / 2));
  const labelY = Math.max(3, y);

  drawRoundedRect(ctx, labelX, labelY, width, height, 3);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = getContrastTextColor(fill);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(lines[0], labelX + width / 2, labelY + 12);
  ctx.fillText(lines[1], labelX + width / 2, labelY + 24);
  ctx.restore();
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawAnchoredBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  chartWidth: number,
  chartHeight: number,
  placement: 'above' | 'below',
  accentColor = '#3D7EFF'
) {
  ctx.save();
  ctx.font = '600 11px "BlinkMacSystemFont", -apple-system, system-ui, sans-serif';

  const width = Math.max(48, ctx.measureText(text).width + 12);
  const height = 17;
  const labelX = Math.max(2, Math.min(chartWidth - width - 2, x));
  const labelY = placement === 'above' ? y - height : y;
  const top = Math.max(1, Math.min(chartHeight - height - 1, labelY));

  ctx.fillStyle = 'rgba(13, 13, 13, 0.82)';
  ctx.fillRect(labelX, top, width, height);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(labelX, top, width, height);
  ctx.fillStyle = '#E8E8E8';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, labelX + 6, top + height / 2);
  ctx.restore();
}

function drawAnchoredPriceLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  price: number,
  chartWidth: number,
  chartHeight: number,
  placement: 'above' | 'below',
  accentColor = '#3D7EFF'
) {
  drawAnchoredBadge(ctx, x, y, formatPrice(price), chartWidth, chartHeight, placement, accentColor);
}
