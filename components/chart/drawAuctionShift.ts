import { Candle } from '@/types/candle';
import { AuctionShiftResult, AuctionShiftState } from '@/types/auctionShift';

const COLORS: Record<AuctionShiftState, string> = {
  balanced: '#787B86',
  initiative_buying: '#26A69A',
  initiative_selling: '#EF5350',
  absorption_reversal: '#3D7EFF',
  exhaustion_transition: '#F0B90B',
};

const LABELS: Record<AuctionShiftState, string> = {
  balanced: 'BAL',
  initiative_buying: 'INIT BUY',
  initiative_selling: 'INIT SELL',
  absorption_reversal: 'ABS REV',
  exhaustion_transition: 'EXH SHIFT',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
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

function getMarkerY(result: AuctionShiftResult, chartHeight: number): number {
  if (result.direction === 'selling' || result.state === 'initiative_selling') {
    return Math.max(18, chartHeight - 18);
  }

  return 18;
}

function shouldRenderContext(result: AuctionShiftResult, minConfidence: number): boolean {
  if (result.confidence < minConfidence) return false;
  if (result.state === 'balanced') return result.transition && result.confidence >= minConfidence + 10;
  return result.transition || result.confidence >= minConfidence + 15;
}

export function getAuctionShiftHitPoint(
  result: AuctionShiftResult,
  x: number,
  chartHeight: number
): { x: number; y: number; radius: number } {
  return {
    x,
    y: getMarkerY(result, chartHeight),
    radius: result.transition ? 18 : 10,
  };
}

export function drawAuctionShift(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  visibleRange: { firstIndex: number; lastIndex: number },
  indexToX: (i: number) => number | null,
  barWidth: number,
  chartHeight: number,
  auctionShiftMap: Map<number, AuctionShiftResult>,
  settings: {
    minConfidence: number;
    showLabels: boolean;
    showBackground: boolean;
    drawBackground: boolean;
    drawTags: boolean;
  }
) {
  const { firstIndex, lastIndex } = visibleRange;

  for (let i = firstIndex; i <= lastIndex && i < candles.length; i++) {
    const candle = candles[i];
    const result = auctionShiftMap.get(candle.time);
    if (!result || !shouldRenderContext(result, settings.minConfidence)) continue;

    const x = indexToX(i);
    if (x === null) continue;

    const color = COLORS[result.state];

    if (settings.drawBackground && settings.showBackground && result.transition && result.state !== 'balanced') {
      const width = Math.max(barWidth, 5);
      ctx.fillStyle = rgba(color, result.provisional ? 0.025 : 0.045);
      ctx.fillRect(x - width / 2, 0, width, chartHeight);
    }

    if (!settings.drawTags) continue;

    const y = getMarkerY(result, chartHeight);
    const isTop = y < chartHeight / 2;
    const alpha = result.provisional ? 0.5 : 0.85;
    const lineWidth = Math.max(8, Math.min(barWidth * 0.8, 26));

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = result.transition ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x - lineWidth / 2, y);
    ctx.lineTo(x + lineWidth / 2, y);
    ctx.stroke();

    if (result.transition && settings.showLabels && barWidth >= 9) {
      const label = LABELS[result.state];
      ctx.font = '700 8px "JetBrains Mono"';
      const textWidth = ctx.measureText(label).width;
      const pillWidth = Math.max(30, textWidth + 10);
      const pillHeight = 14;
      const pillX = x - pillWidth / 2;
      const pillY = isTop ? y + 4 : y - pillHeight - 4;

      roundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 4);
      ctx.fillStyle = rgba('#0D0D0D', 0.92);
      ctx.fill();
      ctx.strokeStyle = rgba(color, 0.75);
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, pillY + pillHeight / 2 + 0.5);
    }

    ctx.restore();
  }
}
