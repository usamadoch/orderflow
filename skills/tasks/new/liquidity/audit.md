Audit only. Do not implement fixes yet.

I want to audit the current liquidity / heatmap implementation because the current result is not useful.

Current problem:
The current liquidity/heatmap layer draws horizontal lines or zones very far away from active price, and a detached yellow box/zone on the right side. It does not look or behave like a real orderbook liquidity heatmap. It feels like random distant liquidity levels rather than useful near-price market depth.

Goal:
Find exactly how the current liquidity and heatmap system works, why it draws far-away lines/zones, and what would be required to rebuild it into a proper orderbook heatmap.

Reference behavior I want:
A proper liquidity heatmap should behave more like a time x price orderbook heatmap:
- use live orderbook/depth data
- bucket liquidity by price level
- keep historical snapshots from the time the app is opened
- render heatmap cells across time and price
- color intensity should represent liquidity size
- optionally show numbers/labels for large liquidity levels
- focus on visible/near-price levels unless user zooms out intentionally
- avoid random far-away lines that do not help the trader

Audit these areas:

1. Current data source
- Which Binance depth/orderbook stream is used?
- Is it spot only, futures only, or tied to selected contract type?
- What snapshot depth/limit is used?
- How often does the orderbook update?
- Is the orderbook state accurate and updated incrementally?

2. Current liquidity calculation
- How are raw bid/ask levels converted into liquidity zones?
- What bucket size is used?
- Are sizes normalized?
- Is there a threshold for minimum liquidity?
- Why are levels far away from current price being selected?
- Is current price distance considered?

3. Current heatmap history
- Is the system storing historical orderbook snapshots over time?
- Or is it only drawing the latest/current levels as horizontal lines?
- How many snapshots are kept?
- How are snapshots aligned with candle time / chart x-axis?
- Does history start only after app load, or does it try to restore old heatmap data?

4. Current rendering
- Which component/function draws the liquidity lines, bands, heatmap, and yellow box?
- What is the yellow box/zone on the right?
- How are price levels mapped to y-axis?
- How are time/history snapshots mapped to x-axis?
- Does it draw only visible price range or all detected zones?
- Does it draw far-away zones even when they are outside useful context?

5. Difference from desired behavior
Compare current implementation against a real orderbook heatmap:
- current horizontal liquidity lines/zones
- desired time x price heatmap cells
- current far-away level selection
- desired visible/near-price filtering
- current visual style
- desired intensity-based heatmap with optional labels

6. Root problems
Identify the exact root causes:
- data source issue?
- bucket/threshold issue?
- distance-from-price issue?
- no historical snapshot grid?
- wrong rendering model?
- stale zones not removed?
- y-axis scaling/price mapping issue?
- UI overlay issue?

7. Recommended rebuild/fix plan
Do not implement yet. Give a ranked plan:
- smallest safe fix if current system can be improved
- medium fix
- proper rebuild plan if current implementation should be replaced

Files likely involved:
- lib/liquidity/orderbook.ts
- lib/liquidity/aggregation.ts
- lib/liquidity/history.ts
- lib/liquidity/analysis.ts
- lib/liquidity/heatmap.ts
- lib/draw/drawLiquidity.ts
- lib/draw/drawLiquidityHeatmap.ts
- components/FeedProvider.tsx
- components/chart/ChartCanvas.tsx
- components/ui/ChartSettingsDropdown.tsx
- lib/store/chart.ts
- types/liquidity.ts

Output:
Create an audit document:

artifacts/liquidity_heatmap_audit.md

Required sections:
# Liquidity / Heatmap Audit

## 1. Current Data Source
## 2. Current Liquidity Calculation
## 3. Current Heatmap History
## 4. Current Rendering Behavior
## 5. Why Current Output Looks Wrong
## 6. Gap vs Desired Orderbook Heatmap
## 7. Root Causes
## 8. Recommended Fix / Rebuild Plan

Important:
- Be honest if the current implementation should be replaced instead of patched.
- Do not implement changes yet.
- Do not change chart rendering, storage, feeds, or settings in this task.
- Update skills/map.md only if required by project convention, but keep the update short.
- Add a short skills/log.md entry if required.