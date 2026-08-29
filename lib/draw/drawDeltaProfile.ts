import { VolumeProfile } from '@/lib/utils/volumeProfile';
import { CHART_BEARISH_RGB, CHART_BULLISH_RGB, chartColorToRgba } from '@/lib/config/chartColors';

/**
 * Draws the delta profile strip (ask volume - bid volume per price level).
 * Renders from stripRightEdge leftwards.
 */
export function drawDeltaProfile(
  ctx: CanvasRenderingContext2D,
  profile: VolumeProfile,
  priceToY: (price: number) => number,
  stripRightEdge: number,
  deltaProfileWidth: number,
  profileBucketSize: number,
  profileOpacity: number = 0.6,
  profileMinRowWidth: number = 2,
  profileMinRowHeight: number = 1,
  profileScaleMode: 'linear' | 'sqrt' = 'sqrt'
) {
  if (profile.maxAbsDelta <= 0 || deltaProfileWidth <= 0) return;

  // Background strip
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(stripRightEdge - deltaProfileWidth, 0, deltaProfileWidth, ctx.canvas.height);

  // Vertical separator line
  ctx.strokeStyle = '#1F1F1F';
  ctx.lineWidth = 1;
  ctx.beginPath();
  
  if (profile.rows.length > 0) {
    const yMin = priceToY(profile.rows[profile.rows.length - 1].price + profileBucketSize);
    const yMax = priceToY(profile.rows[0].price);
    ctx.moveTo(stripRightEdge, Math.max(0, yMin));
    ctx.lineTo(stripRightEdge, Math.min(ctx.canvas.height, yMax));
  } else {
    ctx.moveTo(stripRightEdge, 0);
    ctx.lineTo(stripRightEdge, ctx.canvas.height);
  }
  ctx.stroke();

  for (const row of profile.rows) {
    const rowDelta = row.askVol - row.bidVol;
    if (rowDelta === 0) continue;

    const yRange = getDeltaProfileRowYRange(row.price, profileBucketSize, priceToY, profileMinRowHeight);
    if (!yRange) continue;
    const { yTop, rowHeight } = yRange;

    const absDelta = Math.abs(rowDelta);
    const deltaRatio = absDelta / profile.maxAbsDelta;
    let barW: number;

    if (profileScaleMode === 'sqrt') {
      barW = Math.sqrt(deltaRatio) * deltaProfileWidth;
    } else {
      barW = deltaRatio * deltaProfileWidth;
    }

    if (profileMinRowWidth > 0) {
      barW = Math.max(profileMinRowWidth, barW);
    }
    barW = Math.min(deltaProfileWidth, barW);

    if (barW < 0.5) continue;

    const barX = stripRightEdge - barW;
    
    ctx.fillStyle = rowDelta > 0 
      ? chartColorToRgba(CHART_BULLISH_RGB, profileOpacity)
      : chartColorToRgba(CHART_BEARISH_RGB, profileOpacity);
    
    // Clip at left edge (x=0)
    const drawX = Math.max(0, barX);
    const drawW = stripRightEdge - drawX;
    
    if (drawW > 0) {
      ctx.fillRect(drawX, yTop, drawW, rowHeight);
    }
  }
}

function getDeltaProfileRowYRange(
  price: number,
  profileBucketSize: number,
  priceToY: (price: number) => number,
  minRowHeight: number,
) {
  let yTop = priceToY(price + profileBucketSize);
  let yBot = priceToY(price);
  let rowHeight = yBot - yTop;

  if (rowHeight <= 0) return null;
  if (minRowHeight > 0 && rowHeight < minRowHeight) {
    const center = (yTop + yBot) / 2;
    yTop = center - minRowHeight / 2;
    yBot = center + minRowHeight / 2;
    rowHeight = minRowHeight;
  }

  return { yTop, yBot, rowHeight };
}
