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
  barWidth: number,
  isHovered: boolean = false
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

  ctx.save();
  // Hover highlight state (background opacity increases from 0.06 to 0.10)
  ctx.fillStyle = isHovered ? 'rgba(61, 126, 255, 0.10)' : 'rgba(61, 126, 255, 0.06)';
  ctx.fillRect(x, y, width, height);
  
  // If we are actively dragging, also draw the border here so it's visible
  if (dragStart && dragEnd) {
    ctx.strokeStyle = 'rgba(61, 126, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
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
  isHoveringClear: boolean = false,
  isHovered: boolean = false,
  isLocked: boolean = false,
  isSelected: boolean = true,
  isHoveringLock: boolean = false,
  profileScaleMode: 'linear' | 'sqrt' = 'sqrt',
  profileBucketSize: number = bucketSize,
  profileWidthPct: number = 70,
  profileOpacity: number = 0.5,
  profileMinRowWidth: number = 2,
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

  // 1. Border
  if (isSelected || isHovered) {
    ctx.strokeStyle = 'rgba(61, 126, 255, 0.8)';
    if (!isSelected) ctx.setLineDash([4, 4]);
  } else {
    ctx.strokeStyle = 'rgba(61, 126, 255, 0.35)';
    ctx.setLineDash([4, 4]);
  }
  ctx.lineWidth = 1;
  ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

  // 2. Profile Bars
  if (profile) {
    const barAnchorX = Math.min(x1, x2);
    const barMaxWidth = rectWidth * (profileWidthPct / 100);

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
      const rowTopY = priceToY(row.price + profileBucketSize);
      const rowBotY = priceToY(row.price);
      
      const drawTopY = Math.max(rowTopY, rectY);
      const drawBotY = Math.min(rowBotY, rectY + rectHeight);
      const drawHeight = drawBotY - drawTopY;

      if (drawHeight <= 0) continue;

      let barWidthPx: number;
      const volRatio = row.totalVol / profile.maxVol;

      if (profileScaleMode === 'sqrt') {
        barWidthPx = Math.sqrt(volRatio) * barMaxWidth;
      } else {
        barWidthPx = volRatio * barMaxWidth;
      }

      if (row.totalVol > 0 && profileMinRowWidth > 0) {
        barWidthPx = Math.max(profileMinRowWidth, barWidthPx);
      }

      if (barWidthPx < 0.5) continue;

      if (row.hasFP && row.totalVol > 0) {
        const askWidth = barWidthPx * (row.askVol / row.totalVol);
        const bidWidth = barWidthPx - askWidth;
        ctx.fillStyle = `rgba(38, 166, 154, ${profileOpacity})`;
        ctx.fillRect(barAnchorX, drawTopY, askWidth, drawHeight);
        ctx.fillStyle = `rgba(239, 83, 80, ${profileOpacity})`;
        ctx.fillRect(barAnchorX + askWidth, drawTopY, bidWidth, drawHeight);
      } else {
        ctx.fillStyle = `rgba(138, 138, 138, ${profileOpacity})`;
        ctx.fillRect(barAnchorX, drawTopY, barWidthPx, drawHeight);
      }
    }

    // POC Highlight
    if (showPocHighlight) {
      const pocRow = profile.rows.find(r => r.price === profile.poc);
      if (pocRow) {
        const rowTopY = priceToY(pocRow.price + profileBucketSize);
        const rowBotY = priceToY(pocRow.price);
        const drawTopY = Math.max(rowTopY, rectY);
        const drawBotY = Math.min(rowBotY, rectY + rectHeight);
        const drawHeight = drawBotY - drawTopY;

        if (drawHeight > 0) {
          const volRatio = pocRow.totalVol / profile.maxVol;
          let barW = (profileScaleMode === 'sqrt' ? Math.sqrt(volRatio) : volRatio) * barMaxWidth;
          if (pocRow.totalVol > 0 && profileMinRowWidth > 0) barW = Math.max(profileMinRowWidth, barW);

          if (barW >= 0.5) {
            const highlightOpacity = Math.min(1.0, profileOpacity + 0.2);
            if (pocRow.hasFP) {
              const askWidth = barW * (pocRow.askVol / pocRow.totalVol);
              const bidWidth = barW - askWidth;
              ctx.fillStyle = `rgba(38, 166, 154, ${highlightOpacity})`;
              ctx.fillRect(barAnchorX, drawTopY, askWidth, drawHeight);
              ctx.fillStyle = `rgba(239, 83, 80, ${highlightOpacity})`;
              ctx.fillRect(barAnchorX + askWidth, drawTopY, bidWidth, drawHeight);
            } else {
              ctx.fillStyle = `rgba(138, 138, 138, ${Math.min(1.0, profileOpacity + 0.25)})`;
              ctx.fillRect(barAnchorX, drawTopY, barW, drawHeight);
            }

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
  }

  // 5. Labels & Buttons
  ctx.setLineDash([]);
  ctx.font = '9px "JetBrains Mono"';
  
  // CUSTOM Label
  ctx.fillStyle = '#3D7EFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('CUSTOM', rectX + 4, rectY + 4);

  // LOCKED Indicator
  if (isLocked) {
    ctx.fillStyle = '#4A4A4A';
    ctx.fillText('LOCKED', rectX + 44, rectY + 4);
  }

  // Interaction Buttons (Top Right)
  ctx.font = '10px "JetBrains Mono"';
  ctx.fillStyle = isHoveringLock ? '#E8E8E8' : (isLocked ? '#3D7EFF' : '#8A8A8A');
  ctx.textAlign = 'right';
  ctx.fillText(isLocked ? '🔒' : '🔓', rectX + rectWidth - 20, rectY + 4);

  ctx.font = '11px "JetBrains Mono"';
  ctx.fillStyle = isHoveringClear ? '#E8E8E8' : '#8A8A8A';
  ctx.fillText('✕', rectX + rectWidth - 6, rectY + 4);

  // 6. Resize Handles
  if (isSelected && isHovered && !isLocked) {
    ctx.fillStyle = 'rgba(61, 126, 255, 0.7)';
    ctx.fillRect(rectX - 2, rectY + rectHeight / 2 - 8, 4, 16);
    ctx.fillRect(rectX + rectWidth - 2, rectY + rectHeight / 2 - 8, 4, 16);
    ctx.fillRect(rectX + rectWidth / 2 - 8, rectY - 2, 16, 4);
    ctx.fillRect(rectX + rectWidth / 2 - 8, rectY + rectHeight - 2, 16, 4);
  }

  ctx.restore();
}
