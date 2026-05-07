import { useEffect, useRef, RefObject } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CrosshairMode, CandlestickSeries } from 'lightweight-charts';

export function useChartInit(containerRef: RefObject<HTMLDivElement | null>) {
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0D0D0D' },
        textColor: '#8A8A8A',
      },
      grid: {
        vertLines: { color: '#1F1F1F' },
        horzLines: { color: '#1F1F1F' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        borderColor: '#1F1F1F',
      },
      rightPriceScale: {
        borderColor: '#1F1F1F',
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26A69A',
      downColor: '#EF5350',
      borderVisible: false,
      wickUpColor: '#26A69A',
      wickDownColor: '#EF5350',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [containerRef]);

  return { chartRef, seriesRef };
}
