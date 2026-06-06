# Volume Profile — Phase 2 & 3 Implementation Tasks
## Agent Instructions — Read Fully Before Starting Any Task

Rules:
- Complete tasks in order. Do not skip ahead.
- After each task, update LOG.md with what changed and what files were touched.
- Do not refactor unrelated code while implementing a task.
- If a task requires a new store field, add it to the existing chart store, do not create a new store.
- If a task requires a new draw function, create a new file in `lib/draw/` or `components/chart/` consistent with existing naming.
- All new settings must be wired to the existing settings UI pattern already used in `ChartSettingsDropdown.tsx`.

---

# PHASE 2 — New Profile Modes

---

## Task 4: Visible Range Profile (Auto-Rebuild on Scroll/Zoom)

**What it does:**
A profile that automatically rebuilds whenever the visible candle range changes.
As the user pans or zooms, the profile recalculates for exactly the candles on screen.

**Implementation steps:**

1. Add a new `profilePeriod` enum value: `'visible'` alongside existing values in the store.

2. In `ChartCanvas.tsx`, detect when the visible candle range changes (start index or end index changes).
   Use a `useEffect` or ref comparison — do not trigger on every render, only when range actually changes.

3. When `profilePeriod === 'visible'` and visible range changes:
   - Call `volumeProfileEngine.buildProfile()` with the currently visible candle slice.
   - Pass no `priceHigh`/`priceLow` bounds (full price range of visible candles).
   - Store the result in a local ref, not in Zustand state, to avoid React re-render cascade.

4. Render this profile using the existing `drawVolumeProfile` function anchored to the right side,
   same as the default attached profile.

5. Add a debounce of 150ms on the rebuild trigger so rapid scrolling does not spam buildProfile calls.

6. Wire a "Visible" option into the VBP Period selector in settings UI.

**Files likely touched:**
- `lib/store/chart.ts` — add `'visible'` to period enum
- `components/chart/ChartCanvas.tsx` — visible range change detection + rebuild trigger
- `components/ui/ChartSettingsDropdown.tsx` — add Visible option to period selector

---

## Task 5: Multiple Profiles (Per Session / Per Day)

**What it does:**
Renders one separate profile for each time period (e.g. one per day, one per 4 hours).
Each profile is anchored to its own time range on the chart.

**Implementation steps:**

1. Add a `profileLength` config to the store with two fields:
   - `profileLengthType`: `'minutes' | 'hours' | 'days'`
   - `profileLengthValue`: number (e.g. 1 for daily, 4 for 4-hour, 240 for 4-hour in minutes)

2. Write a helper function `splitCandlesByPeriod(candles, lengthType, lengthValue)` in `lib/utils/`.
   It returns an array of candle slices, each representing one period.
   Use UTC day boundaries for `'days'`, hour boundaries for `'hours'`.

3. In `ChartCanvas.tsx`, when `profilePeriod === 'multiple'`:
   - Split visible candles into period slices using the helper.
   - Build a profile for each slice using `volumeProfileEngine.buildProfile()`.
   - Do not build profiles for slices entirely outside the visible range.

4. For each built profile, render it anchored to its own time range:
   - X position: left edge = first candle of that slice, right edge = last candle of that slice.
   - Bars extend leftward from the right edge of the slice (or rightward — match DeepCharts direction).
   - Max bar width = width of the slice in pixels × `profileWidthPct`.

5. Each profile is normalized independently (its own `maxVol`). Do not normalize across profiles.

6. Add `profileLengthType` and `profileLengthValue` controls to settings UI.
   Defaults: `days`, value `1`.

7. Wire a "Multiple" option into the VBP Period selector.

**Files likely touched:**
- `lib/store/chart.ts`
- `lib/utils/splitCandlesByPeriod.ts` (new file)
- `components/chart/ChartCanvas.tsx`
- `components/ui/ChartSettingsDropdown.tsx`

---

## Task 6: Ask/Bid Split Bar Profile

**What it does:**
Each profile row shows bid volume and ask volume as two separate colored bars
extending in opposite directions (or side-by-side), instead of a single total volume bar.

**Implementation steps:**

1. Add `profileVbpType` field to store with values:
   `'volume' | 'askBid' | 'delta' | 'deltaAndVolume' | 'deltaPercent' | 'tradeCount'`
   Default: `'volume'`. (Later tasks will use other values.)

2. In `drawVolumeProfile.ts`, add a branch for `profileVbpType === 'askBid'`:
   - For each row, draw two bars:
     - **Ask bar** (buying aggression): green, extends right from profile anchor.
       Width = `(row.askVol / maxAskVol) × maxBarWidth × profileWidthPct`
     - **Bid bar** (selling aggression): red, rendered on top of ask or offset left.
       Width = `(row.bidVol / maxBidVol) × maxBarWidth × profileWidthPct`
   - Normalize ask and bid separately to their own maximums across the profile.
   - Apply same opacity gradient formula from Phase 1 Task 2, using `row.totalVol / maxVol`.

3. Confirm `row.askVol` and `row.bidVol` are present in the profile row data from `profileEngine.ts`.
   If not, verify fine rows in cache store these fields and they survive aggregation.
   Do not proceed with this task if bid/ask data is missing — report it instead.

4. Add "Ask/Bid" option to the VBP Type selector in settings UI.

**Files likely touched:**
- `lib/store/chart.ts`
- `components/chart/drawVolumeProfile.ts`
- `components/chart/drawSelectionRect.ts` (same change for custom profiles)
- `components/ui/ChartSettingsDropdown.tsx`

---

## Task 7: HVN Detection and Highlighting

**What it does:**
Identifies secondary high-volume nodes (not just the POC) and renders them
with a distinct highlight color. Makes D-shape, P-shape, b-shape structure visible.

**Implementation steps:**

1. In `lib/utils/volumeProfile.ts`, add a function `detectHVNs(rows, maxVol, options)`:
   - Input: sorted row array, maxVol, options `{ sensitivityPct: number, maxHVNs: number }`
   - Step 1: smooth the row volumes with a simple moving average (window = 3 rows).
   - Step 2: find local maxima on the smoothed array where:
     - Row volume > both neighbors
     - Row volume > `sensitivityPct / 100 × maxVol` (e.g. 30% of POC by default)
   - Step 3: exclude the POC itself (already highlighted separately).
   - Step 4: return top N peaks sorted by volume descending, capped at `maxHVNs` (default 3).

2. Add `hvnSensitivity: number` (default 30) and `hvnMaxCount: number` (default 3) to store.

3. In `profileEngine.ts`, call `detectHVNs` after the existing POC/VA/LVN calculation.
   Attach result as `profile.hvns: ProfileRow[]`.

4. In `drawVolumeProfile.ts`, after drawing all rows:
   - For each row in `profile.hvns`, draw an accent outline or brighter fill.
   - Suggested: same highlight style as POC but using a distinct color (e.g. cyan or purple).
   - Do not redraw the full bar — just add a left-edge accent line 2px wide.

5. Add `hvnSensitivity` slider to settings UI (range 10–80, label "HVN Sensitivity").
   Add same controls to custom profile settings.

**Files likely touched:**
- `lib/utils/volumeProfile.ts`
- `lib/volumeProfile/profileEngine.ts`
- `components/chart/drawVolumeProfile.ts`
- `components/chart/drawSelectionRect.ts`
- `lib/store/chart.ts`
- `components/ui/ChartSettingsDropdown.tsx`

---

## Task 8: Composite Profile

**What it does:**
Builds a single profile from all loaded candle data (not just visible range).
Useful for identifying the overall value area across multiple sessions.

**Implementation steps:**

1. Add `'composite'` to `profilePeriod` enum in store.

2. In `ChartCanvas.tsx`, when `profilePeriod === 'composite'`:
   - Pass the entire loaded candle array (not just visible) to `volumeProfileEngine.buildProfile()`.
   - Only rebuild when the total loaded candle set changes (new data fetched), not on every pan/zoom.
   - Cache the result in a ref. Do not store in Zustand.

3. Render composite profile anchored to the right edge of the chart, same as default profile.
   It does not move when panning. It always represents total loaded history.

4. Composite profile should visually distinguish itself from the default profile.
   Suggested: use a different base color (e.g. purple instead of amber) or lower opacity (0.5).
   Add a label "COMPOSITE" or "C" above the profile.

5. Wire "Composite" option into VBP Period selector in settings UI.

**Files likely touched:**
- `lib/store/chart.ts`
- `components/chart/ChartCanvas.tsx`
- `components/ui/ChartSettingsDropdown.tsx`

---

# PHASE 3 — Advanced Features

---

## Task 9: Minimum Order Size Filter

**What it does:**
Only trades above a minimum size (in contracts/coins) contribute to the profile.
Filters out noise from tiny retail fills. Shows institutional activity only.

**Implementation steps:**

1. Add `profileMinTradeSize: number` (default 0 = disabled) to store.

2. In `lib/volumeProfile/profileCache.ts` or wherever fine rows are built from raw trades:
   - When `profileMinTradeSize > 0`, skip any individual trade where `trade.size < profileMinTradeSize`.
   - This filter must apply before aggregation into fine rows, not after.

3. Confirm: if fine rows are pre-built and cached, this filter cannot be applied retroactively.
   In that case, the filter must either:
   a. Trigger a cache invalidation and rebuild from raw trades, OR
   b. Only apply to the raw trade fallback path (trades not covered by fine rows).
   Report which path applies before implementing.

4. Add a numeric input "Min Trade Size" to settings UI. Default empty (disabled).
   When set, show a visual indicator that the profile is filtered.

**Files likely touched:**
- `lib/store/chart.ts`
- `lib/volumeProfile/profileCache.ts` or equivalent raw trade ingestion path
- `components/ui/ChartSettingsDropdown.tsx`

---

## Task 10: Delta Percentage Profile Type

**What it does:**
Each row shows delta as a percentage of total volume at that level,
not the raw delta value. Highlights relative aggression strength.

**Implementation steps:**

1. In `profileEngine.ts`, for each row add a computed field:
   `row.deltaPercent = row.totalVol > 0 ? ((row.askVol - row.bidVol) / row.totalVol) × 100 : 0`
   Range: -100 to +100.

2. In `drawVolumeProfile.ts`, add branch for `profileVbpType === 'deltaPercent'`:
   - `maxAbsDeltaPct` = max of `Math.abs(row.deltaPercent)` across all rows.
   - Bar width = `Math.abs(row.deltaPercent) / maxAbsDeltaPct × maxBarWidth × profileWidthPct`
   - Color: positive deltaPercent = green (net buying), negative = red (net selling).
   - Apply opacity gradient using `Math.abs(row.deltaPercent) / maxAbsDeltaPct`.

3. Add "Delta %" option to VBP Type selector in settings UI.

**Files likely touched:**
- `lib/volumeProfile/profileEngine.ts`
- `components/chart/drawVolumeProfile.ts`
- `components/chart/drawSelectionRect.ts`
- `lib/store/chart.ts`
- `components/ui/ChartSettingsDropdown.tsx`

---

## Task 11: Trade Count Profile Type

**What it does:**
Profile built from number of individual trades (fills) per level, not volume.
Highlights price levels with high trade frequency regardless of size.

**Implementation steps:**

1. Confirm that raw trade data or fine row cache stores `tradeCount` per price level.
   If not, this task cannot be completed without modifying the data ingestion pipeline.
   Report before proceeding.

2. If `tradeCount` exists in fine rows:
   - Add `'tradeCount'` to `profileVbpType` enum.
   - In `profileEngine.ts`, when `vbpType === 'tradeCount'`, aggregate `row.tradeCount`
     instead of `row.totalVol` for bar width normalization.
   - `profile.maxVol` in this mode becomes `profile.maxTradeCount`.

3. In `drawVolumeProfile.ts`, add branch for `profileVbpType === 'tradeCount'`:
   - Use `row.tradeCount / profile.maxTradeCount` for bar width ratio.
   - Color: neutral (white/gray) to distinguish from volume-based profiles.
   - Opacity gradient: `row.tradeCount / profile.maxTradeCount`.

4. POC in trade count mode = the price level with highest trade count, not highest volume.
   Update POC calculation in `profileEngine.ts` to respect `vbpType`.

5. Add "Trade Count" option to VBP Type selector in settings UI.

**Files likely touched:**
- `lib/volumeProfile/profileEngine.ts`
- `lib/volumeProfile/profileCache.ts` (verify tradeCount field exists)
- `components/chart/drawVolumeProfile.ts`
- `components/chart/drawSelectionRect.ts`
- `lib/store/chart.ts`
- `components/ui/ChartSettingsDropdown.tsx`

---

## Task 12: Developing POC Line

**What it does:**
Instead of a single POC line at the current highest-volume level,
shows a historical trace of where the POC has been as candles closed.
Reveals how the dominant price level migrated over time.

**Implementation steps:**

1. Add `pocLineType: 'static' | 'developing'` to store. Default `'static'`.

2. In `ChartCanvas.tsx`, when `pocLineType === 'developing'`:
   - Build an incremental profile for each closed candle time step in the visible range.
   - For each step T, build profile from session start to T, extract POC price.
   - Result: an array of `{ timestamp, pocPrice }` data points.
   - Cache this array in a ref. Rebuild only when candle data or session range changes.
   - Performance note: do not call full `buildProfile()` per candle — instead maintain
     a running row map and update it incrementally as each candle is added.

3. Render the developing POC as a step line on the chart canvas:
   - For each time step, draw a horizontal segment at `pocPrice` from T to T+1.
   - Use a distinct color (e.g. dotted blue) to differentiate from static POC line.

4. Add "Developing" toggle to POC Line settings in the UI.

**Files likely touched:**
- `lib/store/chart.ts`
- `components/chart/ChartCanvas.tsx`
- `lib/draw/drawDevelopingPOC.ts` (new file)
- `components/ui/ChartSettingsDropdown.tsx`

---

## Task 13: Merge / Split Profiles

**What it does:**
Right-click any rendered profile to merge it with the adjacent profile (combine their candle ranges)
or split a composite back into its original periods.

**Implementation steps:**

1. Add a `profileInstances` array to store. Each instance has:
   ```ts
   {
     id: string,
     startTime: number,
     endTime: number,
     mergedWith: string[] // IDs of profiles merged into this one
   }
   ```

2. In `ChartCanvas.tsx`, detect right-click on a profile bar region (hit-test against profile X bounds).
   Show a context menu with: Merge Previous, Merge Next, Split, Reset.

3. **Merge:** combine `startTime` of earlier instance with `endTime` of later instance.
   Rebuild combined profile from the merged time range.

4. **Split:** restore original `startTime`/`endTime` from `mergedWith` history.
   Rebuild individual profiles.

5. **Reset:** clear all merges, restore default period-based split.

6. Context menu component should reuse any existing right-click menu pattern in the codebase.
   If none exists, create a minimal absolutely-positioned div with onClick handlers.

**Files likely touched:**
- `lib/store/chart.ts`
- `components/chart/ChartCanvas.tsx`
- `components/ui/ProfileContextMenu.tsx` (new file)

---

## Task 14: Swing Profile (Auto-Detect Swings)

**What it does:**
Automatically detects price swings and renders a volume profile for each swing.
No manual selection required.

**Implementation steps:**

1. Write `lib/utils/detectSwings.ts` with function `detectSwings(candles, options)`:
   - Options: `{ type: 'leftRightBar' | 'highestLowest' | 'reversalTick', lookback: number, reversalTicks: number }`
   - For `leftRightBar`: a swing high is a candle whose high is higher than N candles left and right.
     A swing low is a candle whose low is lower than N candles left and right.
   - Returns array of `{ type: 'high' | 'low', index: number, price: number, timestamp: number }`.

2. In `ChartCanvas.tsx`, add a `profilePeriod === 'swing'` branch:
   - Detect swings in visible candles using `detectSwings`.
   - For each consecutive high→low or low→high swing pair, build a profile
     from the candles between those two swing points.
   - Render each swing profile anchored within its own swing's time range.
   - Max bar width = swing width in pixels × `profileWidthPct`.

3. Draw swing boundary lines (thin dashed lines at swing high/low) to show swing detection visually.
   These should be toggleable via a "Show Swing Lines" setting.

4. Add swing detection settings to UI:
   - Swing Type selector (Left Right Bar, Highest Lowest, Reversal Tick)
   - Lookback value (default 5 bars)

5. Add "Swing" option to VBP Period selector in settings UI.

**Files likely touched:**
- `lib/utils/detectSwings.ts` (new file)
- `lib/store/chart.ts`
- `components/chart/ChartCanvas.tsx`
- `components/ui/ChartSettingsDropdown.tsx`

---

## Completion Checklist

| Task | Feature | Phase |
|---|---|---|
| Task 4 | Visible range profile | 2 |
| Task 5 | Multiple profiles per period | 2 |
| Task 6 | Ask/Bid split bars | 2 |
| Task 7 | HVN detection + highlight | 2 |
| Task 8 | Composite profile | 2 |
| Task 9 | Min order size filter | 3 |
| Task 10 | Delta % profile type | 3 |
| Task 11 | Trade count profile type | 3 |
| Task 12 | Developing POC line | 3 |
| Task 13 | Merge/Split profiles | 3 |
| Task 14 | Swing auto-profile | 3 |

Phase 1 (Tasks 1–3) is in `deepcharts_vp_analysis.md`.
Complete Phase 1 before starting anything here.