import { VolumeProfile } from '@/lib/utils/volumeProfile';

/**
 * Draws the background tint for the custom range selection.
 * Called early in the draw stack (behind candles).
 */
export function drawSelectionRect(
  ctx: CanvasRenderingContext2D,
  dragStart: { x: number; y: number } | null,
  dragEnd: { x: number; y: number } | null,
  customProfileRange: {
    firstIndex: number;
    lastIndex: number;
    priceHigh: number;
    priceLow: number;
  } | null,
  indexToX: (idx: number) => number,
  priceToY: (price: number) => number,
  barWidth: number
) {
  let x: number, y: number, width: number, height: number;

  if (dragStart && dragEnd) {
    x = Math.min(dragStart.x, dragEnd.x);
    y = Math.min(dragStart.y, dragEnd.y);
    width = Math.abs(dragEnd.x - dragStart.x);
    height = Math.abs(dragEnd.y - dragStart.y);
    if (width < 5 && height < 5) return;
  } else if (customProfileRange) {
    const { firstIndex, lastIndex, priceHigh, priceLow } = customProfileRange;
    const x1 = indexToX(firstIndex) - barWidth / 2;
    const x2 = indexToX(lastIndex) + barWidth / 2;
    const y1 = priceToY(priceHigh);
    const y2 = priceToY(priceLow);
    x = Math.min(x1, x2);
    y = Math.min(y1, y2);
    width = Math.abs(x2 - x1);
    height = Math.abs(y2 - y1);
  } else {
    return;
  }

  // Background tint removed as requested to keep candles visible

  // If we are actively dragging, draw a subtle solid border
  if (dragStart && dragEnd) {
    ctx.strokeStyle = 'rgba(61, 126, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
  }

  ctx.restore();
}

/**
 * Draws the volume profile bars, POC, labels, and interaction buttons for the custom range.
 * Called late in the draw stack (on top of candles).
 */
export function drawCustomProfile(
  ctx: CanvasRenderingContext2D,
  customProfileRange: {
    firstIndex: number;
    lastIndex: number;
    priceHigh: number;
    priceLow: number;
  } | null,
  profile: VolumeProfile | null,
  indexToX: (idx: number) => number,
  priceToY: (price: number) => number,
  barWidth: number,
  bucketSize: number,
  isHovered: boolean = false,
  isLocked: boolean = false,
  isSelected: boolean = true,
  profileScaleMode: 'linear' | 'sqrt' = 'sqrt',
  profileBucketSize: number = bucketSize,
  profileWidthPct: number = 70,
  profileOpacity: number = 0.5,
  profileMinRowWidth: number = 2,
  profileMinRowHeight: number = 1,
  showPocHighlight: boolean = true,
  showVaFill: boolean = true,
  showPocLine: boolean = true,
  showVaLines: boolean = true
) {
  if (!customProfileRange) return;

  const { firstIndex, lastIndex, priceHigh, priceLow } = customProfileRange;
  const x1 = indexToX(firstIndex) - barWidth / 2;
  const x2 = indexToX(lastIndex) + barWidth / 2;
  const y1 = priceToY(priceHigh);
  const y2 = priceToY(priceLow);

  const rectX = Math.min(x1, x2);
  const rectY = Math.min(y1, y2);
  const rectWidth = Math.abs(x2 - x1);
  const rectHeight = Math.abs(y2 - y1);

  ctx.save();

  // 1. Border (Subtle and solid)
  if (isSelected || isHovered) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
  }

  // 2. Profile Bars
  if (profile) {
    const barAnchorX = Math.min(x1, x2);
    const barMaxWidth = Math.max(0, rectWidth * (profileWidthPct / 100));

    // VA Area Fill
    if (showVaFill) {
      const vaHighY = priceToY(profile.vaHigh + profileBucketSize);
      const vaLowY = priceToY(profile.vaLow);
      const fillTop = Math.max(vaHighY, rectY);
      const fillBot = Math.min(vaLowY, rectY + rectHeight);
      if (fillBot > fillTop) {
        ctx.fillStyle = 'rgba(61, 126, 255, 0.08)';
        ctx.fillRect(barAnchorX, fillTop, barMaxWidth, fillBot - fillTop);
      }
    }

    for (const row of profile.rows) {
      const yRange = getCustomProfileRowYRange(row.price, profileBucketSize, priceToY, profileMinRowHeight, rectY, rectHeight);
      if (!yRange) continue;

      const { drawTopY, drawHeight } = yRange;

      let barWidthPx: number;
      const volRatio = profile.maxVol > 0 ? Math.max(0, Math.min(1, row.totalVol / profile.maxVol)) : 0;

      if (profileScaleMode === 'sqrt') {
        barWidthPx = Math.sqrt(volRatio) * barMaxWidth;
      } else {
        barWidthPx = volRatio * barMaxWidth;
      }

      if (row.totalVol > 0 && profileMinRowWidth > 0) {
        barWidthPx = Math.max(profileMinRowWidth, barWidthPx);
      }
      barWidthPx = Math.min(barMaxWidth, barWidthPx);

      if (barWidthPx < 0.5) continue;

      // Unified muted amber/orange color
      ctx.fillStyle = `rgba(217, 119, 6, ${profileOpacity})`;
      ctx.fillRect(barAnchorX, drawTopY, barWidthPx, drawHeight);
    }

    // POC Highlight
    if (showPocHighlight) {
      const pocRow = profile.rows.find(r => r.price === profile.poc);
      if (pocRow) {
        const yRange = getCustomProfileRowYRange(pocRow.price, profileBucketSize, priceToY, profileMinRowHeight, rectY, rectHeight);

        if (yRange) {
          const { drawTopY, drawHeight } = yRange;
          const volRatio = profile.maxVol > 0 ? Math.max(0, Math.min(1, pocRow.totalVol / profile.maxVol)) : 0;
          let barW = (profileScaleMode === 'sqrt' ? Math.sqrt(volRatio) : volRatio) * barMaxWidth;
          if (pocRow.totalVol > 0 && profileMinRowWidth > 0) barW = Math.max(profileMinRowWidth, barW);
          barW = Math.min(barMaxWidth, barW);

          if (barW >= 0.5) {
            const highlightOpacity = Math.min(1.0, profileOpacity + 0.2);
            ctx.fillStyle = `rgba(217, 119, 6, ${highlightOpacity})`;
            ctx.fillRect(barAnchorX, drawTopY, barW, drawHeight);

            ctx.strokeStyle = '#F0B90B';
            ctx.lineWidth = 1;
            ctx.strokeRect(barAnchorX, drawTopY, barW, drawHeight);

            if (drawHeight >= 10 && barW >= 20) {
              ctx.fillStyle = '#F0B90B';
              ctx.font = '8px "JetBrains Mono"';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText('POC', barAnchorX + 3, drawTopY + drawHeight / 2 + 1);
            }
          }
        }
      }
    }

    // 3. POC Line
    if (showPocLine) {
      const pocY = priceToY(profile.poc + profileBucketSize / 2);
      if (pocY >= rectY && pocY <= rectY + rectHeight) {
        ctx.strokeStyle = '#F0B90B';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(rectX, Math.round(pocY) + 0.5);
        ctx.lineTo(rectX + rectWidth, Math.round(pocY) + 0.5);
        ctx.stroke();
      }
    }

    // 4. VA Lines
    if (showVaLines) {
      const vaHighY = priceToY(profile.vaHigh + profileBucketSize);
      const vaLowY = priceToY(profile.vaLow);

      ctx.strokeStyle = '#3D7EFF';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);

      if (vaHighY >= rectY && vaHighY <= rectY + rectHeight) {
        ctx.beginPath();
        ctx.moveTo(rectX, Math.round(vaHighY) + 0.5);
        ctx.lineTo(rectX + rectWidth, Math.round(vaHighY) + 0.5);
        ctx.stroke();
      }
      if (vaLowY >= rectY && vaLowY <= rectY + rectHeight) {
        ctx.beginPath();
        ctx.moveTo(rectX, Math.round(vaLowY) + 0.5);
        ctx.lineTo(rectX + rectWidth, Math.round(vaLowY) + 0.5);
        ctx.stroke();
      }
    }

    // 5. LVN Lines
    if (profile.lvns.length > 0) {
      ctx.strokeStyle = '#22D3EE';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.fillStyle = '#22D3EE';
      ctx.font = '8px "JetBrains Mono"';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';

      for (const lvn of profile.lvns) {
        const lvnY = priceToY(lvn + profileBucketSize / 2);
        if (lvnY < rectY || lvnY > rectY + rectHeight) continue;

        ctx.beginPath();
        ctx.moveTo(rectX, Math.round(lvnY) + 0.5);
        ctx.lineTo(rectX + rectWidth, Math.round(lvnY) + 0.5);
        ctx.stroke();
        ctx.fillText('LVN', rectX + 3, lvnY - 2);
      }
    }
  }

  // 6. Interaction Buttons (Moved to React overlay in ChartCanvas.tsx)
  // Resize handles still rendered on canvas for precision
  if (isSelected && isHovered && !isLocked) {
    ctx.fillStyle = 'rgba(61, 126, 255, 0.7)';
    ctx.fillRect(rectX - 2, rectY + rectHeight / 2 - 8, 4, 16);
    ctx.fillRect(rectX + rectWidth - 2, rectY + rectHeight / 2 - 8, 4, 16);
    ctx.fillRect(rectX + rectWidth / 2 - 8, rectY - 2, 16, 4);
    ctx.fillRect(rectX + rectWidth / 2 - 8, rectY + rectHeight - 2, 16, 4);
  }

  ctx.restore();
}

function getCustomProfileRowYRange(
  price: number,
  profileBucketSize: number,
  priceToY: (price: number) => number,
  minRowHeight: number,
  rectY: number,
  rectHeight: number,
) {
  let rowTopY = priceToY(price + profileBucketSize);
  let rowBotY = priceToY(price);
  const rowHeight = rowBotY - rowTopY;

  if (rowHeight <= 0) return null;
  if (minRowHeight > 0 && rowHeight < minRowHeight) {
    const center = (rowTopY + rowBotY) / 2;
    rowTopY = center - minRowHeight / 2;
    rowBotY = center + minRowHeight / 2;
  }

  const drawTopY = Math.max(rowTopY, rectY);
  const drawBotY = Math.min(rowBotY, rectY + rectHeight);
  const drawHeight = drawBotY - drawTopY;

  if (drawHeight <= 0) return null;

  return { drawTopY, drawBotY, drawHeight };
}
