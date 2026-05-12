# Volume Profile Improvements — Task 3 of 4
## POC Highlighting and Value Area Visual Improvements

---

## Goal for This Task Only

Make the POC and Value Area visually clear and distinguishable. The POC row should stand out from other rows. VA High and VA Low should be readable without competing with the chart. Add a subtle value area fill between VA High and VA Low. No new controls beyond what is needed to make these toggleable.

Tasks 1 and 2 must be complete before this task — row density and width scaling must be working correctly first.

---

## Change 1 — POC Row Highlight

Currently the POC is only indicated by a dashed horizontal line across the chart. The actual row containing the POC in the profile has no special treatment — it looks identical to every other row.

Add a visible highlight to the POC row itself inside the profile bars.

### How to highlight the POC row

In `drawVolumeProfile`, after drawing all rows normally, draw the POC row again on top with:
- A solid border/outline around the bar: stroke `1px`, color `#F0B90B` (amber), full opacity
- The bar fill gets a slight brightness boost: increase opacity by `+0.2` above the user's `profileOpacity` setting, capped at `1.0`
- The bid/ask split is preserved — both halves are brightened equally

Do not change the bar width for the POC row — it stays at the same width as the normal scaled calculation. Only brightness and outline change.

### POC label inside the profile

Add a small `POC` text label rendered inside the POC bar, at the left edge of the bar:
- Font: `JetBrains Mono`, `8px`
- Color: `#F0B90B`
- Position: `x = profileStartX + 3`, `y = pocRowTopY + rowHeight / 2 + 3`
- Only render if `pocRowHeight >= 10` and `pocBarWidth >= 20` — skip if row is too small

The existing POC dashed line across the full chart width stays unchanged. This label is inside the profile bars only.

---

## Change 2 — Value Area Background Fill

Currently VA High and VA Low are only marked by dashed lines extending across the chart. The area between them has no visual distinction.

Add a subtle background fill inside the profile bars between VA Low and VA High.

### How to render it

Before drawing individual profile bars, fill the value area background:
- `y1 = priceToY(profile.vaHigh + profileBucketSize)` — top of VA
- `y2 = priceToY(profile.vaLow)` — bottom of VA
- `x = profileStartX` — left edge of profile bars
- Width: `effectiveWidth` — same as the bar width limit
- Fill: `rgba(61, 126, 255, 0.06)` — very subtle blue tint, distinct from bar colors

This renders behind the bars so the bar colors show on top. It gives a clear visual band showing the 70% value area zone.

The VA dashed lines across the full chart width stay unchanged. This fill is inside the profile bars only.

---

## Change 3 — VA High and VA Low Line Improvements

The current VA lines are thin and easy to miss. Improve their legibility without making them dominant.

### Changes to the existing VA lines

- Increase line width from `1px` to `1.5px`
- Change dash pattern from `[2, 4]` to `[4, 3]` — slightly longer dashes, more visible
- Add a `VAH` and `VAL` label at the left edge of the chart (`x = 4`)
  - Font: `JetBrains Mono`, `9px`
  - Color: `#3D7EFF`
  - For VAH: label sits `2px` above the line
  - For VAL: label sits `2px` below the line
  - Only show label if the two lines are more than `16px` apart — prevents overlap

Currently labels are rendered near the price axis (right side). Move them to the left side of the chart instead — they are less likely to overlap with price axis numbers there.

Remove the existing right-side `VAH`/`VAL` labels and replace with these left-side labels.

---

## Change 4 — POC Line Improvement

The existing POC line spans the full chart width with a dashed style. Make it slightly more prominent:

- Change from dashed `[4, 4]` to a semi-dashed pattern `[6, 3]` — longer dash, tighter gap
- Increase line width from `1px` to `1.5px`
- Add a `POC` label at the left edge of the chart (`x = 4`)
  - Font: `JetBrains Mono`, `9px`, bold if possible
  - Color: `#F0B90B`
  - Sits `2px` above the line
  - Always shown — POC is always a single line, no overlap concern

Remove the existing right-side `POC` label and replace with this left-side one.

---

## Change 5 — Toggles for These Features

Add to the settings panel `VOLUME PROFILE` section:

```
POC row highlight      [toggle]   on
VA area fill           [toggle]   on
Show POC line          [toggle]   on
Show VA lines          [toggle]   on
```

Store additions:

```ts
profileShowPocHighlight: boolean   // default true, persisted
profileShowVaFill:       boolean   // default true, persisted
profileShowPocLine:      boolean   // default true, persisted
profileShowVaLines:      boolean   // default true, persisted
```

In `drawVolumeProfile`, gate each visual element behind its toggle. If `profileShowPocLine` is false, skip both the POC line and the left-side POC label.

---

## How to Verify This Task is Done

Do not proceed to Task 4 until all four visual elements render correctly and their toggles work.