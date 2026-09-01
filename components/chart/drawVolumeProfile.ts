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

  const lineOpacity = isCustomActive ? 0.3 : 1;
  const sortedRows = [...profile.rows].sort((a, b) => b.price - a.price);

  // ── Step 0: VA Background Fill ──
  if (showVaFill) {
    const vaHighY = priceToY(profile.vaHigh + profileBucketSize);
    const vaLowY = priceToY(profile.vaLow);
    ctx.fillStyle = 'rgba(61, 126, 255, 0.06)';
    ctx.fillRect(profileStartX, vaHighY, effectiveWidth, vaLowY - vaHighY);
  }

  // ── Step 1: Profile Bars ──
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
      // Unified muted amber/orange color for institutional look
      ctx.fillStyle = `rgba(217, 119, 6, ${rowOpacity})`;
      ctx.fillRect(barX, yTop, calculatedBarWidth, rowHeight);
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

          // Re-draw with higher brightness
          ctx.fillStyle = `rgba(217, 119, 6, ${highlightOpacity})`;
          ctx.fillRect(barX, yTop, barW, rowHeight);

          // POC outline
          ctx.strokeStyle = pocColor;
          ctx.lineWidth = pocWidth;
          ctx.strokeRect(barX, yTop, barW, rowHeight);

          // Internal POC label
          if (rowHeight >= 10 && barW >= 20) {
            ctx.fillStyle = pocColor;
            ctx.font = '8px "JetBrains Mono"';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText('POC', barX + 3, yTop + rowHeight / 2 + 1);
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

  // ── Step 2: POC Line ──
  if (showPocLine) {
    const pocY = priceToY(profile.poc + profileBucketSize / 2);

    ctx.save();
    ctx.globalAlpha = lineOpacity;
    ctx.strokeStyle = pocColor;
    ctx.lineWidth = Math.max(1.5, pocWidth);
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(pocY) + 0.5);
    ctx.lineTo(chartRight, Math.round(pocY) + 0.5);
    ctx.stroke();

    // POC label on left
    ctx.fillStyle = pocColor;
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('POC', 4, pocY - 2);
    ctx.restore();
  }

  // ── Step 3: VA High / VA Low Lines ──
  if (showVaLines) {
    const vaHighY = priceToY(profile.vaHigh + profileBucketSize);
    const vaLowY = priceToY(profile.vaLow);

    ctx.save();
    ctx.globalAlpha = lineOpacity;
    ctx.strokeStyle = '#3D7EFF';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);

    ctx.beginPath();
    ctx.moveTo(0, Math.round(vaHighY) + 0.5);
    ctx.lineTo(chartRight, Math.round(vaHighY) + 0.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, Math.round(vaLowY) + 0.5);
    ctx.lineTo(chartRight, Math.round(vaLowY) + 0.5);
    ctx.stroke();

    // VA labels on left
    const vaDistance = Math.abs(vaLowY - vaHighY);
    if (vaDistance >= 16) {
      ctx.fillStyle = '#3D7EFF';
      ctx.font = '9px "JetBrains Mono"';
      ctx.textAlign = 'left';
      
      ctx.textBaseline = 'bottom';
      ctx.fillText('VAH', 4, vaHighY - 2);
      
      ctx.textBaseline = 'top';
      ctx.fillText('VAL', 4, vaLowY + 2);
    }
    ctx.restore();
  }

  // ── Step 4: LVN Lines ──
  if (profile.lvns.length > 0) {
    ctx.save();
    ctx.globalAlpha = lineOpacity;
    ctx.strokeStyle = lvnColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.fillStyle = lvnColor;
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';

    for (const lvn of profile.lvns) {
      const lvnY = priceToY(lvn + profileBucketSize / 2);
      ctx.beginPath();
      ctx.moveTo(profileStartX, Math.round(lvnY) + 0.5);
      ctx.lineTo(chartRight, Math.round(lvnY) + 0.5);
      ctx.stroke();
      ctx.fillText('LVN', profileStartX + 3, lvnY - 2);
    }
    ctx.restore();
  }

  // ── Step 5: HVN Lines ──
  if (profile.hvns && profile.hvns.length > 0) {
    ctx.save();
    ctx.globalAlpha = lineOpacity;
    ctx.strokeStyle = hvnColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 4]);
    ctx.fillStyle = hvnColor;
    ctx.font = 'bold 9px "JetBrains Mono"';
    ctx.textAlign = 'right'; // align right for HVN to distinguish from LVN
    ctx.textBaseline = 'bottom';

    for (const hvn of profile.hvns) {
      const hvnY = priceToY(hvn + profileBucketSize / 2);
      ctx.beginPath();
      ctx.moveTo(profileStartX, Math.round(hvnY) + 0.5);
      ctx.lineTo(chartRight, Math.round(hvnY) + 0.5);
      ctx.stroke();
      ctx.fillText('HVN', chartRight - 4, hvnY - 2);
    }
    ctx.restore();
  }

  // ── Step 6: Developing POC Trail ──
  if (showPocLine && profile.developingPoc && profile.developingPoc.length > 0 && candles && indexToX) {
    ctx.save();
    ctx.globalAlpha = lineOpacity;
    ctx.strokeStyle = pocColor;
    ctx.lineWidth = Math.max(2, pocWidth + 1);
    ctx.lineJoin = 'round';
    ctx.beginPath();

    let started = false;
    for (const point of profile.developingPoc) {
      // Find candle index for this time (point.time is in ms, candle.time is in s)
      const timeSeconds = Math.floor(point.time / 1000);
      
      let lo = 0, hi = candles.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (candles[mid].time < timeSeconds) lo = mid + 1;
        else hi = mid;
      }
      const index = Math.min(lo, candles.length - 1);
      
      const x = indexToX(index);
      const y = priceToY(point.price + profileBucketSize / 2);

      if (!started) {
        ctx.moveTo(x, Math.round(y) + 0.5);
        started = true;
      } else {
        ctx.lineTo(x, Math.round(y) + 0.5);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
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
