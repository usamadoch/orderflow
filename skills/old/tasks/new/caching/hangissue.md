I want to fix browser-side runtime growth/performance issues found from the market debug snapshot.

Do not change MongoDB storage.
Do not change chart UI behavior.
Do not change feed registry behavior.
Do not change footprint/profile calculations.
Do not refactor the whole app.
This task is only about preventing in-memory/debug growth and adding render-frequency visibility.

Problem from debug snapshot:
After 2–3 hours, the browser tab can hang/freeze. MongoDB is working and streams look healthy, but client-side state/debug structures are growing.

Key findings:
1. Candle cache `loadedRanges` contains many repeated/near-duplicate ranges.
2. Volume Profile cache has very large `tradeCount` / `seenTradeKeyCount`.
3. `recentRestoreCalls` can become thousands of lines in the debug snapshot.
4. We do not yet have clear render/redraw frequency metrics.

Tasks:

1. Deduplicate/merge candle loadedRanges

Fix candle cache range tracking so loaded/restored ranges are normalized.

Expected behavior:
- Do not append duplicate loaded ranges repeatedly.
- Merge overlapping or adjacent ranges.
- Keep loadedRanges compact.
- Example: repeated `{ startTime: 100, endTime: 500 }` should appear once.
- Overlapping ranges like `100-500` and `120-520` should merge to `100-520`.
- Keep behavior the same for candle restore/cache logic.

2. Cap/prune Volume Profile trade tracking

Review Volume Profile shared cache tracking for:
- `tradeCount`
- `seenTradeKeyCount`
- any `seenTrades`, `tradeMap`, trade dedupe sets, or live trade arrays

Add safe pruning/caps so these do not grow forever during long sessions.

Expected behavior:
- Keep enough recent trade identity to prevent double-counting.
- Remove old trade keys outside retention/window.
- Do not break live dedupe.
- Do not remove currently active 1m slice data.
- Add metrics showing trades/keys removed during cleanup.

3. Hard-cap debug recentRestoreCalls

The debug snapshot should stay readable and lightweight.

Expected behavior:
- Keep only the most recent N restore/storage diagnostics.
- Suggested default: 100 or 200 max entries.
- Make it configurable by constant/env if reasonable.
- `window.__MARKET_DEBUG__.getSnapshot()` should not return thousands of lines only because restore logs accumulated.
- Add dropped/trimmed count if useful.

4. Add render/redraw frequency metrics

Add lightweight metrics for chart rendering/update frequency.

Track if possible:
- chart render count per panel
- canvas redraw count per panel
- last redraw timestamp
- redraws per second
- expensive render duration if easy to measure
- profile/footprint repaint counts if already isolated

Important:
- Metrics only; do not optimize rendering yet.
- Do not spam console logs.
- Expose through `window.__MARKET_DEBUG__.getSnapshot()`.

Files likely involved:
- lib/feeds/candleCache.ts
- lib/volumeProfile/profileCache.ts
- lib/debug/marketMetrics.ts
- chart canvas/render component files
- components/FeedProvider.tsx only if needed

Validation:
1. Let app run for a while and call:
   `window.__MARKET_DEBUG__.getSnapshot()`
2. Confirm candle loadedRanges stay compact and deduped.
3. Confirm recentRestoreCalls is capped.
4. Confirm Volume Profile trade/seen key counts do not grow without bound.
5. Confirm render/redraw metrics appear.
6. Confirm chart behavior, footprint, volume profile, Mongo restore, and live updates still work.

Output:
1. Explain exactly what changed.
2. List files modified.
3. Confirm loadedRanges are deduped/merged.
4. Confirm Volume Profile trade tracking is capped/pruned.
5. Confirm recentRestoreCalls is hard-capped.
6. Confirm render/redraw metrics were added.
7. Mention any remaining performance risk.