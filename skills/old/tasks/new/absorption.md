# Absorption Detection System

---

## Goal

Automatically detect candles where aggressive order flow failed to move price — meaning passive liquidity absorbed the aggression. Score each candle 0–100 based on multiple signal inputs. Render visual markers on the chart. Show a breakdown tooltip on hover explaining why a candle was flagged.

This runs entirely on in-memory footprint data. No backend needed.

---

## Core Rule

**Absorption = aggression + failed continuation.**

Delta alone is never enough. A candle with extreme positive delta is only absorption if price failed to follow through. Always check both sides — what volume did and what price did.

---

## Data Requirements

The detection engine needs access to per-candle data. For each candle being scored:

- `FootprintCandle` from the aggregation engine — for delta, cells, bid/ask volumes
- `Candle` OHLCV — for price progression, wick analysis, body size
- A rolling window of recent candles (last N, default 20) — for average delta and average volume comparisons

Without the rolling window, there is no baseline to compare against. A delta of 500 means nothing without knowing the average is 50.

---

## Absorption Score — Signal Inputs

Score is built from five independent signals. Each contributes a partial score. Sum them, clamp to 100.

---

### Signal 1 — Delta Extremity (weight: 25 pts max)

Compare this candle's absolute delta to the rolling average absolute delta of the last 20 candles.

- `deltaRatio = abs(candle.delta) / avgAbsDelta`
- `1.5x` → 10 pts
- `2x` → 17 pts
- `3x+` → 25 pts

Direction matters for classification (buyer vs seller absorption) but not for the score calculation itself.

---

### Signal 2 — Volume Extremity (weight: 15 pts max)

Compare this candle's total volume to the rolling average volume.

- `volumeRatio = candle.volume / avgVolume`
- `1.5x` → 7 pts
- `2x` → 12 pts
- `2.5x+` → 15 pts

High volume confirms that a meaningful number of participants were involved — reducing the chance of a false positive from a thin-market spike.

---

### Signal 3 — Poor Price Progression (weight: 30 pts max)

This is the most important signal. Aggressive volume happened but price barely moved.

Two sub-checks:

**Body-to-range ratio:**
- `bodySize = abs(close - open)`
- `totalRange = high - low`
- `bodyRatio = bodySize / totalRange`
- A small body relative to range means price was pushed both ways — indecision or rejection
- `bodyRatio < 0.3` → 10 pts
- `bodyRatio < 0.15` → 20 pts

**Wick rejection:**
- For seller absorption: check upper wick size — `upperWick = high - max(open, close)`
- For buyer absorption: check lower wick size — `lowerWick = min(open, close) - low`
- `wickRatio = wick / totalRange`
- `wickRatio > 0.4` → 5 pts
- `wickRatio > 0.6` → 10 pts

Combined max from this signal: 30 pts.

**Important addition not in the original spec:**
Also check net price movement relative to delta direction.

- For negative delta (sell aggression): if `close >= open` (candle closed up or flat despite sellers) → add 5 pts
- For positive delta (buy aggression): if `close <= open` (candle closed down or flat despite buyers) → add 5 pts

This is the clearest single indicator of absorption — price moved against the aggressor.

---

### Signal 4 — Footprint Imbalance Cluster Failure (weight: 20 pts max)

Check if the footprint shows stacked imbalances in one direction but the candle failed to continue.

**Imbalance definition per cell:**
A cell is imbalanced when one side is significantly larger than the other.
- `ratio = askVol / (bidVol + 1)` — add 1 to avoid division by zero
- Ratio > 3 = ask imbalance (aggressive buying dominated this level)
- Ratio < 0.33 = bid imbalance (aggressive selling dominated)

**Stacking:**
Count consecutive price levels with the same imbalance direction. A cluster of 3+ stacked imbalances in one direction = strong directional aggression.

- 3+ stacked ask imbalances but candle failed to close higher → buyer absorption, 15 pts
- 3+ stacked bid imbalances but candle failed to close lower → seller absorption, 15 pts
- 5+ stacked → 20 pts

---

### Signal 5 — Repeated Level Defense (weight: 10 pts max)

Look back at the last 5 candles. Check if the same price bucket was repeatedly hit with high volume on the same side without breaking.

This requires comparing the current candle's high-volume cells against the previous candles' high-volume cells at the same price levels.

- Same price level defended in 2 of last 5 candles → 5 pts
- Same price level defended in 3+ of last 5 candles → 10 pts

This is the hardest signal to compute but adds meaningful confidence when triggered. If implementation complexity is a concern, implement Signals 1–4 first and add Signal 5 in a follow-up pass.

---

## Absorption Direction

After scoring, classify direction:

- `'buyer'` — positive delta failed to continue (passive sellers absorbed aggressive buyers)
- `'seller'` — negative delta failed to continue (passive buyers absorbed aggressive sellers)

Edge case: if delta is near zero, direction is ambiguous — do not classify, do not render.

---

## Absorption Result Type

**File:** `types/absorption.ts`

```ts
type AbsorptionDirection = 'buyer' | 'seller'
type AbsorptionRank = 'minor' | 'strong' | 'extreme'

interface AbsorptionResult {
  candleTime:  number
  score:       number
  rank:        AbsorptionRank        // minor: 40–60, strong: 60–80, extreme: 80–100
  direction:   AbsorptionDirection
  reasons:     string[]              // human-readable explanations for tooltip
  signals: {
    deltaExtremity:       number     // pts contributed
    volumeExtremity:      number
    poorProgression:      number
    imbalanceCluster:     number
    repeatedDefense:      number
  }
}
```

The `reasons` array is built during scoring — each signal that contributes points appends a plain English string. This powers the hover tooltip directly without any extra logic.

Example reasons array:
```
[
  "Extreme negative delta (3.2x average)",
  "High volume candle (2.1x average)",
  "Tight body despite large sell aggression",
  "Lower wick rejection (62% of range)",
  "Bid imbalance cluster — 4 stacked levels"
]
```

---

## Detection Engine

**File:** `lib/absorption/engine.ts`

### `scoreCandle(candle, footprintCandle, recentCandles, recentFootprints)`

- Takes one candle, its footprint, and the rolling window of recent candles and footprints
- Runs all five signal checks
- Builds `reasons[]` as it goes — only append a reason if that signal contributed points
- Returns `AbsorptionResult | null` — null if score < 40 (below minor threshold) or if delta is near zero

### `buildAbsorptionMap(candles, engine, settings)`

- Takes the full candles array, the aggregation engine, and absorption settings from store
- Iterates all candles where footprint data exists
- For each, calls `scoreCandle` with the appropriate rolling window (slice of last 20)
- Returns `Map<number, AbsorptionResult>` keyed by candle time
- Called once at startup then updated incrementally as new candles close

### Incremental Update

Do not re-score all candles on every live candle update. Only score a candle when it closes — `candle.isClosed === true`. Score it once, store the result, never re-score it.

The live (open) candle can be scored in real time but mark its result as `provisional: true` — its score will change as trades come in. Render provisional results with reduced opacity.

---

## Store Additions

**File:** `lib/store/chart.ts`

- `absorptionEnabled: boolean` — default `true`
- `absorptionMinScore: number` — minimum score to display, default `50`
- `absorptionSide: 'both' | 'buyer' | 'seller'` — default `'both'`
- `absorptionShowLabels: boolean` — default `true`
- `absorptionMap: Map<number, AbsorptionResult>` — not persisted, session only

The `absorptionMap` lives in the store so both the canvas draw function and the sidebar can read from it.

---

## Visual Display

**File:** `lib/draw/drawAbsorption.ts`

### `drawAbsorption(ctx, candles, visibleRange, indexToX, priceToY, absorptionMap, settings)`

For each visible candle with an absorption result in the map:

**Marker position:**
- Seller absorption (passive buyers absorbed sellers): marker placed **below** the candle low — `y = priceToY(candle.low) + 8 + radius`
- Buyer absorption (passive sellers absorbed buyers): marker placed **above** the candle high — `y = priceToY(candle.high) - 8 - radius`

**Marker by rank:**

Minor (40–60):
- Small filled circle, radius `5px`
- Fill: `rgba(color, 0.5)`
- No label

Strong (60–80):
- Larger filled circle, radius `8px`
- Fill: `rgba(color, 0.7)`
- Optional label `ABS` in `8px JetBrains Mono` centered below/above marker

Extreme (80–100):
- Largest circle, radius `11px`
- Fill: `rgba(color, 0.9)`
- Stroke: same color, `1.5px`
- Label: `ABS` + score e.g. `ABS 87`
- Subtle glow effect: draw the same circle at `radius * 2` with very low opacity `0.15` behind it

**Colors:**
- Seller absorption marker: `#26A69A` teal — passive buyers won
- Buyer absorption marker: `#EF5350` red — passive sellers won

This color convention may feel counterintuitive but is correct — teal means buyers were in control (absorbed the sellers), red means sellers were in control (absorbed the buyers).

**Provisional markers** (live candle, not yet closed):
- Same shape but dashed stroke, `0.4` opacity
- No label

---

## Hover Tooltip

When the user hovers over the chart and the cursor is near an absorption marker, show a tooltip.

**File:** `components/chart/AbsorptionTooltip.tsx`

This is an HTML overlay component positioned absolutely over the canvas — not drawn on canvas. Use a `div` with `position: absolute`, `pointer-events: none`, `z-index: 10`.

### Hover detection

In `ChartCanvas` `onMouseMove`, after the canvas redraws for crosshair, check if the cursor is within `20px` of any absorption marker's rendered position. If yes, set `hoveredAbsorption: AbsorptionResult | null` in local state, which renders the tooltip.

### Tooltip content

```
┌──────────────────────────────┐
│  SELLER ABSORPTION           │
│  Score: 84  ●●●●             │  ← rank dots
│                              │
│  ✓ Extreme negative delta    │
│    (3.2× average)            │
│  ✓ High volume (2.1×)        │
│  ✓ Price failed to continue  │
│  ✓ Lower wick rejection 62%  │
│  ✓ Bid cluster — 4 levels    │
└──────────────────────────────┘
```

- Background: `#141414`, border `1px solid #1F1F1F`, border-radius `6px`
- Title color: teal or red depending on direction
- Score: numeric + filled dots indicating rank (1 dot = minor, 2 = strong, 3 = extreme)
- Each reason prefixed with `✓` in accent color
- Font: `JetBrains Mono`, 11px throughout
- Width: 220px fixed
- Position: above or below the marker depending on screen space

---

## Toolbar Control

Add to main toolbar, grouped with the bubbles toggle for consistency:

- Toggle button to enable/disable absorption markers
- Minimum score filter: small input or slider — `MIN 50` label
- Side filter: `B` (buyer abs) / `S` (seller abs) / `B+S`

Keep it compact — same pattern as the bubbles toolbar section.

---

## Settings Panel Additions

New `ABSORPTION` section:

```
ABSORPTION
  Show markers         [toggle]
  Minimum score        [slider]   50
  Side                 [B] [S] [B+S]
  Show labels          [toggle]
  Show on live candle  [toggle]
```

---

## Draw Order Update

```
1. drawGrid
2. drawSelectionHighlight
3. drawCandles OR drawFootprint
4. drawBubbles
5. drawAbsorption                ← new, above bubbles
6. drawVolumeProfile
7. drawAxes
```

Absorption markers render above bubbles so they are not hidden by bubble clusters at the same price level.

---

## Future Upgrades

### Absorption Zones
When a candle scores above 70, extend a horizontal zone line to the right until price crosses it. Treated as a live support/resistance level derived from order flow rather than price structure alone.

### Trapped Trader Detection
After a high-score absorption candle, monitor the next 3–5 candles. If price moves against the absorbed side by more than `1 ATR`, mark it as a confirmed trap. The original absorption marker upgrades visually — border thickens, label adds `→ TRAPPED`.

### Cross-Candle Absorption
Current detection is per-candle. A future pass can detect absorption that spans multiple candles — aggressive pressure sustained across 3–5 candles followed by a single reversal candle. Score is averaged across the sequence.

### Session Absorption Summary
In the sidebar, add an `ABSORPTION` section showing:
- Count of minor/strong/extreme signals this session
- Strongest signal so far (score + time)
- Current bias: which side has seen more absorption

---

## File Checklist

```
types/absorption.ts
└── AbsorptionResult, AbsorptionDirection, AbsorptionRank

lib/absorption/engine.ts
├── scoreCandle
└── buildAbsorptionMap

lib/draw/drawAbsorption.ts
└── drawAbsorption — markers, labels, glow

components/chart/
├── ChartCanvas.tsx              — drawAbsorption in redraw, hover detection
└── AbsorptionTooltip.tsx        — HTML overlay tooltip

lib/store/chart.ts
├── absorptionEnabled
├── absorptionMinScore
├── absorptionSide
├── absorptionShowLabels
├── absorptionMap (session only, not persisted)
└── matching actions

components/ui/
├── Toolbar.tsx                  — absorption toggle + min score + side filter
└── SettingsPanel.tsx            — ABSORPTION section

Behavior:
├── Candles scored only on close, live candle provisional
├── Score built from 5 independent signals
├── Direction requires both aggression AND failed continuation
├── Markers scale by rank — minor / strong / extreme
├── Hover tooltip shows full reason breakdown
├── Side and score filters reduce clutter
├── Works in both candle and footprint mode
└── Controls persist across refresh
```