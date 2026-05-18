import { VolumeProfile } from '@/lib/utils/volumeProfile';
import { HeatmapRow } from '@/types/liquidity';

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
  profileWidthPct: number = 70,
  profileOpacity: number = 0.4,
  profileMinRowWidth: number = 2,
  profileMinRowHeight: number = 1,
  profileBucketSize: number = bucketSize,
  profileScaleMode: 'linear' | 'sqrt' = 'sqrt',
  showPocHighlight: boolean = true,
  showVaFill: boolean = true,
  showPocLine: boolean = true,
  showVaLines: boolean = true,
  heatmapRows?: HeatmapRow[]
) {
  const chartRight = canvasWidth - priceAxisWidth;
  const effectiveWidth = Math.max(0, profileWidth * (profileWidthPct / 100));
  if (effectiveWidth <= 0 || profile.maxVol <= 0) return;

  const profileStartX = chartRight - effectiveWidth;

  const barOpacity = isCustomActive ? profileOpacity * 0.4 : profileOpacity;
  const lineOpacity = isCustomActive ? 0.3 : 1;

  // ── Step 0: VA Background Fill ──
  if (showVaFill) {
    const vaHighY = priceToY(profile.vaHigh + profileBucketSize);
    const vaLowY = priceToY(profile.vaLow);
    ctx.fillStyle = 'rgba(61, 126, 255, 0.06)';
    ctx.fillRect(profileStartX, vaHighY, effectiveWidth, vaLowY - vaHighY);
  }

  // ── Step 1: Profile Bars ──
  for (const row of profile.rows) {
    const yRange = getProfileRowYRange(row.price, profileBucketSize, priceToY, profileMinRowHeight);
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

    // Unified muted amber/orange color for institutional look
    ctx.fillStyle = `rgba(217, 119, 6, ${barOpacity})`;
    ctx.fillRect(barX, yTop, calculatedBarWidth, rowHeight);
  }

  // ── Step 1.5: POC Row Highlight ──
  if (showPocHighlight) {
    const pocRow = profile.rows.find(r => r.price === profile.poc);
    if (pocRow) {
      const yRange = getProfileRowYRange(pocRow.price, profileBucketSize, priceToY, profileMinRowHeight);
      if (yRange) {
        const { yTop, rowHeight } = yRange;

        const volRatio = Math.max(0, Math.min(1, pocRow.totalVol / profile.maxVol));
        let barW = (profileScaleMode === 'sqrt' ? Math.sqrt(volRatio) : volRatio) * effectiveWidth;
        if (pocRow.totalVol > 0 && profileMinRowWidth > 0) barW = Math.max(profileMinRowWidth, barW);
        barW = Math.min(effectiveWidth, barW);

        if (barW >= 0.5) {
          const barX = chartRight - barW;
          const highlightOpacity = Math.min(1.0, barOpacity + 0.2);

          // Re-draw with higher brightness
          ctx.fillStyle = `rgba(217, 119, 6, ${highlightOpacity})`;
          ctx.fillRect(barX, yTop, barW, rowHeight);

          // Amber outline
          ctx.strokeStyle = '#F0B90B';
          ctx.lineWidth = 1;
          ctx.strokeRect(barX, yTop, barW, rowHeight);

          // Internal POC label
          if (rowHeight >= 10 && barW >= 20) {
            ctx.fillStyle = '#F0B90B';
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
              ctx.shadowColor = '#F0B90B';
              ctx.shadowBlur = 10;
              ctx.fillStyle = '#F0B90B';
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
    ctx.strokeStyle = '#F0B90B';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(pocY) + 0.5);
    ctx.lineTo(chartRight, Math.round(pocY) + 0.5);
    ctx.stroke();

    // POC label on left
    ctx.fillStyle = '#F0B90B';
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

  // â”€â”€ Step 4: LVN Lines â”€â”€
  if (profile.lvns.length > 0) {
    ctx.save();
    ctx.globalAlpha = lineOpacity;
    ctx.strokeStyle = '#22D3EE';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.fillStyle = '#22D3EE';
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
}

function getProfileRowYRange(
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
