# Fix MongoDB Sort Memory Error and Query Performance
## Critical — Footprint, Volume Profile, and Aggregate Bubble Collections

This task fixes a recurring crash:
`MongoServerError: Sort exceeded memory limit of 33554432 bytes`

The crash happens on footprint history queries for large time ranges.
The same failure risk exists on volume profile fine row queries and aggregate bubble queries.
The root cause is missing compound indexes. Without them MongoDB loads all matching
documents into memory to sort them. With proper indexes MongoDB reads documents
in sorted order without any in-memory sort.

Do not change chart behavior. Do not change API response shapes.
Only add indexes and fix queries that risk this error.

---

## Task 1 — Audit All Collection Queries

Before adding any indexes, read `lib/db/mongo/marketStorageMongo.ts` completely.

For every collection accessed in that file, identify:
- The collection name
- Every query filter used against it (which fields are in the find or match stage)
- Every sort applied (which fields, which direction)
- Whether that sort field is part of an existing index alongside the filter fields

Report the findings before implementing anything.

Collections expected to be present:
- Footprint cells collection
- Volume profile fine rows collection
- Aggregate bubbles collection
- Candles collection
- Raw trades collection (if queried directly)

---

## Task 2 — Fix Footprint Collection Index

The crash originates in `getFootprintCellsForRange` in `marketStorageMongo.ts`.

The query filters by symbol, contractType, dataSourceMode or timeframe,
and a time range on openTime or equivalent timestamp field.
It then sorts by that same timestamp field.

Create a compound index on the footprint collection that covers all filter fields
plus the sort field in the correct order:

The index must be created in the MongoDB Atlas UI or via a migration script.
The correct index field order is: equality fields first, then the range/sort field last.
For example if the query filters on symbol, contractType, and timeframe,
and sorts on openTime ascending, the index should be on those four fields in that order.

Confirm the exact field names by reading the actual query in the code.
Do not guess field names. Use the exact names from the query.

After the index is identified, create a setup or migration script at
`scripts/ensureIndexes.ts` that creates this index using `createIndex` with
the correct fields and options. Set `background: true` so it does not block reads.

---

## Task 3 — Fix Volume Profile Fine Rows Index

Read the function that queries the volume profile fine rows collection.
It is likely called from `profileCache.ts` or a storage function it calls.

Apply the same analysis:
- What fields does the query filter on?
- What field does it sort on?
- Is that sort field covered by an existing index alongside the filter fields?

If the index is missing or incomplete, add it to the `ensureIndexes.ts` script
using the same pattern as Task 2.

---

## Task 4 — Fix Aggregate Bubbles Index

The aggregate bubbles query at `/api/history/aggregate-bubbles` returns 200
but takes around 940ms consistently. That response time indicates a full collection
scan or a poorly covered sort even when it does not crash.

Read the function that queries the aggregate bubbles collection.
Identify the filter fields and sort field.
Add the compound index to `ensureIndexes.ts`.

---

## Task 5 — Fix Candles Collection Index

Candle queries return quickly now but will slow down as more data accumulates.
Read the candle query functions. Identify filter and sort fields.
Add the compound index to `ensureIndexes.ts` if not already present.

---

## Task 6 — Add allowDiskUse as Fallback

For any aggregation pipeline query that uses a sort stage,
add `allowDiskUse: true` as a fallback option on the cursor or aggregate call.

This does not replace proper indexing. It is a safety net that prevents a hard crash
if a query ever hits the sort memory limit despite indexes.

Find every `.sort()` call and every aggregation pipeline with a sort stage
in `marketStorageMongo.ts`. Add `allowDiskUse: true` to those operations.

For `FindCursor` queries with `.sort()`, the option is passed as a cursor option.
For `aggregate()` calls, pass `{ allowDiskUse: true }` as the options argument.

Confirm the exact API for the installed MongoDB driver version before applying.

---

## Task 7 — Reduce Footprint Query Range

The failing request fetches footprint data from start=1780392600 to end=1780842600.
That is approximately 7.5 hours of 1-minute candles.
At 1-minute timeframe with bucket size 5, each candle has multiple price level documents.
Even with an index this is a large result set.

Read the footprint API route at `app/api/history/footprint/route.ts`.

Check whether there is a maximum time range limit enforced on the query.
If the request can ask for an unbounded range, add a server-side cap.

A reasonable cap for 1-minute footprint data is 500 candles worth of time range
which matches the existing candle limit. Calculate the maximum time range as
`limit × timeframe duration in seconds` and reject or clamp requests beyond that.

Return a clear error message if the range is too large rather than letting
MongoDB crash silently.

---

## Task 8 — Run ensureIndexes Script

The `ensureIndexes.ts` script created in Tasks 2 through 5 must be run once
against the production MongoDB Atlas cluster.

Add a npm script entry in `package.json`:
`"db:indexes": "ts-node scripts/ensureIndexes.ts"`

Document in a comment inside the script that it must be re-run whenever
a new collection is added or a query pattern changes significantly.

After running, verify in MongoDB Atlas that the indexes appear in the collection
index list before closing this task.

---

## Task 9 — Validation

Run `npx.cmd tsc --noEmit`. Report any new errors introduced by this work.
Mention pre-existing unrelated errors but do not fix them.

Manually trigger the failing request by loading 6 to 8 hours of footprint data.
Confirm the sort memory error no longer occurs.
Confirm the footprint response time improves.
Confirm the aggregate bubbles response time improves from the current 940ms baseline.

---

## Expected Outcome

- Footprint sort memory crash does not recur.
- Volume profile and aggregate bubble queries are index-covered.
- `allowDiskUse: true` prevents hard crashes if memory limits are ever hit again.
- Server-side range cap prevents the API from accepting unbounded footprint requests.
- All index creation is centralized in `scripts/ensureIndexes.ts` for future reference.