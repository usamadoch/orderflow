import type { CvdScale } from '@/types/cvd';

export function createManualScale(center: number, range: number, chartHeight: number): CvdScale {
  const safeRange = Math.max(1, range);
  const min = center - safeRange / 2;
  const max = center + safeRange / 2;

  const valueToY = (value: number) => ((max - value) / safeRange) * chartHeight;
  const yToValue = (y: number) => max - (y / Math.max(1, chartHeight)) * safeRange;

  return { min, max, valueToY, yToValue };
}

export function computeCvdZoomScale(
  y: number,
  deltaY: number,
  chartHeight: number,
  currentScale: CvdScale
): { center: number; range: number } {
  const oldRange = Math.max(1, currentScale.max - currentScale.min);
  const zoomFactor = Math.max(0.2, Math.min(5, 1 + deltaY * 0.002));
  const newRange = Math.max(1, Math.min(1_000_000_000, oldRange * zoomFactor));
  const anchorValue = currentScale.yToValue(y);
  const ratio = (currentScale.max - anchorValue) / oldRange;
  const newMax = anchorValue + newRange * ratio;
  const newMin = newMax - newRange;

  return {
    center: (newMin + newMax) / 2,
    range: newRange,
  };
}
