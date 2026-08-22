# Volume Profile — Phase 1 Implementation Tasks
## Agent Instructions — Read Fully Before Starting Any Task

Rules:
- Complete tasks in order. Do not skip ahead.
- After each task, update LOG.md with what changed and what files were touched.
- Do not refactor unrelated code while implementing a task.
- If a store field already exists with the same purpose, reuse it — do not duplicate.
- Phase 1 is purely visual rendering fixes. No new features, no new profile types.
- All three tasks must be completed before Phase 2 begins.

---

## Task 1: Auto Tick Grouping

**What it does:**
Calculates the optimal profile row height dynamically based on the visible
price range and the canvas pixel height. Prevents sub-pixel rows that cause
the noisy scattered appearance. Row count will always match what the screen
can physically render cleanly.

**The problem this fixes:**
At fixed 8t row size, BTC can produce 300–800 rows across 400–600px of chart height.
That means rows are sub-pixel in height. Min row width then forces every row
to 2px width regardless of volume, so all rows look identical — no shape emerges.

**Implementation steps:**

1. In `ChartCanvas.tsx`, locate where `profileBucketSize` is calculated before
   passing it to `volumeProfileEngine.buildProfile()`. It currently reads from
   `profileResolutionTicks × tickSize`.

2. Add a new calculation immediately before each `buildProfile()` call:

   ```ts
   const TARGET_ROW_PX = 3; // target pixel height per row

   function calcAutoBucketSize(
     priceHigh: number,
     priceLow: number,
     canvasHeightPx: number,
     tickSize: number
   ): number {
     const priceRangeTicks = (priceHigh - priceLow) / tickSize;
     const ticksPerPx = priceRangeTicks / canvasHeightPx;
     const rawBucket = ticksPerPx * TARGET_ROW_PX * tickSize;
     // Round up to nearest tickSize multiple
     return Math.max(tickSize, Math.ceil(rawBucket / tickSize) * tickSize);
   }
   ```

3. When `profileResolutionTicks === 0` (auto mode) OR when no manual override is set,
   use `calcAutoBucketSize(priceHigh, priceLow, canvasHeightPx, tickSize)` as
   `profileBucketSize` instead of the fixed tick-based calculation.

4. When `profileResolutionTicks > 0` (manual override), keep existing behavior:
   `profileBucketSize = tickSize × profileResolutionTicks`.
   Auto mode does not override a manual setting.

5. Add `profileResolutionTicks = 0` as the new default in `lib/store/chart.ts`.
   0 means auto. Any value > 0 means manual override.

6. In the settings UI (`ChartSettingsDropdown.tsx`), update the Row Size slider label:
   - When slider is at 0 (leftmost), display "AUTO" instead of "0t / 0.00".
   - When slider is > 0, display existing format "8t / 4.00".

7. Apply the same `calcAutoBucketSize` for both default profile and custom profile
   `buildProfile()` calls in `ChartCanvas.tsx`. Custom profile uses selection
   `priceHigh`/`priceLow` and selection pixel height, not full canvas height.

**Do not change:**
- `profileEngine.ts` internals
- Cache key logic
- Fine row aggregation math

**Files likely touched:**
- `components/chart/ChartCanvas.tsx`
- `lib/store/chart.ts`
- `components/ui/ChartSettingsDropdown.tsx`

---

## Task 2: Opacity Gradient Per Row Volume Strength

**What it does:**
Encodes each row's volume strength into its opacity.
Rows near POC volume appear bright. Rows at 10% of POC appear nearly transparent.
This creates the visual gradient that makes D-shape, P-shape, b-shape emerge
without changing any width calculations.

**The problem this fixes:**
Every non-POC row currently renders at the same opacity regardless of volume.
A row with 1% of POC volume looks as visually heavy as a row with 80% of POC volume.
Shape cannot emerge from width alone when opacity is uniform.

**Implementation steps:**

1. In `drawVolumeProfile.ts`, find the section where `fillStyle` or `globalAlpha`
   is set for non-POC rows. It currently uses a fixed opacity constant.

2. Replace the fixed opacity with this formula:

   ```ts
   const MIN_OPACITY = 0.15;
   const volumeRatio = row.totalVol / profile.maxVol; // 0.0 to 1.0
   const rowOpacity = MIN_OPACITY + (1 - MIN_OPACITY) * volumeRatio;
   // Result: POC row = 1.0, row at 10% of POC = 0.235, row at 1% = 0.159
   ```

3. Apply `rowOpacity` to the bar fill. Two ways depending on current code:
   - If using `ctx.globalAlpha`: set `ctx.globalAlpha = rowOpacity` before `fillRect`.
     Reset to `1.0` after each row draw.
   - If using `rgba()` color string: inject `rowOpacity` into the alpha channel of
     the existing bar color string.
   Use whichever method is already in use. Do not switch rendering approach.

4. POC row must still render at full opacity (1.0). Confirm POC draw pass is
   separate and is not affected by the loop change.

5. Apply the identical formula to `drawSelectionRect.ts` for custom profiles.
   Both renderers must behave identically.

6. Do not apply opacity gradient to:
   - VA fill rectangle (keep its existing opacity)
   - POC line
   - VA lines
   - LVN markers
   Only the row bars get the gradient.

7. `MIN_OPACITY` should be a named constant at the top of each draw file,
   not a magic number inline. This makes it easy to tune later.

**Do not change:**
- Width calculation
- POC/VA/LVN draw logic
- Profile engine or data layer

**Files likely touched:**
- `components/chart/drawVolumeProfile.ts`
- `components/chart/drawSelectionRect.ts`

---

## Task 3: Continuous Row Fill — Eliminate Hairline Gaps

**What it does:**
Ensures adjacent profile rows share exact pixel boundaries with no hairline
gap between them. Currently floating point rounding can leave 1px gaps
between rows at certain zoom levels, making the profile look like
scattered separate bars instead of a continuous shape.

**The problem this fixes:**
If row N renders from Y=100 to Y=103.7 (floored to 103),
and row N+1 renders from Y=103.7 (floored to 103) to Y=107.4,
both rows start at Y=103 and overlap. Or if row N uses `Math.floor`
and row N+1 uses `Math.ceil`, a 1px gap appears at Y=103.
At fine row sizes this becomes visible as a striped/scattered texture.

**Implementation steps:**

1. In `drawVolumeProfile.ts`, find the row Y position and height calculation.
   It likely looks like:

   ```ts
   const rowY = priceToY(row.bucketPrice + profileBucketSize);
   const rowHeight = priceToY(row.bucketPrice) - rowY;
   ```

2. Verify: does `rowY` of row N equal `rowY + rowHeight` of row N-1?
   Add a temporary console.log to check 5 adjacent rows:

   ```ts
   // TEMP DEBUG — remove after confirming
   rows.slice(0, 5).forEach((row, i) => {
     const y = priceToY(row.bucketPrice + profileBucketSize);
     const h = priceToY(row.bucketPrice) - y;
     console.log(`Row ${i}: y=${y}, h=${h}, bottom=${y + h}`);
   });
   ```

   If `bottom` of row N does not equal `y` of row N+1, gaps exist.

3. Fix by computing row height as the difference between adjacent row Y positions,
   not from price-to-pixel independently per row:

   ```ts
   // Sort rows by price ascending first
   const sortedRows = [...profile.rows].sort((a, b) => a.bucketPrice - b.bucketPrice);

   sortedRows.forEach((row, i) => {
     const rowTop = priceToY(row.bucketPrice + profileBucketSize);
     // Use next row's top as this row's bottom, or calculate from price if last row
     const rowBottom = i < sortedRows.length - 1
       ? priceToY(sortedRows[i + 1].bucketPrice + profileBucketSize)
       : priceToY(row.bucketPrice);
     const rowHeight = Math.max(1, rowBottom - rowTop); // minimum 1px
   });
   ```

   This guarantees no gaps regardless of floating point behavior.

4. Apply the same fix to `drawSelectionRect.ts` for custom profiles.

5. Remove the temporary console.log after confirming gaps are resolved.

6. After implementing, zoom the chart to several different levels and visually
   confirm the profile looks continuous with no striping. Report zoom levels tested.

**Do not change:**
- `priceToY` function itself
- Row sort order used for draw iteration elsewhere
- Min row height logic (but note: with exact boundaries, min row height should
  rarely trigger — if rows are still expanding, auto grouping from Task 1 may
  need to be applied first)

**Files likely touched:**
- `components/chart/drawVolumeProfile.ts`
- `components/chart/drawSelectionRect.ts`

---

## Task 4: Default Scaling Mode to Linear

**What it does:**
Changes the default profile scaling mode from `sqrt` to `linear`.
SQRT remains available as a manual setting but is no longer the default.

**Why:**
Linear scaling shows true volume proportions. Shape (D, P, b, balanced)
emerges from actual volume distribution. SQRT inflates low-volume rows
and compresses high-volume dominance — it hides structure.
SQRT is only useful when the goal is "see every traded level" not "read shape."

**Implementation steps:**

1. In `lib/store/chart.ts`, find `profileScaleMode` default value.
   Change from `'sqrt'` to `'linear'`.

2. Confirm the settings UI toggle (LINEAR / SQRT buttons) still works correctly.
   No change needed there — just verifying the default reflects in the UI on load.

3. In `ChartSettingsDropdown.tsx` or wherever the SQRT/LINEAR toggle is rendered,
   add a tooltip or label below the toggle:
   - Under LINEAR: "True proportions — best for shape reading"
   - Under SQRT: "Amplifies low volume — best for activity presence"
   Keep labels short. If tooltip is complex to add, skip the labels.

4. No changes to the sqrt/linear calculation logic itself.

**Files likely touched:**
- `lib/store/chart.ts`
- `components/ui/ChartSettingsDropdown.tsx` (optional tooltip only)

---

## Phase 1 Completion Checklist

Before marking Phase 1 done and moving to Phase 2, confirm all of these:

| Check | Confirmed |
|---|---|
| Auto grouping active by default (profileResolutionTicks = 0) | |
| Row Size slider shows "AUTO" at position 0 | |
| Manual row size still works when slider > 0 | |
| Opacity gradient applied — weak rows visually dimmer than strong rows | |
| POC row still at full opacity | |
| VA fill, POC line, VA lines unaffected by opacity change | |
| No hairline gaps between rows at any zoom level | |
| Default scaling mode is LINEAR on fresh load | |
| Custom profile (selection box) has identical rendering behavior | |
| LOG.md updated with all changed files | |

Do not begin Phase 2 until every row in this checklist is confirmed.