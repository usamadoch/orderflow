# Exhaustion Detection — Task 1 of 3
## Types + Scoring Engine

---

## Goal for This Task Only

Build the exhaustion detection engine. Define the types. Write the scoring logic. Nothing renders yet. At the end of this task you should be able to call `scoreExhaustion(candle, footprintCandle, recentCandles, recentFootprints)` and get back a structured result with a score and reasons. Verify by logging results to the console.

---

## Exhaustion vs Absorption — Critical Distinction

The absorption engine already exists. Exhaustion is a different concept and must be a completely separate system.

| | Absorption | Exhaustion |
|---|---|---|
| Aggression | Strong | Strong |
| Passive response | Large passive liquidity absorbs it | No dominant passive response |
| Why it fails | Stopped by the other side | Runs out of fuel on its own |
| Delta | Extreme | Extreme but momentum fading across candles |
| Key signal | Single candle | Develops across multiple candles |

Exhaustion is primarily a **multi-candle** pattern. A single candle with big delta and a wick is not exhaustion — it might be absorption. Exhaustion requires seeing aggression sustained over several candles and then price beginning to fail. This is the key difference to bake into the scoring.

---

## Types

**File:** `types/exhaustion.ts`

```ts
type ExhaustionDirection = 'buyer' | 'seller'
type ExhaustionRank = 'weak' | 'moderate' | 'strong' | 'extreme'

interface ExhaustionResult {
  candleTime:   number
  score:        number                  // 0–100
  rank:         ExhaustionRank          // weak: 30–50, moderate: 50–65, strong: 65–80, extreme: 80–100
  direction:    ExhaustionDirection
  provisional:  boolean                 // true if candle is still open
  reasons:      string[]
  signals: {
    momentumDecay:       number         // pts from delta weakening across recent candles
    weakContinuation:    number         // pts from large delta but small price move
    wickRejection:       number         // pts from wick near the exhaustion extreme
    rangeShrink:         number         // pts from shrinking candle bodies during aggression
    imbalanceNoExtension: number        // pts from imbalances not leading to continuation
  }
}
```

Rank thresholds:
- `weak`: score 30–50
- `moderate`: score 50–65
- `strong`: score 65–80
- `extreme`: score 80–100
- Below 30: no result returned

---

## Rolling Window Requirement

Exhaustion scoring needs a lookback window of the last 5 candles before the candle being scored. This is non-negotiable — single-candle exhaustion detection produces too many false positives.

The window must include both `Candle` OHLCV and `FootprintCandle` data for each candle in the window.

Reuse `getRollingAverages` from `lib/utils/chartUtils.ts` (added during the code quality audit) for average delta and average volume. The exhaustion engine imports from there — do not duplicate the rolling average logic.

---

## Signal 1 — Momentum Decay (weight: 30 pts max)

This is the defining signal of exhaustion. Delta is strong but weakening across the last 3–5 candles.

**What to measure:**
- Collect the absolute delta of the last 5 candles in the same direction as the current candle
- Check if the values are trending downward — each candle's delta is smaller than the previous
- A perfect decay (each candle less aggressive than the last) over 4–5 candles → 30 pts
- Decay over 3 candles → 20 pts
- Decay over 2 candles → 10 pts
- No decay → 0 pts

**Direction consistency check:**
All candles in the window must have delta in the same direction as the current candle. If direction flips in the window, the sequence is broken — score 0 for this signal. Exhaustion requires sustained one-sided aggression that is now fading, not random alternation.

**Implementation note:**
Do not require strictly monotonic decay. A small dip then recovery then decay still counts if the overall trend is downward. Compare the average of the first two candles in the window against the average of the last two — if the latter is smaller, decay is present.

---

## Signal 2 — Weak Continuation (weight: 25 pts max)

Large delta but price barely moved. Similar to absorption Signal 3, but interpreted differently here — in exhaustion this is because the aggressive side is running out of willing counterparties, not because a large passive block is absorbing them.

**What to measure:**
- `deltaRatio = abs(candle.delta) / avgAbsDelta` — how extreme is this candle's delta
- `priceMove = abs(candle.close - candle.open)` — how much did price actually move
- `expectedMove = avgPriceMove` — average body size of recent candles
- `continuationRatio = priceMove / expectedMove`

If `deltaRatio > 1.5` but `continuationRatio < 0.5` → strong weak continuation signal
- `continuationRatio < 0.5` and `deltaRatio > 1.5` → 15 pts
- `continuationRatio < 0.3` and `deltaRatio > 2` → 25 pts

Add `avgPriceMove` to `getRollingAverages` output — the average absolute body size of the last N candles. This may require updating that utility function.

---

## Signal 3 — Wick Rejection Near Extreme (weight: 20 pts max)

A wick on the side of the aggression direction — buyers pushing up but an upper wick forms, sellers pushing down but a lower wick forms.

**What to measure:**
- For buyer exhaustion: `upperWick = high - max(open, close)`
- For seller exhaustion: `lowerWick = min(open, close) - low`
- `wickRatio = wick / (high - low)`

Points:
- `wickRatio > 0.3` → 10 pts
- `wickRatio > 0.5` → 20 pts

This signal alone means nothing. It only contributes meaningfully when Signals 1 and 2 are also partially firing. The scoring naturally handles this — a wick without delta decay produces a low total score below the threshold.

---

## Signal 4 — Range Shrink During Sustained Aggression (weight: 15 pts max)

Candle ranges (high - low) are getting smaller even though delta remains directionally consistent. The market is compressing — the aggressive side cannot push price further even with continued effort.

**What to measure:**
- Collect `high - low` for the last 4 candles with delta in the same direction
- Compare the average range of the first two against the average range of the last two
- If later ranges are smaller: range is compressing during aggression

Points:
- Range compressed by more than 20%: 8 pts
- Range compressed by more than 40%: 15 pts

---

## Signal 5 — Imbalances Without Extension (weight: 10 pts max)

Footprint imbalances appear at the extreme of the move (near the high for buyers, near the low for sellers) but price failed to extend beyond that level in subsequent candles.

**What to measure:**
- For buyer exhaustion: find cells in the upper third of the candle's range with `askVol / (bidVol + 1) > 3` — buy imbalances at the highs
- Check the next 1–2 candles: did price exceed the high of the imbalanced candle?
- If imbalances exist at the extreme but price did not extend: 10 pts
- If no imbalances at the extreme: 0 pts

This is a lookahead signal — it requires checking candles after the scored candle. Only compute this for closed candles where subsequent candles exist. For the live candle, this signal always contributes 0.

---

## Direction Classification

After scoring, classify direction:

- If the rolling window shows predominantly positive delta tapering → `'buyer'` exhaustion
- If predominantly negative delta tapering → `'seller'` exhaustion
- If mixed direction in window → do not classify, return null (not exhaustion)

---

## Detection Engine

**File:** `lib/exhaustion/engine.ts`

### `scoreExhaustion(candle, footprintCandle, recentCandles, recentFootprints)`

- Takes the candle to score, its footprint, the last 5 candles before it, and their footprints
- Runs all five signals
- Appends to `reasons[]` only when a signal contributes points — plain English, same pattern as absorption
- Returns `ExhaustionResult | null` — null if score < 30 or direction unclear

### `buildExhaustionMap(candles, engine, absorptionMap)`

- Iterates all closed candles with footprint data
- Skips candles already flagged as absorption with score > 60 — high-confidence absorption and exhaustion are mutually exclusive on the same candle
- Returns `Map<number, ExhaustionResult>` keyed by candle time
- Called once after absorption map is built, since it depends on it

The `absorptionMap` parameter is used to skip candles. Import the `AbsorptionResult` type from `types/absorption.ts`.

### Incremental update

Same pattern as absorption — only score a candle on close. Score the live candle provisionally. Never re-score closed candles.

---

## Store Additions

**File:** `lib/store/chart.ts`

- `exhaustionEnabled: boolean` — default `true`
- `exhaustionMinScore: number` — default `40`
- `exhaustionSide: 'both' | 'buyer' | 'seller'` — default `'both'`
- `exhaustionMap: Map<number, ExhaustionResult>` — session only, not persisted
- Matching set actions for each

---

## How to Verify This Task is Done

Add a temporary keyboard shortcut `E` that logs the exhaustion map to the console when pressed. For each entry log: candle time, score, rank, direction, and reasons array.

Look at the logged output while watching the chart. Ask:
- Are scores showing up at all? If nothing scores above 30, the rolling window or delta comparison is likely wrong.
- Do the reasons make sense for the candles being flagged? Pick a candle that scored and manually verify its delta and recent delta trend in the footprint.
- Are strongly trending candles (large body, consistent delta, no wick) scoring low? They should — clean momentum is the opposite of exhaustion.
- Are any absorptions being flagged as exhaustion? They should not — the `absorptionMap` skip should prevent this.

Do not proceed to Task 2 until scores feel directionally correct when compared to what you see on the chart.