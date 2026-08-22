# Code Quality Audit — Full Project Pass

---

## Goal

Go through the entire codebase and clean it up. No new features. No design changes. No folder structure changes. The focus is duplication, reusability, type safety, dead code, and consistency. Every section below is a specific area to audit and fix.

---

## 1. Duplicated Logic to Consolidate

### maxVol calculation

`maxVol` — the highest single-side volume across visible cells — is calculated separately in at least three places:
- `drawFootprint.ts`
- `drawBubbles.ts`
- `drawAbsorption.ts` (for imbalance scoring)

Extract this into one shared utility function in `lib/utils/volumeProfile.ts` or a new `lib/utils/chartUtils.ts`:

`getMaxCellVolume(candles, visibleRange, engine): number`

Takes visible candles, the range, and the engine. Returns the highest `bidVol` or `askVol` across all visible cells. All three draw functions call this once at the start of the redraw instead of each computing it independently.

---

### Candle iteration pattern

Multiple draw functions loop through visible candles with the same pattern:
```
for (let i = visibleRange.firstIndex; i <= visibleRange.lastIndex; i++) {
  const x = indexToX(i)
  if (x === null) continue
  const fc = engine.getFootprintCandle(candles[i].time)
  ...
}
```

This pattern repeats in `drawFootprint`, `drawBubbles`, `drawAbsorption`, `drawLines` (for vertical lines), and `drawVolumeProfile`. Extract a helper:

`getVisibleCandlesWithCoords(candles, visibleRange, indexToX, engine?)`

Returns an array of `{ index, candle, x, footprintCandle }` objects — only entries where `x` is not null. All draw functions iterate this result instead of rewriting the loop. `footprintCandle` is optional in the return — only populated when `engine` is passed.

---

### Rolling window calculation

The absorption engine computes a rolling average of delta and volume over the last N candles. This same rolling window logic likely exists in `lib/absorption/engine.ts`. If any future feature (e.g. session stats in the sidebar) also needs rolling averages, it will duplicate this. Extract:

`getRollingAverages(candles, endIndex, windowSize): { avgAbsDelta: number, avgVolume: number }`

Into `lib/utils/chartUtils.ts`. Absorption engine imports from there.

---

### Opacity scaling formula

Both `drawFootprint` and `drawBubbles` compute opacity from volume using:
`Math.max(minOpacity, vol / maxVol)`

Extract into `lib/utils/chartUtils.ts`:

`scaleOpacity(vol, maxVol, minOpacity, maxOpacity): number`

Returns a value between `minOpacity` and `maxOpacity`. Single source of truth for how volume maps to opacity across the whole app.

---

### Volume abbreviation formatter

`fmt(n)` — the function that turns `1200` into `1.2k` — is almost certainly duplicated in `drawFootprint.ts`, `drawBubbles.ts`, `drawAbsorption.ts`, and `Sidebar.tsx`. Move it once to `lib/utils/format.ts`:

`formatVol(n: number): string`
`formatPrice(n: number, decimals?: number): string`
`formatDelta(n: number): string` — includes sign prefix, handles abbreviation

All files import from here. No inline formatting functions anywhere.

---

### Delete/close button hit detection

The `✕` button hit detection pattern appears in both `drawSelectionRect` (custom profile delete) and `drawLines` (line delete dot). The mouse proximity check `abs(mouseX - targetX) < radius && abs(mouseY - targetY) < radius` is duplicated.

Extract into `lib/utils/canvas.ts`:

`isNearPoint(mouseX, mouseY, targetX, targetY, radius): boolean`

Used everywhere a click proximity check is needed.

---

## 2. Type Audit

### Strict null checks on coordinate functions

`indexToX` returns `number | null`. Every call site should already be checking for null before drawing. Audit every file that calls `indexToX` and confirm there is a null guard. A missing null guard causes drawing at `x = 0` unexpectedly or a runtime crash.

### `FootprintCandle.cells` map key type

The `cells` map is `Map<number, FootprintCell>` where the key is the normalized bucket price. Confirm every `.get()` and `.set()` call uses the output of `normalizePriceToBucket` and never a raw price. A raw price passed directly as a key will silently miss the lookup and return `undefined`.

### `DrawnLine.value` type — candle time not index

The `value` field on vertical `DrawnLine` should store `candle.time` (unix seconds) not the array index. If it currently stores an index, change the type comment to make this explicit and update the draw function to do a `candles.findIndex(c => c.time === line.value)` lookup each frame. Add a JSDoc comment to the `DrawnLine` interface clarifying what `value` represents for each line type.

### `AbsorptionResult.signals` partial scores

Each signal field in `signals` should be typed as `number` and always present — even if that signal contributed 0 points. Confirm the scoring function initializes all five fields to 0 before adding to them, so no field is ever `undefined`.

### Store action parameter types

All per-panel actions (if multi-panel is implemented) take `panelId: 'left' | 'right'` as first argument. Confirm none of these are typed as `string` — should be the literal union type. A `string` type would allow passing `'center'` without a compile error.

### `CoordinateSystem` interface completeness

Confirm `CoordinateSystem` returned by `buildCoordinates` includes `barWidth` — it is used in multiple draw functions that receive `CoordinateSystem` as a parameter. If any draw function is accepting `barWidth` as a separate parameter alongside `CoordinateSystem`, consolidate — `barWidth` should come from the coords object.

---

## 3. Dead Code

### Remove any remaining `lightweight-charts` references

The original Phase 3 used `lightweight-charts` before the canvas rewrite. Confirm:
- No `lightweight-charts` in `package.json` dependencies
- No imports from `lightweight-charts` anywhere in the codebase
- No `useChartInit.ts` file leftover from the original approach
- No `CandleChart.tsx` from the original approach

If any of these exist, remove them. They are dead code and a source of confusion.

### Remove `trades[]` from Zustand store if unused

The original Phase 2 plan included a `trades: Trade[]` array in the store capped at 5000 entries. If nothing in the app reads from `trades[]` directly (the aggregation engine consumes trades directly, not via the store), remove this array. It accumulates memory for no benefit. Confirm by searching all files for `trades` store reads — if only `pushTrade` writes to it and nothing reads it, remove both the field and the action.

### Remove any `console.log` and `console.error` debug statements

Audit all files. Remove debug logs added during development. Keep only:
- `console.error` in WebSocket error handlers — legitimate runtime error reporting
- `console.warn` for reconnection attempts — useful operational info

Remove all others.

---

## 4. Consistency Pass

### Coordinate system passed as object not spread

Some draw functions may have been written accepting `indexToX` and `priceToY` as separate parameters, while others accept a `CoordinateSystem` object. Standardize: all draw functions that need coordinates accept a single `CoordinateSystem` object. They destructure what they need internally. This reduces function signature length and makes it easy to add new coordinate helpers later.

### Engine access pattern

Confirm all draw functions that need the aggregation engine receive it as a direct parameter — not via React context and not via a global import. The engine is a ref that lives in `FeedProvider` and is passed down. Draw functions are pure functions — they take data in, draw to canvas, return nothing. They should never import from React context.

### Redraw scheduling

Confirm `scheduleRedraw` is the only way `redraw()` is ever triggered — no direct calls to `redraw()` anywhere. The `rafRef` guard that prevents stacking multiple `requestAnimationFrame` calls only works if everything goes through `scheduleRedraw`. Search for any direct `redraw()` calls outside of the RAF callback itself.

### Store action naming

Confirm all action names follow a consistent pattern — `set`, `push`, `toggle`, or `add`/`remove` prefix as appropriate:
- `set` for replacing a single value
- `push` for appending to an array
- `add` / `remove` for named items in an array (like `drawnLines`)
- `toggle` for booleans that flip — e.g. `togglePanel` not `setPanelOpen`

Rename any that deviate.

---

## 5. Performance

### Avoid object allocation inside draw loops

Inside hot draw loops (functions called every frame), avoid creating new objects or arrays. For example, in `drawFootprint`, the `fc.cells.forEach` callback should not create intermediate objects. Read `bidVol` and `askVol` directly from the cell.

### `buildProfile` called once per redraw

Confirm `buildProfile` is called exactly once per redraw in `ChartCanvas`, not once inside `drawVolumeProfile` and again inside `drawCustomProfile`. The result should be computed once and passed to both functions.

### `getAllFootprintCandles` call count

`engine.getAllFootprintCandles()` creates a new sorted array every call. If the sidebar and the absorption map both call this independently, that's two sorts per redraw. Either cache the result for the frame or pass it as a parameter from `ChartCanvas` into both.

---

## 6. Missing Guards

### Empty candles array

Confirm `ChartCanvas` returns early from `redraw()` when `candles.length === 0`. Without this, `buildCoordinates` divides by zero or accesses `candles[-1]`.

### Engine null check in draw functions

All draw functions that accept `engine` should handle `engine === null` gracefully — return early or skip the engine-dependent section. The engine is null briefly during initial mount before `FeedProvider` sets it.

### `bucketSize` of zero

If `bucketSize` is ever 0 (corrupted localStorage, bad input), `normalizePriceToBucket` divides by zero. Add a guard at the top of that function: if `bucketSize <= 0` return `0`.

---

## 7. File Organization

### `lib/utils/chartUtils.ts`

Create this file if it does not exist. Move into it:
- `getMaxCellVolume`
- `getVisibleCandlesWithCoords`
- `getRollingAverages`
- `scaleOpacity`
- `isNearPoint`

These are shared utilities used by multiple draw functions. They do not belong in any single draw file.

### `lib/utils/format.ts`

Create this file if it does not exist. Move into it:
- `formatVol`
- `formatPrice`
- `formatDelta`

Delete any inline formatting functions from draw files after moving.

### `types/` directory

Confirm all custom types are in `types/`:
- `types/feed.ts` — `Candle`, `Trade`
- `types/footprint.ts` — `FootprintCell`, `FootprintCandle`
- `types/absorption.ts` — `AbsorptionResult`, `AbsorptionDirection`, `AbsorptionRank`
- `types/store.ts` — `ChartMode`, `PanelState`, `DrawnLine` (if not already in store file)

No type definitions scattered inside component files or draw files. If any exist outside `types/`, move them.

---

## How to Approach This Task

Work section by section. Do not try to do everything at once.

Suggested order:
1. Types audit first — catch anything that would cause runtime bugs
2. Dead code removal — simplifies everything that follows
3. Extract shared utilities — `chartUtils.ts` and `format.ts`
4. Replace duplicated logic in draw files with the new utilities
5. Consistency pass — naming, parameter shapes
6. Guards
7. Performance

After each section, confirm the app still builds and the chart still renders correctly before moving to the next section.