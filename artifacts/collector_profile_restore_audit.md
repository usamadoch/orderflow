# Collector Profile Restore Audit

## 1. Current Expected Behavior

The standalone BTCUSDT collector should be the only writer for canonical fine Volume Profile rows in MongoDB. The website should restore those rows from `/api/history/profile`, hydrate them into the shared `VolumeProfileBaseCache`, and use them in `RawTradeVolumeProfileEngine.buildProfile()` after refresh. Browser-side live trades may still update rendering after the page is open, but historical visibility after refresh should not depend on live trades.

The expected canonical profile storage shape is:

- `symbol = BTCUSDT`
- `timeframe = 1m`
- `baseBucketSize = 1.5`
- `meta.baseBucketSizeKey = "1.5"`
- 1-minute `candleTime`/`time` values
- source scoped by `contractType` and `dataSourceMode`

## 2. Collector Profile Write Shape

Collector code: `scripts/collector/btcusdtCollector.mjs`

The collector writes profile rows through `toProfileDocuments()`. The write shape matches the Mongo adapter's expected profile document shape:

- `time`: `new Date(sliceTime * 1000)`
- `meta.symbol`: `runtime.symbol`
- `meta.contractType`: `runtime.contractType`
- `meta.dataSourceMode`: `runtime.dataSourceMode`
- `meta.timeframe`: `1m`
- `meta.baseBucketSizeKey`: `toNumberKey(runtime.profileBaseBucketSize)`
- `candleTimeSec`: `sliceTime`
- `baseBucketSize`: stringified number, currently `"1.5"`
- `bucketPrice`: stringified number
- `bucketPriceKey`: normalized string key
- `bidVol`, `askVol`, `totalVol`: stringified numbers
- `tradeCount`: integer

Read-only Mongo sample from `profile_rows_ts`:

```json
{
  "time": "2026-06-02T12:03:00.000Z",
  "candleTimeSec": 1780401780,
  "meta": {
    "baseBucketSizeKey": "1.5",
    "contractType": "futures",
    "dataSourceMode": "both",
    "symbol": "BTCUSDT",
    "timeframe": "1m"
  },
  "baseBucketSize": "1.5",
  "bucketPrice": "69451.5",
  "bucketPriceKey": "69451.5",
  "bidVol": "0.09541",
  "askVol": "16.061470000000007",
  "totalVol": "16.156880000000005",
  "tradeCount": 50
}
```

Collector row groups found in Mongo:

| identity | rows | distinct range |
| --- | ---: | --- |
| `BTCUSDT/futures/both/1m/1.5` | 830 | `1780344180` to `1780401780` |
| `BTCUSDT/futures/futures/1m/1.5` | 829 | `1780344180` to `1780401780` |
| `BTCUSDT/spot/spot/1m/1.5` | 747 | `1780344180` to `1780401840` |
| `BTCUSDT/spot/both/1m/1.5` | 707 | `1780344180` to `1780401780` |
| `BTCUSDT/futures/spot/1m/1.5` | 341 | `1780344180` to `1780401780` |
| `BTCUSDT/spot/futures/1m/1.5` | 234 | `1780344180` to `1780401780` |

Finding: collector profile documents are present and use the same field names/key fields that the website Mongo adapter expects.

## 3. Website Profile Restore Request

Website code: `components/FeedProvider.tsx`

After candle history restore, `hydrateStoredFineProfileRows()` computes the candle history window and fetches:

```text
/api/history/profile
  symbol=<pair>
  timeframe=1m
  contractType=<panel contractType>
  dataSourceMode=<panel dataSourceMode>
  start=<history window start seconds>
  end=<history window end seconds>
  baseBucketSize=<getFineProfileBaseBucketSize(tickSize)>
```

For default BTCUSDT settings, `tickSize = 0.5`, so `getFineProfileBaseBucketSize(0.5)` returns `1.5`. That matches the collector's `baseBucketSize` and `meta.baseBucketSizeKey`.

Direct local API test against the running dev server:

```text
GET /api/history/profile?symbol=BTCUSDT&timeframe=1m&contractType=spot&dataSourceMode=spot&start=1780344180&end=1780401900&baseBucketSize=1.5
```

Returned:

- rows: `747`
- distinct candle times: `34`
- min candle time: `1780344180`
- max candle time: `1780401840`
- base bucket size values: `1.5`

Finding: the API can return collector-written profile rows for a real current collector window.

## 4. MongoDB Restore Query Findings

Website Mongo code: `lib/db/mongo/marketStorageMongo.ts`

`getFineProfileRows()` filters:

```text
meta.symbol
meta.contractType
meta.dataSourceMode
meta.timeframe
meta.baseBucketSizeKey = toNumberKey(baseBucketSize)
time >= start Date
time < end Date
```

It then sorts by:

```text
time ASC, bucketPriceKey ASC
```

and maps documents through `toFineProfileRow()`, converting string numeric fields back to numbers.

Read-only Mongo query using the same filter shape returned rows for all current collector identities. Example results:

- `BTCUSDT/spot/spot/1m/baseBucketSizeKey=1.5`: `747` rows, `34` candle times
- `BTCUSDT/futures/both/1m/baseBucketSizeKey=1.5`: `830` rows, `33` candle times
- `BTCUSDT/futures/futures/1m/baseBucketSizeKey=1.5`: `829` rows, `33` candle times

Finding: no current evidence of a Mongo query mismatch for:

- `baseBucketSize` vs `baseBucketSizeKey`
- number vs string key
- seconds vs `Date`
- timeframe value
- source fields
- `bucketPriceKey` formatting

The restore query can return collector-written rows.

## 5. Profile Cache Hydration Findings

Cache code: `lib/volumeProfile/profileCache.ts`

`VolumeProfileBaseCache.hydrateProfileRows()` accepts rows only when:

- `row.baseBucketSize` equals the cache `baseBucketSize`
- `row.bucketPrice` is finite
- `row.totalVol > 0`

The panel cache key is built in `FeedProvider` with:

```text
symbol
contractType
dataSourceMode
baseBucketSize = getFineProfileBaseBucketSize(tickSize)
```

For default BTCUSDT settings, this is `1.5`, matching the collector rows. The API maps `baseBucketSize: "1.5"` to numeric `1.5`, so these rows should be accepted by hydration.

Important diagnostic gap:

- `FeedProvider` sets `stats.candlesHydrated` from returned rows before checking whether `VolumeProfileBaseCache` actually accepted the rows.
- `RawTradeVolumeProfileEngine.hydrateProfileRows()` logs inserted/rejected counts, but with `[VPROFILE_DEBUG]`, not the requested `[VPROFILE_COLLECTOR_RESTORE_AUDIT]` prefix.

Finding: hydration should accept collector rows for default BTCUSDT if the API returns rows. The current stats can overstate hydration because they count returned rows, not accepted rows.

## 6. buildProfile / Rendering Findings

Rendering code: `components/chart/ChartCanvas.tsx`

The default Volume Profile build uses:

```ts
const profileBucketSize = tickSize > 0
  ? tickSize * Math.max(1, profileResolutionTicks)
  : Math.max(1, bucketSize / 4);
```

Store defaults:

```text
tickSize = 0.5
profileResolutionTicks = 1
```

So the default visual `profileBucketSize` is:

```text
0.5 * 1 = 0.5
```

Engine code: `lib/volumeProfile/profileEngine.ts`

`buildProfileFromRowsAndTrades()` only uses restored fine rows when:

```ts
isCompatibleProfileBucket(row.baseBucketSize, profileBucketSize)
```

Compatibility currently requires:

```ts
baseBucketSize <= profileBucketSize + 1e-9
```

Collector/restored rows have:

```text
baseBucketSize = 1.5
```

Default rendered profile requests:

```text
profileBucketSize = 0.5
```

Therefore restored rows are rejected in `buildProfile()` because:

```text
1.5 <= 0.5 is false
```

This also explains the observed behavior:

- After refresh, restored DB rows exist but are too coarse for the default `0.5` visual profile bucket, so `buildProfile()` ignores them.
- Live browser trades still appear after page load because `buildProfile()` also falls back to raw live trades from the cache. Those trades can be bucketed directly at `0.5`, so the profile appears only after live data accumulates.
- For custom/default profiles with a visual row size of `1.5` or larger, restored rows should become usable.

Additional diagnostic gap:

- Custom profile builds pass a `debugContext`, so they can log `[VPROFILE_DEBUG] Render selected profile build`.
- Default Volume Profile builds do not pass `debugContext`, so the normal right-side/default profile can be empty without logging source row counts.

## 7. Root Cause

The root cause is not the collector write shape and not the Mongo restore query. The root cause is a rendering/build compatibility mismatch:

```text
collector restored profile rows are stored at canonical baseBucketSize = 1.5
default Volume Profile render asks for profileBucketSize = tickSize * profileResolutionTicks = 0.5
buildProfile() rejects restored rows when baseBucketSize > profileBucketSize
```

Because restored `1.5` rows cannot be expanded into a finer `0.5` profile, `buildProfile()` ignores them after refresh. Live trades are still usable because they are stored in the cache as raw trades and can be rebucketed to the finer visual row size. This produces the exact reported symptom: Volume Profile appears only from live browser data after page load.

## 8. Recommended Fix Plan

Do not re-enable browser writes. Fix the restore/render contract instead.

Recommended fix order:

1. Add focused diagnostics with prefix `[VPROFILE_COLLECTOR_RESTORE_AUDIT]` before changing behavior:
   - collector profile write sample: identity, `candleTimeSec`, `baseBucketSize`, `meta.baseBucketSizeKey`, row count
   - profile API params: symbol, contractType, dataSourceMode, timeframe, start, end, baseBucketSize
   - Mongo fetched rows: count, distinct candle times, min/max time, base bucket values
   - hydration result: accepted/rejected counts and rejection reasons
   - default and custom `buildProfile()` source counts: `profileBucketSize`, cache base bucket, fine rows scanned, fine rows used, rows skipped by bucket compatibility, live trades used

2. Make the default rendered profile bucket no finer than the restored canonical base bucket, or make the UI/default setting reflect the canonical minimum:
   - effective profile bucket size should be at least `fineProfileBaseBucketSize`
   - for BTCUSDT default settings this means at least `1.5`, not `0.5`

3. Pass `debugContext` for the default right-side Volume Profile build, not only custom profiles, so empty default rendering reports whether the failure is restore, hydration, compatibility, range, or draw input.

4. Keep current Mongo schema and collector write shape unchanged unless diagnostics later prove a separate source/window mismatch.

5. After the fix, validate with website writes still disabled:
   - collector writes `profile_rows_ts`
   - refresh page
   - `/api/history/profile` returns rows
   - cache hydration accepts rows
   - default `buildProfile()` reports restored rows used
   - default Volume Profile renders before new live browser trades accumulate
