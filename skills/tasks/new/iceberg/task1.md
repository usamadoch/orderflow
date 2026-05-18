# Iceberg Detection — Task 1 of 2
## Concept, Types, and Scoring Engine

---

## Goal for This Task Only

Define what iceberg behavior looks like in footprint data. Build the scoring engine that detects it per candle and across candles. Produce a structured result with a score, rank, and reasons. Verify by logging to console. Nothing renders yet.

---

## What an Iceberg Is

An iceberg order is a large hidden order where only a fraction of the total size is shown in the visible orderbook at any time. When the visible slice gets consumed by aggressive traders, the exchange automatically refreshes another slice of equal size. From the outside it looks like price is hitting the same level repeatedly but the liquidity never depletes.

In footprint data this produces a distinctive signature:
- A specific price bucket accumulates unusually high volume across multiple candles
- That volume is consistently one-sided — always ask or always bid
- Price repeatedly tests that level without breaking through
- Delta at that level neutralizes — aggressive volume is absorbed candle after candle
- The level defense is persistent, not a one-time event

This is distinct from absorption: absorption is a single candle event. Iceberg is a multi-candle persistent defense pattern at one price level.

---

## Iceberg vs Absorption — Critical Difference

| | Absorption | Iceberg |
|---|---|---|
| Scope | Single candle | Multiple candles |
| Delta | Extreme then reversing at the candle level | Consistently neutralized at one bucket across candles |
| Price behavior | Single candle rejection | Repeated tests, repeated defense |
| Duration | Instant event | Develops over 3–10+ candles |
| Key signal | Delta vs price direction mismatch | Volume accumulation at one specific bucket |

> **Note on the delta column:** Absorption can also show near-neutral delta at the bucket level within a single candle — large two-sided volume in one candle is possible. The critical distinguishing factor is **temporal scope**: absorption is a single-candle verdict, iceberg requires the neutralization pattern to repeat across multiple candles at the same level. Do not use delta behavior alone to separate the two; always check scope first.

The existing absorption engine scores per candle. The iceberg engine scores per price level across a range of candles. These are different units of analysis.

---

## What to Look For in Footprint Data

Iceberg detection works at the price bucket level, not the candle level.

For a given price bucket, across the last N candles, ask:

1. **Volume accumulation** — how much total volume has traded at this bucket across all candles in the window? High accumulation means repeated activity here.

2. **Side consistency** — is the volume predominantly one side? Icebergs defending a level show up as consistent ask volume at a bid level (buyers absorbing sellers) or consistent bid volume at an ask level (sellers absorbing buyers).

3. **Price persistence** — price has visited this level multiple times without breaking through. The level is holding.

4. **Delta neutralization** — at this specific bucket, the running delta (cumulative askVol − bidVol across candles) stays near zero despite large volume — both sides are consistently active, with the defending side refreshing to match aggression.

5. **Volume stability** — unlike a regular large trade event that spikes and fades, an iceberg shows consistent volume per candle at this level. The per-candle volume at this bucket is similar across multiple candles.

---

## Types

**File:** `types/iceberg.ts`

```ts
type IcebergSide = 'bid_defense' | 'ask_defense'
  // bid_defense: buyers defending a support level (absorbing sellers)
  // ask_defense: sellers defending a resistance level (absorbing buyers)

type IcebergRank = 'suspected' | 'probable' | 'confirmed'
  // suspected: 35–55, probable: 55–75, confirmed: 75–100

interface IcebergLevel {
  price:            number           // the specific price bucket being defended
  side:             IcebergSide
  score:            number           // 0–100
  rank:             IcebergRank
  provisional:      boolean          // true if based on live (unclosed) candle data
  totalVolume:      number           // cumulative volume at this level across window
  candleCount:      number           // how many candles contributed to this level
  avgVolumePerCandle: number         // stability measure
  cumulativeDelta:  number           // running net at this level
  reasons:          string[]
  signals: {
    volumeAccumulation: number       // pts
    sideConsistency:    number       // pts
    pricePersistence:   number       // pts
    deltaNeutralization: number      // pts
    volumeStability:    number       // pts
  }
  detectedAt:       number           // unix ms
  isActive:         boolean          // still visible in recent candles
}
```

---

## Lookback Window

Iceberg detection requires looking across multiple candles, not just one.

Default lookback: **last 10 candles**. This is the window the engine analyzes for each price bucket.

Why 10:
- Short enough to be recent and relevant
- Long enough to distinguish a one-time event from persistent behavior
- On 1m chart this is 10 minutes of context — enough to see repeated defense

Add to store: `icebergLookback: number` — default `10`, range `5–20`.

---

## Signal 1 — Volume Accumulation (weight: 25 pts max)

Total volume at this price bucket across the last N candles.

Compare to the session average bucket volume — how much does a typical bucket accumulate per candle across the chart.

Compute `avgBucketVolume` as: total volume across all visible footprint data divided by total number of non-empty cells divided by N candles.

- `accumulationRatio = levelTotalVolume / (avgBucketVolume * lookbackWindow)`
- `ratio > 2x` → 12 pts
- `ratio > 4x` → 20 pts
- `ratio > 6x` → 25 pts

This signal fires when a price level has seen dramatically more total activity than a typical level would over the same period.

---

## Signal 2 — Side Consistency (weight: 25 pts max)

Of all the volume at this bucket across all candles, how one-sided is it?

Collect `bidVol` and `askVol` at this bucket from every candle in the window.
- `dominantSide = whichever is larger across all candles combined`
- `dominanceRatio = dominantVol / totalVol`

- `ratio > 0.65` → 10 pts
- `ratio > 0.75` → 18 pts
- `ratio > 0.85` → 25 pts

A bucket with 85% of volume on one side over 10 candles is strongly directional — consistent with a hidden order defending from one side.

The defending side determines `IcebergSide`:
- Dominant ask volume at this level = buyers filling here repeatedly = `bid_defense` (defending a support)
- Dominant bid volume at this level = sellers filling here repeatedly = `ask_defense` (defending resistance)

> **FootprintCell convention:** This assignment assumes the standard convention used throughout this codebase: `askVol` = trades hitting the ask (aggressive buyers), `bidVol` = trades hitting the bid (aggressive sellers). This matches `ingestTrade` where `isBuyerMaker === true` increments `bidVol` (seller aggressive) and `isBuyerMaker === false` increments `askVol` (buyer aggressive). The side assignment above is therefore correct — dominant `askVol` at a level means repeated buyer aggression = passive bid liquidity absorbing them = `bid_defense`. Confirm this convention is intact in your actual `FootprintCell` implementation before running Signal 2, because a reversed assignment makes all side classifications backwards with no visible error.

---

## Signal 3 — Price Persistence (weight: 20 pts max)

How many of the lookback candles had price visit this bucket level? If price visited 8 of 10 candles, it has been actively testing and being held at this level.

For each candle in the window, check if the candle's range (high to low) includes the bucket's price range.

`visitCount = number of candles where candle.low <= bucketPrice + bucketSize && candle.high >= bucketPrice`
`visitRatio = visitCount / lookbackWindow`

- `ratio > 0.5` → 8 pts (price visited more than half the time)
- `ratio > 0.7` → 14 pts
- `ratio > 0.9` → 20 pts

High visit ratio with high volume accumulation is a strong combined signal.

---

## Signal 4 — Delta Neutralization (weight: 20 pts max)

At this specific bucket, the cumulative delta (askVol − bidVol summed across all candles in window) is near zero despite large total volume.

`cumulativeDelta = sum of (cell.askVol - cell.bidVol) for this bucket across all window candles`
`neutralizationRatio = 1 - abs(cumulativeDelta) / totalVolume`

- `ratio > 0.7` → 8 pts (delta less than 30% of volume)
- `ratio > 0.85` → 14 pts
- `ratio > 0.95` → 20 pts

When large volume produces almost no net delta, it means the aggressive and passive sides are nearly equal — consistent with an iceberg being refreshed to match each aggressive order.

---

## Signal 5 — Volume Stability (weight: 10 pts max)

An iceberg refreshes in consistent slice sizes. The per-candle volume at this bucket should be relatively stable across the window — not a spike then silence.

Collect per-candle volume at this bucket: `[v1, v2, v3, ..., vN]` where `vi` is the volume in candle `i`.

Compute coefficient of variation: `CV = standardDeviation(volumes) / mean(volumes)`

Lower CV = more stable = more consistent slice sizes.

- `CV < 0.5` → 6 pts (moderate consistency)
- `CV < 0.3` → 10 pts (high consistency)
- `CV >= 0.5` → 0 pts

Only compute this signal when `visitCount >= 5` — need enough data points for meaningful statistics.

**When `visitCount < 5`:** do not silently score zero. Instead:
- Set `signals.volumeStability = 0` explicitly
- Append to `reasons[]`: `"Volume stability: N/A (insufficient visits)"`

This makes the output transparent — a user reading the reasons knows Signal 5 was not assessed, not that it failed. It also makes debugging easier when a level scores lower than expected.

---

## Detection Engine

**File:** `lib/iceberg/engine.ts`

### `IcebergEngine` class

Constructor takes `bucketSize` and `lookbackWindow`.

### `analyzeLevel(bucketPrice, candles, footprintCandles, windowStart, windowEnd)`

Scores a single price bucket across the provided candle window.

- Takes all footprint candles in the window
- Extracts this bucket's cell from each footprint candle
- Computes all five signals
- Builds `reasons[]` with the following rules:
  - Append a reason string for every signal that contributes points
  - For Signal 5, also append `"Volume stability: N/A (insufficient visits)"` when `visitCount < 5` — this is the one case where a reason is added even though zero points are scored, because the absence of assessment is itself meaningful information
- Returns `IcebergLevel | null` — null if score < 35 or `visitCount < 3`

### `runFullAnalysis(candles, engine, visiblePriceMin, visiblePriceMax)`

Scans all price buckets in the visible price range. For each bucket, calls `analyzeLevel`. Collects all results above the minimum score threshold. Returns `IcebergLevel[]` sorted by score descending.

This is the expensive function — it iterates every visible price bucket. On BTC with `$25` bucket size and a visible range of `$2000`, that is 80 buckets × N candles each. Still fast — a few milliseconds at most.

### `update(newCandle, engine)`

Called on every candle close. Re-runs `runFullAnalysis` for the updated window. Replaces the stored results.

### `reset()`

Clears all results. Called on pair, timeframe, or bucket size change.

---

## When to Run Analysis

Unlike absorption and exhaustion which score one candle at a time, iceberg analysis scans price levels across the lookback window. Run it on every candle close — not per-trade.

In `FeedProvider`, after `engine.ingestCandle(candle)` when `candle.isClosed === true`:
```
icebergEngine.update(candle, aggregationEngine)
store.setIcebergLevels(icebergEngine.getTopLevels(20))
```

Cap output at top 20 levels by score — the renderer only needs the strongest detections.

---

## Store Additions

**File:** `lib/store/chart.ts`

```ts
icebergEnabled:      boolean         // default true, persisted
icebergMinScore:     number          // default 45, persisted
icebergLookback:     number          // default 10, persisted
icebergLevels:       IcebergLevel[]  // session only, not persisted
```

Actions: `setIcebergEnabled`, `setIcebergMinScore`, `setIcebergLookback`, `setIcebergLevels`

---

## Context Access

`IcebergEngine` lives in a ref inside `FeedProvider` alongside the absorption and exhaustion engines. Expose it through `ChartEngineContext`:

```ts
interface ChartEngineContextValue {
  engine:          AggregationEngine | null
  liquidityHistory: LiquidityHistoryManager | null
  icebergEngine:   IcebergEngine | null    // new
}
```

---

Do not proceed to Task 2 until levels log correctly with meaningful scores and reasons.