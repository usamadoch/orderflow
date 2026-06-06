Fix heatmap asset-quantity labels not showing.

Context:
We already tried to add labels to the real orderbook heatmap, but no labels are visible on the chart. The heatmap itself renders correctly, but the quantity labels do not show up.

Goal:
Find why heatmap labels are not visible, then implement the smallest fix so labels appear on strong/readable heatmap cells.

Important:
- Labels must show asset quantity, not USD/notional.
- For BTCUSDT, show BTC quantity.
- For ETHUSDT, show ETH quantity.
- Do not claim this is “order count”; public depth is aggregated by price.
- Do not change depth adapters, MongoDB, storage, footprint, volume profile, or candle logic.
- This is only heatmap label rendering/debugging.

First audit/check:
1. Is the label setting actually enabled and passed into the heatmap renderer?
2. Does each heatmap cell contain quantity fields needed for labels?
3. Are labels skipped because cell width/height threshold is too strict?
4. Are labels skipped because liquidity threshold is too high?
5. Are labels drawn but hidden behind candles/heatmap due to draw order, alpha, clipping, or text color?
6. Are labels being clipped outside chart plot area?
7. Are labels using wrong coordinates after time/price mapping?
8. Are labels only enabled for the old liquidity summary instead of the real heatmap grid?

Fix requirements:
- Draw labels on top of heatmap cells but below/without ruining candle readability.
- Use compact asset-quantity format:
  - 0.8
  - 3.5
  - 12.4
  - 150
  - 1.2K only if very large
- Label mode:
  - Total quantity
  - Total + max level if max-level data exists
- Example:
  - `42.7`
  - `42.7 / 13.4`
- Total = total asset quantity in that heatmap cell/bucket.
- Max = largest single price-level quantity inside that bucket, if available.
- If max-level data is not currently tracked, implement total-only first and clearly mention that max-level needs engine support.

Visibility rules:
- Labels should appear only on strong cells.
- Labels should appear only when cell pixel width/height is enough.
- But make thresholds reasonable so labels actually show when zoomed in.
- Add temporary/debug metrics:
  - label setting enabled
  - label candidates
  - labels drawn
  - labels skipped by size
  - labels skipped by threshold
  - labels skipped by missing quantity

Validation:
- Enable heatmap labels.
- Zoom in enough so cells are readable.
- Confirm labels appear on strong heatmap cells.
- Confirm labels show asset quantity, not dollar value.
- Confirm disabling labels hides them.
- Confirm no chart/data behavior changed.

Output:
1. Explain why labels were not showing.
2. Explain what changed.
3. Confirm labels use asset quantity only.
4. Confirm labels draw on the real heatmap grid, not only the right-side liquidity summary.
5. Confirm label debug metrics were added or explain why not.
6. Mention any remaining limitation.