Refine the real orderbook heatmap rendering and labels.

Current state:
The real time × price heatmap is working, and labels are being drawn, but the final visual behavior still needs refinement.

Problems:
1. Labels are not properly anchored during vertical pan/scale.
   - When I move the chart vertically, the heatmap cells move, but some labels feel like they stay/floating in screen space.
   - The label value may update, but the label position is not following the exact cell/bar rectangle.

2. Labels become gibberish when zoomed out.
   - Too many labels appear.
   - Labels overlap.
   - Labels should hide or merge when cells are too small.

3. Heatmap colors do not communicate liquidity strength well.
   - Current colors mostly look like red/green with opacity.
   - Large liquidity values do not visually stand out enough.
   - I want a more Bookmap-style intensity scale where high liquidity becomes orange/yellow/bright.

Goal:
Keep the current heatmap system, but improve visual correctness and readability.

Fix 1: Anchor labels to final rendered geometry
- Labels must be drawn using the same final cell/bar rectangle used to draw the heatmap.
- Do not calculate label y-position separately from raw price if that causes mismatch.
- If the heatmap cell moves due to vertical pan/zoom, the label must move with it exactly.
- Labels should be clipped to the chart plot area.

Fix 2: Zoom-aware label visibility
- Do not draw labels when cells are too small.
- Do not draw overlapping labels.
- When zoomed out, show only strongest labels or hide labels completely.
- When cells visually merge/group, show one summed label for the grouped visible area.
- When zoomed in, allow individual readable labels.
- Label values must be asset quantity only, not USD.
- Do not call it order count.

Fix 3: Bookmap-style intensity color scale
- Keep bid/ask side information, but add better intensity coloring.
- Low liquidity should be subtle/dark.
- Medium liquidity should be clearer.
- High liquidity should become orange/amber.
- Extreme liquidity should become bright yellow/strong amber.
- Big values like 24K, 65K, 85K should clearly pop compared to small values like 2, 10, 100, 300.
- Use robust scaling such as log/percentile normalization so one huge level does not flatten everything else.

Suggested color direction:
- Very low: nearly transparent
- Low bid: dark teal
- Low ask: dark red
- Medium: stronger teal/red
- High: orange/amber
- Extreme: yellow/bright amber

Important:
- Do not rebuild the heatmap engine.
- Do not change depth adapters.
- Do not change orderbook sync.
- Do not change MongoDB/storage.
- Do not change candles, footprint, volume profile, or trade logic.
- This is heatmap rendering and label refinement only.

Validation:
- Vertical pan/scale: labels must move exactly with the cells.
- Horizontal pan/zoom: labels must stay aligned with heatmap time columns.
- Zoomed out: labels should not become unreadable/gibberish.
- Zoomed in: readable labels should appear.
- Large liquidity values should visually stand out with stronger color.
- Weak liquidity should stay subtle.
- Candles/footprint should remain readable.

Output:
1. Explain what changed.
2. Confirm labels now use final rendered cell geometry.
3. Confirm labels hide/merge based on zoom/readability.
4. Confirm high-liquidity color intensity is improved.
5. Confirm labels still use asset quantity only.
6. List files changed.