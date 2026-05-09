import { Candle } from '@/types/candle';
import { AbsorptionResult, AbsorptionRank } from '@/types/absorption';

// ── Colors ───────────────────────────────────────────────
const COLOR_SELLER_ABS = '#26A69A';  // teal — passive buyers won
const COLOR_BUYER_ABS  = '#EF5350';  // red  — passive sellers won

// ── Rank → visual config ─────────────────────────────────
interface RankConfig {
  radius: number;
  alpha: number;
  showLabel: boolean;
  showScore: boolean;
  stroke: boolean;
  glow: boolean;
}

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

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// ── Main Draw ────────────────────────────────────────────

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
  sideFilter: 'both' | 'buyer' | 'seller'
) {
  for (let i = firstIndex; i <= lastIndex && i < candles.length; i++) {
    const candle = candles[i];
    const result = absorptionMap.get(candle.time);
    if (!result) continue;
    if (result.score < minScore) continue;
    if (sideFilter !== 'both' && result.direction !== sideFilter) continue;

    const color = result.direction === 'seller' ? COLOR_SELLER_ABS : COLOR_BUYER_ABS;
    const cfg = getRankConfig(result.rank);
    const x = indexToX(i);

    // Position: seller absorption below low, buyer absorption above high
    let y: number;
    if (result.direction === 'seller') {
      y = priceToY(candle.low) + 8 + cfg.radius;
    } else {
      y = priceToY(candle.high) - 8 - cfg.radius;
    }

    // Provisional: reduced opacity, dashed
    const isProvisional = result.provisional;
    const effectiveAlpha = isProvisional ? 0.4 : cfg.alpha;

    // ── Glow ──
    if (cfg.glow && !isProvisional) {
      ctx.beginPath();
      ctx.arc(x, y, cfg.radius * 2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, 0.15);
      ctx.fill();
    }

    // ── Main circle ──
    ctx.beginPath();
    ctx.arc(x, y, cfg.radius, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, effectiveAlpha);
    ctx.fill();

    if (cfg.stroke && !isProvisional) {
      ctx.strokeStyle = rgba(color, effectiveAlpha);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    if (isProvisional) {
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = rgba(color, 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // ── Label ──
    if (showLabels && cfg.showLabel && !isProvisional) {
      ctx.font = '500 8px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(color, effectiveAlpha);

      const label = cfg.showScore ? `ABS ${result.score}` : 'ABS';
      const labelY = result.direction === 'seller'
        ? y + cfg.radius + 10
        : y - cfg.radius - 4;

      ctx.fillText(label, x, labelY);
    }
  }
}
