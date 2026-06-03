// import { DrawnLine } from '../store/chart';

import { DrawnLine } from "@/lib/store/chart";
import type { Candle } from "@/types/candle";
import { formatPrice } from "@/lib/utils/format";

const DEFAULT_DRAWING_COLOR = '#787B86';
const DEFAULT_DRAWING_STROKE_WIDTH = 2;
const POSITION_RISK_COLOR = '#F23645';
const POSITION_REWARD_COLOR = '#089981';

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

  drawnLines.forEach((line) => {
    const isHovered = line.id === hoveredLineId;
    const isSelected = line.id === selectedLineId;
    const isActive = isHovered || isSelected;
    ctx.save();
    ctx.lineWidth = line.strokeWidth ?? DEFAULT_DRAWING_STROKE_WIDTH;
    ctx.setLineDash([]);
    ctx.strokeStyle = line.color ?? DEFAULT_DRAWING_COLOR;

    if (line.type === 'horizontal') {
      const y = priceToY(line.value);
      if (y < 0 || y > drawableHeight) {
        ctx.restore();
        return;
      }

      // Draw Line
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(drawableWidth, y);
      ctx.stroke();

      // Draw Delete Dot if hovered
      if (isActive) {
        const dotX = drawableWidth - 6;
        const dotY = y;
        drawDeleteDot(ctx, dotX, dotY, isHoveringDeleteDot);
      }
    } else if (line.type === 'vertical') {
      const x = indexToX(line.value);
      if (x === null || x < 0 || x > drawableWidth) {
        ctx.restore();
        return;
      }

      // Draw Line
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, drawableHeight);
      ctx.stroke();

      // Draw Delete Dot if hovered
      if (isActive) {
        const dotX = x;
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
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(drawableWidth, y);
      ctx.stroke();

      if (isActive) {
        drawHandle(ctx, startX, y);
        drawDeleteDot(ctx, drawableWidth - 6, y, isHoveringDeleteDot);
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

      ctx.fillStyle = isActive ? 'rgba(61, 126, 255, 0.10)' : 'rgba(120, 123, 134, 0.08)';
      ctx.fillRect(left, rectTop, Math.max(1, right - left), Math.max(1, rectBottom - rectTop));
      ctx.strokeRect(left, rectTop, Math.max(1, right - left), Math.max(1, rectBottom - rectTop));

      if (isActive) {
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

      const riskTop = Math.max(0, Math.min(entryY, stopY));
      const riskBottom = Math.min(drawableHeight, Math.max(entryY, stopY));
      const width = Math.max(1, right - left);
      const rewardTop = hasTarget ? Math.max(0, Math.min(entryY, targetY)) : entryY;
      const rewardBottom = hasTarget ? Math.min(drawableHeight, Math.max(entryY, targetY)) : entryY;

      ctx.fillStyle = isActive ? 'rgba(242, 54, 69, 0.28)' : 'rgba(242, 54, 69, 0.18)';
      ctx.fillRect(left, riskTop, width, Math.max(1, riskBottom - riskTop));
      if (hasTarget) {
        ctx.fillStyle = isActive ? 'rgba(8, 153, 129, 0.28)' : 'rgba(8, 153, 129, 0.18)';
        ctx.fillRect(left, rewardTop, width, Math.max(1, rewardBottom - rewardTop));
      }

      drawPositionCandleOverlap(
        ctx,
        line,
        candles,
        indexToX,
        priceToY,
        left,
        right,
        barWidth,
        drawableHeight
      );

      ctx.lineWidth = 1;
      ctx.strokeStyle = '#D1D4DC';
      drawLevelLine(ctx, left, right, entryY, []);
      ctx.strokeStyle = POSITION_RISK_COLOR;
      drawLevelLine(ctx, left, right, stopY, [4, 3]);
      if (hasTarget) {
        ctx.strokeStyle = POSITION_REWARD_COLOR;
        drawLevelLine(ctx, left, right, targetY, [4, 3]);
      }
      ctx.setLineDash([]);

      if (isActive && hasTarget) {
        drawPositionLabels(ctx, line, left, right, entryY, stopY, targetY, drawableWidth, drawableHeight);
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
  barWidth: number
) {
  const chartWidth = canvasWidth - priceAxisWidth;
  const chartHeight = canvasHeight - timeAxisHeight;

  drawnLines.forEach((line) => {
    if (line.type === 'horizontal-ray') {
      const startX = indexToX(line.startIndex ?? 0);
      if (startX === null) return;

      drawAnchoredPriceLabel(ctx, Math.max(0, startX), priceToY(line.value) - 6, line.value, chartWidth, chartHeight, 'above');
    } else if (
      line.type === 'box' &&
      line.firstIndex !== undefined &&
      line.lastIndex !== undefined &&
      line.priceHigh !== undefined &&
      line.priceLow !== undefined
    ) {
      const x1 = indexToX(line.firstIndex);
      const x2 = indexToX(line.lastIndex);
      if (x1 === null || x2 === null) return;

      const left = Math.max(0, Math.min(x1, x2) - barWidth / 2);
      drawAnchoredPriceLabel(ctx, left, priceToY(line.priceHigh) - 6, line.priceHigh, chartWidth, chartHeight, 'above');
      drawAnchoredPriceLabel(ctx, left, priceToY(line.priceLow) + 6, line.priceLow, chartWidth, chartHeight, 'below');
    }
  });
}

function drawDeleteDot(ctx: CanvasRenderingContext2D, x: number, y: number, isHovered: boolean) {
  const radius = 5;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  if (isHovered) {
    ctx.fillStyle = '#EF5350';
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
  ctx.fillStyle = '#0D0D0D';
  ctx.strokeStyle = '#3D7EFF';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.rect(x - 3, y - 3, 6, 6);
  ctx.fill();
  ctx.stroke();
}

function drawPositionHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#0D0D0D';
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

function drawPositionCandleOverlap(
  ctx: CanvasRenderingContext2D,
  line: DrawnLine,
  candles: Candle[],
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  left: number,
  right: number,
  barWidth: number,
  chartHeight: number
) {
  if (
    candles.length === 0 ||
    line.firstIndex === undefined ||
    line.lastIndex === undefined ||
    line.stopPrice === undefined
  ) {
    return;
  }

  const startIndex = Math.max(0, Math.min(line.firstIndex, line.lastIndex));
  const endIndex = Math.min(candles.length - 1, Math.max(line.firstIndex, line.lastIndex));
  const zones = [
    {
      low: Math.min(line.value, line.stopPrice),
      high: Math.max(line.value, line.stopPrice),
      color: 'rgba(120, 10, 20, 0.22)',
    },
    ...(line.targetPrice === undefined
      ? []
      : [{
          low: Math.min(line.value, line.targetPrice),
          high: Math.max(line.value, line.targetPrice),
          color: 'rgba(0, 95, 78, 0.20)',
        }]),
  ];

  ctx.save();
  for (let index = startIndex; index <= endIndex; index += 1) {
    const candle = candles[index];
    const x = indexToX(index);
    if (!candle || x === null) continue;

    const candleLeft = Math.max(left, x - Math.max(2, barWidth * 0.42));
    const candleRight = Math.min(right, x + Math.max(2, barWidth * 0.42));
    if (candleRight <= candleLeft) continue;

    const candleLow = Math.min(candle.low, candle.high);
    const candleHigh = Math.max(candle.low, candle.high);
    zones.forEach((zone) => {
      const overlapLow = Math.max(candleLow, zone.low);
      const overlapHigh = Math.min(candleHigh, zone.high);
      if (overlapHigh <= overlapLow) return;

      const yHigh = priceToY(overlapHigh);
      const yLow = priceToY(overlapLow);
      const top = Math.max(0, Math.min(chartHeight, Math.min(yHigh, yLow)));
      const bottom = Math.max(0, Math.min(chartHeight, Math.max(yHigh, yLow)));
      if (bottom <= top) return;

      ctx.fillStyle = zone.color;
      ctx.fillRect(candleLeft, top, Math.max(1, candleRight - candleLeft), Math.max(1, bottom - top));
    });
  }
  ctx.restore();
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
  chartHeight: number
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
    POSITION_REWARD_COLOR,
    chartWidth,
    'center'
  );
  drawPillLabel(
    ctx,
    `Stop: ${formatPrice(stop)} (${riskPct.toFixed(3)}%) ${formatMove(risk)}`,
    centerX,
    Math.min(chartHeight - 23, bottomY + 6),
    POSITION_RISK_COLOR,
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
    POSITION_RISK_COLOR,
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
  ctx.font = '700 11px "Inter", -apple-system, system-ui, sans-serif';
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
  ctx.fillStyle = '#FFFFFF';
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
  ctx.font = '700 11px "Inter", -apple-system, system-ui, sans-serif';
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
  ctx.fillStyle = '#FFFFFF';
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
  ctx.save();
  ctx.font = '600 11px "Inter", -apple-system, system-ui, sans-serif';

  const label = formatPrice(price);
  const width = Math.max(52, ctx.measureText(label).width + 12);
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
  ctx.fillText(label, labelX + 6, top + height / 2);
  ctx.restore();
}
