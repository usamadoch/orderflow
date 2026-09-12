# FeedProvider.tsx — File Navigation & Context Map

## Overview

- **Source File**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Total Lines**: ~2,905 lines
- **Primary Responsibility**: Master market feed orchestrator per panel. Manages WebSocket live streaming (Binance Spot & Futures), candle & tick aggregation, background Web Worker delegation, stored history hydration (candles, footprint, volume profile, aggregate bubbles), orderbook depth tracking, signal engine execution (absorption, exhaustion, iceberg), and cache lifecycle management.
- **Key Store Dependencies**:
  - [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts) (panel settings, pair, timeframe, bucket sizes)
  - [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts) (pushes candles, trades, bubbles, connection flags)
- **Engine Context**: Provides [ChartEngineContext](file:///c:/Users/d/Documents/ob/orderflowApp/components/ChartEngineContext.tsx) to children.

---

## Quick Navigation Index

| Feature / Task Area | Section | Approximate Line Range |
|---|---|---|
| Module Constants, Storage Flags & Helpers | [Section 1: Constants & Helpers](#section-1-constants--helpers) | Lines 1–110 |
| Engine Refs, Signal State & Queues | [Section 2: Engine Refs & Queues](#section-2-engine-refs--queues) | Lines 111–209 |
| Bucket Sizing, Display Redraws & Signal Rescoring | [Section 3: Secondary Synchronization Effects](#section-3-secondary-synchronization-effects) | Lines 210–411 |
| Feed Lifecycle Reset & Status Initialization | [Section 4: Lifecycle Bootstrap & Reset](#section-4-lifecycle-bootstrap--reset) | Lines 412–579 |
| Trade Buffering & Fine Profile Slicing | [Section 5: Trade Queues & Profile Slicing](#section-5-trade-queues--profile-slicing) | Lines 580–731 |
| Server Persistence Dispatchers | [Section 6: Server Persistence Dispatchers](#section-6-server-persistence-dispatchers) | Lines 732–895 |
| Live Candle Ingestion & Closed Candle Scoring | [Section 7: Live Candle Ingestion](#section-7-live-candle-ingestion) | Lines 896–1109 |
| Live Trade Ingestion & Worker Offloading | [Section 8: Live Trade Ingestion](#section-8-live-trade-ingestion) | Lines 1110–1168 |
| Stored History Hydration Pipeline | [Section 9: Stored History Hydration Pipeline](#section-9-stored-history-hydration-pipeline) | Lines 1169–1907 |
| Viewport Windows & Lazy History Restore | [Section 10: Viewport Windows & Lazy Restore](#section-10-viewport-windows--lazy-restore) | Lines 1908–2148 |
| WebSocket Feed Registry Binding & Init | [Section 11: Feed Registry Binding & Init](#section-11-feed-registry-binding--init) | Lines 2149–2619 |
| Orderbook Depth & Heatmap Sampling | [Section 12: Orderbook Depth & Heatmap](#section-12-orderbook-depth--heatmap) | Lines 2620–2737 |
| Feed Teardown & Unsubscription | [Section 13: Teardown & Stream Cleanup](#section-13-teardown--stream-cleanup) | Lines 2738–2788 |
| Profile Cache Retention & Context Provider JSX | [Section 14: Cache Retention & Context JSX](#section-14-cache-retention--context-jsx) | Lines 2789–2905 |

---

## Logical Section Breakdowns

### Section 1: Constants & Helpers
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 1–110
- **What It Does**:
  - Module imports (React, Zustand stores, feed adapters, server actions, worker client).
  - Storage flags: `ENABLE_BROWSER_MARKET_STORAGE`, `FINE_PROFILE_STORAGE_MAX_AGE_MS`.
  - Helpers: `getFineProfileBaseBucketSize(tickSize)` determining 1m base resolution, `extractHttpErrorMessage`.
  - Props definition: `PanelFeedProviderProps`.
- **When an Agent Should Read This**:
  - When checking browser storage feature flags or fine profile base tick size calculation rules.

---

### Section 2: Engine Refs & Queues
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 111–209
- **What It Does**:
  - Declares `PanelFeedProvider({ panelId, children })`.
  - Instantiates persistent engine refs: `engineRef` (Footprint), `volumeProfileEngineRef`, `icebergEngineRef`, `vacuumDetectorRef`.
  - Instantiates queue refs: `rawTradeQueueRef`, `fineProfileQueueRef`, `pendingAggregateBubbleEventsRef`, `liveFineProfileRowsRef`.
  - Signal state maps: `absorptionMapRef`, `exhaustionMapRef`, `icebergLevelsRef`.
- **Intra-file Dependencies**:
  - These refs are shared across all ingestion and hydration routines in Sections 4–13.
- **When an Agent Should Read This**:
  - When inspecting memory references, queue buffers, or engine singleton lifecycles.

---

### Section 3: Secondary Synchronization Effects
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 210–411
- **What It Does**:
  - Synchronizes panel settings changes without reconnecting the underlying stream:
    - Data source mode (`spot`, `futures`, `combined`) and pair changes.
    - Display bucket size changes: re-aggregates footprint from canonical 1m slices in-memory instantly.
    - Throttled footprint redraw loop (every 100ms) and live candle signal re-scoring.
    - Auto bucket size calculation based on candle ATR/height.
- **Relevant Dependencies**:
  - [lib/aggregation/engine.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/aggregation/engine.ts)
- **When an Agent Should Read This**:
  - When fixing footprint bucket scaling, display re-aggregation lag, or live candle signal re-scoring triggers.

---

### Section 4: Lifecycle Bootstrap & Reset
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 412–579
- **What It Does**:
  - Main `useEffect` triggered on symbol, timeframe, or feed mode change.
  - Clears previous runtime state: resets engines, flushes pending queues, resets signal maps, resets `chartRuntimeStore`.
  - Declares status publisher helpers: `publishRestoreStatus` for UI progress bar.
  - Predicate helpers: `shouldHydrateStoredFineProfiles`, `shouldHydrateStoredAggregateBubbles`.
- **When an Agent Should Read This**:
  - When investigating symbol switching glitches, stale state leakage across timeframe changes, or restore status updates.

---

### Section 5: Trade Queues & Profile Slicing
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 580–731
- **What It Does**:
  - Ingestion buffer flushes: `flushRawTrades`, `flushFineProfileRows`.
  - Real-time trade bucketing: `aggregateFineProfileTrade` grouping trades into 1m candle slices and price levels.
  - Slices management: identifies when a 1m candle has closed and marks slices as eligible for DB persistence.
- **Intra-file Dependencies**:
  - Feeds buffered data into Section 6 persistence dispatchers.
- **When an Agent Should Read This**:
  - When tuning trade buffering throughput, resolving memory growth from high-frequency ticks, or fixing 1m slice boundary calculation.

---

### Section 6: Server Persistence Dispatchers
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 732–895
- **What It Does**:
  - `persistEligibleFineProfileRows`: sends closed 1m profile slices to server action `persistProfileRowsAction`.
  - Throttles server action calls with error backoff and retries.
  - Protects against duplicate slice writes via tracking sets.
- **Relevant Dependencies**:
  - [lib/actions/storageActions.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/actions/storageActions.ts)
- **When an Agent Should Read This**:
  - When debugging client-to-server persistence errors, storage action timeouts, or fine profile row database writes.

---

### Section 7: Live Candle Ingestion
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 896–1109
- **What It Does**:
  - `handleCandle(candle)`: Master callback for live candlestick updates.
  - Updates live candle in `chartRuntimeStore` (or appends if closed).
  - Synchronizes shared candle cache (`candleCache.setCandle`).
  - Incremental signal detection on candle close: absorption scoring (`absorptionEngine`), exhaustion scoring (`exhaustionEngine`).
  - Evaluates liquidity vacuum zones (`vacuumDetectorRef`).
- **Relevant Dependencies**:
  - [lib/absorption/engine.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/absorption/engine.ts)
  - [lib/exhaustion/engine.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/exhaustion/engine.ts)
  - [lib/liquidityVacuum/engine.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/liquidityVacuum/engine.ts)
- **When an Agent Should Read This**:
  - When modifying live candle handling, candle close events, or microstructure signal detection triggers.

---

### Section 8: Live Trade Ingestion
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 1110–1168
- **What It Does**:
  - `handleTrade(trade, source)`: Dispatches raw trades to aggregation Web Worker via `aggregationWorkerClient`.
  - Dispatches to Spot (`handleSpotTrade`) and Futures (`handleFuturesTrade`) routes.
  - Updates trade queues for fine profiles and aggregate bubbles.
- **Relevant Dependencies**:
  - [lib/worker/aggregationWorkerClient.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/worker/aggregationWorkerClient.ts)
- **When an Agent Should Read This**:
  - When modifying trade ingestion routing, spot/futures trade normalization, or Web Worker tick message dispatch.

---

### Section 9: Stored History Hydration Pipeline
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 1169–1907
- **What It Does**:
  - `fetchStoredHistory`: multi-tier parallel hydration pipeline on initial load or symbol switch:
    - 1169–1371: Hydrates historical raw trades via `/api/history/trades` with cursor pagination.
    - 1372–1560: Hydrates aggregate bubbles via `/api/history/aggregate-bubbles`.
    - 1561–1742: Hydrates stored footprint cells and fine Volume Profile rows via `/api/history/footprint` and `/api/history/profile`.
    - 1743–1907: Concurrency-limited chunk loader preventing 504 gateway timeouts.
- **Intra-file Dependencies**:
  - Populates engines (`engineRef`, `volumeProfileEngineRef`) and notifies `chartRuntimeStore`.
- **When an Agent Should Read This**:
  - When diagnosing historical data loading failures, REST history pagination issues, or initial chart load performance.

---

### Section 10: Viewport Windows & Lazy Restore
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 1908–2148
- **What It Does**:
  - Computes time windows for visible/scrolled viewport ranges:
    - `getCustomProfileRestoreWindow`, `getScrolledProfileRestoreWindow`, `getDefaultProfileRestoreWindow`.
    - `getHistoricalSessionProfileRestoreWindow`, `getScrolledFootprintRestoreWindow`.
    - `getScrolledCandlesRestoreWindow`: lazy-loads earlier candles when panning left via `restoreLazyCandlesRange`.
- **When an Agent Should Read This**:
  - When debugging historical session profile date bounds, infinite scroll history loading, or custom profile range hydration.

---

### Section 11: Feed Registry Binding & Init
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 2149–2619
- **What It Does**:
  - `init`: Acquires shared feed adapter instances from `feedRegistry` (ref-counted stream multiplexer).
  - Subscribes to live candles and trades.
  - Reconciles shared in-memory `candleCache` with REST historical candles.
  - Computes automatic bucket sizing based on average candle ranges.
  - Updates connection state (`setConnected(panelId, true)`).
- **Relevant Dependencies**:
  - [lib/feeds/feedRegistry.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/feeds/feedRegistry.ts)
  - [lib/feeds/candleCache.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/feeds/candleCache.ts)
- **When an Agent Should Read This**:
  - When modifying WebSocket connection management, shared feed subscription multiplexing, or candle cache hydration.

---

### Section 12: Orderbook Depth & Heatmap
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 2620–2737
- **What It Does**:
  - Orderbook lifecycle: `loadOrderbookSnapshot`, `initOrderbook`.
  - Subscribes to Binance/Bybit depth streams.
  - Applies depth diff updates to in-memory orderbook.
  - Throttled periodic sampler (500ms) capturing depth levels for historical orderbook heatmap rendering.
- **Relevant Dependencies**:
  - [lib/liquidity/orderbook.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/liquidity/orderbook.ts)
  - [lib/liquidity/orderbookHeatmap.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/liquidity/orderbookHeatmap.ts)
- **When an Agent Should Read This**:
  - When investigating orderbook depth synchronization, REST snapshot desync, or liquidity heatmap recording frequency.

---

### Section 13: Teardown & Stream Cleanup
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 2738–2788
- **What It Does**:
  - Teardown return callback inside `useEffect`.
  - Releases ref-counted feeds in `feedRegistry`.
  - Unsubscribes WebSocket listeners and cancels pending history fetch requests (`active = false`).
  - Flushes remaining pending trade and profile queues.
  - Destroys orderbook depth subscriptions.
- **When an Agent Should Read This**:
  - When fixing memory leaks, lingering WebSocket connections on unmount, or duplicate data feeds.

---

### Section 14: Cache Retention & Context JSX
- **File Path**: [components/FeedProvider.tsx](file:///c:/Users/d/Documents/ob/orderflowApp/components/FeedProvider.tsx)
- **Line Range**: Lines 2789–2905
- **What It Does**:
  - Registers active panel time ranges with shared `profileCache` to prevent eviction of visible session profiles.
  - Developer verification key listener (hotkeys for inspecting cache stats).
  - Renders `<ChartEngineContext.Provider>` passing footprint engine, volume profile engine, orderbook, and redraw dispatcher to child components.
- **Relevant Dependencies**:
  - [lib/volumeProfile/profileCache.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/volumeProfile/profileCache.ts)
- **When an Agent Should Read This**:
  - When troubleshooting Volume Profile cache eviction, session profile disappearing on pan, or modifying `ChartEngineContext` values.
