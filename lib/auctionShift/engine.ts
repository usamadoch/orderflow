import { Candle } from '../../types/candle';
import { FootprintCandle } from '../../types/footprint';
import {
  AuctionShiftDirection,
  AuctionShiftResult,
  AuctionShiftState,
} from '../../types/auctionShift';
import { AbsorptionResult } from '../../types/absorption';
import { ExhaustionResult } from '../../types/exhaustion';
import { AggregationEngine } from '../aggregation/engine';
import { getRollingAverages } from '../utils/chartUtils';
import { buildProfile } from '../utils/volumeProfile';

const LOOKBACK = 20;
const BALANCE_WINDOW = 12;
const PROFILE_WINDOW = 24;
const FOLLOW_THROUGH_WINDOW = 2;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function ratio(value: number, average: number): number {
  if (average <= 0) return 0;
  return value / average;
}

function getRange(candle: Candle): number {
  return Math.max(0, candle.high - candle.low);
}

function getBody(candle: Candle): number {
  return Math.abs(candle.close - candle.open);
}

function getCloseLocation(candle: Candle): number {
  const range = getRange(candle);
  if (range === 0) return 0.5;
  return clamp((candle.close - candle.low) / range, 0, 1);
}

function getDirection(delta: number, candle: Candle): AuctionShiftDirection {
  if (delta > 0) return 'buying';
  if (delta < 0) return 'selling';
  if (candle.close > candle.open) return 'buying';
  if (candle.close < candle.open) return 'selling';
  return 'neutral';
}

function aggressorDirection(direction: 'buyer' | 'seller'): AuctionShiftDirection {
  return direction === 'buyer' ? 'buying' : 'selling';
}

function getStateDirection(state: AuctionShiftState, fallback: AuctionShiftDirection): AuctionShiftDirection {
  if (state === 'initiative_buying') return 'buying';
  if (state === 'initiative_selling') return 'selling';
  if (state === 'balanced') return 'neutral';
  return fallback;
}

function buildRecentProfile(
  candles: Candle[],
  engine: AggregationEngine,
  bucketSize: number
): { vaHigh: number; vaLow: number; poc: number } | null {
  if (candles.length < 4 || bucketSize <= 0) return null;
  const profile = buildProfile(candles, engine, bucketSize, bucketSize);
  if (!profile) return null;
  return {
    vaHigh: profile.vaHigh,
    vaLow: profile.vaLow,
    poc: profile.poc,
  };
}

function hasFollowThrough(
  candle: Candle,
  nextCandles: Candle[],
  direction: AuctionShiftDirection
): boolean {
  if (nextCandles.length === 0) return false;

  if (direction === 'buying') {
    return nextCandles.some((next) => next.high > candle.high && next.close >= candle.close);
  }

  if (direction === 'selling') {
    return nextCandles.some((next) => next.low < candle.low && next.close <= candle.close);
  }

  return false;
}

function hasFailedExtension(
  candle: Candle,
  nextCandles: Candle[],
  direction: AuctionShiftDirection,
  vaHigh?: number,
  vaLow?: number
): boolean {
  if (nextCandles.length === 0) return false;

  const mid = (candle.high + candle.low) / 2;

  if (direction === 'buying') {
    return nextCandles.some((next) => {
      const returnedIntoValue = vaHigh !== undefined && next.close <= vaHigh;
      return next.high <= candle.high || next.close < mid || returnedIntoValue;
    });
  }

  if (direction === 'selling') {
    return nextCandles.some((next) => {
      const returnedIntoValue = vaLow !== undefined && next.close >= vaLow;
      return next.low >= candle.low || next.close > mid || returnedIntoValue;
    });
  }

  return false;
}

function scoreBalance(
  candle: Candle,
  deltaRatio: number,
  volumeRatio: number,
  bodyRatio: number,
  containedInRange: boolean,
  inValueArea: boolean,
  reasons: string[]
): number {
  let score = 0;

  if (deltaRatio > 0 && deltaRatio < 0.9) {
    score += 25;
    reasons.push('Muted aggressive delta versus recent activity');
  }

  if (volumeRatio > 0 && volumeRatio < 1.2) {
    score += 20;
    reasons.push('Volume stayed near the recent baseline');
  }

  if (bodyRatio < 0.45 || getBody(candle) === 0) {
    score += 20;
    reasons.push('Limited directional candle progress');
  }

  if (containedInRange) {
    score += 20;
    reasons.push('Close remained inside the recent auction range');
  }

  if (inValueArea) {
    score += 15;
    reasons.push('Close accepted inside recent value area');
  }

  return clamp(score, 0, 100);
}

function scoreInitiative(
  candle: Candle,
  direction: AuctionShiftDirection,
  deltaRatio: number,
  volumeRatio: number,
  bodyRatio: number,
  closeLocation: number,
  brokeRecentHigh: boolean,
  brokeRecentLow: boolean,
  aboveValue: boolean,
  belowValue: boolean,
  followThrough: boolean,
  failedExtension: boolean,
  reasons: string[]
): { score: number; volumeExpansion: number; acceptance: number; followThroughScore: number } {
  if (direction === 'neutral') {
    return { score: 0, volumeExpansion: 0, acceptance: 0, followThroughScore: 0 };
  }

  let score = 0;
  let volumeExpansion = 0;
  let acceptance = 0;
  let followThroughScore = 0;

  if (deltaRatio >= 2.2) {
    score += 25;
    reasons.push('Aggressive delta expanded sharply');
  } else if (deltaRatio >= 1.5) {
    score += 16;
    reasons.push('Aggressive delta expanded');
  }

  if (volumeRatio >= 1.8) {
    volumeExpansion = 20;
    reasons.push('Volume expanded with participation');
  } else if (volumeRatio >= 1.35) {
    volumeExpansion = 12;
    reasons.push('Volume lifted above the recent baseline');
  }
  score += volumeExpansion;

  if (bodyRatio >= 0.65) {
    score += 15;
    reasons.push('Candle body showed directional efficiency');
  } else if (bodyRatio >= 0.5) {
    score += 9;
    reasons.push('Candle body showed improved directional progress');
  }

  if (direction === 'buying' && closeLocation >= 0.75) {
    acceptance = 15;
    reasons.push('Close accepted near the upper extreme');
  } else if (direction === 'selling' && closeLocation <= 0.25) {
    acceptance = 15;
    reasons.push('Close accepted near the lower extreme');
  }
  score += acceptance;

  if ((direction === 'buying' && (brokeRecentHigh || aboveValue)) || (direction === 'selling' && (brokeRecentLow || belowValue))) {
    score += 15;
    reasons.push('Price accepted beyond recent balance/value');
  }

  if (followThrough) {
    followThroughScore = 10;
    reasons.push('Follow-through appeared after the aggressive candle');
  } else if (failedExtension) {
    followThroughScore = -12;
    reasons.push('Aggression failed to extend on the next candle');
  }

  score += followThroughScore;

  return {
    score: clamp(score, 0, 100),
    volumeExpansion,
    acceptance,
    followThroughScore,
  };
}

function scoreAbsorptionReversal(
  candle: Candle,
  absorption: AbsorptionResult | undefined,
  nextCandles: Candle[],
  nearRangeEdge: boolean,
  vaHigh: number | undefined,
  vaLow: number | undefined,
  reasons: string[]
): { score: number; direction: AuctionShiftDirection; followThroughScore: number } {
  if (!absorption || absorption.score < 55) {
    return { score: 0, direction: 'neutral', followThroughScore: 0 };
  }

  const reversalDirection = absorption.direction === 'seller' ? 'buying' : 'selling';
  const range = getRange(candle);
  const closeLocation = getCloseLocation(candle);
  let score = Math.min(45, absorption.score * 0.55);
  let followThroughScore = 0;

  reasons.push(`Absorption pressure registered (${Math.round(absorption.score)} score)`);

  if (nearRangeEdge) {
    score += 15;
    reasons.push('Absorption formed near a recent auction edge');
  }

  if (range > 0) {
    const buyerAbsorptionRejection = absorption.direction === 'seller' && closeLocation >= 0.55;
    const sellerAbsorptionRejection = absorption.direction === 'buyer' && closeLocation <= 0.45;

    if (buyerAbsorptionRejection || sellerAbsorptionRejection) {
      score += 15;
      reasons.push('Candle rejected the aggressor side');
    }
  }

  if (hasFailedExtension(candle, nextCandles, aggressorDirection(absorption.direction), vaHigh, vaLow)) {
    score += 15;
    followThroughScore = 15;
    reasons.push('Aggression failed to continue after absorption');
  }

  return {
    score: clamp(score, 0, 100),
    direction: reversalDirection,
    followThroughScore,
  };
}

function scoreExhaustionTransition(
  candle: Candle,
  exhaustion: ExhaustionResult | undefined,
  nextCandles: Candle[],
  vaHigh: number | undefined,
  vaLow: number | undefined,
  reasons: string[]
): { score: number; direction: AuctionShiftDirection; followThroughScore: number } {
  if (!exhaustion || exhaustion.score < 40) {
    return { score: 0, direction: 'neutral', followThroughScore: 0 };
  }

  const transitionDirection = exhaustion.direction === 'buyer' ? 'selling' : 'buying';
  let score = Math.min(50, exhaustion.score * 0.6);
  let followThroughScore = 0;

  reasons.push(`Exhaustion behavior registered (${Math.round(exhaustion.score)} score)`);

  if (exhaustion.signals.weakContinuation > 0) {
    score += 12;
    reasons.push('Effort produced weak continuation');
  }

  if (exhaustion.signals.momentumDecay > 0) {
    score += 10;
    reasons.push('Aggressive momentum decayed');
  }

  if (hasFailedExtension(candle, nextCandles, aggressorDirection(exhaustion.direction), vaHigh, vaLow)) {
    score += 14;
    followThroughScore = 14;
    reasons.push('Follow-through failed after exhaustion');
  }

  return {
    score: clamp(score, 0, 100),
    direction: transitionDirection,
    followThroughScore,
  };
}

function scoreAuctionShiftAt(
  candles: Candle[],
  index: number,
  engine: AggregationEngine,
  absorptionMap: Map<number, AbsorptionResult>,
  exhaustionMap: Map<number, ExhaustionResult>,
  bucketSize: number,
  priorState: AuctionShiftState | null
): AuctionShiftResult | null {
  const candle = candles[index];
  if (!candle) return null;

  const recentStart = Math.max(0, index - LOOKBACK);
  const recentCandles = candles.slice(recentStart, index);
  if (recentCandles.length < 3) return null;

  const recentFootprints = recentCandles.map((c) => engine.getFootprintCandle(c.time));
  const footprint: FootprintCandle | null = engine.getFootprintCandle(candle.time);
  const delta = footprint ? footprint.delta : 0;
  const absDelta = Math.abs(delta);
  const { avgAbsDelta, avgVolume } = getRollingAverages(recentCandles, recentFootprints);
  const currentDeltaRatio = ratio(absDelta, avgAbsDelta);
  const currentVolumeRatio = ratio(candle.volume, avgVolume);
  const range = getRange(candle);
  const bodyRatio = range > 0 ? getBody(candle) / range : 0;
  const closeLocation = getCloseLocation(candle);
  const direction = getDirection(delta, candle);

  const balanceWindow = candles.slice(Math.max(0, index - BALANCE_WINDOW), index);
  const recentHigh = balanceWindow.length > 0 ? Math.max(...balanceWindow.map((c) => c.high)) : candle.high;
  const recentLow = balanceWindow.length > 0 ? Math.min(...balanceWindow.map((c) => c.low)) : candle.low;
  const containedInRange = candle.close <= recentHigh && candle.close >= recentLow;
  const brokeRecentHigh = candle.close > recentHigh && candle.high > recentHigh;
  const brokeRecentLow = candle.close < recentLow && candle.low < recentLow;
  const nearRangeEdge = range > 0
    ? Math.abs(candle.high - recentHigh) <= range || Math.abs(candle.low - recentLow) <= range
    : false;

  const profileCandles = candles.slice(Math.max(0, index - PROFILE_WINDOW), index);
  const recentProfile = buildRecentProfile(profileCandles, engine, bucketSize);
  const vaHigh = recentProfile?.vaHigh;
  const vaLow = recentProfile?.vaLow;
  const inValueArea = vaHigh !== undefined && vaLow !== undefined
    ? candle.close <= vaHigh && candle.close >= vaLow
    : containedInRange;
  const aboveValue = vaHigh !== undefined ? candle.close > vaHigh : brokeRecentHigh;
  const belowValue = vaLow !== undefined ? candle.close < vaLow : brokeRecentLow;

  const nextCandles = candles.slice(index + 1, index + 1 + FOLLOW_THROUGH_WINDOW);
  const followThrough = hasFollowThrough(candle, nextCandles, direction);
  const failedExtension = hasFailedExtension(candle, nextCandles, direction, vaHigh, vaLow);

  const balanceReasons: string[] = [];
  const initiativeReasons: string[] = [];
  const absorptionReasons: string[] = [];
  const exhaustionReasons: string[] = [];

  const balanceScore = scoreBalance(
    candle,
    currentDeltaRatio,
    currentVolumeRatio,
    bodyRatio,
    containedInRange,
    inValueArea,
    balanceReasons
  );

  const initiative = scoreInitiative(
    candle,
    direction,
    currentDeltaRatio,
    currentVolumeRatio,
    bodyRatio,
    closeLocation,
    brokeRecentHigh,
    brokeRecentLow,
    aboveValue,
    belowValue,
    followThrough,
    failedExtension,
    initiativeReasons
  );

  const absorption = scoreAbsorptionReversal(
    candle,
    absorptionMap.get(candle.time),
    nextCandles,
    nearRangeEdge,
    vaHigh,
    vaLow,
    absorptionReasons
  );

  const exhaustion = scoreExhaustionTransition(
    candle,
    exhaustionMap.get(candle.time),
    nextCandles,
    vaHigh,
    vaLow,
    exhaustionReasons
  );

  let state: AuctionShiftState = 'balanced';
  let confidence = balanceScore;
  let selectedDirection: AuctionShiftDirection = 'neutral';
  let reasons = balanceReasons;
  const initiativeState: AuctionShiftState = direction === 'selling' ? 'initiative_selling' : 'initiative_buying';

  type Candidate = {
    state: AuctionShiftState;
    score: number;
    direction: AuctionShiftDirection;
    reasons: string[];
  };

  const rawCandidates: Candidate[] = [
    {
      state: initiativeState,
      score: initiative.score,
      direction,
      reasons: initiativeReasons,
    },
    {
      state: 'absorption_reversal',
      score: absorption.score,
      direction: absorption.direction,
      reasons: absorptionReasons,
    },
    {
      state: 'exhaustion_transition',
      score: exhaustion.score,
      direction: exhaustion.direction,
      reasons: exhaustionReasons,
    },
  ];

  const candidates = rawCandidates.filter((candidate) => candidate.direction !== 'neutral');

  const top = candidates.sort((a, b) => b.score - a.score)[0];
  if (top && top.score >= Math.max(55, balanceScore + 8)) {
    state = top.state;
    confidence = top.score;
    selectedDirection = getStateDirection(state, top.direction);
    reasons = top.reasons;
  }

  const transition = priorState !== null && priorState !== state && confidence >= 50;

  return {
    candleTime: candle.time,
    state,
    priorState,
    direction: selectedDirection,
    confidence: Math.round(clamp(confidence, 0, 100)),
    provisional: !candle.isClosed,
    transition,
    reasons: reasons.slice(0, 5),
    signals: {
      balance: Math.round(balanceScore),
      initiative: Math.round(initiative.score),
      absorption: Math.round(absorption.score),
      exhaustion: Math.round(exhaustion.score),
      volumeExpansion: Math.round(initiative.volumeExpansion),
      acceptance: Math.round(initiative.acceptance),
      followThrough: Math.round(Math.max(initiative.followThroughScore, absorption.followThroughScore, exhaustion.followThroughScore)),
    },
  };
}

export function buildAuctionShiftMap(
  candles: Candle[],
  engine: AggregationEngine,
  absorptionMap: Map<number, AbsorptionResult>,
  exhaustionMap: Map<number, ExhaustionResult>,
  bucketSize: number
): Map<number, AuctionShiftResult> {
  const map = new Map<number, AuctionShiftResult>();
  let priorState: AuctionShiftState | null = null;

  for (let i = 0; i < candles.length; i++) {
    const result = scoreAuctionShiftAt(candles, i, engine, absorptionMap, exhaustionMap, bucketSize, priorState);
    if (!result) continue;
    map.set(candles[i].time, result);
    priorState = result.state;
  }

  return map;
}

export function scoreLatestAuctionShift(
  candles: Candle[],
  engine: AggregationEngine,
  absorptionMap: Map<number, AbsorptionResult>,
  exhaustionMap: Map<number, ExhaustionResult>,
  existingMap: Map<number, AuctionShiftResult>,
  bucketSize: number
): Map<number, AuctionShiftResult> {
  if (candles.length === 0) return existingMap;

  const newMap = new Map(existingMap);
  const startIndex = Math.max(0, candles.length - 3);
  let priorState: AuctionShiftState | null = null;

  if (startIndex > 0) {
    priorState = newMap.get(candles[startIndex - 1].time)?.state ?? null;
  }

  for (let i = startIndex; i < candles.length; i++) {
    const result = scoreAuctionShiftAt(candles, i, engine, absorptionMap, exhaustionMap, bucketSize, priorState);
    if (result) {
      newMap.set(candles[i].time, result);
      priorState = result.state;
    } else {
      newMap.delete(candles[i].time);
    }
  }

  return newMap;
}
