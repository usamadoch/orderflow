# Volume Profile Improvements — Task 2 of 4
## Row Density and Smooth Scaling

---

## Goal for This Task Only

Make the profile visually finer and smoother. Two things: increase the number of rows so the profile has more vertical detail, and normalize bar widths so small volume differences do not create extreme visual jumps between adjacent rows. No new controls. No layout changes. Just the calculation and rendering of rows.

---

## Problem 1 — Row Density

Currently `buildProfile` uses `bucketSize` to group prices into rows — the same bucket size used by the footprint cells (e.g. `$100`). On BTC a `$100` bucket means the profile only has maybe 10–20 rows visible at typical zoom levels. This looks blocky.

The profile should use a finer bucket size than the footprint — independent of the user's footprint bucket size setting.

### Introduce `profileBucketSize`

This is separate from `bucketSize` (footprint bucket size). It controls only the volume profile row height.

- Default: one quarter of `bucketSize`. If footprint is `$100`, profile rows are `$25`.
- Minimum: `$5` — below this rows become too thin to see on most zoom levels
- User does not control this directly — it is derived automatically from `bucketSize`
- Formula: `profileBucketSize = Math.max(5, Math.floor(bucketSize / 4))`

### Changes to `buildProfile`

**File:** `lib/utils/volumeProfile.ts`

`buildProfile` currently normalizes prices using `bucketSize`. Change it to accept an optional `profileBucketSize` parameter. If not passed, falls back to `bucketSize` for backward compatibility.

When building the row map, use `normalizePriceToBucket(price, profileBucketSize)` instead of `normalizePriceToBucket(price, bucketSize)`.

When distributing footprint cell volume across profile rows:
- A single footprint cell (at `bucketSize = $100`) now spans multiple profile rows (at `profileBucketSize = $25`)
- Distribute the cell's volume evenly across the profile rows it covers
- Number of profile rows per footprint cell: `Math.round(bucketSize / profileBucketSize)` — e.g. 4 rows at `$25` per `$100` cell
- Split the cell's `bidVol` and `askVol` evenly across those 4 rows

For the OHLCV fallback (candles without footprint data), the same even distribution applies.

### Result

Profile goes from ~15 rows to ~60 rows at typical BTC zoom levels. The profile shape reads as a smooth curve rather than a staircase.

---

## Problem 2 — Aggressive Width Jumps

When one row has `10,000` volume and the adjacent row has `9,800`, their bar widths should look nearly identical. Currently the linear scaling (`vol / maxVol * effectiveWidth`) handles this correctly for large differences but can still feel jumpy because a single high-volume outlier row compresses all other rows toward zero.

### Square Root Normalization

Apply a square root transformation to the volume before scaling. This compresses the range — outlier rows are still the widest but not by as much, and low-volume rows get a more proportional width.

**Current formula:**
```
barW = (row.totalVol / profile.maxVol) * effectiveWidth
```

**New formula:**
```
barW = Math.sqrt(row.totalVol / profile.maxVol) * effectiveWidth
```

`Math.sqrt(1.0) = 1.0` — the highest volume row still hits full effective width.
`Math.sqrt(0.25) = 0.5` — a row with 25% of max volume gets 50% width instead of 25%.
`Math.sqrt(0.04) = 0.2` — a row with 4% of max volume gets 20% width instead of 4%.

This means low-volume rows are more visible and the profile looks filled rather than spikey with gaps.

After applying sqrt normalization, still apply the `profileMinRowWidth` floor from Task 1.

### Make Normalization Toggleable

Not all users want sqrt normalization. Add `profileScaleMode: 'linear' | 'sqrt'` to the store. Default `'sqrt'`.

In `drawVolumeProfile`, check `profileScaleMode`:
- `'linear'`: use `vol / maxVol * effectiveWidth`
- `'sqrt'`: use `Math.sqrt(vol / maxVol) * effectiveWidth`

Add to settings panel inside `VOLUME PROFILE` section:
```
Scaling          [LINEAR] [SQRT]
```

Two small toggle buttons. Active mode has `#3D7EFF` border.

---

## Store Additions

**File:** `lib/store/chart.ts`

```ts
profileScaleMode: 'linear' | 'sqrt'   // default 'sqrt', persisted
```

`profileBucketSize` is derived, not stored — computed from `bucketSize` at render time.

---

## Changes to `drawVolumeProfile`

**File:** `lib/draw/drawVolumeProfile.ts`

`drawVolumeProfile` receives `profileBucketSize` as a new parameter — passed from `ChartCanvas` where it is computed as `Math.max(5, Math.floor(bucketSize / 4))`.

Row height calculation changes from:
```
topY    = priceToY(row.price + bucketSize)
bottomY = priceToY(row.price)
```
to:
```
topY    = priceToY(row.price + profileBucketSize)
bottomY = priceToY(row.price)
```

This must be consistent — if rows are built at `$25`, they must also be rendered at `$25` height.

---

## Changes to `buildProfile` Signature

Old:
```ts
buildProfile(candles, firstIndex, lastIndex, engine, bucketSize)
```

New:
```ts
buildProfile(candles, firstIndex, lastIndex, engine, bucketSize, profileBucketSize)
```

All callers of `buildProfile` — in `ChartCanvas` for both default and custom profiles — must pass the computed `profileBucketSize`. Audit all call sites.

---

## How to Verify This Task is Done

- Open the chart with default settings
- Count visible profile rows — should be significantly more than before (3–4x at minimum)
- Profile shape should look smooth and curved, not like a blocky staircase
- Switch `profileScaleMode` to `LINEAR` in settings — profile becomes spikier, outlier rows dominate
- Switch back to `SQRT` — profile flattens out, more rows visible at reasonable widths
- Change footprint `bucketSize` from `$100` to `$50` — profile automatically gets finer rows (`$12.5` base)
- Change `bucketSize` to `$500` — profile rows get coarser (`$125` base)
- Verify profile row heights match the price range they represent — a `$25` row should visually span `$25` of price, confirmed by checking against the price axis
- Min row width from Task 1 still works — no regression

Do not proceed to Task 3 until the profile visibly has finer rows and smoother width distribution.