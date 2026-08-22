Implement the next liquidity step: real OrderbookHeatmapEngine data model and fixed-cadence snapshot collection.

Context:
Depth source infrastructure is now done:
- Binance spot/futures depth works
- Bybit depth works
- Combined depth works
- Current liquidity summary/right-side ladder still exists
- Real time × price heatmap rendering is not implemented yet

Goal:
Add a real orderbook heatmap engine that collects rolling time-based orderbook snapshots from the active depth source.

This task is data/engine only. Do not replace the renderer yet.

Implement:

1. OrderbookHeatmapEngine

Create a new engine responsible for storing rolling heatmap columns.

Data model:
- each column represents one sampled timestamp
- each column contains price buckets
- each price bucket contains:
  - price/bucketPrice
  - bid quantity
  - ask quantity
  - total quantity
  - side: bid / ask / both
  - optional notional value
  - timestamp

2. Fixed-cadence sampling

Sample the current local orderbook on a fixed interval, not candle close.

Suggested default:
- 500ms or 1000ms snapshot interval

The sampling should:
- use the currently selected depth source/orderbook
- bucket price levels by configured liquidity bucket size
- focus on visible/near-price range or configurable max distance from current price
- keep a capped rolling window, for example last 5–15 minutes or max N columns

3. Source awareness

Heatmap engine should reset/clear when:
- symbol changes
- contract type changes
- depth source changes
- combined/source mode changes
- bucket size changes if needed

4. Metrics/debug

Expose debug metrics through existing market debug snapshot if simple:
- heatmap column count
- bucket count
- sample interval
- last sample time
- source key
- current visible/near-price range
- memory estimate

5. Keep existing visuals unchanged

Do not yet replace:
- current liquidity summary
- right-side ladder/profile
- existing liquidity zones

Do not change:
- MongoDB/storage
- footprint/profile/candles
- trade feeds
- chart visuals
- current liquidity rendering

Validation:
- Open chart and confirm heatmap engine starts collecting columns.
- Wait 1–2 minutes and confirm column count grows.
- Switch depth source and confirm old heatmap columns clear.
- Switch symbol/contract and confirm reset.
- Confirm memory stays capped.
- Confirm existing liquidity overlay still works.

Output:
1. Explain what changed.
2. List files modified.
3. Confirm heatmap engine collects rolling time × price snapshots.
4. Confirm fixed-cadence sampling works.
5. Confirm source/bucket changes reset the engine.
6. Confirm no renderer replacement happened yet.
7. Mention next step: render heatmap cells across chart.