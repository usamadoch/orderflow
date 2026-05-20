import { Candle } from '@/types/candle';
import { LiquidityVacuumDirection, LiquidityVacuumRank, LiquidityVacuumZone } from '@/types/liquidityVacuum';
import { hexToRgba } from '@/lib/utils/format';

interface LiquidityVacuumDrawSettings {
  minScore: number;
  opacity: number;
  showLabels: boolean;
  profileWidth: number;
  priceAxisWidth: number;
  timeAxisHeight: number;
}

const UP_COLOR = '#3D7EFF';
const DOWN_COLOR = '#F0B90B';

function getColor(direction: LiquidityVacuumDirection) {
  return direction === 'up' ? UP_COLOR : DOWN_COLOR;
}

function getRankAlpha(rank: LiquidityVacuumRank) {
  if (rank === 'strong') return 1;
  if (rank === 'probable') return 0.78;
  return 0.55;
}

export function drawLiquidityVacuum(
  ctx: CanvasRenderingContext2D,
  zones: LiquidityVacuumZone[],
  candles: Candle[],
  indexToX: (index: number) => number | null,
  priceToY: (price: number) => number,
  barWidth: number,
  canvasWidth: number,
  canvasHeight: number,
  settings: LiquidityVacuumDrawSettings
) {
  if (zones.length === 0 || candles.length === 0) return;

  const chartRight = canvasWidth - settings.priceAxisWidth - settings.profileWidth;
  const chartBottom = canvasHeight - settings.timeAxisHeight;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, Math.max(0, chartRight), Math.max(0, chartBottom));
  ctx.clip();

  for (const zone of zones) {
    if (zone.score < settings.minScore) continue;

    const x1 = indexToX(zone.startIndex);
    const x2 = indexToX(zone.endIndex);
    if (x1 === null || x2 === null) continue;

    const left = Math.max(0, Math.min(x1, x2) - barWidth / 2);
    const right = Math.min(chartRight, Math.max(x1, x2) + barWidth / 2);
    if (right <= 0 || left >= chartRight || right <= left) continue;

    const topY = priceToY(zone.priceHigh);
    const bottomY = priceToY(zone.priceLow);
    const top = Math.max(0, Math.min(topY, bottomY));
    const bottom = Math.min(chartBottom, Math.max(topY, bottomY));
    if (bottom <= 0 || top >= chartBottom || bottom <= top) continue;

    const color = getColor(zone.direction);
    const alpha = settings.opacity * getRankAlpha(zone.rank) * (zone.revisited ? 0.45 : 1) * (zone.provisional ? 0.7 : 1);
    const edgeAlpha = Math.min(0.9, alpha + 0.2);

    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.fillRect(left, top, right - left, bottom - top);

    ctx.strokeStyle = hexToRgba(color, edgeAlpha);
    ctx.lineWidth = zone.rank === 'strong' ? 1.5 : 1;
    ctx.setLineDash(zone.revisited ? [4, 4] : []);
    ctx.strokeRect(Math.round(left) + 0.5, Math.round(top) + 0.5, Math.max(1, right - left), Math.max(1, bottom - top));

    const midY = zone.direction === 'up' ? top : bottom;
    ctx.setLineDash([]);
    ctx.strokeStyle = hexToRgba(color, Math.min(1, edgeAlpha + 0.1));
    ctx.beginPath();
    ctx.moveTo(left, Math.round(midY) + 0.5);
    ctx.lineTo(right, Math.round(midY) + 0.5);
    ctx.stroke();

    if (settings.showLabels && right - left >= 34 && bottom - top >= 10) {
      ctx.font = '600 9px "JetBrains Mono"';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = hexToRgba(color, Math.min(1, edgeAlpha + 0.2));
      ctx.fillText(`VAC ${Math.round(zone.score)}`, left + 4, top + 3);
    }
  }

  ctx.restore();
}
