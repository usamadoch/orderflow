


AUDIT ONLY. Do not implement fixes yet.

I need to audit why Volume Profile data is no longer persisting/restoring correctly.

Context:
There was a recent regression/blunder where some completed work was lost. Volume Profile had recently been fixed after a MongoDB error:

MongoServerError:
Sort exceeded memory limit of 33554432 bytes
QueryExceededMemoryLimitNoDiskUseAllowed

That fix was supposed to:
- use proper MongoDB indexing/querying for profile restore
- avoid restoring/storing ultra-fine 0.5 tick rows
- use canonical minimum profile base bucket around 1.5 ticks
- make `/api/history/profile` restore work again

Current problem:
Volume Profile now works only live/in-session, but after refresh it starts from zero again.
When I refresh:
- default/profile data does not restore
- custom Volume Profile cannot draw old/historical profile correctly
- it feels like data is not persisting in cache or database
- it may not be writing to MongoDB, or it may be writing but not restoring, or it may be restoring but not hydrating into the profile engine/cache

Goal:
Find exactly where the Volume Profile persistence chain breaks.

Trace this full chain:

live trades / fine rows
→ RawTradeVolumeProfileEngine / profile cache
→ canonical 1m fine profile row generation
→ storage action
→ MongoDB `profile_rows_ts` write
→ `/api/history/profile` restore request after refresh
→ MongoDB restore query
→ profile rows returned
→ profile cache hydration
→ custom/default Volume Profile buildProfile()
→ chart rendering

Audit questions:

1. Current profile storage configuration
- What is the current canonical profile base bucket?
- Is it still using 1.5 minimum base bucket, or did it revert to tickSize / 0.5?
- Are storage writes and restore requests using the same baseBucketSize?
- Are profile cache keys using the same baseBucketSize as storage/restore?

2. Write path
- Are fine profile rows being generated for closed 1m slices?
- Are rows being queued for storage?
- Are storage actions being called?
- Are MongoDB writes actually happening?
- Are rows skipped as duplicate/open/partial?
- What are the skip reasons?
- Does MongoDB `profile_rows_ts` receive new rows after several closed candles?

3. MongoDB collection/query/index
- Does `profile_rows_ts` exist?
- Are the expected compound indexes present?
- Is the restore query tightly filtered by symbol, contractType, dataSourceMode, timeframe, baseBucketSize, and time range?
- Is the query using the correct index/hint?
- Is `allowDiskUse` still present only as fallback for code 292?
- Are old 0.5 rows being ignored safely?
- Are new 1.5 rows actually queried?

4. Restore API
- Does `/api/history/profile` get called after refresh?
- What parameters are requested?
- symbol
- contractType
- dataSourceMode
- timeframe/requested timeframe
- storage timeframe
- start/end
- baseBucketSize
- rowsFetched
- distinct candle times
- min/max candleTime
- Does it return 200 with rows or 200 with zero rows?

5. Hydration/cache
- Are restored rows inserted into `VolumeProfileBaseCache`?
- Are rows rejected because of baseBucketSize mismatch?
- Are rows rejected because of timeframe/source mismatch?
- Are restored rows marked as covered so raw-trade fallback does not double count?
- Does cache coverage show restored candle times after refresh?

6. buildProfile/rendering
- When drawing custom/default Volume Profile after refresh, does `buildProfile()` see restored rows?
- If buildProfile returns empty, why?
- Is the selected custom profile time range outside restored coverage?
- Is row compatibility rejecting 1.5 base rows for visual row sizes like 2, 2.5, 5, etc.?
- Is the renderer receiving an empty profile or is rendering failing separately?

7. Recent regression check
Compare current code against expected behavior from the previous fix:
- canonical minimum base bucket should be 1.5 when tickSize is 0.5
- profile restore should request 1.5, not 0.5
- Mongo restore should use index/hint and tight source/time/base filters
- old 0.5 rows should not be the only restored source
- visual profile row sizes should still aggregate from 1.5 base rows

Add temporary diagnostics if needed with prefix:

[VPROFILE_PERSIST_AUDIT]

Diagnostics should include:
- write queued/written/skipped counts
- baseBucketSize used for write
- baseBucketSize used for restore
- rows fetched from Mongo
- rows hydrated into cache
- rows accepted/rejected by profile engine
- buildProfile source rows count
- reason for empty custom/default profile

Output:
Create an audit document:

artifacts/volume_profile_persistence_audit.md

Required sections:
# Volume Profile Persistence Audit

## 1. Current Expected Behavior
## 2. Current Storage/Base Bucket Configuration
## 3. Write Path Findings
## 4. MongoDB Collection / Index / Query Findings
## 5. Restore API Findings
## 6. Hydration / Cache Findings
## 7. buildProfile / Rendering Findings
## 8. Root Cause
## 9. Recommended Fix Plan

Important:
- Do not implement fixes yet.
- Do not change runtime behavior.
- Do not refactor Volume Profile.
- Do not touch heatmap/liquidity, candles, footprint, feeds, or UI.
- Only inspect and document the issue.
- Update skills/map.md and skills/log.md only if required, and keep those updates short.