Audit chart performance and freezing issues. Do not implement fixes yet.

The app currently freezes/lags when loading several hours of market data and sometimes becomes unusable. The collector now writes market data separately, so the frontend should only read/restore/display data, but the browser still struggles.

Goal:
Find the real frontend bottlenecks before making changes.

Investigate:

1. Restore performance

* Measure API fetch time for candles, footprint, volume profile, aggregate bubbles.
* Measure response sizes and row counts.
* Measure hydration time for each restored data type.
* Identify which restore step blocks the UI longest.

2. Rendering performance

* Measure time spent drawing:

  * candles
  * footprint cells
  * volume profile
  * bubbles
  * aggregate bubbles
  * absorption/exhaustion/iceberg/liquidity signals
  * drawings/tools
* Identify whether full redraw happens too often.
* Identify whether hidden indicators are still calculated or rendered.

3. State/update performance

* Check Zustand/store update frequency.
* Check whether WebSocket/live events cause too many updates.
* Check whether settings changes trigger unnecessary full recalculation.
* Check whether large arrays/maps are stored in React state where refs/caches would be better.

4. Aggregation/cache performance

* Identify where footprint aggregation is recalculated.
* Identify where volume profile aggregation is recalculated.
* Identify whether display bucket/timeframe changes reuse cached base data or recompute too much.
* Identify whether aggregate bubbles are filtered/sorted every redraw.

5. Memory usage

* Estimate memory used after loading:

  * 1 hour
  * 6 hours
  * 24 hours if possible
* Identify large objects/maps/arrays that grow without cleanup.
* Check whether buffers are capped correctly.

6. Main-thread blocking

* Identify heavy synchronous loops.
* Identify work that should move to Web Worker later.
* Identify restore/hydration work that should be chunked/yielded.

Output format:

* Short summary of biggest bottlenecks
* Ranked list: most severe → least severe
* Exact files/functions causing issues
* Measurements where possible
* Recommended fix plan in phases
* Mark quick wins separately from deeper architecture changes

Do not change code except adding temporary timing logs/debug measurements if needed. If temporary logs are added, clearly mark them and explain how to remove them.
