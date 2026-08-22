I want to implement a scalable memory cleanup and TTL policy for market-data caches.

Goal:
Prevent shared caches from growing forever while keeping enough recent data for trading context and smooth chart usage.

Important:
Do not change database technology.
Do not change chart UI.
Do not change feed registry behavior except reading subscriber counts if needed.
Do not change footprint/profile calculation logic.
Do not delete persisted DB data in this task.
This task is only in-memory cache lifecycle management.

Implement cleanup policies for:

1. Shared Footprint Cache
- canonical 1m/$5 base slices
- keyed by symbol::contractType::dataSourceMode

2. Shared Volume Profile Cache
- canonical 1m fine profile rows
- keyed by symbol::contractType::dataSourceMode::baseBucketSize

3. Candle/OHLCV cache if it exists, or prepare compatible hooks if not

Cleanup policy should support:

A. Time-window retention
Keep only recent data, configurable by env/constants:
- default keep last 6 hours of 1m base slices
- allow override like MARKET_CACHE_RETENTION_MINUTES

B. Max-size cap
Protect against extreme growth:
- max slices per cache key
- max rows/cells estimate per cache key
- evict oldest data first

C. Subscriber-aware cleanup
- If a cache key has active subscribers, keep recent data but trim old history.
- If subscriber count becomes 0, keep cache warm for a short grace period.
- After grace period, evict the inactive cache key.
- Example default grace: 5–10 minutes.

D. Safe cleanup timing
- Run cleanup on interval, not every tick.
- Example: every 30–60 seconds.
- Avoid blocking UI or processing large loops on every trade.

E. Metrics
Integrate with marketMetrics/debug system:
- cache keys evicted
- slices removed
- rows removed
- estimated memory before/after
- last cleanup timestamp

Important safety:
- Never delete currently visible/active panel data.
- Never remove the current active 1m candle.
- Do not break refresh persistence; this is only memory cleanup, DB remains source of truth.
- Do not clear cache immediately on panel switch if another panel still uses it.

Validation:
- Let app run on one symbol for several minutes.
- Confirm cache sizes grow then stabilize.
- Open split mode and confirm active shared caches are not evicted.
- Close split mode and confirm inactive cache is removed after grace period.
- Confirm charts still update live.
- Confirm footprint/profile still restore from DB if evicted from memory.

Output:
1. Explain cleanup rules.
2. List files changed.
3. Explain default retention/grace/cap values.
4. Explain how cleanup is subscriber-aware.
5. Show how to verify via debug metrics.
6. Mention any risk or tuning parameter.