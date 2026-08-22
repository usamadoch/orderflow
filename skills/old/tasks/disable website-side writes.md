Disable website-side footprint and Volume Profile persistence now that the standalone collector is writing to MongoDB.

Context:
The standalone BTCUSDT collector is running and successfully writing to:
- footprint_cells_ts
- profile_rows_ts

Goal:
Make the website read/visualize only:
- restore historical footprint/profile data from MongoDB
- fetch/live-render current market data in browser
- do NOT write footprint/profile rows to MongoDB anymore

Important:
Do not delete the old website persistence code yet. Just disable/gate it safely so it can be re-enabled if needed.

Disable website writes for:
1. Footprint persistence
- stop calling `storeBaseFootprintAction(...)` from website/feed path
- stop website-side footprint DB write queue/claim behavior if only used for persistence
- keep live footprint aggregation for rendering
- keep footprint restore/hydration from DB

2. Volume Profile persistence
- stop website-side fine profile row writes
- stop calls to `storeFineProfileRowsAction(...)`
- stop website-side fine profile write queue/flush
- keep live Volume Profile rendering
- keep profile restore/hydration from DB
- keep profile cache for rendering/restored rows

Do not disable:
- candles restore
- footprint restore
- profile restore
- live WebSocket rendering
- chart UI
- footprint rendering
- Volume Profile rendering
- heatmap/liquidity
- collector script

Add a clear config flag if useful:
- default website footprint/profile persistence should be OFF
- optional env flag can re-enable website writes for emergency/debug, for example `NEXT_PUBLIC_ENABLE_BROWSER_MARKET_WRITES=false` or server-side equivalent if better

Expected behavior:
- Collector is the only writer for footprint/profile rows.
- Website can still open and restore old rows from DB.
- Website can still show live current candle data.
- Refresh should restore collector-written historical footprint/profile data.
- No duplicate website + collector writes.

Validation:
1. Run collector.
2. Run website.
3. Confirm Mongo rows continue increasing from collector.
4. Confirm website no longer logs footprint/profile DB write requests.
5. Refresh website and confirm footprint/profile restore works.
6. Stop collector and confirm website does not continue writing footprint/profile rows.
7. Confirm live visual chart still works while website is open.

Output:
1. Explain what was disabled.
2. List files changed.
3. Confirm website still restores footprint/profile data.
4. Confirm website still renders live data.
5. Confirm collector is now the only footprint/profile writer.
6. Mention how to re-enable browser writes if a flag was added.