import { Candle } from '@/types/candle';
import { ExhaustionResult, ExhaustionRank } from '@/types/exhaustion';
import { ExhaustionSide } from '@/lib/store/chart';

/**
 * Renders exhaustion markers on the chart.
 * Exhaustion markers are small horizontal dashes near the candle extreme (high for buyer, low for seller).
 */
export function drawExhaustion(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  visibleRange: { firstIndex: number; lastIndex: number },
  indexToX: (i: number) => number | null,
  priceToY: (p: number) => number,
  barWidth: number,
  exhaustionMap: Map<number, ExhaustionResult>,
  settings: { exhaustionMinScore: number; exhaustionSide: ExhaustionSide; exhaustionShowProvisional: boolean }
) {
  if (barWidth < 5) return;

  const { firstIndex, lastIndex } = visibleRange;
  const { exhaustionMinScore, exhaustionSide, exhaustionShowProvisional } = settings;

  for (let i = firstIndex; i <= lastIndex; i++) {
    const candle = candles[i];
    if (!candle) continue;

    const result = exhaustionMap.get(candle.time);
    if (!result) continue;

    if (result.provisional && !exhaustionShowProvisional) continue;

    if (result.score < exhaustionMinScore) continue;
    if (exhaustionSide !== 'both' && exhaustionSide !== result.direction) continue;

    const x = indexToX(i);
    if (x === null) continue;

    const isBuyer = result.direction === 'buyer';
    const color = isBuyer ? '#F0B90B' : '#B39DDB';
    const opacity = result.provisional ? 0.35 : getRankOpacity(result.rank);
    
    const rankOffset = getRankOffset(result.rank);
    const yBase = isBuyer 
      ? priceToY(candle.high) - 6 - rankOffset
      : priceToY(candle.low) + 6 + rankOffset;

    const dashWidth = barWidth * getRankWidthMultiplier(result.rank);
    const thickness = getRankThickness(result.rank);

    // Style
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = thickness;
    
    // Draw primary dash
    ctx.beginPath();
    ctx.moveTo(x - dashWidth / 2, yBase);
    ctx.lineTo(x + dashWidth / 2, yBase);
    ctx.stroke();

    // Extreme: Draw secondary dash 4px further out
    if (result.rank === 'extreme' && !result.provisional) {
      const y2 = isBuyer ? yBase - 4 : yBase + 4;
      ctx.beginPath();
      ctx.moveTo(x - dashWidth / 2, y2);
      ctx.lineTo(x + dashWidth / 2, y2);
      ctx.stroke();
    }

    // Label Rendering (Strong and Extreme only, if wide enough)
    if (barWidth >= 20 && !result.provisional && (result.rank === 'strong' || result.rank === 'extreme')) {
      ctx.globalAlpha = 1.0; // Labels always full opacity per spec
      ctx.fillStyle = color;
      ctx.font = '8px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.textBaseline = isBuyer ? 'bottom' : 'top';
      
      const label = result.rank === 'extreme' ? `EX ${Math.round(result.score)}` : 'EX';
      
      // If extreme, label is 3px away from the SECOND dash
      const labelGap = 3;
      const labelY = isBuyer 
        ? (result.rank === 'extreme' ? yBase - 4 - labelGap : yBase - labelGap)
        : (result.rank === 'extreme' ? yBase + 4 + labelGap : yBase + labelGap);
      
      ctx.fillText(label, x, labelY);
    }

    // Reset alpha for next candle
    ctx.globalAlpha = 1.0;
  }
}

function getRankOpacity(rank: ExhaustionRank): number {
  switch (rank) {
    case 'weak': return 0.4;
    case 'moderate': return 0.6;
    case 'strong': return 0.8;
    case 'extreme': return 1.0;
    default: return 0.4;
  }
}

function getRankOffset(rank: ExhaustionRank): number {
  switch (rank) {
    case 'weak': return 2;
    case 'moderate': return 3;
    case 'strong': return 4;
    case 'extreme': return 5;
    default: return 2;
  }
}

function getRankWidthMultiplier(rank: ExhaustionRank): number {
  switch (rank) {
    case 'weak': return 0.5;
    case 'moderate': return 0.7;
    case 'strong': return 0.9;
    case 'extreme': return 1.0;
    default: return 0.5;
  }
}

function getRankThickness(rank: ExhaustionRank): number {
  switch (rank) {
    case 'weak': return 1;
    case 'moderate': return 1.5;
    case 'strong': return 2;
    case 'extreme': return 2;
    default: return 1;
  }
}
