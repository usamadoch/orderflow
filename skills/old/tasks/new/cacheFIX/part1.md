



I want to implement one focused performance fix only: footprint-mode passive redraw throttling.

Context:
Latest debug snapshot shows the app freezes after only 8–10 candles in footprint mode during high trade flow.

What is working:
- MongoDB/storage looks fine.
- Shared feed registry looks fine.
- Subscriber counts are not leaking.
- Cache memory is not huge.
- Passive redraw throttling exists.
- Interaction redraws are fixed.
- CVD/default profile are not the main issue in this snapshot.

Problem:
In footprint mode, passive redraw rate is still around 7.5 redraws/sec.

That may be okay for candle mode, but footprint mode is heavier because it repaints visible footprint cells and bubbles. Latest metrics showed:
- chartMode: footprint
- footprintRepaintCount very high
- passiveRedrawsPerSecond around 7.5
- high aggTrade event rate from spot + futures combined
- no obvious memory leak

Goal:
Add chart-mode-aware passive redraw throttling so footprint mode redraws less often during live flow.

Expected behavior:
- Candle mode can keep the current passive redraw rate.
- Footprint mode should use a lower passive redraw rate, target around 2–4 redraws/sec.
- Suggested footprint passive interval: 250ms–350ms.
- User interactions must remain responsive:
  - pan
  - zoom
  - mousemove/crosshair
  - wheel
  - resize
- Only passive/live-data redraws should be throttled more aggressively.
- Do not throttle real interaction redraws heavily.

Important constraints:
- Do not change footprint calculations.
- Do not change footprint cache.
- Do not change MongoDB/storage.
- Do not change feed registry.
- Do not change chart visuals.
- Do not implement dirty-region rendering yet.
- Do not touch raw_trades or fine profile persistence in this task.
- Keep this small and focused.

Implementation guidance:
- Find the existing passive redraw throttling logic.
- Make passive redraw interval depend on chart mode.
- Example:
  - candle/default mode: existing interval
  - footprint mode: slower interval
- Keep this configurable by constant if possible.
- Add/update debug metrics to show:
  - chartMode
  - passiveRedrawIntervalMs
  - passiveRedrawsPerSecond
  - passiveRedrawThrottledCount
  - footprintRepaintCount

Validation:
After implementation, I will run footprint mode for 10–20 minutes.

Expected:
- passiveRedrawsPerSecond in footprint mode should drop from around 7.5 to around 2–4.
- footprintRepaintCount should grow slower.
- chart should feel less heavy.
- pan/zoom/crosshair should still respond immediately.
- candle mode behavior should not get worse.

Output:
1. Explain what changed.
2. List files modified.
3. Confirm footprint mode has a lower passive redraw rate.
4. Confirm interaction redraws remain responsive.
5. Confirm no calculation/storage/cache behavior changed.
6. Mention any remaining performance risks.