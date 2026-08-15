# Large Custom Volume Profile Bug Diagnosis

## Confirmed findings
The code proves the following execution path and constraints:
1. When a large Custom Volume Profile is created, `FeedProvider.tsx` computes the missing time bounds and safely paginates requests to `/api/history/profile/route.ts` in 2-hour chunks (`FINE_PROFILE_RESTORE_CHUNK_SECONDS`), respecting the API's 6-hour limit.
2. The fetched chunks are populated into the shared `VolumeProfileBaseCache`.
3. `VolumeProfileBaseCache` enforces global retention limits defined in `lib/cache/marketCachePolicy.ts`: 
   - `MARKET_CACHE_MAX_BASE_SLICES` = 720 (12 hours)
   - `MARKET_CACHE_MAX_PROFILE_ROWS` = 150,000 rows
4. A background interval (`volumeProfileCleanupInterval`) fires every 45 seconds to garbage collect this cache. If the fetched custom profile range exceeds 12 hours (or 150k rows), the cache `cleanup()` method aggressively deletes the oldest slices to stay under the limit.
5. Crucially, during this eviction, `cache.cleanup()` also clears the loaded coverage tracker (`this.loadedRanges = []`) and increments the cache version.
6. The version bump invalidates `RawTradeVolumeProfileEngine.cachedProfile`, causing `buildProfile()` to rebuild on the next React render cycle. Because the oldest rows were deleted, the resulting profile rendering is incomplete or missing.
7. Moving the profile horizontally updates its range bounds in the state. The `FeedProvider` interval reacts by checking `profileCache.getMissingBaseCandleTimes()`. Since the cache eviction previously cleared `loadedRanges`, `FeedProvider` correctly detects that the data is "missing" again and triggers `restoreLazyProfileRange`. This fetches the data, temporarily repairing the profile until the next 45-second cleanup timer deletes the oldest rows again.

## Likely root causes
**1. Cache Eviction Policy vs. UI Requirements Conflict (Highest Likelihood):**
The Custom Volume Profile feature relies on the global `VolumeProfileBaseCache`, which acts as a rolling 12-hour window. A custom profile requires a static, arbitrary time window. When that static window is larger than the global rolling window limit, the background garbage collector systematically destroys the UI's data.

## What is NOT the problem
- **It is NOT an API / Fetching Limit Error:** The backend explicitly blocks > 6 hour requests, but the client successfully mitigates this by paginating into 2-hour chunks. The data successfully arrives at the client.
- **It is NOT a rendering / calculation failure:** The profile algorithm in `lib/utils/volumeProfile.ts` accurately aggregates whatever data it is given. The bars disappear because the input rows are actually deleted from memory.
- **It is NOT a missing horizontal update trigger:** Dragging the profile correctly flags the range as missing and refetches it. The temporary success proves the networking and rendering loops are fully functional.

## Recommended fix
The minimal architectural fix is to decouple the **Shared Rolling Cache** from the **Static Profile Requirements**, or to add "protected ranges" to the cache.

**Recommended approach (Protected Ranges):**
Add a mechanism in `VolumeProfileBaseCache` to "pin" or protect certain time bounds so they survive the `cleanup()` garbage collector. 
1. Allow `profileEngine.ts` to register an `activeWindow`.
2. Modify `lib/volumeProfile/profileCache.ts` `deleteRowsBefore()` and `cleanup()` to skip evicting slices that fall within any actively registered Custom Profile window. 
3. This safely allows large custom profiles to remain in memory while still gracefully pruning stale rolling data that isn't actively viewed.
