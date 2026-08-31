# Volume Profile — Final Spec & Priority Order

No data-integrity bugs found this time (unlike the bubbles collector issue) — this feature is in reasonable shape. Ranking is purely by trading value and effort, go tier by tier with your agent, same as bubbles.

## Verify before starting (see notes above)

- Confirm Tick Grouping "Auto" actually recalculates live on price-scale zoom, not just on load.
- Confirm POC "Extend Line to End of Window" is a real toggle in VolumeProfileSettings.tsx, not just unconditional behavior in the draw code.
- Confirm what "Composite" would actually require given current cache limits — don't treat zoom-out as a substitute.

## Keep as-is (no article conflict, don't touch)

- Tick Grouping (Auto/Manual) — already matches spec.
- Scale Mode (linear/sqrt), min row width/height bounds, Value Area fill/lines, POC glow-from-heatmap — all platform-only additions, none conflict with the article, two mirror patterns already approved for bubbles.

## Priority order

### Tier 1 — Core methodology gap

1. **Add HVN (peak) detection.** Currently only the single POC is tracked — no broader set of high-volume nodes. LVN detection exists but with hardcoded thresholds and no sensitivity control. Add HVN detection alongside LVN, both with a configurable sensitivity setting (matches the article, and matches what you actually watch for in your own trading).

### Tier 2 — Consolidate Profile Type + real Ask/Bid split

2. Unify pure-volume bars, the separate Delta side-strip toggle, and the untapped bid/ask data already sitting in `ProfileRow` into one Profile Type selector (Volume / Ask-Bid Split / Delta / Delta+Volume), matching the article. The bid/ask data already exists — it's just never rendered as a split bar. This is mostly wiring existing pieces together plus one new render path, not new data work.

### Tier 3 — Input Data expansion

3. Add Order Count, Aggregate Trades, and Number-of-Trades as selectable input metrics for the profile. The aggregate-trade event pipeline already exists from the bubbles rebuild — this is meaningfully cheaper now than it would've been before that work. Reuse it rather than building a second pipeline.

### Tier 4 — Threshold filtering

4. Add Min/Max Filter to exclude small trades/orders from the profile calculation. Same concept as bubbles' Filter Volume — same pattern, should be quick given the precedent.

### Tier 5 — Period completeness

5. Add true **Composite** (all loaded data, independent of current viewport) and **Latest** (most recent period only, e.g. just today's session) as explicit period modes. Currently only Visible, Custom, and Multiple exist.

### Tier 6 — POC upgrade

6. **Developing POC trail** — show the POC's migration path as a session forms, not just its final static value. Genuine analytical value (you already watch POC reactions), but needs snapshotting POC per time-step, non-trivial.

### Tier 7 — Flexibility / power-user

7. Custom session time ranges (beyond hardcoded Tokyo/London/New York) — replaces fixed sessions with user-defined start/end in exchange timezone.
8. Length Type / Length Value — arbitrary period sizing ("every 2 days", "every 4 hours").
9. Merge/Split profiles from a right-click menu.

### Tier 8 — Cosmetic

10. Customizable POC highlight/line color & width (currently hardcoded amber, 1.5px, dashed).
11. Configurable HVN/LVN colors.
