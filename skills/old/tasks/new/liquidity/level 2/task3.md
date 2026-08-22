# Liquidity Map — Level 2, Task 3 of 3
## Scroll Behavior, Performance, and Profile Interaction

---

## Goal for This Task Only

Make the heatmap behave correctly when the user scrolls into history. Handle the mismatch between what snapshots exist and what the chart is showing. Define performance limits. Integrate heatmap data with the volume profile for contextual enrichment.

Level 2 Tasks 1 and 2 must be complete before starting this.

---

## The Scroll Problem

The heatmap shows historical liquidity aligned with the current visible price range. But when the user pans backward in time, they are looking at candles from hours ago. The heatmap still shows liquidity from the current session's snapshots — which may not represent what liquidity looked like when those candles were trading.

This is a fundamental limitation of the current architecture. The heatmap is not time-synchronized with the chart's scroll position — it shows the current history buffer regardless of which candles are visible.

### How to handle it

**Option A — Always show current state (simplest)**

The heatmap always shows the current buffer regardless of chart scroll position. When scrolled into history, the heatmap is labeled with a note: `CURRENT SESSION`. The user understands they are seeing today's liquidity context overlaid on historical candles.

This is the MVP approach. Honest about the limitation, still useful — current session liquidity levels projected back onto recent history.

**Option B — Timestamp-matched rendering (future)**

Requires storing snapshots with full timestamp alignment and matching heatmap rows to candle time. Complex, deferred to a future version.

**Implement Option A.** Add a small `CURRENT` label at the top of the heatmap strip when the chart is scrolled more than 50 candles back from the latest candle. This indicates the heatmap is showing current session context, not historically matched data.

The label:
- Position: top of the heatmap strip
- Text: `CURRENT`
- Font: `JetBrains Mono`, `8px`
- Color: `#4A4A4A` — muted, informational not alarming

---

## Candle Visibility Threshold for Heatmap

When the user is zoomed out so far that hundreds of candles are visible at once, the heatmap strip becomes less meaningful — each price row is very thin and the visual is noisy.

Add a minimum row height threshold: if `priceToY` computation produces rows smaller than `2px`, switch to a simplified rendering mode:

**Simplified mode (rows < 2px):**
- Do not draw individual rows
- Instead, draw a gradient fill across the full heatmap strip
- Top half of strip: ask-side color (`#EF5350`) at average ask intensity
- Bottom half: bid-side color (`#26A69A`) at average bid intensity
- A thin divider at `priceToY(currentPrice)`
- This at least communicates relative bid vs ask pressure at the current zoom level

Return to full row rendering when rows are >= 2px.

---

## Memory Management

The `LiquidityHistory` buffer caps at `maxSnapshots`. But each snapshot stores up to 300 price levels (150 bid + 150 ask). At default settings:

`200 snapshots × 300 levels × (4 bytes price + 4 bytes qty) = ~480KB`

Acceptable. At `maxSnapshots = 500`:
`~1.2MB` — still fine.

**Eviction policy:** When adding a new snapshot that would exceed `maxSnapshots`, remove the oldest. This is a simple FIFO queue — no complex eviction logic needed.

**Cleanup on disconnect:** When the pair changes or the user closes the tab, the history is in-memory only. Nothing persists. On reconnect, history starts fresh. This is expected behavior.

---

## Integration With Volume Profile

The volume profile and the heatmap now both occupy the right side of the chart. They provide different information:

- **Volume profile**: how much volume traded at each price (candles that actually executed)
- **Liquidity heatmap**: how much passive volume was resting at each price (orders waiting)

These are complementary. A price level with high volume in the profile AND high historical liquidity in the heatmap suggests a major contested zone. A level with high profile volume but no heatmap intensity suggests it traded through quickly without resting orders.

### Visual integration

No code changes needed for the basic complementary view — the two strips sit side by side and the user reads both.

**Optional enrichment:** When drawing the volume profile, check if the POC row corresponds to a price level with high heatmap intensity. If yes, render the POC row with a subtle amber left-edge glow — visually connecting the two data sources. This requires passing `heatmapRows` into `drawVolumeProfile` as an optional parameter.

Implement this only after the core rendering is stable. Flag as optional.

---

## Integration With Custom Profile

When the user draws a custom profile selection, the heatmap still shows the full current session's liquidity context. The heatmap does not filter to the selection range — it continues to show all visible price levels.

This is correct — the heatmap is session-context, not selection-specific.

No code changes needed. The two systems are visually independent.

---

## Multi-Panel

In dual panel mode with different pairs:
- Left panel (BTC) has its own `LiquidityHistoryManager` in its `PanelFeedProvider`
- Right panel (ETH) has its own separate instance
- Each panel's heatmap reflects its own pair's liquidity history

This requires `liquidityHistory` to be per-panel in `ChartEngineContext` — which was already set up in Task 1 by extending the context. No further changes needed if Task 1 was implemented per-panel correctly.

---

## Settings Panel — Final Additions

**File:** `components/ui/SettingsPanel.tsx`

Add remaining history settings to the `LIQUIDITY HEATMAP` section:

```
History depth        [slider]   200 candles
Show CURRENT label   [toggle]   on
Profile integration  [toggle]   off    ← optional POC glow
```

- History depth slider: range 50–500, step 50. Changing this value does not clear existing history — it just adjusts the cap going forward.
- Show CURRENT label: controls whether the `CURRENT SESSION` indicator renders when scrolled into history.
- Profile integration: gates the optional POC glow feature.

---

## Performance Summary for Level 2

| Operation | Frequency | Cost |
|---|---|---|
| Snapshot capture | Once per candle close | Medium — iterates 300 levels |
| `buildHeatmapRows` | Every redraw | Low — 50–150 rows |
| `drawLiquidityHeatmap` | Every redraw | Low — same rows |
| `getLiquidityBehavior` | Once per redraw per row | Low — array math |
| Memory footprint | Static | ~480KB at default settings |

All operations are within acceptable budget. No workers, no caching beyond the history buffer itself.

The one risk: if the user sets `maxSnapshots = 500` and `liquidityBucketSize = $10` (many price levels), `buildHeatmapRows` may iterate 500+ rows per redraw. Add a safeguard: cap `buildHeatmapRows` to the 300 rows closest to current price, ignoring distant levels.

---
