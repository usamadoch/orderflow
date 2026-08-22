import type { CvdMode, CvdScaleMode } from '@/types/chart';

export interface CvdScale {
  min: number;
  max: number;
  valueToY: (value: number) => number;
  yToValue: (y: number) => number;
}

export interface CvdPoint {
  index: number;
  time: number;
  rawDelta: number;
  delta: number;
  rawOpen: number;
  rawHigh: number;
  rawLow: number;
  rawClose: number;
  open: number;
  high: number;
  low: number;
  close: number;
  reset: boolean;
}

export type CvdDivergenceDirection = 'bullish' | 'bearish';

export interface CvdDivergenceMarker {
  index: number;
  time: number;
  direction: CvdDivergenceDirection;
  priceValue: number;
  cvdValue: number;
}

export type CvdDragMode = 'pan' | 'scale';

export interface DrawCvdOptions {
  mode: CvdMode;
  scaleMode: CvdScaleMode;
  fixedRange: number;
  positiveColor: string;
  negativeColor: string;
  showDivergenceMarkers: boolean;
  divergenceMarkers?: CvdDivergenceMarker[];
  chartWidth: number;
  chartHeight: number;
  canvasWidth: number;
  canvasHeight: number;
  priceAxisWidth: number;
  timeAxisHeight: number;
  barWidth: number;
}
