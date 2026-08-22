import { AbsorptionResult } from '../../types/absorption';
import { ExhaustionResult } from '../../types/exhaustion';
import { IcebergLevel } from '../../types/iceberg';
import { LiquidityVacuumZone } from '../../types/liquidityVacuum';
import { FootprintCandle } from '../../types/footprint';
import { Candle } from '../../types/candle';

import { detectAbsorption } from '../absorption/engine';
import { scoreCandle as scoreAbsorptionCandle } from '../absorption/absorptionScorer';
import { detectExhaustion } from '../exhaustion/engine';
import { scoreExhaustionCandle } from '../exhaustion/exhaustionScorer';
import { IcebergEngine } from '../iceberg/engine';
import { buildLiquidityVacuumZones } from '../liquidityVacuum/engine';
import type { AggregationEngine } from '../aggregation/engine';

// Fake aggregation engine to provide footprint candles to signal engines
class FakeAggregationEngine {
  private footprintMap: Map<number, FootprintCandle>;

  constructor(footprints: FootprintCandle[]) {
    this.footprintMap = new Map();
    for (const fp of footprints) {
      if (fp) {
        this.footprintMap.set(fp.time, fp);
      }
    }
  }

  getFootprintCandle(time: number): FootprintCandle | null {
    return this.footprintMap.get(time) || null;
  }
}

export type ComputeSignalsRequest = {
  type: 'COMPUTE_SIGNALS';
  id: string;
  payload: {
    panelId: string;
    candles: Candle[];
    footprints: FootprintCandle[];
    bucketSize: number;
    
    absorptionEnabled: boolean;
    
    exhaustionEnabled: boolean;
    exhaustionLookback: number;
    
    icebergEnabled: boolean;
    icebergMinScore: number;
    icebergLookback: number;
    
    liquidityVacuumEnabled: boolean;
    liquidityVacuumMinScore: number;
    liquidityVacuumMaxZones: number;
  }
};

export type ScoreLiveRequest = {
  type: 'SCORE_LIVE';
  id: string;
  payload: {
    panelId: string;
    candles: Candle[];
    footprints: FootprintCandle[];
    bucketSize: number;
    
    absorptionEnabled: boolean;
    absorptionMap: Map<number, AbsorptionResult>;
    
    exhaustionEnabled: boolean;
    exhaustionLookback: number;
    exhaustionMap: Map<number, ExhaustionResult>;
    
    liquidityVacuumEnabled: boolean;
    liquidityVacuumMinScore: number;
    liquidityVacuumMaxZones: number;
  }
};

export type SignalWorkerMessage = ComputeSignalsRequest | ScoreLiveRequest;

export type ComputeSignalsResponse = {
  type: 'COMPUTE_SIGNALS_RESULT';
  id: string;
  payload: {
    absorptionMap: Map<number, AbsorptionResult>;
    exhaustionMap: Map<number, ExhaustionResult>;
    icebergLevels: IcebergLevel[];
    liquidityVacuumZones: LiquidityVacuumZone[];
  }
};

export type ScoreLiveResponse = {
  type: 'SCORE_LIVE_RESULT';
  id: string;
  payload: {
    absorptionMap: Map<number, AbsorptionResult>;
    exhaustionMap: Map<number, ExhaustionResult>;
    liquidityVacuumZones: LiquidityVacuumZone[];
  }
};

const icebergEngines = new Map<string, IcebergEngine>();

self.addEventListener('message', (event: MessageEvent<SignalWorkerMessage>) => {
  const { type, id, payload } = event.data;

  try {
    if (type === 'COMPUTE_SIGNALS') {
      const engine = new FakeAggregationEngine(payload.footprints) as unknown as AggregationEngine;
      
      let absorptionMap = new Map<number, AbsorptionResult>();
      if (payload.absorptionEnabled) {
        absorptionMap = detectAbsorption(payload.candles, engine);
      }

      let exhaustionMap = new Map<number, ExhaustionResult>();
      if (payload.exhaustionEnabled) {
        exhaustionMap = detectExhaustion(payload.candles, engine, absorptionMap, payload.exhaustionLookback);
      }

      let icebergLevels: IcebergLevel[] = [];
      if (payload.icebergEnabled) {
        let icebergEngine = icebergEngines.get(payload.panelId);
        if (!icebergEngine) {
          icebergEngine = new IcebergEngine(payload.bucketSize, payload.icebergLookback);
          icebergEngines.set(payload.panelId, icebergEngine);
        } else {
          icebergEngine.setBucketSize(payload.bucketSize);
          icebergEngine.setLookbackWindow(payload.icebergLookback);
        }
        icebergLevels = icebergEngine.update(payload.candles, engine)
          .filter(level => level.score >= payload.icebergMinScore)
          .slice(0, 20);
      }

      let liquidityVacuumZones: LiquidityVacuumZone[] = [];
      if (payload.liquidityVacuumEnabled) {
        liquidityVacuumZones = buildLiquidityVacuumZones(payload.candles, engine, payload.bucketSize, {
          minScore: payload.liquidityVacuumMinScore,
          maxZones: payload.liquidityVacuumMaxZones
        });
      }

      self.postMessage({
        type: 'COMPUTE_SIGNALS_RESULT',
        id,
        payload: {
          absorptionMap,
          exhaustionMap,
          icebergLevels,
          liquidityVacuumZones
        }
      } as ComputeSignalsResponse);
    } 
    else if (type === 'SCORE_LIVE') {
      const engine = new FakeAggregationEngine(payload.footprints) as unknown as AggregationEngine;
      const candles = payload.candles;
      
      let absorptionMap = payload.absorptionMap;
      let exhaustionMap = payload.exhaustionMap;
      let liquidityVacuumZones: LiquidityVacuumZone[] = [];

      if (candles.length > 0) {
        const lastCandle = candles[candles.length - 1];
        if (!lastCandle.isClosed) {
          if (payload.absorptionEnabled) {
            const windowStart = Math.max(0, candles.length - 1 - 20);
            const recentCandles = candles.slice(windowStart, candles.length - 1);
            const recentFootprints = recentCandles.map(c => engine.getFootprintCandle(c.time));
            const footprint = engine.getFootprintCandle(lastCandle.time);
            
            const result = scoreAbsorptionCandle(lastCandle, footprint, recentCandles, recentFootprints);
            if (result) {
              absorptionMap = new Map(payload.absorptionMap);
              absorptionMap.set(lastCandle.time, result);
            }
          }

          if (payload.exhaustionEnabled) {
            const windowStart = Math.max(0, candles.length - 1 - payload.exhaustionLookback);
            const recentCandles = candles.slice(windowStart, candles.length - 1);
            const recentFootprints = recentCandles.map(c => engine.getFootprintCandle(c.time));
            const footprint = engine.getFootprintCandle(lastCandle.time);
            
            const result = scoreExhaustionCandle(lastCandle, footprint, recentCandles, recentFootprints, []);
            if (result) {
              exhaustionMap = new Map(payload.exhaustionMap);
              exhaustionMap.set(lastCandle.time, result);
            }
          }
          
          if (payload.liquidityVacuumEnabled) {
            liquidityVacuumZones = buildLiquidityVacuumZones(payload.candles, engine, payload.bucketSize, {
              minScore: payload.liquidityVacuumMinScore,
              maxZones: payload.liquidityVacuumMaxZones
            });
          }
        }
      }

      self.postMessage({
        type: 'SCORE_LIVE_RESULT',
        id,
        payload: {
          absorptionMap,
          exhaustionMap,
          liquidityVacuumZones
        }
      } as ScoreLiveResponse);
    }
  } catch (error) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
