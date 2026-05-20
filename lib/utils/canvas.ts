import { FootprintCell } from '../../types/footprint';

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getVisualStrength(value: number, scale: number) {
  if (value <= 0 || scale <= 0) return 0;
  return clamp01(value / scale);
}

function getCellOpacity(value: number, scale: number) {
  const strength = getVisualStrength(value, scale);
  if (strength <= 0) return 0.06;
  return 0.08 + Math.pow(strength, 0.9) * 0.64;
}

function getDeltaOpacity(value: number, scale: number) {
  const strength = getVisualStrength(value, scale);
  if (strength <= 0) return 0;
  return 0.12 + Math.pow(strength, 0.85) * 0.58;
}

function getDeltaWidthRatio(value: number, scale: number) {
  const strength = getVisualStrength(value, scale);
  if (strength <= 0) return 0;
  return Math.min(0.92, Math.pow(strength, 0.82) * 0.92);
}

export function initCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = window.devicePixelRatio || 1;
  
  // Use rounded values for internal buffer size to align with physical pixels
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  
  // Set CSS dimensions to match logical dimensions precisely
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
  }
  return ctx;
}

export function drawFootprintCell(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  width: number,
  height: number,
  cell: FootprintCell,
  volumeScale: number
) {
  const safeWidth = Math.max(0, Number.isFinite(width) ? width : 0);
  const safeHeight = Math.max(0, Number.isFinite(height) ? height : 0);
  const gap = safeWidth >= 12 ? 1 : 0.5;
  const halfWidth = (safeWidth - gap) / 2;
  
  if (halfWidth <= 0 || safeHeight <= 0) return;

  const bidOpacity = getCellOpacity(cell.bidVol, volumeScale);
  const askOpacity = getCellOpacity(cell.askVol, volumeScale);
  const leftX = centerX - safeWidth / 2;
  const askX = leftX + halfWidth + gap;

  // Draw bid (left)
  ctx.fillStyle = `rgba(239, 83, 80, ${bidOpacity})`;
  ctx.fillRect(leftX, y, halfWidth, safeHeight);

  // Draw ask (right)
  ctx.fillStyle = `rgba(38, 166, 154, ${askOpacity})`;
  ctx.fillRect(askX, y, halfWidth, safeHeight);

  // Draw text
  if (safeHeight >= 8 && halfWidth >= 8) {
    ctx.fillStyle = '#E8E8E8';
    const fontSize = Math.max(8, Math.min(11, Math.floor(safeHeight - 2)));
    ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'middle';
    
    const formatVol = (v: number) => {
      if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
      return v.toFixed(1);
    };

    ctx.textAlign = 'center';
    
    const bidLabel = formatVol(cell.bidVol);
    const askLabel = formatVol(cell.askVol);
    const labelMaxWidth = Math.max(0, halfWidth - 2);

    if (ctx.measureText(bidLabel).width <= labelMaxWidth) {
      ctx.fillText(bidLabel, leftX + halfWidth / 2, y + safeHeight / 2);
    }

    if (ctx.measureText(askLabel).width <= labelMaxWidth) {
      ctx.fillText(askLabel, askX + halfWidth / 2, y + safeHeight / 2);
    }
  }
}

export function drawDeltaCell(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  width: number,
  height: number,
  delta: number,
  deltaScale: number
) {
  const safeWidth = Math.max(0, Number.isFinite(width) ? width : 0);
  const safeHeight = Math.max(0, Number.isFinite(height) ? height : 0);
  if (safeWidth <= 0 || safeHeight <= 0) return;

  const absDelta = Math.abs(delta);
  const ratio = getDeltaWidthRatio(absDelta, deltaScale);
  const minVisibleWidth = absDelta > 0 ? Math.min(safeWidth, Math.max(1, safeWidth * 0.025)) : 0;
  const barWidth = absDelta > 0 ? Math.max(minVisibleWidth, safeWidth * ratio) : 0;
  const opacity = getDeltaOpacity(absDelta, deltaScale);
  
  // Bar background - extend toward the right from the left edge of the cell
  ctx.fillStyle = delta >= 0 ? `rgba(38, 166, 154, ${opacity})` : `rgba(239, 83, 80, ${opacity})`;
  ctx.fillRect(centerX - safeWidth / 2, y, barWidth, safeHeight);

  // Delta text
  if (safeHeight >= 8 && safeWidth >= 10) {
    ctx.fillStyle = '#E8E8E8';
    const fontSize = Math.max(8, Math.min(11, Math.floor(safeHeight - 2)));
    ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const formatDelta = (d: number) => {
      const sign = d > 0 ? '+' : d < 0 ? '-' : '';
      const abs = Math.abs(d);
      if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + 'k';
      return sign + abs.toFixed(1);
    };

    const label = formatDelta(delta);
    if (ctx.measureText(label).width <= safeWidth - 4) {
      ctx.fillText(label, centerX, y + safeHeight / 2);
    }
  }
}

export function drawDelta(
  ctx: CanvasRenderingContext2D,
  x: number,
  delta: number,
  canvasHeight: number,
  width: number
) {
  const y = canvasHeight - 20;
  
  ctx.fillStyle = delta >= 0 ? '#26A69A' : '#EF5350';
  
  let fontSize = 11;
  if (width < 30) fontSize = 9;
  ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let text = '';
  if (Math.abs(delta) >= 1000) {
    const abbreviated = (delta / 1000).toFixed(1);
    text = delta > 0 ? `+${abbreviated}k` : `${abbreviated}k`;
  } else {
    // Avoid floating point mess (e.g. 5.4427400000000)
    const rounded = Number(delta.toFixed(3));
    text = delta > 0 ? `+${rounded}` : `${rounded}`;
  }

  if (width >= 20) {
    ctx.fillText(text, x, y);
  } else {
    // Too narrow, maybe just a colored dot or small rect
    ctx.fillRect(x - width/2, y - 2, width, 4);
  }
}
