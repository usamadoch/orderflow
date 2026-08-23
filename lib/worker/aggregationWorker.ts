import { Trade } from '../../types/trade';
import { FootprintCandle, FootprintCell } from '../../types/footprint';
import { FineProfileRow } from '../../types/volumeProfile';
import { AggregationEngine } from '../aggregation/engine';
import { RawTradeVolumeProfileEngine } from '../volumeProfile/profileEngine';

export type AggregationWorkerRequest = 
  | { type: 'INIT', payload: { bucketSize: number, maxCandles?: number } }
  | { type: 'INGEST_TRADE_BATCH', payload: { trades: Trade[], currentCandleTime: number } }
  | { type: 'HYDRATE_FOOTPRINTS', payload: { time: number, cells: Array<[number, FootprintCell]> } }
  | { type: 'HYDRATE_PROFILE_ROWS', payload: { rows: FineProfileRow[] } };

export type AggregationWorkerResponse = 
  | { type: 'FOOTPRINT_UPDATE', payload: { footprints: FootprintCandle[] } }
  | { type: 'PROFILE_UPDATE', payload: { rows: FineProfileRow[] } };

let engine: AggregationEngine | null = null;
let profileEngine: RawTradeVolumeProfileEngine | null = null;

const pendingFootprints = new Map<number, FootprintCandle>();
const pendingProfileRows = new Map<string, FineProfileRow>();
let updateTimeout: ReturnType<typeof setTimeout> | null = null;

function scheduleUpdate() {
  if (updateTimeout) return;
  updateTimeout = setTimeout(() => {
    updateTimeout = null;
    
    if (pendingFootprints.size > 0) {
      postMessage({
        type: 'FOOTPRINT_UPDATE',
        payload: { footprints: Array.from(pendingFootprints.values()) }
      } as AggregationWorkerResponse);
      pendingFootprints.clear();
    }

    if (pendingProfileRows.size > 0) {
      postMessage({
        type: 'PROFILE_UPDATE',
        payload: { rows: Array.from(pendingProfileRows.values()) }
      } as AggregationWorkerResponse);
      pendingProfileRows.clear();
    }
  }, 100); // 10fps throttle
}

self.addEventListener('message', (e: MessageEvent<AggregationWorkerRequest>) => {
  const { type, payload } = e.data;

  try {
    if (type === 'INIT') {
      engine = new AggregationEngine(payload.bucketSize, payload.maxCandles || 500);
      profileEngine = new RawTradeVolumeProfileEngine();
    }
    
    else if (type === 'INGEST_TRADE_BATCH') {
      if (!engine || !profileEngine) return;
      
      const { trades, currentCandleTime } = payload;
      const affectedBaseTimes = new Set<number>();
      
      for (const trade of trades) {
        engine.ingestTrade(trade, currentCandleTime);
        profileEngine.ingestTrade(trade);
        
        // We need the 1m base candle time for profile rows
        const baseTime = Math.floor(trade.time / 60000) * 60;
        affectedBaseTimes.add(baseTime);
      }

      // Collect updated footprints
      const fp = engine.getBaseFootprintCandle(currentCandleTime);
      if (fp) pendingFootprints.set(fp.time, fp);

      // Collect updated profile rows
      const baseCache = profileEngine.getBaseCache();
      for (const time of affectedBaseTimes) {
        const rows = baseCache.getFineRowsInRange(time, time + 60);
        for (const { row } of rows) {
          pendingProfileRows.set(`${row.candleTime}:${row.baseBucketSize}:${row.bucketPrice}`, row);
        }
      }

      scheduleUpdate();
    }
    
    else if (type === 'HYDRATE_FOOTPRINTS') {
      if (!engine) return;
      
      const cellsMap = new Map(payload.cells);
      engine.hydrateBaseFootprintCandle(payload.time, cellsMap);
      
      const fp = engine.getBaseFootprintCandle(payload.time);
      if (fp) {
        pendingFootprints.set(fp.time, fp);
        scheduleUpdate();
      }
    }

    else if (type === 'HYDRATE_PROFILE_ROWS') {
      if (!profileEngine) return;
      profileEngine.hydrateProfileRows(payload.rows, 'restore');
      
      for (const row of payload.rows) {
        pendingProfileRows.set(`${row.candleTime}:${row.baseBucketSize}:${row.bucketPrice}`, row);
      }
      scheduleUpdate();
    }
  } catch (error) {
    console.error('[AggregationWorker] Error processing message:', error);
  }
});
