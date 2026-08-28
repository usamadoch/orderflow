import type { AggregationEngine } from '@/lib/aggregation/engine';
import type { Candle } from '@/types/candle';
import type { CvdResetMode, SessionConfig } from '@/lib/store/chart';
import type { CvdPoint, CvdDivergenceMarker } from '../../types/cvd';
import { getZonedTimeParts } from './format';

export type { CvdPoint, CvdDivergenceMarker };

interface BuildCvdSeriesOptions {
  resetMode: CvdResetMode;
  smoothing: number;
  sessions?: Record<string, SessionConfig>;
  timezone?: string;
}

export function buildCvdSeries(
  candles: Candle[],
  engine: AggregationEngine,
  options: BuildCvdSeriesOptions
): CvdPoint[] {
  const rawPoints: CvdPoint[] = [];
  const smoothing = Math.max(1, Math.round(options.smoothing || 1));
  const tz = options.timezone || 'local';
  let cumulative = 0;
  let previousDayKey: string | null = null;
  let previousSessionKey: string | null = null;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    const dayKey = getZonedDayKey(candle.time, tz);
    const sessionKey = getActiveSessionKey(candle, options.sessions, tz);
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

function getZonedDayKey(timeSeconds: number, timezone: string) {
  const parts = getZonedTimeParts(timeSeconds * 1000, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getActiveSessionKey(candle: Candle, sessions?: Record<string, SessionConfig>, timezone: string = 'local') {
  if (!sessions) return null;

  const parts = getZonedTimeParts(candle.time * 1000, timezone);
  const minutes = parts.hour * 60 + parts.minute;

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
