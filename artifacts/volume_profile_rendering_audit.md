# Volume Profile Rendering Audit

## 1. Current Profile Data Flow

Both default and custom profiles use the same active `VolumeProfileSource` from `ChartEngineContext`. In `ChartCanvas`, custom profiles call `volumeProfileEngine.buildProfile()` with the selected candle slice plus `priceHigh`/`priceLow`, while the default attached profile calls the same method with the visible candle slice and no price bounds (`components/chart/ChartCanvas.tsx:553`, `components/chart/ChartCanvas.tsx:623`).

The current active source is `RawTradeVolumeProfileEngine`, backed by `VolumeProfileBaseCache`. On panel/feed setup, `FeedProvider` attaches a shared source-scoped fine-row cache keyed by symbol, contract type, data source mode, and `tickSize` as `baseBucketSize` (`components/FeedProvider.tsx:433`). The cache stores canonical 1 minute fine profile rows, with row prices normalized to the base bucket size (`lib/volumeProfile/profileCache.ts:161`). Stored fine rows are hydrated from `/api/history/profile` using the same base bucket size (`components/FeedProvider.tsx:1341`), live fine rows are hydrated after closed 1 minute slices (`components/FeedProvider.tsx:759`), and raw live/restored trades are retained as fallback/coverage fill (`components/FeedProvider.tsx:1047`, `components/FeedProvider.tsx:1208`).

At build time, the engine first reads fine rows in the requested time window, then aggregates each fine row into the requested display bucket using `normalizePriceToBucket(row.bucketPrice, profileBucketSize)` (`lib/volumeProfile/profileEngine.ts:209`). It then adds raw trades only for base candle times not already covered by fine rows, preventing double count for covered 1 minute slices (`lib/volumeProfile/profileEngine.ts:232`). The final row map is sorted and calculates total volume, max row volume, max absolute delta, POC, VA, and LVNs from that same map (`lib/volumeProfile/profileEngine.ts:318`).

Empty rows are not explicitly inserted. The profile contains only rows with volume from fine rows or fallback trades. However, because `profileResolutionTicks` defaults to 1 and base rows are tick-sized, BTC can produce many non-empty, low-volume rows, which can visually behave like clutter even without true empty rows.

There is also an older utility path in `lib/utils/volumeProfile.ts` that can build a profile from footprint candles or OHLCV fallback (`lib/utils/volumeProfile.ts:29`). Current `ChartCanvas` profile rendering does not call this function directly, but it is relevant risk if any old path still imports it later. Its split logic only subdivides larger footprint buckets into finer profile rows when `bucketSize / profileBucketSize` rounds above 1 (`lib/utils/volumeProfile.ts:52`), so it is not the current default/custom attached profile path.

## 2. Row Size / Aggregation Behavior

Displayed row size is computed as:

```ts
profileBucketSize = tickSize > 0
  ? tickSize * Math.max(1, profileResolutionTicks)
  : Math.max(1, bucketSize / 4)
```

This means row size is independent from footprint `bucketSize` when a tick size exists (`components/chart/ChartCanvas.tsx:437`). Store defaults set `profileResolutionTicks: 1`, `profileMinRowHeight: 1`, `profileMinRowWidth: 2`, and `profileScaleMode: 'sqrt'` (`lib/store/chart.ts:416`). The UI slider labels row size as ticks and allows 1 to 40 ticks (`components/ui/ChartSettingsDropdown.tsx:813`), while the store action permits up to 100 ticks (`lib/store/chart.ts:783`).

Aggregation is mathematically consistent when `profileBucketSize` is a whole multiple of the fine cache base bucket. The engine explicitly rejects incompatible combinations where `baseBucketSize > profileBucketSize` or the ratio is not an integer (`lib/volumeProfile/profileEngine.ts:360`). Since the shared cache base bucket is initialized from `tickSize`, normal settings like 1, 2, 5, 10, 20, or 40 ticks aggregate correctly into larger buckets.

Bucket boundaries are aligned by flooring price to the bucket size (`lib/utils/aggregation.ts:1`). This is consistent across fine row ingestion and display aggregation, but it means all buckets are anchored to absolute zero rather than to the selected profile's visible/selected low. That is stable and deterministic, but custom range boundaries can cut through bucket spans: rows are included/excluded by the floored row price, not by partial overlap against the selected high/low (`lib/volumeProfile/profileEngine.ts:222`). This is acceptable for coarse display but can be visually surprising at selection edges.

For BTC visual structure, 0.5 or 1 tick rows are likely too fine for the intended auction-shape read. At 1 tick resolution, every tiny traded price level becomes a row. Even if the raw math is correct, the row count is too high for P-shape, b-shape, D-shape, HVN, and LVN structure to emerge cleanly on a compressed canvas. Larger buckets, such as 5 to 20 ticks for intraday BTC and possibly 25 to 50 ticks for wider ranges, are more likely to expose structure.

## 3. Width Normalization

Each profile is normalized per built profile, not per row. `maxVol` is computed as the highest `totalVol` among the rows in the same profile map (`lib/volumeProfile/profileEngine.ts:318`), and draw width uses `row.totalVol / profile.maxVol` (`components/chart/drawVolumeProfile.ts:52`, `components/chart/drawSelectionRect.ts:131`). POC is the same highest total-volume row used to define `maxVol` (`lib/utils/volumeProfile.ts:141`), so width scaling and POC are internally aligned.

Bid/ask/delta are not mixed into the main width calculation. Main profile bars use `row.totalVol`; delta profile uses `maxAbsDelta` and `askVol - bidVol` in a separate strip (`lib/draw/drawDeltaProfile.ts:41`). The main profile therefore represents total traded volume, not delta.

The major visual issue is the default `sqrt` scale. With square-root scaling, weak rows are deliberately expanded:

```text
1% of POC volume -> 10% visual width
4% of POC volume -> 20% visual width
9% of POC volume -> 30% visual width
25% of POC volume -> 50% visual width
```

That compression helps small rows remain visible, but it hides contrast between weak and strong areas. For auction-structure reading, it makes tails and low-volume pockets look too important and makes the POC/HVN less dominant. Linear scaling is more truthful for shape, while sqrt scaling is more readable for activity presence.

Custom and default profiles are each normalized to their own max row. That is correct in isolation, but it means a narrow custom selection can make low absolute volume look large because its local POC becomes 100%. This is expected behavior but should be made clear: custom profile shape is relative to the selected range, not directly comparable to the default profile width unless both are built from identical candles and price bounds.

## 4. Visual Clamping and Filled Mode

Minimum width is applied to every nonzero volume row. Default and custom renderers both do:

```ts
if (row.totalVol > 0 && profileMinRowWidth > 0) {
  barWidth = Math.max(profileMinRowWidth, barWidth);
}
```

The default is 2 px (`lib/store/chart.ts:421`), with UI/store allowing up to 8 px (`components/ui/ChartSettingsDropdown.tsx:857`, `lib/store/chart.ts:792`). On a fine BTC profile with many low-volume rows, a 2 px floor turns single-print or tiny rows into visible bars. This is a direct reason low-volume rows look too large.

Minimum row height has the same effect vertically. If a row's actual price-to-pixel height is below the configured minimum, the renderer expands it around the row center (`components/chart/drawVolumeProfile.ts:213`, `components/chart/drawSelectionRect.ts:259`). The default is 1 px and the UI allows up to 4 px (`components/ui/ChartSettingsDropdown.tsx:873`). At fine row sizes, this can make adjacent weak rows visually merge into a noisy filled band.

There is no separate "filled mode" branch in the current profile renderer. The current bar drawing uses solid `fillRect` rows for all rendered modes. The profile can still feel "filled" because dense 1 tick rows plus min row height create near-continuous vertical coverage, and because VA fill paints a blue rectangle across the value area (`components/chart/drawVolumeProfile.ts:37`, `components/chart/drawSelectionRect.ts:113`). If the UI still exposes a filled/bar concept elsewhere, this renderer is effectively using filled row rectangles either way.

Opacity does not encode row strength. Every non-POC row gets the same amber opacity regardless of volume (`components/chart/drawVolumeProfile.ts:71`, `components/chart/drawSelectionRect.ts:147`). A low-volume row with a clamped width and full row opacity therefore looks materially stronger than its true share of volume. The POC gets a brighter redraw and outline, but non-POC HVNs are not visually emphasized beyond width.

## 5. POC / VA / HVN / LVN Accuracy

POC is calculated from the same aggregated rows used for drawing (`lib/volumeProfile/profileEngine.ts:318`). VA is also calculated from those same rows by expanding outward from the POC, always adding the adjacent side with higher volume until 70% of total volume is reached (`lib/utils/volumeProfile.ts:159`). That is internally consistent.

VAH/VAL rendering uses bucket edges: VAH is drawn at `vaHigh + profileBucketSize`, VAL at `vaLow` (`components/chart/drawVolumeProfile.ts:154`). POC and LVN lines use row centers (`components/chart/drawVolumeProfile.ts:131`, `components/chart/drawVolumeProfile.ts:201`). This is a reasonable distinction, but it can look inconsistent when row size is large.

LVNs are detected as local valleys only when a row is at most 65% of both neighbors' minimum and at most 85% of the average row volume, capped at 5 markers (`lib/utils/volumeProfile.ts:204`). This is simple and deterministic, but it is very sensitive to row resolution. At 1 tick, neighboring rows are noisy and LVN candidates can be accidental micro-valleys. At coarse row sizes, the same logic becomes more useful.

There is no explicit HVN detection or marker list in the current profile data. HVN-like information is only implied by width and the POC highlight. This is why HVN structure is not clear: the renderer has one strong POC accent, low-volume node markers, and VA fill, but no secondary high-volume node labeling or smoothing/peak detection.

## 6. Custom vs Default Profile Consistency

The math source is consistent: both custom and default profiles call the same `volumeProfileEngine.buildProfile()` with the same `profileBucketSize` setting. They therefore share the same fine-row/trade source, row aggregation, POC/VA/LVN math, and row normalization logic (`components/chart/ChartCanvas.tsx:559`, `components/chart/ChartCanvas.tsx:624`).

The render paths are separate but mostly duplicated. Default profiles use `drawVolumeProfile` and are anchored to the right-side profile area with a fixed `baseProfileWidth` of 120 px multiplied by `profileWidthPct` (`components/chart/ChartCanvas.tsx:629`, `components/chart/drawVolumeProfile.ts:28`). Custom profiles use `drawCustomProfile` and anchor bars to the left side of the selected rectangle, with max width equal to `rectWidth * profileWidthPct` (`components/chart/drawSelectionRect.ts:110`). Width ratios, sqrt/linear scaling, min width, min height, VA fill, POC line, VA lines, and LVN lines are otherwise very similar.

The key consistency gap is available width. A custom selection can be much wider than 120 px, so its bars can appear more expressive even with identical math. Conversely, a narrow custom range can compress everything and make min width more dominant. Default profile max width is bounded by `baseProfileWidth`, while custom profile max width is bounded by selection width.

Another consistency gap is clipping. Custom profile row rendering clips vertically to the selection rectangle (`components/chart/drawSelectionRect.ts:278`), while default profile rendering does not clip rows to a profile-specific rectangle and relies on the chart viewport. This is expected, but it means edge rows in custom profiles can appear truncated while default rows draw their full visible row height.

## 7. Why The Profile Looks Noisy

The calculation path appears mostly correct and consistent for the current engine. The noisy/scattered look is primarily visual-resolution and rendering-scale driven, not obviously a data-source or storage bug.

The strongest causes are:

1. `profileResolutionTicks` defaults to 1, so BTC profiles are drawn at tick-level granularity (`lib/store/chart.ts:418`). This creates many non-empty micro rows.

2. `sqrt` scaling is the default (`lib/store/chart.ts:422`). It intentionally enlarges low-volume rows and compresses high-volume dominance.

3. `profileMinRowWidth` defaults to 2 px and applies to every nonzero row (`components/chart/drawVolumeProfile.ts:61`). This gives tiny rows a visual floor.

4. `profileMinRowHeight` defaults to 1 px and can expand sub-pixel rows (`components/chart/drawVolumeProfile.ts:223`). Dense fine rows become a continuous, spiky texture.

5. All non-POC rows use the same opacity. Volume strength is encoded only by width, but width is then distorted by sqrt scaling and min width.

6. LVNs are detected on raw adjacent rows without smoothing. At very fine resolution, micro-valleys can be marked as LVNs even when they are not meaningful auction valleys.

7. There is no HVN detection beyond POC. Secondary high-volume areas are not semantically highlighted, so the user must infer them from noisy widths.

BTC data can be genuinely noisy at 1 tick resolution, especially on short time windows and mixed spot/futures data source mode. But the current defaults amplify that noise visually. A cleaner profile likely requires coarser display rows and less aggressive low-volume inflation before changing any data source or engine behavior.

## 8. Recommended Fix Order

1. Change the visual defaults first: use larger default `profileResolutionTicks` for BTC, set `profileScaleMode` to `linear` for auction-shape reading, and consider defaulting `profileMinRowWidth` to 0 or 1. This is the lowest-risk path because aggregation and storage remain unchanged.

2. Add a low-volume visual threshold or opacity curve. For example, skip or fade rows below a configurable percentage of POC volume instead of giving every nonzero row the same opacity and minimum width.

3. Separate "structure mode" from "presence mode". Structure mode should prefer linear scaling, coarser rows, low/no min width, and maybe no VA fill. Presence mode can keep sqrt scaling and min widths for seeing every traded row.

4. Add row smoothing or neighbor aggregation before LVN/HVN detection only, not necessarily before drawing. LVN detection should operate on meaningful display rows and likely require valley width/depth, not just one-row local minima.

5. Add explicit HVN detection for secondary peaks. POC alone is not enough to show D-shape, P-shape, or b-shape structure.

6. Unify duplicated render logic between `drawVolumeProfile` and `drawCustomProfile` after behavior is settled. The math is currently consistent, but duplicate scaling/clamping code increases the risk of future divergence.

7. Consider profile-width policy separately from math. Default profiles are capped by a 120 px base width, while custom profiles use selection width; that is useful, but direct visual comparison between default and custom profiles should not be assumed.

Suggested near-term readable BTC settings before code changes:

- Row size: 5 to 20 ticks for intraday profiles; 25 to 50 ticks for wider ranges.
- Scaling: linear when reading POC/HVN/LVN shape; sqrt only when intentionally inspecting low-volume participation.
- Min row width: 0 or 1 px.
- Min row height: 0 or 1 px.
- Opacity: lower for dense/fine rows, higher only after row size is coarse enough.
