import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterEvents, getClusterSizingValue } from '../../components/chart/drawBubbles';
import { useChartStore } from '../../lib/store/chart';
import type { BubbleEvent } from '../../types/bubble';
import type { Candle } from '../../types/candle';

// Helper to create test candles
function createTestCandles(): Candle[] {
  return [
    {
      time: 1000,
      open: 50000,
      high: 50100,
      low: 49950,
      close: 50050,
      volume: 50,
      isClosed: true,
    },
    {
      time: 1060,
      open: 50050,
      high: 50200,
      low: 50000,
      close: 50150,
      volume: 80,
      isClosed: true,
    },
  ];
}

// Helper to create test events
function createEvent(overrides: Partial<BubbleEvent> = {}): BubbleEvent {
  return {
    time: 1010,
    price: 50000,
    side: 'buy',
    volume: 10,
    tradeCount: 5,
    source: 'aggregateTrade',
    symbol: 'BTCUSDT',
    contractType: 'spot',
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Time Grouping Tests
// ─────────────────────────────────────────────────────────────────────────────

test('Time Mode: groups trades within bubbleTimeWindowMs burst window', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010.0, price: 50000, volume: 10, side: 'buy' }),
    createEvent({ time: 1010.1, price: 50002, volume: 15, side: 'buy' }), // +100ms
    createEvent({ time: 1010.2, price: 50001, volume: 20, side: 'buy' }), // +200ms
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'time',
      bubbleTimeWindowMs: 250,
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 1, 'All 3 trades within 200ms must merge into 1 cluster');
  assert.strictEqual(clusters[0].volume, 45, 'Total volume must equal 10 + 15 + 20');
  assert.strictEqual(clusters[0].buyVolume, 45);
  // Volume weighted price: (50000*10 + 50002*15 + 50001*20) / 45 = 2250050 / 45 ≈ 50001.111
  assert.ok(Math.abs(clusters[0].price - 50001.111) < 0.01, 'Price must be volume-weighted');
});

test('Time Mode: separates trades outside bubbleTimeWindowMs', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010.0, price: 50000, volume: 10, side: 'buy' }),
    createEvent({ time: 1010.8, price: 50000, volume: 15, side: 'buy' }), // +800ms > 250ms
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'time',
      bubbleTimeWindowMs: 250,
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 2, 'Trades 800ms apart must form 2 distinct clusters');
});

test('Time Mode in Ask/Bid Split: keeps buy and sell clusters separate', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010.05, price: 50000, volume: 25, side: 'buy' }),
    createEvent({ time: 1010.08, price: 50000, volume: 15, side: 'sell' }),
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'time',
      bubbleColorMode: 'askBidSplit',
      bubbleTimeWindowMs: 250,
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 2, 'Ask and Bid trades must remain separate bubbles in askBidSplit mode');
  const buyCluster = clusters.find(c => c.side === 'buy');
  const sellCluster = clusters.find(c => c.side === 'sell');
  assert.ok(buyCluster && buyCluster.volume === 25);
  assert.ok(sellCluster && sellCluster.volume === 15);
});

test('Time Mode in Delta: merges buy and sell clusters with net delta', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010.05, price: 50000, volume: 40, side: 'buy' }),
    createEvent({ time: 1010.08, price: 50000, volume: 15, side: 'sell' }),
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'time',
      bubbleColorMode: 'delta',
      bubbleTimeWindowMs: 250,
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 1, 'Opposite sides must merge into 1 cluster in delta mode');
  const sizing = getClusterSizingValue(clusters[0], 'volume', 'delta');
  assert.strictEqual(sizing.delta, 25, 'Net delta must be 40 - 15 = 25');
  assert.strictEqual(sizing.side, 'buy');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Price Grouping Tests
// ─────────────────────────────────────────────────────────────────────────────

test('Price Mode: merges trades across large time differences in same candle at same price bucket', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1005, price: 50000, volume: 20, side: 'buy' }), // second 5
    createEvent({ time: 1050, price: 50005, volume: 30, side: 'buy' }), // second 50 (>40 seconds later!)
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'price',
      bubblePriceAggrMode: 'extension',
      bubbleTickGroupingMode: 'fixed',
      bubbleTickCount: 2, // 2 * 10 = 20 price bucket
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 1, 'Trades within the same candle and price bucket must merge in Price mode');
  assert.strictEqual(clusters[0].volume, 50);
});

test('Price Mode: separates trades belonging to different candles', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010, price: 50000, volume: 20, side: 'buy' }), // Candle 0 (time 1000..1059)
    createEvent({ time: 1070, price: 50000, volume: 30, side: 'buy' }), // Candle 1 (time 1060..1119)
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'price',
      bubblePriceAggrMode: 'extension',
      bubbleTickGroupingMode: 'fixed',
      bubbleTickCount: 3,
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 2, 'Trades in different candles must never merge');
});

test('Price Mode: Extension mode expands cluster boundaries within tick size', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010, price: 50000, volume: 10, side: 'buy' }),
    createEvent({ time: 1015, price: 50008, volume: 15, side: 'buy' }), // within 20 price bucket
    createEvent({ time: 1020, price: 50016, volume: 20, side: 'buy' }), // within 20 price bucket
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'price',
      bubblePriceAggrMode: 'extension',
      bubbleTickGroupingMode: 'fixed',
      bubbleTickCount: 2, // 20 tick window
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 1, 'Cluster must incrementally expand boundaries within tick bucket span');
  assert.strictEqual(clusters[0].volume, 45);
  assert.strictEqual(clusters[0].minPrice, 50000);
  assert.strictEqual(clusters[0].maxPrice, 50016);
});

test('Price Mode: prevents snowballing by splitting into separate clusters when price extends beyond bucket span', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010, price: 50000, volume: 10, side: 'buy' }),
    createEvent({ time: 1015, price: 50015, volume: 15, side: 'buy' }), // within 20 price bucket of 50000
    createEvent({ time: 1020, price: 50030, volume: 20, side: 'buy' }), // 50030 - 50000 = 30 > 20 bucket span -> must split!
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'price',
      bubblePriceAggrMode: 'extension',
      bubbleTickGroupingMode: 'fixed',
      bubbleTickCount: 2, // 20 tick window
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 2, 'Trades exceeding price bucket span must split into distinct clusters');
  assert.strictEqual(clusters[0].volume, 25);
  assert.strictEqual(clusters[1].volume, 20);
});

test('Price Mode: Extension+Retracement absorbs opposing side trades and flips net delta', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010, price: 50000, volume: 20, side: 'buy' }),
    createEvent({ time: 1015, price: 50005, volume: 50, side: 'sell' }), // heavier sell at same level
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'price',
      bubbleColorMode: 'askBidSplit', // Even in askBidSplit!
      bubblePriceAggrMode: 'extensionRetracement',
      bubbleTickGroupingMode: 'fixed',
      bubbleTickCount: 2,
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 1, 'extensionRetracement must absorb opposing trades at price zone');
  assert.strictEqual(clusters[0].volume, 70);
  assert.strictEqual(clusters[0].buyVolume, 20);
  assert.strictEqual(clusters[0].sellVolume, 50);
  assert.strictEqual(clusters[0].side, 'sell', 'Cluster side must flip to sell because sellVolume (50) > buyVolume (20)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Automatic Grouping Tests
// ─────────────────────────────────────────────────────────────────────────────

test('Automatic Mode: switches to price grouping on wide bars (barWidth >= 8)', () => {
  const candles = createTestCandles();
  // Two trades 40 seconds apart in same candle at same price
  const events: BubbleEvent[] = [
    createEvent({ time: 1005, price: 50000, volume: 20, side: 'buy' }),
    createEvent({ time: 1045, price: 50002, volume: 30, side: 'buy' }),
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16, // barWidth = 16 >= 8 -> price mode
    {
      bubbleGroupingMode: 'automatic',
      bubblePriceAggrMode: 'extension',
      bubbleTickGroupingMode: 'automatic',
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 1, 'Automatic mode on barWidth >= 8 must group by price bucket');
  assert.strictEqual(clusters[0].volume, 50);
});

test('Automatic Mode: falls back to time burst window on narrow bars (barWidth < 8)', () => {
  const candles = createTestCandles();
  // Two trades 40 seconds apart in same candle
  const events: BubbleEvent[] = [
    createEvent({ time: 1005, price: 50000, volume: 20, side: 'buy' }),
    createEvent({ time: 1045, price: 50002, volume: 30, side: 'buy' }),
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    6, // barWidth = 6 < 8 -> falls back to time mode (250ms window)
    {
      bubbleGroupingMode: 'automatic',
      bubbleTimeWindowMs: 250,
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 2, 'Automatic mode on barWidth < 8 must fall back to time burst window');
});

test('Zoom Stability: changing barWidth preserves exact cluster counts and coordinates in Price mode', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010, price: 50000, volume: 10, side: 'buy' }),
    createEvent({ time: 1015, price: 50010, volume: 15, side: 'buy' }),
    createEvent({ time: 1020, price: 50040, volume: 20, side: 'buy' }),
  ];

  const commonSettings = {
    bubbleGroupingMode: 'price' as const,
    bubblePriceAggrMode: 'extension' as const,
    bubbleTickGroupingMode: 'automatic' as const,
    bubbleThreshold: 1,
    bubbleFilterRender: 2,
    bubbleStdDevVal: 2,
    bubbleOutStdDevPerc: 5,
    bubbleSide: 'both' as const,
    bucketSize: 10,
  };

  const clustersZoomedIn = clusterEvents(events, candles, 0, 1, 40, commonSettings);
  const clustersZoomedOut = clusterEvents(events, candles, 0, 1, 10, commonSettings);

  assert.strictEqual(clustersZoomedIn.length, clustersZoomedOut.length, 'Zooming must not change number of price clusters');
  assert.strictEqual(clustersZoomedIn[0].price, clustersZoomedOut[0].price, 'Zooming must not shift cluster price');
  assert.strictEqual(clustersZoomedIn[1].price, clustersZoomedOut[1].price, 'Zooming must not shift cluster price');
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Sizing & Side Filtering
// ─────────────────────────────────────────────────────────────────────────────

test('Sizing by Orders: trade counts and fallback handling', () => {
  const candles = createTestCandles();
  const events: BubbleEvent[] = [
    createEvent({ time: 1010, price: 50000, volume: 10, tradeCount: 12 }),
    createEvent({ time: 1010.1, price: 50000, volume: 15, tradeCount: 8 }),
  ];

  const clusters = clusterEvents(
    events,
    candles,
    0,
    1,
    16,
    {
      bubbleGroupingMode: 'time',
      bubbleSizeBy: 'orders',
      bubbleTimeWindowMs: 250,
      bubbleThreshold: 1,
      bubbleFilterRender: 2,
      bubbleStdDevVal: 2,
      bubbleOutStdDevPerc: 5,
      bubbleSide: 'both',
      bucketSize: 10,
    }
  );

  assert.strictEqual(clusters.length, 1);
  assert.strictEqual(clusters[0].tradeCount, 20, '12 orders + 8 orders = 20 orders');
  const sizing = getClusterSizingValue(clusters[0], 'orders', 'askBidSplit');
  assert.strictEqual(sizing.value, 20);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Store & Persistence Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test('ChartStore: defaults contain all Tier 4 grouping fields', () => {
  const state = useChartStore.getState();
  const leftPanel = state.panels.left;

  assert.strictEqual(leftPanel.bubbleGroupingMode, 'automatic');
  assert.strictEqual(leftPanel.bubblePriceAggrMode, 'extension');
  assert.strictEqual(leftPanel.bubbleTickGroupingMode, 'automatic');
  assert.strictEqual(leftPanel.bubbleTickCount, 3);
  assert.strictEqual(leftPanel.bubbleTimeWindowMs, 250);
});

test('ChartStore: setters update panel state and timeframe settings', () => {
  const store = useChartStore.getState();

  store.setBubbleGroupingMode('left', 'price');
  store.setBubblePriceAggrMode('left', 'extensionRetracement');
  store.setBubbleTickGroupingMode('left', 'fixed');
  store.setBubbleTickCount('left', 8);
  store.setBubbleTimeWindowMs('left', 500);

  const updated = useChartStore.getState().panels.left;
  assert.strictEqual(updated.bubbleGroupingMode, 'price');
  assert.strictEqual(updated.bubblePriceAggrMode, 'extensionRetracement');
  assert.strictEqual(updated.bubbleTickGroupingMode, 'fixed');
  assert.strictEqual(updated.bubbleTickCount, 8);
  assert.strictEqual(updated.bubbleTimeWindowMs, 500);

  // Per-timeframe settings must also record updates
  const tf = updated.timeframe;
  const tfSettings = updated.settingsByTimeframe[tf];
  assert.ok(tfSettings, 'Settings for current timeframe must be recorded');
  assert.strictEqual(tfSettings.bubbleGroupingMode, 'price');
  assert.strictEqual(tfSettings.bubblePriceAggrMode, 'extensionRetracement');
  assert.strictEqual(tfSettings.bubbleTickGroupingMode, 'fixed');
  assert.strictEqual(tfSettings.bubbleTickCount, 8);
  assert.strictEqual(tfSettings.bubbleTimeWindowMs, 500);
});
