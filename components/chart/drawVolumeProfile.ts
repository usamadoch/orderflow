import { VolumeProfile } from '@/lib/utils/volumeProfile';
import { HeatmapRow } from '@/types/liquidity';
import { VolumeProfileType } from '@/types/chart';
import { CHART_BEARISH_RGB, CHART_BULLISH_RGB, chartColorToRgba } from '@/lib/config/chartColors';

const MIN_PROFILE_ROW_OPACITY = 0.15;

/**
 * Draw horizontal volume profile bars, POC line, VA lines, and labels.
 */
export function drawVolumeProfile(
  ctx: CanvasRenderingContext2D,
  profile: VolumeProfile,
  priceToY: (price: number) => number,
  canvasWidth: number,
  profileWidth: number,
  priceAxisWidth: number,
  bucketSize: number,
  isCustomActive: boolean = false,
  profileWidthPct: number = 45,
  profileOpacity: number = 0.6,
  profileMinRowWidth: number = 2,
  profileMinRowHeight: number = 1,
  profileBucketSize: number = bucketSize,
  profileScaleMode: 'linear' | 'sqrt' = 'sqrt',
  showPocHighlight: boolean = true,
  showVaFill: boolean = true,
  showPocLine: boolean = true,
  showVaLines: boolean = true,
  profileType: VolumeProfileType = 'volume',
  heatmapRows?: HeatmapRow[],
  candles?: { time: number }[],
  indexToX?: (index: number) => number,
  pocColor: string = '#F0B90B',
  hvnColor: string = '#F43F5E',
  lvnColor: string = '#22D3EE',
  pocWidth: number = 1
) {
  const chartRight = canvasWidth - priceAxisWidth;
  const effectiveWidth = Math.max(0, profileWidth * (profileWidthPct / 100));
  if (effectiveWidth <= 0 || profile.maxVol <= 0) return;

  const profileStartX = chartRight - effectiveWidth;

  void isCustomActive;
  const sortedRows = [...profile.rows].sort((a, b) => b.price - a.price);

  // ── Step 0: Overall Profile Border ──
  if (sortedRows.length > 0) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1;
    const topY = priceToY(sortedRows[0].price + profileBucketSize);
    const botY = priceToY(sortedRows[sortedRows.length - 1].price);
    ctx.strokeRect(profileStartX, topY, effectiveWidth, botY - topY);
    ctx.restore();
  }

  // ── Step 1: Profile Bars ──
  const hvnSet = new Set(profile.hvns ?? []);
  const lvnSet = new Set(profile.lvns ?? []);

  for (let i = 0; i < sortedRows.length; i += 1) {
    const row = sortedRows[i];
    const yRange = getProfileRowYRange(sortedRows, i, profileBucketSize, priceToY, profileMinRowHeight);
    if (!yRange) continue;

    const { yTop, rowHeight } = yRange;

    let calculatedBarWidth: number;
    const volRatio = Math.max(0, Math.min(1, row.totalVol / profile.maxVol));

    if (profileScaleMode === 'sqrt') {
      calculatedBarWidth = Math.sqrt(volRatio) * effectiveWidth;
    } else {
      calculatedBarWidth = volRatio * effectiveWidth;
    }
    
    // Apply minimum row width only if there is volume
    if (row.totalVol > 0 && profileMinRowWidth > 0) {
      calculatedBarWidth = Math.max(profileMinRowWidth, calculatedBarWidth);
    }
    calculatedBarWidth = Math.min(effectiveWidth, calculatedBarWidth);

    if (calculatedBarWidth < 0.5) continue;

    const barX = chartRight - calculatedBarWidth;
    const rowOpacity = getProfileRowOpacity(row.totalVol, profile.maxVol);
    const isHvn = hvnSet.has(row.price);
    const isLvn = lvnSet.has(row.price);

    if (profileType === 'bidAsk') {
      // Split the bar horizontally into Ask (buy/bullish) and Bid (sell/bearish)
      const askVol = row.askVol || 0;
      const bidVol = row.bidVol || 0;
      const totalVol = Math.max(1, askVol + bidVol);
      const askRatio = askVol / totalVol;
      const bidRatio = bidVol / totalVol;

      const askWidth = calculatedBarWidth * askRatio;
      const bidWidth = calculatedBarWidth * bidRatio;

      // Draw Bid (sellers - Bearish)
      if (bidWidth > 0) {
        ctx.fillStyle = chartColorToRgba(CHART_BEARISH_RGB, rowOpacity);
        ctx.fillRect(barX, yTop, bidWidth, rowHeight);
      }
      
      // Draw Ask (buyers - Bullish) right after Bid
      if (askWidth > 0) {
        ctx.fillStyle = chartColorToRgba(CHART_BULLISH_RGB, rowOpacity);
        ctx.fillRect(barX + bidWidth, yTop, askWidth, rowHeight);
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
      ctx.fillRect(barX, yTop, calculatedBarWidth, rowHeight);

      if (isHvn && rowHeight >= 9 && calculatedBarWidth >= 18) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 8px "JetBrains Mono", BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('HVN', chartRight - 3, yTop + rowHeight / 2);
      } else if (isLvn && rowHeight >= 9) {
        ctx.fillStyle = lvnColor;
        ctx.font = 'bold 8px "JetBrains Mono", BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('LVN', barX - 3, yTop + rowHeight / 2);
      }
    }
  }

  // ── Step 1.5: POC Row Highlight ──
  if (showPocHighlight) {
    const pocRowIndex = sortedRows.findIndex(r => r.price === profile.poc);
    if (pocRowIndex >= 0) {
      const pocRow = sortedRows[pocRowIndex];
      const yRange = getProfileRowYRange(sortedRows, pocRowIndex, profileBucketSize, priceToY, profileMinRowHeight);
      if (yRange) {
        const { yTop, rowHeight } = yRange;

        const volRatio = Math.max(0, Math.min(1, pocRow.totalVol / profile.maxVol));
        let barW = (profileScaleMode === 'sqrt' ? Math.sqrt(volRatio) : volRatio) * effectiveWidth;
        if (pocRow.totalVol > 0 && profileMinRowWidth > 0) barW = Math.max(profileMinRowWidth, barW);
        barW = Math.min(effectiveWidth, barW);

        if (barW >= 0.5) {
          const barX = chartRight - barW;
          const highlightOpacity = Math.max(getProfileRowOpacity(pocRow.totalVol, profile.maxVol), profileOpacity);

          // Fill with configurable pocColor
          ctx.fillStyle = chartColorToRgba(pocColor, highlightOpacity);
          ctx.fillRect(barX, yTop, barW, rowHeight);

          // Internal POC label
          if (rowHeight >= 9 && barW >= 18) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 8px "JetBrains Mono", BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('POC', barX + 3, yTop + rowHeight / 2);
          }

          // Optional Enrichment: POC Glow from Heatmap
          if (heatmapRows) {
            const matchingHeatmapRow = heatmapRows.find(
              hr => hr.price >= pocRow.price && hr.price < pocRow.price + profileBucketSize
            );
            if (matchingHeatmapRow && matchingHeatmapRow.intensity >= 0.9) {
              ctx.shadowColor = pocColor;
              ctx.shadowBlur = 10;
              ctx.fillStyle = pocColor;
              ctx.fillRect(barX, yTop, 2, rowHeight);
              ctx.shadowBlur = 0; // reset
            }
          }
        }
      }
    }
  }

  // ── Step 2 & 3: POC Line and VA Lines removed (POC and Value Area are identified directly by bar coloring) ──
  void showVaLines;
  void showPocLine;
  void pocWidth;
  void candles;
  void indexToX;

  // ── Step 4 & 5: LVN and HVN are rendered directly as colored bar segments in Step 1 above ──

  // ── Step 6: Developing POC Trail removed (as requested, bar colors identify POC/VA) ──
}

function getProfileRowYRange(
  rows: VolumeProfile['rows'],
  rowIndex: number,
  profileBucketSize: number,
  priceToY: (price: number) => number,
  minRowHeight: number,
) {
  const row = rows[rowIndex];
  if (!row) return null;

  let yTop = priceToY(row.price + profileBucketSize);
  let yBot = getProfileRowBottomY(rows, rowIndex, profileBucketSize, priceToY);
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
