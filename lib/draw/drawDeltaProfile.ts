import { VolumeProfile } from '@/lib/utils/volumeProfile';

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
  profileOpacity: number = 0.4,
  profileMinRowWidth: number = 2,
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

    const yTop = priceToY(row.price + profileBucketSize);
    const yBot = priceToY(row.price);
    const rowHeight = yBot - yTop;

    if (rowHeight < 0.5) continue;

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

    if (barW < 0.5) continue;

    const barX = stripRightEdge - barW;
    
    // Teal for positive, Red for negative
    ctx.fillStyle = rowDelta > 0 
      ? `rgba(38, 166, 154, ${profileOpacity})` 
      : `rgba(239, 83, 80, ${profileOpacity})`;
    
    // Clip at left edge (x=0)
    const drawX = Math.max(0, barX);
    const drawW = stripRightEdge - drawX;
    
    if (drawW > 0) {
      ctx.fillRect(drawX, yTop, drawW, rowHeight);
    }
  }
}
