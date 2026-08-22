import { Candle } from '@/types/candle';
import { AbsorptionResult, AbsorptionRank, RankConfig } from '@/types/absorption';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR, chartColorToRgba } from '@/lib/config/chartColors';

const COLOR_SELLER_ABS = CHART_BULLISH_COLOR;
const COLOR_BUYER_ABS = CHART_BEARISH_COLOR;

// ── Rank → visual config ─────────────────────────────────

function getRankConfig(rank: AbsorptionRank): RankConfig {
  switch (rank) {
    case 'minor':
      return { radius: 5, alpha: 0.5, showLabel: false, showScore: false, stroke: false, glow: false };
    case 'strong':
      return { radius: 8, alpha: 0.7, showLabel: true, showScore: false, stroke: false, glow: false };
    case 'extreme':
      return { radius: 11, alpha: 0.9, showLabel: true, showScore: true, stroke: true, glow: true };
  }
}

function rgba(hex: string, a: number): string {
  return chartColorToRgba(hex, a);
}

// ── Main Draw ────────────────────────────────────────────

function getTimeframeScale(timeframe: string): number {
  if (timeframe.endsWith('m')) {
    const mins = parseInt(timeframe);
    if (mins >= 60) return 1.4;
    if (mins >= 15) return 1.2;
    return 1.0;
  }
  if (timeframe.endsWith('h')) {
    const hours = parseInt(timeframe);
    if (hours >= 4) return 1.6;
    return 1.4;
  }
  if (timeframe.endsWith('d')) return 1.8;
  return 1.0;
}

export function drawAbsorption(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  firstIndex: number,
  lastIndex: number,
  indexToX: (i: number) => number,
  priceToY: (p: number) => number,
  absorptionMap: Map<number, AbsorptionResult>,
  showLabels: boolean,
  minScore: number,
  sideFilter: 'both' | 'buyer' | 'seller',
  timeframe: string
) {
  const tfScale = getTimeframeScale(timeframe);
  for (let i = firstIndex; i <= lastIndex && i < candles.length; i++) {
    const candle = candles[i];
    const result = absorptionMap.get(candle.time);
    if (!result) continue;
    if (result.score < minScore) continue;
    if (sideFilter !== 'both' && result.direction !== sideFilter) continue;

    const color = result.direction === 'seller' ? COLOR_SELLER_ABS : COLOR_BUYER_ABS;
    const cfg = getRankConfig(result.rank);
    const radius = cfg.radius * tfScale;
    const x = indexToX(i);

    // Position: seller absorption below low, buyer absorption above high
    let y: number;
    if (result.direction === 'seller') {
      y = priceToY(candle.low) + 8 + radius;
    } else {
      y = priceToY(candle.high) - 8 - radius;
    }

    // Provisional: reduced opacity, dashed
    const isProvisional = result.provisional;
    const effectiveAlpha = isProvisional ? 0.4 : cfg.alpha;

    // ── Glow ──
    if (cfg.glow && !isProvisional) {
      ctx.fillStyle = rgba(color, 0.15);
      ctx.fillRect(x - radius * 2, y - radius * 2, radius * 4, radius * 4);
    }

    // ── Main square ──
    ctx.fillStyle = rgba(color, effectiveAlpha);
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);

    if (cfg.stroke && !isProvisional) {
      ctx.strokeStyle = rgba(color, effectiveAlpha);
      ctx.lineWidth = 1.5 * tfScale;
      ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    if (isProvisional) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = rgba(color, 0.4);
      ctx.lineWidth = 1;
      ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
    }

    // ── Label ──
    if (showLabels && cfg.showLabel && !isProvisional) {
      ctx.font = '500 8px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(color, effectiveAlpha);

      const label = cfg.showScore ? `ABS ${result.score}` : 'ABS';
      const labelY = result.direction === 'seller'
        ? y + radius + 10
        : y - radius - 4;

      ctx.fillText(label, x, labelY);
    }
  }
}
