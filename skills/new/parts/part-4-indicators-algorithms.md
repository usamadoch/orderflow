# Part 4 — Indicators and Algorithms

**Scope:** the actual math behind every signal on the chart, and — separately, in its own part of each section — the plain-English idea it's built to capture. This is the layer most directly responsible for the hang: every calculation here needs to be cheap enough to run on every incoming trade, for every symbol, without becoming the synchronous bottleneck Part 1 diagnoses. Read this file as the algorithmic half of that fix; Part 1 covers the structural half (moving what can't be made cheap enough onto a worker thread).

---

## 1. The General Computation Pattern

Before the individual indicators: nearly everything in this file is one of three underlying patterns, and recognizing which one applies to a given calculation tells you immediately how to make it cheap.

**Running totals.** A single number (or pair of numbers) updated by a fixed, small amount on every new trade — no history needs to be re-read. VWAP and CVD are both this. Cost per event: constant, regardless of how long the session has been running.

**Price-bucketed histograms.** A collection of running totals, one per price level, each updated independently as trades land at that price. Volume profile and footprint are both this — really just "running totals," plural, indexed by price instead of being a single global number.

**Rolling statistics over a trailing window.** Absorption's dynamic threshold needs a mean and standard deviation over, say, the last N bars — and recomputing that from scratch over N values on every new bar is exactly the kind of avoidable O(n)-per-event cost Part 1 warns about. The fix is an **online (incremental) rolling calculation**: keep a running sum and a running sum-of-squares over the window, updated by adding the new value and subtracting the value that just fell out of the window, rather than re-summing the whole window every time. Mean is `sum / count`; variance is derived from the sum-of-squares and the sum without ever touching every individual value again. This turns a window-sized calculation into a fixed handful of arithmetic operations per event, independent of how large the window is — the same "constant cost per event" property VWAP and CVD have natively.

Every indicator below reduces to one of these three shapes. None of them require re-scanning raw history on each update if implemented this way — which is the entire point.

---

## 2. VWAP (Volume Weighted Average Price)

**The idea.** A plain average price treats a 0.001 BTC trade and a 10 BTC trade identically. VWAP weights each price by how much volume actually traded there, so it reflects where the money moved, not just where the price happened to sit. It's the benchmark institutional execution is often measured against — trading above VWAP on a buy is generally considered a worse fill than trading below it.

**The mechanics.** Maintain two running totals from the session anchor point: the sum of (price × volume) across every trade, and the sum of volume alone.

`VWAP = Σ(price × volume) / Σ(volume)`

Updating on a new trade is one multiply, two additions, and one division — genuinely constant cost. Reset both running totals at the session boundary (you already have custom session support built, so this is a case of wiring the existing session-boundary logic into whichever running totals need resetting there, VWAP and CVD both).

**Variant worth knowing:** a *rolling* VWAP (fixed lookback window, e.g., last 30 minutes, rather than anchored to session start) is the rolling-statistics pattern from Section 1, not the plain running-total pattern — it needs the add-new/subtract-expired approach, not just accumulation, since old trades need to eventually stop counting.

---

## 3. CVD (Cumulative Volume Delta)

**The idea.** Delta, per trade, is simply which side was aggressive — did a buyer lift the offer, or did a seller hit the bid. CVD is the running sum of that over a session, and it's most useful read *against* price: price rising while CVD falls means the rally is happening on thinning aggressive-buy conviction — a classic early divergence warning — and the reverse pattern flags the same thing on the downside.

**The mechanics.** Binance's `aggTrade` stream includes a flag for whether the buyer was the "maker" (the resting order). If the buyer was the maker, an aggressive *seller* initiated the trade by hitting a resting buy order — classify as sell volume. If the buyer was *not* the maker, an aggressive *buyer* initiated it — classify as buy volume.

`delta = buy_volume − sell_volume` (per trade)
`CVD = Σ(delta)` (running sum since session anchor, same reset point as VWAP)

**Noise note.** Tick-level delta is noisy — a rapid back-and-forth of small opposing trades can make raw per-tick CVD jump around in a way that obscures the actual signal. If the divergence read is getting cluttered by this, the fix isn't to change the math, it's to compute CVD at the bar level (delta summed within each footprint bar, then the running total advances bar-by-bar) rather than re-plotting every single tick's contribution — same underlying running total, just sampled at a coarser, more readable resolution for display.

---

## 4. Volume Profile — Point of Control and Value Area

**The idea.** Bucket all traded volume over a period into price levels — the result is a histogram of which prices attracted the most business. The busiest bucket is the **Point of Control (POC)**. The **Value Area** is the contiguous price range holding roughly 70% of total volume, built outward from the POC — meant to represent where the market broadly agreed price was fair, with everything outside comparatively rejected.

**The mechanics.** The stepwise expansion algorithm (the same method exchanges like the CME use), not a simple percentile cut:

1. Total volume across all buckets in the period → target = total × 0.70.
2. Start at the POC (highest-volume bucket). `accumulated = POC's volume`.
3. Compare the bucket immediately above the current included range against the bucket immediately below it. Add whichever has *more* volume to the range; add its volume to `accumulated`.
4. Repeat step 3 — always comparing the next bucket above against the next bucket below the current range, always taking the larger — until `accumulated ≥ target`.
5. VAH (Value Area High) = top of the highest included bucket. VAL (Value Area Low) = bottom of the lowest included bucket.

Worked example — a session's volume by price bucket:

| Price | Volume |
|---|---|
| 118 | 4 |
| 119 | 10 |
| 120 | 22 |
| **121 (POC)** | **30** |
| 122 | 20 |
| 123 | 9 |
| 124 | 5 |

Total = 100, target = 70. Start at 121 (30) → accumulated 30. Compare 122 (20) vs 120 (22): 120 wins → accumulated 52, VAL = 120. Compare 122 (20) vs 119 (10): 122 wins this round → accumulated 72 ≥ 70, stop. **POC = 121, VAH = 122, VAL = 120.** Bucket 119 is never included despite having more volume than untouched bucket 124 — the algorithm always compares the two buckets *immediately adjacent* to the current range, never the largest remaining buckets globally, which is exactly what keeps the Value Area one contiguous range instead of a scattered set of high-volume spikes.

**Making this cheap:** compute per-bucket volume as a running total updated on every trade (Section 1's histogram pattern) — never re-derive the whole histogram from raw ticks. The POC/VA expansion itself (steps 2–5) only needs to run when a user requests the profile for a given period, not on every tick; that computation is proportional to the number of price buckets in the range, not the number of trades, and is cheap enough to run on demand without needing to be incremental itself.

---

## 5. Footprint Imbalances

**The idea.** Within one bar, each price row has both bid volume (aggressive selling into resting buyers) and ask volume (aggressive buying into resting sellers). An imbalance flags a row where one side dominates — a visible marker that one side was disproportionately aggressive at that exact price.

**The mechanics.** The comparison is diagonal, not same-row: a price row's ask volume compares against the *bid* volume one tick *below* it — because a buyer lifting the offer at price P and a seller hitting the bid at P minus one tick are the two flows actually competing for the same liquidity as price moves through that zone. Flag a cell when one side exceeds the other by a set ratio, commonly 3:1 (300%).

**Stacked imbalances.** Three or more *consecutive* price levels flagged in the same direction is a meaningfully stronger signal than one isolated cell — sustained one-sided pressure through a price range rather than a single noisy print. Implementing this as a running counter (increment on a same-direction flagged cell adjacent to the previous one, reset on a break in the pattern) keeps it in the same constant-cost-per-cell category as everything else here, rather than requiring a separate pass over the completed bar afterward.

**Cross-bar imbalance zones** (a genuine extension worth having on the roadmap, not something you need day one): the same stacking idea can apply *across* consecutive bars at the same price level, not just within a single bar — a price level that shows an imbalance in the same direction across several consecutive bars is a stronger structural signal than any single bar's imbalance alone, and is a natural way to surface "this level keeps getting defended/attacked" without the user having to notice it manually across many bars.

---

## 6. Absorption (and Exhaustion)

**The idea, briefly** (you've already built a version of this): heavy aggressive volume hits a price level and price *doesn't* move the way that volume would normally suggest, because resting orders at that level are large enough to soak it up. It's a meaningful signal near a prior support/resistance/POC level; the identical pattern occurring in the middle of nowhere is largely noise.

**Making the threshold adaptive, not fixed.** A fixed volume threshold either misses real absorption during quiet conditions or fires constantly during busy ones, because "unusually heavy" is relative to current conditions, not an absolute number. Use the rolling-statistics pattern from Section 1: maintain a rolling mean and standard deviation of volume-per-cell (or per-bar, depending on granularity) over a trailing window, updated incrementally — never recomputed from scratch — and flag a candidate using a z-score test:

`z = (cell volume − rolling mean) / rolling standard deviation`

Flag when `z` exceeds a chosen threshold (commonly 2–3), combined with the requirement that price barely moved during that bar/cell. This self-adjusts to the current regime and the specific instrument automatically — no manually-tuned number per symbol that goes stale as volatility shifts.

**The location filter, made concrete.** Maintain a small, explicitly tracked set of "significant levels" — prior session POC, prior VAH/VAL, recent swing highs/lows — each with a tolerance band in ticks. A statistically-flagged candidate only becomes a surfaced absorption signal if it falls within tolerance of one of these tracked levels; otherwise it's suppressed. This lookup is cheap (a small set, checked against one price) and is what separates a genuinely actionable signal from "the market was busy right now," which is the single biggest complaint about naive absorption detectors.

**Exhaustion, briefly, for the roadmap:** the near-opposite read of the same inputs — instead of heavy volume with no price progress, it's price making progress right as the aggressive volume behind it visibly fades, without needing a large passive wall on the other side. Both patterns can share the same rolling-statistics infrastructure (volume relative to its recent norm, price range relative to volume) — the difference is in which combination of "volume trend" and "price progress" gets flagged, not in a separate calculation pipeline.

---

## 7. Bubble Sizing

**The idea.** Trade size varies by orders of magnitude — most trades are small, a few are enormous — so a direct linear mapping from size to radius either makes small trades invisible or lets one outsized trade dominate the entire chart.

**The mechanics.** A monotonic but compressive function — square root or logarithm — maps trade size into radius, clamped to a sensible min/max so nothing disappears or overflows:

`radius = clamp( minRadius + scale × sqrt(tradeSize), minRadius, maxRadius )`

Color by aggressor side using the identical maker-flag logic already used for CVD classification — no separate lookup needed, it's the same underlying field read once per trade and reused for both the color and the CVD running total.

---

## 8. Signal Confluence — Why This Is the Actual Product

Worth stating explicitly since it's the core of what you're trying to give users beyond candlesticks: none of the individual signals above are the point in isolation — a single absorption flag, a single stacked imbalance, a single CVD divergence, is each just one data point. The edge comes from **confluence** — several of these independently-computed signals agreeing at the same price and around the same time (absorption at a prior VAH, with a CVD divergence forming, with a stacked imbalance on the same side). Since every signal here is already computed as a cheap, incremental value attached to a specific price and time, building a simple confluence layer — checking whether multiple active signals currently overlap within a small price/time tolerance — is a thin, cheap pass on top of infrastructure this file already establishes, not a new computational burden. This is the concrete mechanism behind the "aware of more than candlesticks" positioning the product is built around.

---

## 9. Complexity Summary — Why This Is Half of the Hang Fix

Every calculation in this file, done correctly, costs a small, fixed amount of work per incoming trade — O(1) per event — regardless of how long the session has run or how much history has accumulated. The failure mode that produces a hang is any of these being implemented instead as "re-derive from the full accumulated history" on some trigger (bar close, user request, indicator toggle) — an O(n) cost that grows for the entire life of the session and gets worse the longer the platform stays running, which lines up exactly with a hang that gets worse over time or under load rather than staying constant. If Part 1's diagnosis is correct that the hang is event-loop blocking caused by indicator computation, the fix isn't only "move it to a worker thread" (the structural fix) — it's also making sure what gets moved there is genuinely O(1)-per-event in the first place, because a worker thread running an O(n) calculation still eventually becomes the bottleneck as n grows, just one step removed from the main thread instead of on it.

---

## Terms Reference

- **Running total** — a value updated incrementally on each new event, never recomputed from scratch.
- **Online / incremental rolling statistics** — mean and standard deviation over a trailing window, maintained via running sums that add new values and subtract expired ones, rather than re-summing the whole window each time.
- **Z-score** — how many standard deviations a value sits from the current rolling mean; used here to make "unusually heavy" adaptive to current conditions instead of a fixed number.
- **POC (Point of Control)** — the single highest-volume price bucket in a volume profile.
- **Value Area (VAH/VAL)** — the contiguous price range built outward from the POC via the stepwise adjacent-bucket expansion, holding roughly 70% of total volume.
- **Stacked imbalance** — three or more consecutive footprint price levels flagged in the same direction within a bar (or, as an extension, across bars).
- **Confluence** — multiple independent signals agreeing at the same price/time, treated as a stronger combined signal than any one alone.
