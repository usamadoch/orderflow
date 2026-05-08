import { VolumeProfile } from '@/lib/utils/volumeProfile';

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
  bucketSize: number
) {
  const chartRight = canvasWidth - priceAxisWidth;

  // ── Step 1: Profile Bars ──
  for (const row of profile.rows) {
    const yTop = priceToY(row.price + bucketSize);
    const yBot = priceToY(row.price);
    const rowHeight = yBot - yTop;

    if (rowHeight < 1) continue;

    const barWidth = (row.totalVol / profile.maxVol) * profileWidth;
    if (barWidth < 0.5) continue;

    const barX = chartRight - barWidth;

    if (row.hasFP && row.totalVol > 0) {
      // Bid/ask split — ask on left (green), bid on right (red)
      const askWidth = barWidth * (row.askVol / row.totalVol);
      const bidWidth = barWidth - askWidth;

      // Ask portion (green)
      ctx.fillStyle = 'rgba(38, 166, 154, 0.4)';
      ctx.fillRect(barX, yTop, askWidth, rowHeight);

      // Bid portion (red)
      ctx.fillStyle = 'rgba(239, 83, 80, 0.4)';
      ctx.fillRect(barX + askWidth, yTop, bidWidth, rowHeight);
    } else {
      // Fallback — neutral gray (no footprint data)
      ctx.fillStyle = 'rgba(138, 138, 138, 0.3)';
      ctx.fillRect(barX, yTop, barWidth, rowHeight);
    }
  }

  // ── Step 2: POC Line ──
  const pocY = priceToY(profile.poc + bucketSize / 2);

  ctx.save();
  ctx.strokeStyle = '#F0B90B';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, Math.round(pocY) + 0.5);
  ctx.lineTo(chartRight, Math.round(pocY) + 0.5);
  ctx.stroke();
  ctx.restore();

  // ── Step 3: VA High / VA Low Lines ──
  const vaHighY = priceToY(profile.vaHigh + bucketSize);
  const vaLowY = priceToY(profile.vaLow);

  ctx.save();
  ctx.strokeStyle = '#3D7EFF';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);

  ctx.beginPath();
  ctx.moveTo(0, Math.round(vaHighY) + 0.5);
  ctx.lineTo(chartRight, Math.round(vaHighY) + 0.5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, Math.round(vaLowY) + 0.5);
  ctx.lineTo(chartRight, Math.round(vaLowY) + 0.5);
  ctx.stroke();
  ctx.restore();

  // ── Step 4: Labels ──
  const labelX = chartRight + 4;
  ctx.font = '9px "JetBrains Mono"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // POC label
  ctx.fillStyle = '#F0B90B';
  ctx.fillText('POC', labelX, pocY);

  // VA labels — skip if too close together
  const vaDistance = Math.abs(vaLowY - vaHighY);
  if (vaDistance >= 14) {
    ctx.fillStyle = '#3D7EFF';
    ctx.fillText('VAH', labelX, vaHighY);
    ctx.fillText('VAL', labelX, vaLowY);
  }
}
