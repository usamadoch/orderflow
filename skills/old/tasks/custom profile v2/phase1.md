# Volume Profile Improvements — Task 1 of 4
## Width Control, Opacity, and Minimum Row Visibility

---

## Goal for This Task Only

Add three user-controllable properties to the volume profile: how wide the bars are allowed to grow, how transparent the profile is, and a minimum bar width so small rows never disappear. No changes to how the profile is calculated. No changes to row density. No changes to POC or VA rendering. Pure visual controls.

---

## What Changes

### Profile Width as a Percentage

Currently the profile bars grow to fill a fixed pixel width (`PROFILE_WIDTH`, default 120px). The bars always stretch to the maximum — the widest row always hits the full 120px.

New behavior: the user sets a `profileWidthPct` value (0–100%) that controls what percentage of the available space the bars actually use.

- `profileWidthPct = 100` → same as current behavior, widest bar hits full width
- `profileWidthPct = 50` → widest bar only uses 50% of the allocated space, rest is empty
- `profileWidthPct = 30` → narrow bars, lots of space behind them, candles clearly visible

The `PROFILE_WIDTH` constant (the total reserved pixel strip on the right) stays unchanged — it controls how much space is reserved. `profileWidthPct` controls how much of that reserved space the bars actually fill.

**Formula change in `drawVolumeProfile`:**
```
current:  barW = (row.totalVol / profile.maxVol) * PROFILE_WIDTH
new:      effectiveWidth = PROFILE_WIDTH * (profileWidthPct / 100)
          barW = (row.totalVol / profile.maxVol) * effectiveWidth
```

The empty portion of the reserved strip (between the bars and the right axis) remains blank — no fill, no border. Just space.

---

### Profile Opacity Control

Currently bar fills use hardcoded opacity values (`0.35` for default profile, `0.5` for custom). Replace these with a user-controlled `profileOpacity` value.

- Range: `0.1` to `1.0`, default `0.4`, step `0.05`
- Applied to both bid and ask portions of every bar
- POC line and VA lines are not affected by this opacity — they stay at their current opacity

**In `drawVolumeProfile`:**
```
current:  ctx.fillStyle = `rgba(38, 166, 154, 0.35)`
new:      ctx.fillStyle = `rgba(38, 166, 154, ${profileOpacity})`
```

Same change applied to the bid (red) portion and to the custom profile variant.

When the default profile is dimmed because a custom profile is active, apply `profileOpacity * 0.4` instead of the flat `0.2` previously hardcoded — this way the dimmed default profile always looks proportionally faded relative to the user's opacity preference.

---

### Minimum Row Width

Currently a row with very low volume produces a bar so thin it is invisible — `1px` or less. These rows simply vanish and the profile looks like it has gaps.

Add a `profileMinRowWidth: number` — the minimum number of pixels any rendered bar must be, regardless of volume.

- Default: `2px`
- Range: `0` (off, current behavior) to `8px`
- Applied as a floor: `barW = Math.max(profileMinRowWidth, calculatedBarW)`
- A `0` value disables the minimum — same as current behavior

**Visual effect:** with a minimum of `2px`, even the lowest-volume rows show a faint sliver. The profile looks continuous rather than gapped.

**Important:** the minimum width only applies when `calculatedBarW > 0`. If a row has zero volume, do not render it at all — a minimum width bar on a zero-volume row would be misleading.

---

## Store Additions

**File:** `lib/store/chart.ts`

```ts
profileWidthPct:    number   // default 70, range 10–100
profileOpacity:     number   // default 0.4, range 0.1–1.0
profileMinRowWidth: number   // default 2, range 0–8
```

Add set actions for each. All three persist across page refresh — add to `partialize`.

---

## Settings Panel

**File:** `components/ui/SettingsPanel.tsx`

Inside the existing `VOLUME PROFILE` section, add:

```
VOLUME PROFILE
  Width              [slider]   70%
  Opacity            [slider]   40%
  Min row width      [slider]   2px
  Profile Width px   [slider]   120px    ← existing
  POC Color          [picker]             ← existing
  VA Color           [picker]             ← existing
  Value Area         [slider]   70%      ← existing
```

- Width slider: range 10–100, step 5, label shows percentage e.g. `70%`
- Opacity slider: range 10–100 (display as percent), internally stored as 0.1–1.0, step 5
- Min row width slider: range 0–8, step 1, label shows `Npx` or `OFF` when 0

All sliders update the store immediately on change (no debounce needed — these are cheap redraws).

---

Do not proceed to Task 2 until all three controls work correctly and persist.