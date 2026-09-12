# chartRuntime.ts — File Navigation & Context Map

## Overview

- **Source File**: [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts)
- **Total Lines**: ~1,107 lines
- **Primary Responsibility**: Ephemeral (in-memory, unpersisted) Zustand store (`useChartRuntimeStore`) managing real-time market streaming data, live candle series, tick buffers, active microstructure signal maps, synchronized crosshair coordinates, drag streams, and trading operations (Binance Spot REST/WebSocket client actions and local MetaTrader 5 HTTP bridge synchronization).
- **Performance Design**: Contains specialized fast-path mutators for high-frequency live trade and candle ticks to prevent unnecessary React re-render cascades.

---

## Quick Navigation Index

| Feature / Task Area | Section | Approximate Line Range |
|---|---|---|
| Interfaces, Trading Types & Master Contract | [Section 1: Interfaces & Types](#section-1-interfaces--types) | Lines 1–104 |
| Initial State Factories & Fast-Path Mutators | [Section 2: Initial States & Fast Path](#section-2-initial-states--fast-path) | Lines 105–285 |
| Per-Panel Feed Setters & Signal Maps | [Section 3: Stream Setters & Signals](#section-3-stream-setters--signals) | Lines 286–380 |
| Local MT5 HTTP Bridge Synchronization | [Section 4: MT5 Local Bridge Engine](#section-4-mt5-local-bridge-engine) | Lines 381–551 |
| Virtual Positions, Brackets & Drag Streams | [Section 5: Positions, Brackets & Drag](#section-5-positions-brackets--drag) | Lines 552–609 |
| Server Trading API Client Handlers | [Section 6: Trading API Client Handlers](#section-6-trading-api-client-handlers) | Lines 610–1044 |
| Store Creator & Ephemeral Selectors | [Section 7: Store Factory & Selectors](#section-7-store-factory--selectors) | Lines 1045–1107 |

---

## Logical Section Breakdowns

### Section 1: Interfaces & Types
- **File Path**: [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts)
- **Line Range**: Lines 1–104
- **What It Does**:
  - Re-exports domain types: `PanelRuntimeState`, `TradingRuntimeStatus`.
  - Defines `DrawingDragState` (real-time position coordinates during drawing dragging).
  - Defines `MT5PositionPayload` (symbol, ticket, lots, open price, SL, TP, profit).
  - Defines `ChartRuntimeState` contract containing all ephemeral panel states, trading accounts, active positions, brackets, and action signatures.
- **When an Agent Should Read This**:
  - When reviewing runtime state types, drag payload interfaces, or trading action method signatures.

---

### Section 2: Initial States & Fast Path
- **File Path**: [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts)
- **Line Range**: Lines 105–285
- **What It Does**:
  - Constructs baseline defaults: `initialTradingStatus`, `createInitialPanelRuntimeState`.
  - Fast-path candle update utilities: mutates the active live candle in-place when high/low/close changes, bypassing React state overhead for non-closing ticks.
  - Snapshot clone helpers for safe store updates.
- **When an Agent Should Read This**:
  - When optimizing high-frequency live market tick performance or modifying panel reset defaults.

---

### Section 3: Stream Setters & Signals
- **File Path**: [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts)
- **Line Range**: Lines 286–380
- **What It Does**:
  - Live data ingestion mutators:
    - `pushCandle`, `pushAllCandles`: appends or updates candlesticks for a panel.
    - `pushTrade`: buffers trade ticks and triggers canvas footprint redraws (`triggerFootprintRedraw`).
    - `appendAggregateBubbleEvents`, `clearAggregateBubbleEvents`.
  - Signal map setters:
    - `setAbsorptionMap`: Map of candle time to detected absorption candidates.
    - `setExhaustionMap`: Map of candle time to exhaustion signals.
    - `setIcebergLevels`, `setLiquidityVacuumZones`, `setLiquidityZones`.
  - Global interaction setters: `setCrosshair`, `setDrawingDrag`, `setActiveMeasurement`.
- **When an Agent Should Read This**:
  - When tracing how live WebSocket messages mutate client runtime state or how signal engine markers are registered.

---

### Section 4: MT5 Local Bridge Engine
- **File Path**: [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts)
- **Line Range**: Lines 381–551
- **What It Does**:
  - Integration with local MetaTrader 5 HTTP bridge (`http://localhost:3001`):
    - `setTradingStatus`, `setMT5Status`, `setMT5BridgeStatus`.
    - `syncMT5Bridge()`: polls local bridge server health and retrieves MT5 terminal connectivity status.
    - `syncMT5Positions(positions)`: reconciles open MT5 positions with frontend virtual positions and bracket orders; handles external SL/TP modifications made directly inside the MT5 terminal.
- **Relevant Dependencies**:
  - [market_order_bridge/server.mjs](file:///c:/Users/d/Documents/ob/orderflowApp/market_order_bridge/server.mjs)
- **When an Agent Should Read This**:
  - When debugging MetaTrader 5 account syncing, EA bridge polling issues, or multi-platform position reconciliation.

---

### Section 5: Positions, Brackets & Drag
- **File Path**: [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts)
- **Line Range**: Lines 552–609
- **What It Does**:
  - Manages on-chart trading entities:
    - `upsertVirtualPosition`, `removeVirtualPosition`.
    - `upsertBracketOrder`, `removeBracketOrder`: updates SL/TP order levels.
    - `setBracketDrag`: streams transient SL/TP drag coordinates during interactive canvas drag.
    - `setMarketOrderDrag`: manages market order placement line drag.
    - `updateVirtualPnl`: computes unrealized PnL against current mark price.
- **Intra-file Dependencies**:
  - Informs the canvas rendering layers in `ChartCanvas.tsx` for real-time bracket visualization.
- **When an Agent Should Read This**:
  - When fixing bracket order snapping, unrealized PnL updates, or drag-to-modify latency.

---

### Section 6: Trading API Client Handlers
- **File Path**: [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts)
- **Line Range**: Lines 610–1044
- **What It Does**:
  - Frontend async client calling Next.js `/api/trading/` routes:
    - `refreshRiskStatus`: queries risk limit counters, lock state, and kill switches.
    - `refreshAccountSnapshot`: synchronizes balances, open limit orders, and fills.
    - `refreshUserStreamStatus`: verifies listenKey validity for Binance user data stream.
    - `placeOrder`: executes limit/market orders with risk gating.
    - `cancelOrder`: cancels active exchange limit orders.
    - `modifyOrder`: adjusts limit price or quantity on active orders.
- **Relevant Dependencies**:
  - [app/api/trading/orders/route.ts](file:///c:/Users/d/Documents/ob/orderflowApp/app/api/trading/orders/route.ts)
  - [app/api/trading/account-snapshot/route.ts](file:///c:/Users/d/Documents/ob/orderflowApp/app/api/trading/account-snapshot/route.ts)
- **When an Agent Should Read This**:
  - When debugging order placement errors, API risk status synchronization, or account snapshot refreshes.

---

### Section 7: Store Factory & Selectors
- **File Path**: [lib/store/chartRuntime.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chartRuntime.ts)
- **Line Range**: Lines 1045–1107
- **What It Does**:
  - Instantiates `useChartRuntimeStore` using Zustand `create`.
  - Exports memoized React hooks and selectors:
    - `usePanelRuntime(panelId)`: scoped panel candles and stream state.
    - `useCrosshair()`: active global crosshair coordinates.
    - `useTradingStatus()`: account health and MT5 connectivity status.
- **When an Agent Should Read This**:
  - When creating new runtime selectors or inspecting subscription scopes in UI widgets.
