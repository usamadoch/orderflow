I want to implement a production-style observability/debug layer for the market-data system.

Goal:
Add a developer metrics/debug system that gives visibility into live feeds, caches, restores, subscribers, memory size, and data coverage.

Important:
Do not change runtime behavior.
Do not refactor architecture.
Do not change database schema.
Do not change chart rendering.
This task is only observability/debug visibility.

Add a dev-only metrics system that can track:

1. Feed Registry Metrics
- active stream keys
- stream type: kline / aggTrade / depth
- subscriber count
- created/reused/closed counts
- last event timestamp
- event rate per stream

2. Footprint Cache Metrics
- active cache keys
- number of 1m/$5 base slices
- approximate row/cell count
- coverage range min/max time
- cache hit/miss count
- restore request count
- restore dedupe count
- live trade dedupe count

3. Volume Profile Cache Metrics
- active cache keys
- number of 1m fine profile slices
- fine row count
- baseBucketSize
- coverage range min/max time
- cache hit/miss count
- restore request count
- restore dedupe count

4. Candle Cache / History Metrics if available
- active candle keys
- candle count
- history restore count
- in-flight history dedupe count

5. Storage / Restore Diagnostics
- recent restore calls
- rows fetched
- rows written
- distinct candle_time count
- failed/skipped row count

Implementation guidance:
- Create a central module like lib/debug/marketMetrics.ts.
- It should work in development mode and be safe/no-op in production unless explicitly enabled.
- Add a simple way to inspect metrics from browser console, for example:
  window.__MARKET_DEBUG__.getSnapshot()
  window.__MARKET_DEBUG__.reset()
- Optional: add a minimal dev-only overlay/panel if easy, but console snapshot is enough for this task.
- Use lightweight counters, not heavy logging spam.
- Do not store huge raw data inside the metrics system.

Validation:
- Open one panel and confirm metrics show active streams/caches.
- Open split mode and confirm subscriber counts increase.
- Change timeframe and confirm correct keys update.
- Close split mode and confirm subscriber count decreases.
- Confirm metrics do not break feed/cache behavior.

Output:
1. Explain what metrics were added.
2. List files changed.
3. Show how to access metrics in DevTools.
4. Explain what each metric means.
5. Mention any remaining blind spots.