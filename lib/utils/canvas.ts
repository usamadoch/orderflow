import { FootprintCell } from '../../types/footprint';

export function initCanvas(canvas: HTMLCanvasElement, container: HTMLElement) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = container.offsetWidth * dpr;
  canvas.height = container.offsetHeight * dpr;
  canvas.style.width = container.offsetWidth + 'px';
  canvas.style.height = container.offsetHeight + 'px';
  const ctx = canvas.getContext('2d');
  if (ctx) {
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
  maxVol: number
) {
  const gap = 1;
  const halfWidth = width / 2 - gap;
  
  if (halfWidth <= 0 || height <= 0) return;

  const minOpacity = 0.15;
  const bidOpacity = maxVol > 0 ? Math.max(minOpacity, cell.bidVol / maxVol) : minOpacity;
  const askOpacity = maxVol > 0 ? Math.max(minOpacity, cell.askVol / maxVol) : minOpacity;

  // Draw bid (left)
  ctx.fillStyle = `rgba(239, 83, 80, ${bidOpacity})`;
  ctx.fillRect(centerX - width / 2, y, halfWidth, height);

  // Draw ask (right)
  ctx.fillStyle = `rgba(38, 166, 154, ${askOpacity})`;
  ctx.fillRect(centerX + gap, y, halfWidth, height);

  // Draw text
  if (height >= 10 && width >= 30) {
    ctx.fillStyle = '#E8E8E8';
    const fontSize = height < 15 ? 9 : 11;
    ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'middle';
    
    const formatVol = (v: number) => {
      if (v >= 1000) return (v / 1000).toFixed(1) + 'k';
      return v.toFixed(1);
    };

    ctx.textAlign = 'center';
    
    // Bid text - center of left half
    const bidX = centerX - width / 4 - gap / 2;
    ctx.fillText(formatVol(cell.bidVol), bidX, y + height / 2);

    // Ask text - center of right half
    const askX = centerX + width / 4 + gap / 2;
    ctx.fillText(formatVol(cell.askVol), askX, y + height / 2);
  }
}

export function drawDeltaCell(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  width: number,
  height: number,
  delta: number,
  maxDelta: number
) {
  if (width <= 0 || height <= 0) return;

  const absDelta = Math.abs(delta);
  const ratio = maxDelta > 0 ? absDelta / maxDelta : 0;
  const barWidth = width * ratio;
  
  // Bar background - extend toward the right from the left edge of the cell
  ctx.fillStyle = delta >= 0 ? 'rgba(38, 166, 154, 0.4)' : 'rgba(239, 83, 80, 0.4)';
  ctx.fillRect(centerX - width / 2, y, barWidth, height);

  // Delta text
  if (height >= 10 && width >= 20) {
    ctx.fillStyle = '#E8E8E8';
    const fontSize = height < 15 ? 9 : 11;
    ctx.font = `${fontSize}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const formatDelta = (d: number) => {
      const sign = d > 0 ? '+' : d < 0 ? '−' : '';
      const abs = Math.abs(d);
      if (abs >= 1000) return sign + (abs / 1000).toFixed(1) + 'k';
      return sign + abs.toFixed(1);
    };

    ctx.fillText(formatDelta(delta), centerX, y + height / 2);
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
