Fix MongoDB profile restore query memory error and stop storing useless ultra-fine profile rows.

Error:
MongoServerError: Sort exceeded memory limit of 33554432 bytes, code 292 QueryExceededMemoryLimitNoDiskUseAllowed, inside getFineProfileRows() in lib/db/mongo/marketStorageMongo.ts.

Context:
The app currently stores fine profile rows at 0.5 tick/base bucket size, but I do not use 0.5 tick visually. My normal usable Volume Profile row size starts around 1.5 ticks or higher. Storing 0.5 tick rows creates too many profile rows, makes Mongo restore heavier, and does not help my analysis.

Goal:
Fix the MongoDB profile restore query/indexing and change fine profile storage so the minimum stored base bucket is 1.5 ticks instead of 0.5 tick.

Tasks:

1. Fix Mongo profile restore query/indexing
- Inspect getFineProfileRows() query and sort.
- Add/correct compound indexes for profile_rows_ts matching the restore filter and sort.
- Ensure query filters tightly by symbol, contractType, dataSourceMode, timeframe/storage timeframe, baseBucketSize, and time range.
- Sort using indexed fields only.
- Avoid broad collection scans.
- Use allowDiskUse only as fallback, not the main fix.

2. Change minimum fine profile base bucket
- Do not store fine profile rows at 0.5 tick anymore.
- Set minimum stored profile base bucket to 1.5 ticks.
- If tickSize is 0.5, stored base bucket should become 1.5.
- If visual/profile row size is larger, aggregation can still derive from 1.5 base rows.
- Make sure restore queries request the same canonical base bucket that storage writes.
- Existing old 0.5 data can remain in DB, but new writes/restores should use the new base bucket going forward unless migration/cleanup is simple and safe.

3. Keep behavior safe
- Do not change Volume Profile visual rendering logic unless needed to match the new base bucket.
- Do not change candles, footprint, heatmap, feeds, or MongoDB candle/footprint storage.
- Do not rewrite the profile engine.
- Keep custom/default Volume Profile working.

Expected:
- /api/history/profile no longer throws Sort exceeded memory error.
- New profile rows are stored at minimum 1.5 tick base resolution, not 0.5.
- Restore uses the same 1.5 tick base bucket.
- Row count and Mongo query load should be lower.
- Visual profile row sizes like 1.5, 2, 2.5, 5+ ticks should still work.

Validation:
- Start app and confirm /api/history/profile returns 200.
- Confirm Mongo profile_rows_ts new writes use baseBucketSize 1.5 when tickSize is 0.5.
- Confirm custom VP renders.
- Confirm default VP renders.
- Confirm no old 0.5 restore request is made for new sessions.
- Confirm indexes exist and query no longer does large in-memory sort.

Output:
1. Explain root cause.
2. List index/query changes.
3. Confirm new minimum stored base bucket is 1.5 ticks.
4. Confirm old 0.5 rows are ignored or handled safely.
5. Confirm Volume Profile still renders.