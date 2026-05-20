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
