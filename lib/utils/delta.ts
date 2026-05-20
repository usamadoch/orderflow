import type { AggregationEngine } from '@/lib/aggregation/engine';
import type { Candle } from '@/types/candle';
import type { CvdResetMode, SessionConfig } from '@/lib/store/chart';

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

interface BuildCvdSeriesOptions {
  resetMode: CvdResetMode;
  smoothing: number;
  sessions?: Record<string, SessionConfig>;
}

export function buildCvdSeries(
  candles: Candle[],
  engine: AggregationEngine,
  options: BuildCvdSeriesOptions
): CvdPoint[] {
  const rawPoints: CvdPoint[] = [];
  const smoothing = Math.max(1, Math.round(options.smoothing || 1));
  let cumulative = 0;
  let previousDayKey: string | null = null;
  let previousSessionKey: string | null = null;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const dayKey = getUtcDayKey(candle.time);
    const sessionKey = getActiveSessionKey(candle, options.sessions);
    const reset =
      index === 0 ||
      (options.resetMode === 'daily' && previousDayKey !== null && dayKey !== previousDayKey) ||
      (options.resetMode === 'session' && sessionKey !== null && sessionKey !== previousSessionKey);

    if (reset) {
      cumulative = 0;
    }

    const rawDelta = engine.getFootprintCandle(candle.time)?.delta ?? 0;
    const rawOpen = cumulative;
    const rawClose = cumulative + rawDelta;

    cumulative = rawClose;
    previousDayKey = dayKey;
    previousSessionKey = sessionKey;

    rawPoints.push({
      index,
      time: candle.time,
      rawDelta,
      delta: rawDelta,
      rawOpen,
      rawHigh: Math.max(rawOpen, rawClose),
      rawLow: Math.min(rawOpen, rawClose),
      rawClose,
      open: rawOpen,
      high: Math.max(rawOpen, rawClose),
      low: Math.min(rawOpen, rawClose),
      close: rawClose,
      reset,
    });
  }

  if (smoothing <= 1) {
    return rawPoints;
  }

  const smoothed: CvdPoint[] = [];

  for (let i = 0; i < rawPoints.length; i += 1) {
    const point = rawPoints[i];
    let sum = 0;
    let count = 0;

    for (let j = i; j >= 0 && count < smoothing; j -= 1) {
      sum += rawPoints[j].rawClose;
      count += 1;
      if (rawPoints[j].reset) break;
    }

    const close = count > 0 ? sum / count : point.rawClose;
    const previous = smoothed[i - 1];
    const open = point.reset || !previous ? point.rawOpen : previous.close;

    smoothed.push({
      ...point,
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
      delta: close - open,
    });
  }

  return smoothed;
}

export function detectLocalCvdDivergences(
  candles: Candle[],
  points: CvdPoint[],
  lookback: number
): CvdDivergenceMarker[] {
  const windowSize = Math.max(3, Math.min(30, Math.round(lookback || 8)));
  const markers: CvdDivergenceMarker[] = [];
  const epsilon = 0.0000001;
  let lastBullishIndex = -Infinity;
  let lastBearishIndex = -Infinity;

  for (let index = windowSize; index < candles.length && index < points.length; index += 1) {
    const candle = candles[index];
    const point = points[index];
    if (!candle || !point || windowCrossesReset(points, index - windowSize, index)) continue;

    let previousHigh = -Infinity;
    let previousLow = Infinity;
    let previousCvdHigh = -Infinity;
    let previousCvdLow = Infinity;

    for (let i = index - windowSize; i < index; i += 1) {
      const previousCandle = candles[i];
      const previousPoint = points[i];
      if (!previousCandle || !previousPoint) continue;

      previousHigh = Math.max(previousHigh, previousCandle.high);
      previousLow = Math.min(previousLow, previousCandle.low);
      previousCvdHigh = Math.max(previousCvdHigh, previousPoint.high);
      previousCvdLow = Math.min(previousCvdLow, previousPoint.low);
    }

    if (!Number.isFinite(previousHigh) || !Number.isFinite(previousLow) || !Number.isFinite(previousCvdHigh) || !Number.isFinite(previousCvdLow)) {
      continue;
    }

    const priceBreaksHigher = candle.high > previousHigh + epsilon;
    const cvdFailsHigh = point.high <= previousCvdHigh + epsilon;
    if (priceBreaksHigher && cvdFailsHigh && index - lastBearishIndex >= Math.max(2, Math.floor(windowSize / 2))) {
      markers.push({
        index,
        time: candle.time,
        direction: 'bearish',
        priceValue: candle.high,
        cvdValue: point.high,
      });
      lastBearishIndex = index;
      continue;
    }

    const priceBreaksLower = candle.low < previousLow - epsilon;
    const cvdFailsLow = point.low >= previousCvdLow - epsilon;
    if (priceBreaksLower && cvdFailsLow && index - lastBullishIndex >= Math.max(2, Math.floor(windowSize / 2))) {
      markers.push({
        index,
        time: candle.time,
        direction: 'bullish',
        priceValue: candle.low,
        cvdValue: point.low,
      });
      lastBullishIndex = index;
    }
  }

  return markers;
}

function windowCrossesReset(points: CvdPoint[], startIndex: number, endIndex: number) {
  for (let i = Math.max(1, startIndex + 1); i <= endIndex; i += 1) {
    if (points[i]?.reset) return true;
  }
  return false;
}

function getUtcDayKey(timeSeconds: number) {
  const date = new Date(timeSeconds * 1000);
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function getActiveSessionKey(candle: Candle, sessions?: Record<string, SessionConfig>) {
  if (!sessions) return null;

  const date = new Date(candle.time * 1000);
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();

  for (const [key, session] of Object.entries(sessions)) {
    if (!session.enabled) continue;
    if (isInsideSession(minutes, session)) return key;
  }

  return null;
}

function isInsideSession(minutes: number, session: SessionConfig) {
  const start = session.startHour * 60 + session.startMin;
  const end = session.endHour * 60 + session.endMin;

  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}
