# Volume Bubbles — Final Spec & Priority Order

Source of truth: the DeepDOM article. Anything your platform has that isn't in the article gets dropped unless flagged below. Anything the article has that you're missing gets added, ranked by priority.

## Dropped

- **Bubble Source: Footprint** — redundant with your existing footprint/volume-profile indicators, and the investigation found it doesn't track trade count at all, uses a different (uncapped) max-scale calculation than aggregate mode, and ignores the Min Orders setting entirely. Dropping this removes a confirmed structural inconsistency in one move. Aggregate Trades becomes your only bubble source, matching the article.
- **Min/Max Radius (px) as the primary sizing control** — not a setting in the article. Replaced below by relative-to-visible-max + standard-deviation sizing. Keep a min/max clamp internally as a rendering safety net only (so a calculation edge case can't produce a 0px or screen-covering bubble) — just stop treating it as the main sizing lever.

## Flag before locking scope

- **Size By: Orders** — not in the article, but you explicitly asked early on for both Volume and Orders sizing to work. Recommend keeping this as an additive extra on top of article parity — it doesn't conflict with anything, and dropping Footprint mode already resolves the threshold-ambiguity the investigation flagged (Footprint mode's Min Orders being silently ignored is now moot since Footprint mode is gone). Confirm you still want it, or drop it for strict parity.
- **Side Filter (Buy/Sell/Both)** — not in the article either, but zero-cost and doesn't conflict with anything. Fine to keep as a bonus toggle regardless of what you decide on Orders sizing.
- **Collector hardcoded thresholds** — the investigation report itself states `aggregateBubbleMinVolume: 1` in prose but then parenthetically says "(with volume 0.5)" in the same paragraph. That's an internal contradiction in the agent's own findings — get the literal value from the file before implementing the threshold fix below, don't take either number at face value yet.

## Priority order

### Tier 1 — Fix what's actively broken (data integrity)

1. **Collector vs. live threshold mismatch.** The collector's hardcoded minimums silently drop trades that the live UI displays if your Filter Volume is set below them — so history quietly disagrees with what you saw live. Fix by either making the collector's threshold configurable and matched to the UI's Filter Volume, or preventing the UI minimum from going below the collector's floor. Do this first — it's actively producing wrong historical data.
2. **Drop Footprint bubble source.** Removes the confirmed structural inconsistency and simplifies every setting below it.

_(Position accuracy — Y-coordinate, X-coordinate sub-candle interpolation, forming-candle handling, shared bar-width — was already investigated and confirmed correct. No work needed there.)_

### Tier 2 — Bring sizing in line with the reference model

3. **Two-tier filtering**: Filter Volume (raw threshold, pre-scaling — a trade below this never becomes a bubble) + Filter Bubble (rendered pixel-size threshold, post-scaling — hides bubbles that shrank to near-invisible after scaling). Replaces your single Min Orders/Min Volume number.
4. **Relative + statistical sizing**: bubble size calculated relative to the largest bubble currently visible on screen, with Std Dev Val + Out Std Dev Perc controlling how outliers get absorbed into the scale. Replaces the fixed Min/Max Radius mapping and the ad-hoc "anchored cap" hack the investigation found in the aggregate-mode code.

### Tier 3 — Analytical upgrade (color modes)

5. **Bubble Mode**: Ask/Bid Split, Delta, Volume — three coloring schemes instead of a flat two-color side split.
6. **Volume Mode Color**: Delta Absolute / Delta Percentual sub-setting for the Volume color mode.

### Tier 4 — Structural feature (biggest lift, biggest capability gap)

7. **Grouping**: Grouping Mode (Automatic / Time / Price), Price Aggr Mode (Extension / Extension+Retracement), Tick Grouping (Automatic / Fixed + manual tick count). This is what turns thousands of raw ticks into a manageable number of meaningful bubbles instead of one bubble per execution. Biggest engineering lift on this list — plan it as its own phase, not bundled with the tiers above.

### Tier 5 — Cosmetic

8. Display Mode (2D/3D), Bid/Ask Color, Line Width, Opacity.
