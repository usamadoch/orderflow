# Exhaustion Detection — Task 3 of 3
## Controls, Hover Tooltip, and Settings

---

## Goal for This Task Only

Add user controls for exhaustion — toolbar toggle, minimum score filter, side filter. Add a hover tooltip that explains why a candle was flagged, same pattern as the absorption tooltip. Add exhaustion settings to the settings panel. Persist user preferences.

Tasks 1 and 2 must be complete before starting this.

---

## Toolbar Controls

**File:** `components/ui/Toolbar.tsx`

Group exhaustion controls alongside the absorption controls since they are related concepts. Keep it compact.

**Enable/disable toggle:**
- Small button with label `EX` or a fading wave icon
- Active: background `#1F1F1F`, border `1px solid #F0B90B` (amber, matches buyer exhaustion color), text `#E8E8E8`
- Inactive: transparent, text `#4A4A4A`
- Clicking toggles `exhaustionEnabled` in store

**Minimum score input:**
- Visible only when `exhaustionEnabled` is true
- Label: `MIN`
- Number input, bound to `exhaustionMinScore`
- Default `40`, min `30`, max `90`, step `5`
- Debounced 300ms
- Width: 50px
- Font: `JetBrains Mono`, 11px

**Side filter:**
- Three small buttons: `B` (buyer), `S` (seller), `B+S` (both)
- Active: `#3D7EFF` background
- Same pattern as absorption and bubbles side filters
- Controls `exhaustionSide` in store

---

## Hover Tooltip

Same architecture as the absorption tooltip — an HTML overlay `div` positioned absolutely over the canvas, `pointer-events: none`.

**File:** `components/chart/ExhaustionTooltip.tsx`

### Hover detection

In `ChartCanvas` `onMouseMove`, after checking for absorption hover, check exhaustion markers.

For each visible candle with an exhaustion result, compute the marker's `x` and `y` position (same calculation as in `drawExhaustion`). If the cursor is within `14px` of that position, set `hoveredExhaustion: ExhaustionResult | null` in local state.

Only one tooltip shows at a time — if absorption is hovered, exhaustion tooltip does not show, and vice versa. Absorption takes priority since it is a stronger signal.

### Tooltip content

```
┌──────────────────────────────┐
│  BUYER EXHAUSTION            │
│  Score: 71  ◈◈◈              │  ← rank diamonds (◈ = filled, ◇ = empty)
│                              │
│  ✓ Delta decaying 4 candles  │
│  ✓ Large delta, weak move    │
│  ✓ Upper wick rejection 44%  │
│  ✓ Range compressing         │
└──────────────────────────────┘
```

- Background: `#141414`, border `1px solid #1F1F1F`, border-radius `6px`
- Title: amber (`#F0B90B`) for buyer exhaustion, purple (`#B39DDB`) for seller exhaustion
- Rank indicators: 4 diamond characters — filled for achieved rank, empty for remaining
  - weak = 1 filled, moderate = 2, strong = 3, extreme = 4
- Each reason line: `✓` in `#3D7EFF`, text in `#8A8A8A`
- Font: `JetBrains Mono`, 11px
- Width: 220px fixed
- Positioned above the marker for seller exhaustion, below for buyer exhaustion
- If tooltip would clip outside canvas bounds, flip to the other side

---

## Settings Panel

**File:** `components/ui/SettingsPanel.tsx`

Add a new `EXHAUSTION` section after the `ABSORPTION` section:

```
EXHAUSTION
  Show markers         [toggle]
  Minimum score        [slider]   40
  Side                 [B] [S] [B+S]
  Lookback window      [slider]   5 candles
  Show on live candle  [toggle]
```

**Lookback window slider:**
- Controls how many recent candles the momentum decay signal looks back over
- Range: 3–8, default 5, step 1
- Add `exhaustionLookback: number` to store, default `5`
- Pass into `scoreExhaustion` as a parameter — replace the hardcoded `5` from Task 1
- Changing this value requires rebuilding the exhaustion map — call `buildExhaustionMap` again after the change

**Show on live candle toggle:**
- Controls whether provisional markers render on the currently open candle
- Add `exhaustionShowProvisional: boolean` to store, default `true`
- In `drawExhaustion`, skip provisional results when this is false

---

## Sidebar Integration

**File:** `components/ui/Sidebar.tsx`

Add a small `EXHAUSTION` section below the existing `ABSORPTION` section:

```
EXHAUSTION
  Buyer signals      3
  Seller signals     1
  Last signal        12:34  STRONG
```

- `Buyer signals`: count of `ExhaustionResult` entries with `direction === 'buyer'` and `score >= exhaustionMinScore` across all candles in memory
- `Seller signals`: same for seller
- `Last signal`: time and rank of the most recent exhaustion result above the min score threshold — format time as `HH:MM`

Read from `exhaustionMap` in store. Update whenever `candles` array changes — same refresh trigger as the rest of the sidebar.

---

## Persistence

**File:** `lib/store/chart.ts`

Add to the `partialize` persist list:
- `exhaustionEnabled`
- `exhaustionMinScore`
- `exhaustionSide`
- `exhaustionLookback`
- `exhaustionShowProvisional`

Do not persist `exhaustionMap` — session only, rebuilds on connect.

---

## Interaction With Absorption Controls

Both absorption and exhaustion have enable toggles, min score inputs, and side filters in the toolbar. They should be visually grouped together — a thin divider between them and a small section label `SIGNALS` above both groups.

If both are disabled, the `SIGNALS` label grays out entirely. This keeps the toolbar scannable without two separate unlabeled control groups.

---

## Complete Store Summary for Exhaustion

```ts
exhaustionEnabled:        boolean    // default true  — persisted
exhaustionMinScore:       number     // default 40    — persisted
exhaustionSide:           'both' | 'buyer' | 'seller'  // default 'both' — persisted
exhaustionLookback:       number     // default 5     — persisted
exhaustionShowProvisional: boolean   // default true  — persisted
exhaustionMap:            Map<number, ExhaustionResult>  // session only
```

---
