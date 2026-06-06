Implement the next heatmap/liquidity reliability task: proper orderbook depth synchronization.

Context:
The real orderbook heatmap is now rendering correctly enough. Depth source support exists for Binance, Bybit, and Combined. The remaining risk is orderbook correctness: if snapshot/stream sync is wrong or a depth update is missed, the heatmap can show stale or wrong liquidity.

Goal:
Improve orderbook snapshot + WebSocket diff-depth synchronization so the local orderbook stays accurate and can safely resync on gaps.

Focus:
- Binance spot depth
- Binance futures depth
- Bybit depth if its stream provides sequence/update IDs
- Combined mode should use each exchange’s correctly synced local book

Implement:

1. Proper initial sync flow
- Start depth stream.
- Buffer incoming depth updates.
- Fetch REST snapshot.
- Apply only updates that correctly bridge from snapshot to stream.
- Drop stale updates.
- Mark orderbook as ready only after a valid sync bridge.

2. Gap detection
- Track update IDs / sequence numbers where available.
- If a stream update sequence does not continue correctly, mark the book stale.
- Trigger a safe resync: clear/buffer/fetch snapshot/rebuild.
- Do not silently continue with broken orderbook state.

3. Per-exchange sync state
Track debug state per depth source:
- exchange
- contract type
- symbol
- ready/stale/resyncing
- last snapshot id
- last update id
- buffered update count
- gap count
- resync count
- last resync reason

4. Combined mode safety
- Combined should only merge books that are ready.
- If one exchange is stale/resyncing, keep using the ready exchange or show partial-ready status.
- Do not mix stale orderbook data into combined liquidity.

5. Metrics/debug
Expose through existing debug metrics if simple:
- orderbookReady
- orderbookStale
- gapCount
- resyncCount
- bufferedUpdates
- activeDepthSources
- combinedReadySources

Keep unchanged:
- no MongoDB/storage changes
- no footprint/profile/candle changes
- no heatmap visual redesign
- no settings redesign
- no raw trade changes

Validation:
- Open Binance spot depth and confirm snapshot + stream sync ready.
- Switch to Binance futures and confirm futures depth sync ready.
- Switch to Bybit and confirm Bybit sync ready if sequence support exists.
- Switch to Combined and confirm only ready books are merged.
- Disconnect/reconnect or change symbol/source and confirm old book clears and resyncs.
- Confirm heatmap still renders.
- Confirm stale/gap state appears in debug instead of silently showing bad data.

Output:
1. Explain what changed.
2. List files modified.
3. Confirm Binance spot sync is safer.
4. Confirm Binance futures sync is safer.
5. Confirm Bybit behavior and any limitations.
6. Confirm Combined ignores stale sources.
7. Mention how to verify with debug metrics.