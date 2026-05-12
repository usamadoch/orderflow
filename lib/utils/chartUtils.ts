import { Candle } from '../../types/candle';
import { FootprintCandle } from '../../types/footprint';

export interface RollingAverages {
  avgAbsDelta: number;
  avgVolume: number;
  avgPriceMove: number;
}

/**
 * Computes rolling averages for a window of candles and footprints.
 * 
 * @param candles Array of candles in the window
 * @param footprints Array of matching footprint candles
 * @returns RollingAverages object
 */
export function getRollingAverages(
  candles: Candle[],
  footprints: (FootprintCandle | null)[]
): RollingAverages {
  let sumAbsDelta = 0;
  let sumVolume = 0;
  let sumPriceMove = 0;
  const count = candles.length;

  for (let i = 0; i < count; i++) {
    const fp = footprints[i];
    sumAbsDelta += fp ? Math.abs(fp.delta) : 0;
    sumVolume += candles[i].volume;
    sumPriceMove += Math.abs(candles[i].close - candles[i].open);
  }

  return {
    avgAbsDelta: count > 0 ? sumAbsDelta / count : 0,
    avgVolume: count > 0 ? sumVolume / count : 0,
    avgPriceMove: count > 0 ? sumPriceMove / count : 0,
  };
}
