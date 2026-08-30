# Footprint Diagnostic Report

Based on a deep diagnostic pass and reproducing the logic flow:

### 1 & 2. Eviction Trigger and `focalTime` Bug
The root cause of all three symptoms is indeed cache eviction caused by a stale `focalTime`. 
- `focalTime` is currently **only** updated when a *new* historical network fetch is initiated (via `runRestoreOnce`).
- **Repro Flow:**
  1. User scrolls back: triggers a network fetch. `focalTime` updates to the past.
  2. User scrolls back to the present. The present footprint data is already in cache, so NO fetch is triggered. **`focalTime` remains stuck in the past.**
  3. The `cleanup()` interval runs every 45s. It sees the cache size exceeds `MARKET_CACHE_MAX_BASE_SLICES` (720 slices = 12h) and evicts data furthest from `focalTime`.
  4. Because `focalTime` is stuck in the past, it evicts the PRESENT. 
  5. If the user then scrolls to the past, fetches present, and `focalTime` gets stuck on the present, it evicts the PAST. 

### 3. Rendering State when Canvas Goes Blank
At the exact moment the canvas goes empty, **the cache genuinely does not have the footprint cells**. 
The `displayCandleMap` (managed by `AggregationEngine`) still holds the `Candle` (OHLCV) metadata, but `FootprintBaseCache` has evicted the underlying `$5` bucket cells. 
Because `getFootprintCandle` finds the candle but sees `cells.size === 0`, it returns a footprint object with no cells, which correctly renders as a completely empty footprint outline. A frame or two later, the pagination interval notices the base slice is missing and triggers the re-fetch.

### 4. Pagination / Overlap Logic
The logic deciding "is this range already loaded" before firing a fetch is located in `FeedProvider.tsx` (`getScrolledFootprintRestoreWindow`):
```typescript
const range = alignFootprintRange(firstTime, lastTime + timeframeSeconds);
const missingTimes = footprintCache.getMissingBaseCandleTimes(range.startSeconds, range.endSeconds);
```
There is **no independent bug here**. `getMissingBaseCandleTimes` strictly checks `this.hasBaseFootprintCandle(time)` (physical presence in cache). It doesn't rely on a "previously fetched ranges" array. Therefore, the pagination fetch is working perfectly—it fires exclusively because the data was genuinely evicted.

### 5. Viewport Update Throttling (Volume Profile Pattern)
The `VolumeProfileEngine` maintains its protected ranges via a direct `useChartStore.subscribe` effect in `FeedProvider.tsx`.
**There is no explicit throttle or debounce mechanism.** 
The operation (`setProtectedRanges`) is extremely lightweight—it just overwrites an array reference in a `Map` (`protectedRangesByOwner.set(ownerId, ranges)`). Since Zustand batches synchronous state updates, and the operation is O(1) memory pointer swapping, this unthrottled path is safe and performant to reuse for footprint.

### 6. Next Steps
I will proceed with the proposed plan, and I will include:
1. **Cleanup of `protectedRangesByOwner`** when switching symbol/timeframe (which occurs naturally if the `FeedProvider` cleans up or when the cache instance is released/destroyed).
2. **Explicit boundary inclusivity**: `isProtectedTime(time)` will use `>= startSeconds` and `< endSeconds` to perfectly match the base timeframe boundary semantics.
