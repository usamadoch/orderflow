import { useEffect, useRef, useState } from 'react';
import { useChartStore } from '@/lib/store/chart';
import { useChartRuntimeStore } from '@/lib/store/chartRuntime';
import { PanelId } from '@/types/chart';
import { getSharedCandleCache, CandleCacheSnapshot } from '@/lib/feeds/candleCache';
import { getVwapAnchorTime, VwapCalculateOptions } from '@/lib/utils/vwap';
import { Candle } from '@/types/candle';

export function useVwapHydration(panelId: PanelId) {
  const panel = useChartStore((state) => state.panels[panelId]);
  const displayCandles = useChartRuntimeStore((state) => state.panels[panelId]?.candles ?? []);
  const vwapEnabled = panel.vwapEnabled;
  const pair = panel.pair;
  const contractType = panel.contractType;

  const [base1mCandles, setBase1mCandles] = useState<Candle[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);

  const optionsRef = useRef<VwapCalculateOptions>({
    periodMode: panel.vwapPeriodMode,
    sessionAnchor: panel.vwapSessionAnchor,
    rollingDays: panel.vwapRollingDays,
    priceSource: panel.vwapPriceSource,
    envelopeMode: panel.vwapEnvelopeMode,
    band1Enabled: panel.vwapBand1Enabled,
    band1Value: panel.vwapBand1Value,
    band2Enabled: panel.vwapBand2Enabled,
    band2Value: panel.vwapBand2Value,
    band3Enabled: panel.vwapBand3Enabled,
    band3Value: panel.vwapBand3Value,
  });

  // Keep options ref updated so we don't spam effects
  optionsRef.current = {
    periodMode: panel.vwapPeriodMode,
    sessionAnchor: panel.vwapSessionAnchor,
    rollingDays: panel.vwapRollingDays,
    priceSource: panel.vwapPriceSource,
    envelopeMode: panel.vwapEnvelopeMode,
    band1Enabled: panel.vwapBand1Enabled,
    band1Value: panel.vwapBand1Value,
    band2Enabled: panel.vwapBand2Enabled,
    band2Value: panel.vwapBand2Value,
    band3Enabled: panel.vwapBand3Enabled,
    band3Value: panel.vwapBand3Value,
  };

  const firstDisplayTime = displayCandles[0]?.time;
  const lastDisplayTime = displayCandles[displayCandles.length - 1]?.time;

  useEffect(() => {
    if (!vwapEnabled || !firstDisplayTime || !lastDisplayTime) {
      if (!vwapEnabled) {
        setBase1mCandles([]);
        setIsHydrating(false);
      }
      return;
    }

    const options = optionsRef.current;
    const requiredAnchorTime = getVwapAnchorTime(firstDisplayTime, options);

    const cache = getSharedCandleCache({
      symbol: pair,
      contractType,
      timeframe: '1m',
    });

    const unsubscribe = cache.subscribe((snapshot: CandleCacheSnapshot) => {
      if (snapshot.candles.length > 0 && snapshot.candles[0].time <= firstDisplayTime) {
        setBase1mCandles(snapshot.candles);
      } else if (snapshot.candles.length === 0) {
        setBase1mCandles([]);
      }
    });

    // Check if we need to hydrate
    const snapshot = cache.getSnapshot();
    const hasEnoughData = snapshot.candles.length > 0 && snapshot.candles[0].time <= requiredAnchorTime;

    if (!hasEnoughData) {
      setIsHydrating(true);
      // Fetch missing history
      void cache.restoreHistory(async () => {
        try {
          const params = new URLSearchParams({
            symbol: pair,
            contractType,
            timeframe: '1m',
            since: String(requiredAnchorTime),
            until: String(lastDisplayTime + 60), // buffer
            limit: '50000', // ensure enough limit to cover up to 30 days of 1m candles
          });
          const response = await fetch(`/api/history/candles?${params.toString()}`);

          if (!response.ok) {
            console.warn(`[VWAP Hydration] API returned ${response.status}`);
            return {
              candles: [],
              source: 'none',
              storedCandles: 0,
              binanceCandles: 0,
            };
          }

          const fetchedCandles = (await response.json()) as Candle[];
          return {
            candles: fetchedCandles,
            source: 'stored',
            storedCandles: fetchedCandles.length,
            binanceCandles: 0,
          };
        } catch (err) {
          console.warn('[VWAP Hydration] failed to fetch 1m candles', err);
          return {
            candles: [],
            source: 'none',
            storedCandles: 0,
            binanceCandles: 0,
          };
        }
      }).finally(() => {
        setIsHydrating(false);
      });
    } else {
      setIsHydrating(false);
    }

    return () => {
      unsubscribe();
    };
  }, [
    vwapEnabled,
    pair,
    contractType,
    firstDisplayTime,
    lastDisplayTime,
    panel.vwapPeriodMode,
    panel.vwapSessionAnchor,
    panel.vwapRollingDays,
  ]);

  return { base1mCandles, isHydrating };
}
