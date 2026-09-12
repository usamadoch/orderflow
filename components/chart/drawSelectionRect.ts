import { VolumeProfile } from '@/lib/utils/volumeProfile';
import type { VolumeProfileType } from '@/types/chart';
import type { HeatmapRow } from '@/types/liquidity';
import { CHART_BEARISH_RGB, CHART_BULLISH_RGB, chartColorToRgba } from '@/lib/config/chartColors';

const MIN_PROFILE_ROW_OPACITY = 0.15;

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
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(61, 126, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
  }
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
  profileWidthPct: number = 45,
  profileOpacity: number = 0.6,
  profileMinRowWidth: number = 2,
  profileMinRowHeight: number = 1,
  showPocHighlight: boolean = true,
  showVaFill: boolean = true,
  showPocLine: boolean = true,
  profileShowVaLines: boolean = true,
  profileType: VolumeProfileType = 'volume',
  heatmapRows?: HeatmapRow[],
  candles?: { time: number }[],
  indexToXGlobal?: (index: number) => number,
  pocColor: string = '#F0B90B',
  hvnColor: string = '#F43F5E',
  lvnColor: string = '#22D3EE',
  pocWidth: number = 1
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
  ctx.setLineDash([]); // Ensure crisp solid border (never dotted/dashed)

  // 1. Overall Volume Profile Border (Always rendered, solid)
  ctx.strokeStyle = isSelected
    ? 'rgba(255, 255, 255, 0.35)'
    : isHovered
    ? 'rgba(255, 255, 255, 0.22)'
    : 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

  // 2. Profile Bars
  if (profile) {
    const barAnchorX = Math.min(x1, x2);
    const barMaxWidth = Math.max(0, rectWidth * (profileWidthPct / 100));
    const sortedRows = [...profile.rows].sort((a, b) => b.price - a.price);
    const hvnSet = new Set(profile.hvns ?? []);
    const lvnSet = new Set(profile.lvns ?? []);

    for (let i = 0; i < sortedRows.length; i += 1) {
      const row = sortedRows[i];
      const yRange = getCustomProfileRowYRange(sortedRows, i, profileBucketSize, priceToY, profileMinRowHeight, rectY, rectHeight);
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

      const rowOpacity = getProfileRowOpacity(row.totalVol, profile.maxVol);
      const isHvn = hvnSet.has(row.price);
      const isLvn = lvnSet.has(row.price);

      if (profileType === 'bidAsk') {
        const askVol = row.askVol || 0;
        const bidVol = row.bidVol || 0;
        const totalVol = Math.max(1, askVol + bidVol);
        const askRatio = askVol / totalVol;
        const bidRatio = bidVol / totalVol;

        const askWidth = barWidthPx * askRatio;
        const bidWidth = barWidthPx * bidRatio;

        if (bidWidth > 0) {
          ctx.fillStyle = chartColorToRgba(CHART_BEARISH_RGB, rowOpacity);
          ctx.fillRect(barAnchorX, drawTopY, bidWidth, drawHeight);
        }
        if (askWidth > 0) {
          ctx.fillStyle = chartColorToRgba(CHART_BULLISH_RGB, rowOpacity);
          ctx.fillRect(barAnchorX + bidWidth, drawTopY, askWidth, drawHeight);
        }
      } else if (profileType !== 'delta') {
        const isInsideVa = row.price >= profile.vaLow && row.price <= profile.vaHigh + profileBucketSize * 0.5;
        let fillColor: string;
        if (isHvn) {
          fillColor = chartColorToRgba(hvnColor, Math.max(rowOpacity, 0.85));
        } else if (isLvn) {
          fillColor = chartColorToRgba(lvnColor, Math.max(rowOpacity, 0.85));
        } else if (showVaFill && isInsideVa) {
          // Color bars inside the Value Area (POC area) with distinct blue matching VA lines (#3D7EFF)
          fillColor = chartColorToRgba('#3D7EFF', Math.max(rowOpacity, 0.75));
        } else {
          // Bars outside Value Area: muted amber
          fillColor = showVaFill
            ? `rgba(217, 119, 6, ${rowOpacity * 0.75})`
            : `rgba(217, 119, 6, ${rowOpacity})`;
        }
        ctx.fillStyle = fillColor;
        ctx.fillRect(barAnchorX, drawTopY, barWidthPx, drawHeight);

        if (isHvn && drawHeight >= 9 && barWidthPx >= 18) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 8px "JetBrains Mono", BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText('HVN', barAnchorX + barWidthPx - 2, drawTopY + drawHeight / 2);
        } else if (isLvn && drawHeight >= 9) {
          ctx.fillStyle = lvnColor;
          ctx.font = 'bold 8px "JetBrains Mono", BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText('LVN', barAnchorX + barWidthPx + 3, drawTopY + drawHeight / 2);
        }
      }
    }

    // POC Highlight
    if (showPocHighlight) {
      const pocRowIndex = sortedRows.findIndex(r => r.price === profile.poc);
      if (pocRowIndex >= 0) {
        const pocRow = sortedRows[pocRowIndex];
        const yRange = getCustomProfileRowYRange(sortedRows, pocRowIndex, profileBucketSize, priceToY, profileMinRowHeight, rectY, rectHeight);

        if (yRange) {
          const { drawTopY, drawHeight } = yRange;
          const volRatio = profile.maxVol > 0 ? Math.max(0, Math.min(1, pocRow.totalVol / profile.maxVol)) : 0;
          let barW = (profileScaleMode === 'sqrt' ? Math.sqrt(volRatio) : volRatio) * barMaxWidth;
          if (pocRow.totalVol > 0 && profileMinRowWidth > 0) barW = Math.max(profileMinRowWidth, barW);
          barW = Math.min(barMaxWidth, barW);

          if (barW >= 0.5) {
            const highlightOpacity = Math.max(getProfileRowOpacity(pocRow.totalVol, profile.maxVol), profileOpacity);
            ctx.fillStyle = chartColorToRgba(pocColor, highlightOpacity);
            ctx.fillRect(barAnchorX, drawTopY, barW, drawHeight);

            if (drawHeight >= 9 && barW >= 18) {
              ctx.fillStyle = '#FFFFFF';
              ctx.font = 'bold 8px "JetBrains Mono", BlinkMacSystemFont, sans-serif';
              ctx.textAlign = 'left';
              ctx.textBaseline = 'middle';
              ctx.fillText('POC', barAnchorX + 3, drawTopY + drawHeight / 2);
            }
          }
        }
      }
    }

    // 3. POC line & developing POC trail removed (as requested, bar colors identify POC/VA)
    void showPocLine;
    void profileShowVaLines;
    void pocWidth;
    void candles;
    void indexToXGlobal;

    // 4. LVN and HVN are rendered directly as colored bar segments in the profile bars loop above
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
  rows: VolumeProfile['rows'],
  rowIndex: number,
  profileBucketSize: number,
  priceToY: (price: number) => number,
  minRowHeight: number,
  rectY: number,
  rectHeight: number,
) {
  const row = rows[rowIndex];
  if (!row) return null;

  let rowTopY = priceToY(row.price + profileBucketSize);
  let rowBotY = getProfileRowBottomY(rows, rowIndex, profileBucketSize, priceToY);
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

function getProfileRowBottomY(
  rows: VolumeProfile['rows'],
  rowIndex: number,
  profileBucketSize: number,
  priceToY: (price: number) => number,
) {
  const row = rows[rowIndex];
  const nextRow = rows[rowIndex + 1];
  if (!row) return 0;

  if (nextRow && areAdjacentRows(row.price, nextRow.price, profileBucketSize)) {
    return priceToY(nextRow.price + profileBucketSize);
  }

  return priceToY(row.price);
}

function areAdjacentRows(currentPrice: number, nextPrice: number, profileBucketSize: number) {
  const tolerance = Math.max(1e-9, profileBucketSize * 1e-6);
  return Math.abs(nextPrice - (currentPrice - profileBucketSize)) <= tolerance;
}

function getProfileRowOpacity(totalVol: number, maxVol: number) {
  const volumeRatio = maxVol > 0 ? Math.max(0, Math.min(1, totalVol / maxVol)) : 0;
  return MIN_PROFILE_ROW_OPACITY + (1 - MIN_PROFILE_ROW_OPACITY) * volumeRatio;
}
