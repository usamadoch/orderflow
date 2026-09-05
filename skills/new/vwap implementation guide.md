# VWAP — Implementation Guide

You don't have this indicator yet, so this is a from-scratch build spec, combining the Deepcharts VWAP Envelopes article with how VWAP is generally implemented elsewhere (TradingView's native VWAP, Anchored VWAP, and several popular community versions), so the end result isn't narrower than what's standard.

---

## Part 1 — Plain English

### What VWAP actually is

A normal moving average treats every candle equally — 10 candles, average them, done. VWAP doesn't. It weights each candle's price by how much volume traded on it. A candle where 500 BTC changed hands pulls the average toward its price much harder than a candle where 2 BTC changed hands. The result is less "the average price over time" and more "the average price the market actually paid," which is why institutions use it as a fairness benchmark — a large order executed above VWAP paid a worse-than-average price; below VWAP, better-than-average.

**Example:** three 1-minute candles at prices 60,000 / 60,100 / 60,050 with volumes 10 / 100 / 5 BTC. A plain average of the three prices ≈ 60,050. VWAP is pulled hard toward 60,100, because that's where almost all the actual volume traded. That's the entire point of the indicator — size matters, not just price.

### The two things people mean by "VWAP" — you need both

**Anchored / Session VWAP (the industry-standard default, used almost everywhere):** starts accumulating from a fixed starting point — most commonly the start of the trading day — and keeps building forward until that period ends, then resets and starts over. This is what "VWAP" means by default on nearly every platform. For a 24/7 market like BTC futures, the universal convention (not ambiguous the way the session-times question was — this one's genuinely standard across the industry) is to reset at **00:00 UTC** daily.

**Rolling / Continuous VWAP (the Deepcharts "VWAP Envelopes" specific variant):** never resets. Instead it always covers a fixed trailing window — the last 60 minutes, the last 5 days, whatever you set — and that window continuously slides forward with the clock. No reset means no discontinuous jump at midnight, but it also means it won't match the session VWAP except by coincidence at the exact moment a session happens to end (the article states this directly: it only lines up with the daily session VWAP right at session close). Useful for pure intraday, "how has price behaved relative to volume over the last N minutes regardless of what time it is" analysis.

**Example of the difference:** at 11:58 PM, session VWAP reflects almost a full day of accumulated volume. One minute later, at 12:00 AM, session VWAP resets to nothing and starts over from the new candle — a visible jump. A rolling VWAP set to "last 1440 minutes" shows no jump at all at that moment — it's always looking at the trailing 24 hours no matter what the clock says.

Build both. Session VWAP is the one nearly everyone expects by default; rolling VWAP is Deepcharts' distinguishing feature and genuinely useful for pure intraday work.

### The envelope bands (standard deviation or percentage)

Around the VWAP line, bands mark how far price typically strays from it. With standard-deviation bands: roughly 68% of price action stays inside the 1st band, ~95% inside the 2nd, ~99.7% inside the 3rd — so the further out a band gets touched, the rarer that move statistically is. Percentage bands do the same job more simply: a fixed distance (e.g. ±2%) above and below, no statistics involved.

**Example use:** price sitting above VWAP = market paid a premium today (bullish context); price below = discount (bearish context). A touch of the 2nd or 3rd band is a statistically stretched move — often watched for mean-reversion back toward VWAP, or, if price keeps pushing through and holding beyond a band instead of snapping back, that's read as trend/breakout confirmation instead.

### Price source

VWAP needs one number per candle to weight by volume — not just the close. The default almost everywhere is **HLC3** (`(high + low + close) / 3`, the "typical price") because it accounts for the whole candle's range, not just where it happened to close. Alternatives (Close only, HL2, OHLC4) exist for people who want the line to hug price action more tightly or more loosely — worth exposing as a setting, default to HLC3.

---

## Part 2 — Formulas / Pseudocode

_(Separate from the plain-English section above — everything below is exact math, not explanation.)_

### Price source options

```
HLC3   = (high + low + close) / 3        // default
HL2    = (high + low) / 2
OHLC4  = (open + high + low + close) / 4
Close  = close
```

### Core VWAP (applies to both Session and Rolling modes — only the window differs)

```
For each candle i in the active window:
    typicalPrice[i] = priceSource(candle[i])   // per above
    cumPV += typicalPrice[i] * volume[i]
    cumV  += volume[i]

VWAP = cumPV / cumV
```

**Session mode window:** all candles since the last anchor point (00:00 UTC for daily; start of week/month for those modes). Reset `cumPV` and `cumV` to zero at each new anchor.

**Rolling mode window:** only the last N minutes or last N days, continuously sliding — recompute (or maintain incrementally with a subtract-on-expiry approach) rather than accumulating forever.

### Standard deviation bands

```
For each candle i in the same window used for VWAP:
    variance += volume[i] * (typicalPrice[i] - VWAP)^2

stdDev = sqrt(variance / cumV)     // volume-weighted standard deviation

Band_1_Up = VWAP + (stdDev * multiplier1)   // multiplier default 1
Band_1_Dw = VWAP - (stdDev * multiplier1)
Band_2_Up = VWAP + (stdDev * multiplier2)   // multiplier default 2
Band_2_Dw = VWAP - (stdDev * multiplier2)
Band_3_Up = VWAP + (stdDev * multiplier3)   // multiplier default 3
Band_3_Dw = VWAP - (stdDev * multiplier3)
```

### Percentage bands (alternative envelope mode)

```
Band_1_Up = VWAP * (1 + pct1/100)
Band_1_Dw = VWAP * (1 - pct1/100)
// same pattern for band 2 and 3, each with its own pct value
```

---

## Part 3 — Settings Spec

### Period Mode

- **Session** _(default)_ — resets daily at 00:00 UTC. Standard, universal for crypto — not ambiguous the way generic "session" definitions have been elsewhere in this project.
- **Week** / **Month** — same anchored mechanism, resets at week/month start instead of daily.
- **Rolling — Minutes** — Period Value = number of trailing minutes (e.g. 60, 1440). Deepcharts' "Minutes" mode.
- **Rolling — Days** — Period Value = number of trailing days. Deepcharts' "Daily (last n days)" mode.
- **Anchored to Bar** _(extension, not in the Deepcharts article, but a widely-used standard feature — e.g. TradingView's Anchored VWAP)_ — user clicks a candle, VWAP starts accumulating from exactly that point (swing high/low, a specific event candle). Worth adding since it's a well-established capability elsewhere, not just cosmetic.

### Period Value

- Numeric input, meaning depends on Period Mode (minutes count, or day count). Not used for Session/Week/Month/Anchored-to-Bar modes.

### Price Source

- HLC3 _(default)_, Close, HL2, OHLC4.

### Envelope Mode

- **Standard Deviation** _(default)_ — bands computed per the formula above.
- **Price Percentage** — bands as a fixed % offset instead.

### Envelope Bands (three independent bands, each with its own multiplier/percentage and its own visibility toggle)

- 1st band: Up/Down multiplier (default 1) or percentage.
- 2nd band: Up/Down multiplier (default 2) or percentage.
- 3rd band: Up/Down multiplier (default 3) or percentage.
- Each band independently hideable (an "Ignore" style option, not just one global on/off for all three).

### Visual / Style

- VWAP line color, width, style (solid/dashed/dotted).
- Per-band color for each of the 6 lines (1UP/1DW/2UP/2DW/3UP/3DW).
- Optional fill between each band pair.
- Custom short name/label for the indicator instance (useful once you have both a Session and a Rolling VWAP on the same chart at once and need to tell them apart).

## Suggested build order

1. Core Session VWAP (00:00 UTC anchor) + standard deviation bands 1/2/3 — this alone covers what most people expect by default and is the highest-value piece.
2. Rolling VWAP (Minutes and Days modes) — Deepcharts' distinguishing feature, reuses the same core calculation with a different window.
3. Percentage envelope mode as an alternative to standard deviation.
4. Visual customization (colors, styles, fills, per-band hide).
5. Anchored-to-Bar mode — genuinely useful but the most engineering-heavy piece (needs click-to-anchor UI), lowest priority of the five.
