# OrderFlow v1.0 → v2.0 Migration Roadmap

## How to hand this to the agent
- Give it: this file, `skills/map.md` from v1, and the specific `artifacts/*.md` audits listed under each phase — not the full `log.md`, too noisy for context.
- Rule per phase: read the "read first" list before writing any code for that phase. "Port" items get moved with minimal changes. Everything else in that phase is a clean rebuild, not a port.
- Don't start the next phase until the current phase's test gate passes. This is what makes "test along the way" actually work instead of becoming one big-bang rewrite.
- v1 folder stays mounted read-only — reference only, never edited, never the place new code lands.

## Phase 0 — Scaffold
- New parent folder, v2 as a fresh Next.js app.
- Set up `skills/map.md` + `skills/log.md` from day one, same convention you're already using.
- Test gate: agent can run the empty app and correctly read/update its own map/log files.

## Phase 1 — Data Ingestion Pipeline
*(you already have the dedicated doc for this)*
- Read first: `artifacts/node_collector_design.md`, `artifacts/collector_backfill_analysis.md`, `artifacts/collector_persistence_audit.md`.
- Port: `lib/feeds/binance.ts`, `binanceFutures.ts`, `feedRegistry.ts`, `adapter.ts`, `depthAdapter.ts`, `lib/config/markets.ts`.
- Extend, don't rebuild: `scripts/collector/btcusdtCollector.mjs` is already a standalone collector — generalize it from BTCUSDT-only to multi-symbol instead of designing a new one from zero.
- Test gate: collector runs standalone, writes real trade data, survives a forced disconnect/reconnect.

## Phase 2 — Time-Series Storage
*(you already have the dedicated doc for this)*
- Read first: `artifacts/storage_migration_audit.md`, `artifacts/mongodb_storage_design.md` — these already document the exact write-path/restore-path problems you're trying to get away from. Read them so you don't re-discover the same issues.
- Build clean (not a port): TimescaleDB hypertables + continuous aggregates + Redis hot layer, per the storage doc.
- Test gate: collector → storage → a raw query returns correct windowed candle/footprint data. No UI involved yet.

## Phase 3 — Feed & State Layer
- Rebuild clean: v1's `FeedProvider.tsx` bundles live streaming, restore/hydration, and aggregation orchestration into one file. That concentration is a likely contributor to the freeze on its own, separate from canvas rendering — don't port it as-is.
- Port: the settings shape in `lib/store/chart.ts` (persisted Zustand settings). The data model is fine; leave behind the file's surrounding orchestration logic.
- Leave a seam for Web Workers here — don't guess which computation needs to move off-thread yet, that gets decided with real profiling in Phase 5.
- Test gate: a panel subscribes to live data and hydrates history without blocking the rest of the app.

## Phase 4 — Canvas Core (candles only, no indicators)
- Read first: `artifacts/rendering_performance_audit.md` — already covers redraw triggers, throttling, visible-range work, and expensive layers. This is the single most relevant existing document to the hang problem. Read it before writing any rendering code.
- Port: `drawCandles.ts`, `drawAxes.ts`, `useCoordinates.ts`, `usePanZoom.ts` — pure, stateless drawing math, low risk.
- Rebuild: `ChartCanvas.tsx`'s orchestration. In v1 it owns rendering, hit-testing, dragging, trading overlays, and bubble routing in one file — split render loop, interaction handling, and data routing into separate concerns.
- Test gate: candles render and pan/zoom stay smooth under a live feed, before footprint/CVD/profile get added back.

## Phase 5 — Indicators: Footprint, CVD, Volume Profile
- Read first: `artifacts/volume_profile_system_audit.md`, `volume_profile_rendering_audit.md`, `drawing_anchor_shift_audit.md`, `large_profile_bug_diagnosis.md` — all already diagnose bugs in this exact subsystem.
- Port: `lib/utils/aggregation.ts`, `lib/utils/volumeProfile.ts`, `lib/utils/delta.ts` — correct, non-trivial math, the single highest-value reuse in this whole migration.
- Rebuild: `footprintCache.ts`, `profileCache.ts` — redesign against the Phase 2/3 storage and Redis layer instead of porting the old in-memory TTL pattern.
- Profile here, then decide: if `lib/aggregation/engine.ts` or `lib/volumeProfile/profileEngine.ts` show up as the actual CPU cost, that's when they move to a Web Worker.
- Test gate: footprint, CVD, and volume profile render correctly against real historical + live data, no freeze under load.

## Phase 6 — Signals: Absorption, Exhaustion, Iceberg, Liquidity Vacuum, Liquidity Map
- Port as-is: `lib/absorption/engine.ts`, `exhaustion/engine.ts`, `iceberg/engine.ts`, `liquidityVacuum/engine.ts` — self-contained scoring logic, low coupling to the rest of the app.
- Port with re-verification: `lib/liquidity/orderbook.ts` + `orderbookHeatmap.ts` — these depend on depth-stream sync quality. Re-check gap/resync behavior against the new Phase 3 feed layer rather than assuming it transfers unchanged.
- Test gate: signals fire on real data and roughly match v1.0 output on the same historical window — sanity check, not full parity.

## Phase 7 — UI / Layout
- Port largely as-is: Header, Sidebar, panel toolbar, settings dropdown — the part you already said isn't the real problem.
- Test gate: full app usable end-to-end for one user.

## Open call: trading execution
v1.0 has a working Binance testnet order/risk/position layer (order ticket, kill switch, SL/TP bracket orders). That's a different risk class once other people are using the app, not just you. This roadmap defaults to leaving it out of v2 until the charting side is solid end-to-end — flag it if you want it pulled into scope from the start instead.
