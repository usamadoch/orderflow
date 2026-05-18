import { AbsorptionResult } from '@/types/absorption';
import { Candle } from '@/types/candle';
import { IcebergLevel, IcebergRank, IcebergSide } from '@/types/iceberg';
import { hexToRgba } from '@/lib/utils/format';

interface IcebergDrawSettings {
  icebergMinScore: number;
  icebergShowSuspected: boolean;
  icebergShowLabels: boolean;
  icebergShowTint: boolean;
  icebergLookback: number;
  absorptionMap?: Map<number, AbsorptionResult>;
}

const BID_DEFENSE_COLOR = '#26A69A';
const ASK_DEFENSE_COLOR = '#EF5350';
const ABSORPTION_HANDOFF_COLOR = '#F0B90B';

function getColor(side: IcebergSide): string {
  return side === 'bid_defense' ? BID_DEFENSE_COLOR : ASK_DEFENSE_COLOR;
}

function getOpacity(rank: IcebergRank): number {
  if (rank === 'confirmed') return 0.9;
  if (rank === 'probable') return 0.65;
  return 0.4;
}

function getLevelWindow(level: IcebergLevel, candles: Candle[], lookback: number): { start: number; end: number } {
  const fallbackEnd = Math.max(0, candles.length - 1);
  const end = Number.isFinite(level.windowEndIndex) ? level.windowEndIndex : fallbackEnd;
  const start = Number.isFinite(level.windowStartIndex)
    ? level.windowStartIndex
    : Math.max(0, end - lookback + 1);

  return {
    start: Math.max(0, Math.min(candles.length - 1, start)),
    end: Math.max(0, Math.min(candles.length - 1, end)),
  };
}

function hasAbsorptionHandoff(
  level: IcebergLevel,
  candles: Candle[],
  absorptionMap: Map<number, AbsorptionResult> | undefined,
  bucketSize: number,
  start: number,
  end: number
): boolean {
  if (!absorptionMap || absorptionMap.size === 0) return false;

  const minPrice = level.price - bucketSize * 2;
  const maxPrice = level.price + bucketSize * 3;
  for (let i = start; i <= end && i < candles.length; i++) {
    const candle = candles[i];
    if (!absorptionMap.has(candle.time)) continue;
    if (candle.low <= maxPrice && candle.high >= minPrice) return true;
  }
  return false;
}

export function drawIceberg(
  ctx: CanvasRenderingContext2D,
  icebergLevels: IcebergLevel[],
  candles: Candle[],
  indexToX: (i: number) => number | null,
  priceToY: (p: number) => number,
  barWidth: number,
  bucketSize: number,
  settings: IcebergDrawSettings
) {
  if (icebergLevels.length === 0 || candles.length === 0) return;

  ctx.save();

  for (const level of icebergLevels) {
    if (level.score < settings.icebergMinScore) continue;
    if (!settings.icebergShowSuspected && level.rank === 'suspected') continue;

    const { start, end } = getLevelWindow(level, candles, settings.icebergLookback);
    const x1 = indexToX(start);
    const x2 = indexToX(end);
    if (x1 === null || x2 === null) continue;

    const leftX = Math.min(x1, x2) - barWidth / 2;
    const rightX = Math.max(x1, x2) + barWidth / 2;
    const color = getColor(level.side);
    const opacity = getOpacity(level.rank) * (level.provisional ? 0.5 : 1);
    const y = priceToY(level.price + bucketSize / 2);

    if (settings.icebergShowTint && level.rank === 'confirmed') {
      const topY = priceToY(level.price + bucketSize);
      const bottomY = priceToY(level.price);
      ctx.fillStyle = hexToRgba(color, 0.04 * (level.provisional ? 0.5 : 1));
      ctx.fillRect(leftX, Math.min(topY, bottomY), rightX - leftX, Math.abs(bottomY - topY));
    }

    ctx.strokeStyle = hexToRgba(color, opacity);
    ctx.lineWidth = 1.5;
    ctx.setLineDash(level.rank === 'confirmed' ? [] : [6, 3]);
    ctx.beginPath();
    ctx.moveTo(leftX, y);
    ctx.lineTo(rightX, y);
    ctx.stroke();

    if (level.rank === 'confirmed') {
      const gap = 3;
      ctx.beginPath();
      ctx.moveTo(leftX, y + gap);
      ctx.lineTo(rightX, y + gap);
      ctx.stroke();

      const rowHeight = Math.abs(priceToY(level.price) - priceToY(level.price + bucketSize));
      ctx.setLineDash([]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rightX, y - rowHeight / 2);
      ctx.lineTo(rightX, y + rowHeight / 2);
      ctx.stroke();
    }

    if (hasAbsorptionHandoff(level, candles, settings.absorptionMap, bucketSize, start, end)) {
      ctx.setLineDash([]);
      ctx.strokeStyle = hexToRgba(ABSORPTION_HANDOFF_COLOR, 0.75 * (level.provisional ? 0.5 : 1));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rightX, y);
      ctx.lineTo(rightX + barWidth / 2, y);
      ctx.stroke();
    }

    if (settings.icebergShowLabels && barWidth >= 10 && level.rank !== 'suspected') {
      ctx.setLineDash([]);
      ctx.fillStyle = hexToRgba(color, Math.min(1, opacity + 0.1));
      ctx.font = '500 9px "JetBrains Mono"';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const label = level.rank === 'confirmed' ? `ICE ${Math.round(level.score)}` : 'ICE';
      ctx.fillText(label, rightX + 4, y - 3);
    }
  }

  ctx.restore();
}
