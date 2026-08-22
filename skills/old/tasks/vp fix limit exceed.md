Fix Volume Profile restore so large DB history does not break Mongo queries.

Issue:
After collector runs for many hours, `/api/history/profile` can request a very large time range and Mongo throws:

Sort exceeded memory limit of 33554432 bytes
QueryExceededMemoryLimitNoDiskUseAllowed

This is likely because default Volume Profile restore is trying to fetch too much profile history at once.

Goal:
Make Volume Profile restore chunked/paginated and avoid huge in-memory Mongo sorts.

Required changes:

1. Default profile restore
- Do not fetch 1–2 days of `profile_rows_ts` in one request.
- Load recent profile history first, for example last 2–6 hours.
- Keep chart usable while older profile rows are not loaded.
- Show small loading status when profile history is restoring.

2. Custom Volume Profile restore
- If user draws a custom profile over a range that is not loaded, fetch only that selected range.
- If selected range is large, fetch it in chunks.
- Show loading state near the profile/tool or chart header while custom profile data is being loaded.
- Do not crash or silently fail.

3. Mongo query/index safety
- Ensure `getFineProfileRows()` uses tight filters:
  - symbol
  - contractType
  - dataSourceMode
  - timeframe
  - baseBucketSize
  - time range
- Ensure sort uses an index-friendly order.
- Add/fix compound index if needed.
- Avoid huge in-memory sort.
- Use `allowDiskUse` only as fallback, not main solution.

4. Lazy/backfill behavior
- Recent data should load first.
- Older profile rows should load only when needed:
  - user pans/scrolls back
  - user draws custom profile over older range
- Avoid duplicate requests for already-loaded ranges.

5. UX
- Add visible restore status:
  - “Loading profile history…”
  - “Loading custom profile…”
  - row/chunk progress if easy
- Do not block live feed.

Do not change:
- collector script
- Mongo schema unless index change is required
- footprint restore
- candle restore
- heatmap/liquidity
- VP calculation/rendering logic except loading/restoring data

Validation:
- Run collector for many hours.
- Refresh website.
- No Mongo 32MB sort error.
- Recent profile data loads first.
- Custom profile over large range loads in chunks.
- Loading indicator appears while profile data is being fetched.
- No duplicate restore loops.
- Default/custom VP still render correctly.

Output:
1. Explain what caused the issue.
2. Explain chunking/pagination strategy.
3. List index/query changes.
4. Confirm loading UI.
5. List files changed.