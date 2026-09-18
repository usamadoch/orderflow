import { formatPrice } from '@/lib/utils/format';

export const ASK_LINE_COLOR = '#EF5350'; // Red / Coral (MT5 Ask line)
export const BID_LINE_COLOR = '#00E5FF'; // Cyan / Sky Blue (MT5 Bid line)

const BADGE_FONT = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Ubuntu, sans-serif';

export interface BidAskLinesOptions {
  askColor?: string;
  bidColor?: string;
  lineWidth?: number;
  lineDash?: number[];
  alpha?: number;
  showBadges?: boolean;
}

/**
 * Draws two horizontal lines for Bid and Ask across the chart canvas,
 * with corresponding badges on the right-hand price axis.
 */
export function drawBidAskLines(
  ctx: CanvasRenderingContext2D,
  bid: number | null | undefined,
  ask: number | null | undefined,
  priceToY: (price: number) => number,
  chartWidth: number,
  priceAxisWidth: number,
  options?: BidAskLinesOptions
) {
  const askColor = options?.askColor || ASK_LINE_COLOR;
  const bidColor = options?.bidColor || BID_LINE_COLOR;
  const lineWidth = options?.lineWidth ?? 1;
  const lineDash = options?.lineDash ?? [4, 3];
  const alpha = options?.alpha ?? 0.88;
  const showBadges = options?.showBadges !== false;

  ctx.save();

  // Helper to draw a single horizontal quote line
  const drawLine = (price: number, color: string) => {
    const rawY = priceToY(price);
    const lineY = Math.round(rawY) + 0.5;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(lineDash);
    ctx.beginPath();
    ctx.moveTo(0, lineY);
    ctx.lineTo(chartWidth, lineY);
    ctx.stroke();
    ctx.restore();
  };

  // Helper to draw the price axis badge
  const drawBadge = (price: number, label: string, bgColor: string, textColor: string) => {
    if (!showBadges || priceAxisWidth <= 0) return;

    const rawY = priceToY(price);
    const badgeH = 17;
    const badgeW = Math.max(54, priceAxisWidth - 4);
    const badgeX = chartWidth + 2;
    const badgeY = Math.round(rawY - badgeH / 2);

    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 2.5);
    } else {
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
    }
    ctx.fill();

    ctx.font = BADGE_FONT;
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = `${label} ${formatPrice(price)}`;
    ctx.fillText(text, badgeX + badgeW / 2, badgeY + badgeH / 2);
    ctx.restore();
  };

  // 1. Draw Ask Line (Higher price)
  if (ask != null && Number.isFinite(ask) && ask > 0) {
    drawLine(ask, askColor);
    drawBadge(ask, 'ASK', askColor, '#FFFFFF');
  }

  // 2. Draw Bid Line (Lower price)
  if (bid != null && Number.isFinite(bid) && bid > 0) {
    drawLine(bid, bidColor);
    drawBadge(bid, 'BID', bidColor, '#0A0E17');
  }

  ctx.restore();
}
