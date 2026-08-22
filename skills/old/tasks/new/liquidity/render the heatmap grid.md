Implement Step 8: render the real orderbook heatmap grid across time and price.

Context:
The OrderbookHeatmapEngine data model and fixed-cadence snapshot collection are already implemented. It should now contain rolling time-based columns with bucketed bid/ask liquidity.

Goal:
Render those heatmap columns on the chart as a true time × price orderbook heatmap, similar in concept to Bookmap/TapeSurf-style liquidity heatmap.

Expected visual behavior:
- X-axis = snapshot time.
- Y-axis = price bucket.
- Each cell = liquidity at that price bucket during that sampled time column.
- Color intensity = liquidity size.
- Bid-side liquidity should use teal/green tones.
- Ask-side liquidity should use red/orange tones.
- If both bid and ask exist in same bucket, use a neutral/amber/mixed tone.
- Draw only cells inside the visible chart time range and visible price range.
- Clip heatmap drawing to the chart plot area.
- Render heatmap behind candles/footprint, not on top of price bars.
- Keep current candles/footprint readable.

Important:
- This should use the new OrderbookHeatmapEngine data.
- Do not use the old right-side Liquidity Summary strip as the heatmap.
- Do not remove the existing Liquidity Summary yet unless needed.
- Do not change depth source adapters.
- Do not change MongoDB/storage.
- Do not change footprint/profile/candle calculations.
- Do not add persistence for heatmap data.
- Keep heatmap session-memory only for now.

Rendering requirements:
- Map each heatmap column timestamp to chart x-coordinate using existing time/index coordinate logic.
- Map each bucket price to y-coordinate using existing priceToY logic.
- Cell width should be based on sample interval and chart scale.
- Cell height should be based on bucket size and price scale.
- Skip cells that are too small or fully offscreen.
- Use alpha/intensity scaling so large liquidity is visible but not overwhelming.
- Use robust normalization, preferably log or percentile-style scaling, so one huge order does not make everything else invisible.
- Optional: draw quantity labels only when cells are large enough and liquidity is above a strong threshold.

Performance:
- Render visible columns only.
- Render visible price buckets only.
- Avoid allocating huge arrays every redraw.
- Keep drawing fast enough for live use.
- Add metrics if simple:
  - heatmap cells drawn
  - heatmap columns visible
  - heatmap draw duration
  - heatmap skipped/offscreen cells

Settings:
Use existing liquidity/heatmap settings if already present. If needed, add minimal settings:
- enable/disable real heatmap
- opacity
- show labels
- max lookback/window if not already available
- intensity mode if simple

Validation:
- Open chart with heatmap enabled.
- Let it run for 1–2 minutes.
- Confirm heatmap cells begin drawing from the time the app is open.
- Confirm cells align with candle time on x-axis.
- Confirm cells align with price levels on y-axis.
- Pan/zoom and confirm heatmap stays aligned.
- Switch depth source and confirm old heatmap clears.
- Switch symbol/contract and confirm heatmap resets.
- Confirm candles/footprint remain readable.
- Confirm no huge performance drop.

Output:
1. Explain what changed.
2. List files modified.
3. Confirm real time × price heatmap cells are rendered.
4. Confirm old Liquidity Summary is not being confused with the real heatmap.
5. Confirm heatmap resets on source/symbol/contract changes.
6. Confirm performance safeguards.
7. Mention remaining limitations.