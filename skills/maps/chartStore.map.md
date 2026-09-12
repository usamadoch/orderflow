# chart.ts — File Navigation & Context Map

## Overview

- **Source File**: [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts)
- **Total Lines**: ~2,129 lines
- **Primary Responsibility**: Persisted Zustand store (`useChartStore`, v38) managing user configurations across sessions and browser tabs. Controls panel layouts, timeframe-specific settings, indicator parameters (Footprint, Volume Profile, CVD, Volume Bars, Liquidity, Heatmap, VWAP, Stats Grid), drawings, canvas theme colors, and cross-panel synchronization toggles.
- **Persistence Mechanism**: Custom `tabAwareStorage` engine using `localStorage` backed by multi-tab change detection.
- **Schema Evolution**: Embedded migration pipeline upgrading stored client schemas from v1 through v38 without data loss.

---

## Quick Navigation Index

| Feature / Task Area | Section | Approximate Line Range |
|---|---|---|
| Imports, Color Tokens & Type Definitions | [Section 1: Imports & Types](#section-1-imports--types) | Lines 1–92 |
| Master `ChartState` Interface & Action Signatures | [Section 2: ChartState Interface](#section-2-chartstate-interface) | Lines 93–360 |
| Default Configurations & Timeframe Defaults | [Section 3: Defaults & Configs](#section-3-defaults--configs) | Lines 361–680 |
| Scoped State Mutation Helpers | [Section 4: Scoped Mutation Helpers](#section-4-scoped-mutation-helpers) | Lines 681–736 |
| Multi-Tab Storage Engine (`tabAwareStorage`) | [Section 5: Multi-Tab Storage Engine](#section-5-multi-tab-storage-engine) | Lines 737–789 |
| Store Implementation: Panel & Timeframe Actions | [Section 6A: Panel & Timeframe Actions](#section-6a-panel--timeframe-actions) | Lines 790–912 |
| Store Implementation: Footprint & Volume Profile | [Section 6B: Footprint & Volume Profile](#section-6b-footprint--volume-profile) | Lines 913–1207 |
| Store Implementation: CVD & Volume Bars | [Section 6C: CVD & Volume Bars](#section-6c-cvd--volume-bars) | Lines 1208–1292 |
| Store Implementation: Sessions, Liquidity & Heatmap | [Section 6D: Sessions, Liquidity & Heatmap](#section-6d-sessions-liquidity--heatmap) | Lines 1293–1345 |
| Store Implementation: Stats Grid & VWAP Settings | [Section 6E: Stats Grid & VWAP Settings](#section-6e-stats-grid--vwap-settings) | Lines 1346–1446 |
| Store Implementation: Layout & Sync Settings | [Section 6F: Layout & Sync Settings](#section-6f-layout--sync-settings) | Lines 1447–1486 |
| Store Implementation: Theme Styling & Auth | [Section 6G: Theme Styling & Auth](#section-6g-theme-styling--auth) | Lines 1487–1531 |
| Store Schema Migrations Pipeline (v1 to v38) | [Section 7: Store Schema Migrations](#section-7-store-schema-migrations) | Lines 1532–2090 |
| Selectors, React Hooks & Module Exports | [Section 8: Selectors & Exports](#section-8-selectors--exports) | Lines 2091–2129 |

---

## Logical Section Breakdowns

### Section 1: Imports & Types
- **File Path**: [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts)
- **Line Range**: Lines 1–92
- **What It Does**:
  - Imports Zustand factory `create` and persistence middleware `persist`, `createJSONStorage`.
  - Imports shared theme tokens from [lib/config/chartColors.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/config/chartColors.ts) (`DEFAULT_CANVAS_BG`, `DEFAULT_GRID_COLOR`, `DEFAULT_GRID_OPACITY`).
  - Imports domain types for indicators, layout modes, sessions, CVD, and drawing tools.
- **When an Agent Should Read This**:
  - When verifying imported types or adding new external dependencies to the persisted chart store.

---

### Section 2: ChartState Interface
- **File Path**: [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts)
- **Line Range**: Lines 93–360
- **What It Does**:
  - Defines the comprehensive TypeScript `ChartState` contract.
  - Declares all state properties: `panels` dictionary (`left`, `right`), `activePanel`, `layoutMode`, `splitRatio`, `crosshairSyncEnabled`, `drawingsSyncEnabled`, `theme` tokens, and `isAuthenticated`.
  - Declares all setter function signatures for every indicator parameter and drawing tool action.
- **When an Agent Should Read This**:
  - When adding new indicator settings, action signatures, or inspecting available store dispatchers.

---

### Section 3: Defaults & Configs
- **File Path**: [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts)
- **Line Range**: Lines 361–680
- **What It Does**:
  - Constructs `DEFAULT_TIMEFRAME_SETTINGS`: fallback dictionary defining default indicator values (profile type, CVD mode, footprint colors, VWAP periods) per timeframe (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`).
  - Constructs default panel configurations for left and right panels with independent symbols and timeframes.
- **When an Agent Should Read This**:
  - When modifying default indicator parameters, adding a new timeframe preset, or updating factory settings.

---

### Section 4: Scoped Mutation Helpers
- **File Path**: [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts)
- **Line Range**: Lines 681–736
- **What It Does**:
  - `updateTimeframeSetting`: pure helper that writes a setting into the panel's active timeframe dictionary (`settingsByTimeframe[tf]`), ensuring per-timeframe isolation.
  - `updatePanelSetting`: pure helper that updates top-level panel properties (e.g. `pair`, `contractType`).
- **Intra-file Dependencies**:
  - Consumed by all indicator setters in Section 6 to avoid repetitive immutable spread boilerplate.
- **When an Agent Should Read This**:
  - When debugging timeframe-scoping bugs (e.g. settings bleeding across timeframes) or refactoring store state mutations.

---

### Section 5: Multi-Tab Storage Engine (`tabAwareStorage`)
- **File Path**: [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts)
- **Line Range**: Lines 737–789
- **What It Does**:
  - Custom implementation of `StateStorage` interface for Zustand `persist`.
  - Implements `getItem`, `setItem`, `removeItem`.
  - Uses tab-specific identifiers and window storage events to support running multiple browser tabs without conflicting state overwrites.
- **When an Agent Should Read This**:
  - When troubleshooting state persistence, tab synchronization conflicts, or localStorage quota issues.

---

### Section 6: Zustand Store Implementation (`useChartStore`)
The core store creator starts at Line 790 and defines concrete action implementations:

#### Section 6A: Panel & Timeframe Actions (Lines 790–912)
- **What It Does**: `setPair`, `setTimeframe`, `setDataSourceMode`, `setChartMode`, `setBucketSize`, `setAutoBucketSize`, `addLine`, `updateLine`, `removeLine`.
- **When an Agent Should Read This**: When modifying symbol selection, timeframe switches, or drawing tool persistence actions.

#### Section 6B: Footprint & Volume Profile (Lines 913–1207)
- **What It Does**: Setters for footprint cluster mode, color maps, imbalance thresholds, profile period, value area percentage, POC styling, and profile filters.
- **When an Agent Should Read This**: When adding footprint display options or Volume Profile parameter controls.

#### Section 6C: CVD & Volume Bars (Lines 1208–1292)
- **What It Does**: `setCvdEnabled`, `setCvdMode`, `setCvdSmoothing`, `setCvdScaleMode`, `setVolumeBarsEnabled`, `setVolumeBarsInputData`, `setVolumeBarsFilterMode`.
- **When an Agent Should Read This**: When adjusting CVD indicator options or volume bars calculation filters.

#### Section 6D: Sessions, Liquidity & Heatmap (Lines 1293–1345)
- **What It Does**: `setSessionsEnabled`, `setSessionTime`, `setLiquidityEnabled`, `setLiquidityHeatmapEnabled`, `setLiquidityHeatmapOpacity`.
- **When an Agent Should Read This**: When modifying trading session time boundaries or liquidity heatmap visual parameters.

#### Section 6E: Stats Grid & VWAP Settings (Lines 1346–1446)
- **What It Does**: `setStatsIndicatorEnabled`, `setStatsIndicatorItems`, `setVwapSettings` (supports period mode, session anchor, standard deviation envelope bands).
- **When an Agent Should Read This**: When configuring stats grid summary metrics or VWAP indicator options.

#### Section 6F: Layout & Sync Settings (Lines 1447–1486)
- **What It Does**: `setLayoutMode`, `setSplitDirection`, `setSplitRatio`, `setActivePanel`, `setCrosshairSyncEnabled`, `setDrawingsSyncEnabled`, `setBracketDragConfirmEnabled`.
- **When an Agent Should Read This**: When updating split-screen behavior or cross-panel synchronization flags.

#### Section 6G: Theme Styling & Auth (Lines 1487–1531)
- **What It Does**: Canvas background colors/gradients, gridline styling (solid/dashed/dotted), crosshair styles, and basic UI password authentication (`authenticate`, `logout`).
- **When an Agent Should Read This**: When changing theme styling actions or authentication gates.

---

### Section 7: Store Schema Migrations
- **File Path**: [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts)
- **Line Range**: Lines 1532–2090
- **What It Does**:
  - Middleware `migrate: (persistedState, version) => ...` upgrading older persisted state to the current schema version (v38).
  - Handles backward-compatibility transformations across all past versions (adding newly created indicators, updating color tokens, ensuring default values for new settings).
- **When an Agent Should Read This**:
  - When adding a new indicator or modifying store shape (any schema change requires incrementing version and adding a migration step here!).

---

### Section 8: Selectors & Exports
- **File Path**: [lib/store/chart.ts](file:///c:/Users/d/Documents/ob/orderflowApp/lib/store/chart.ts)
- **Line Range**: Lines 2091–2129
- **What It Does**:
  - Memoized selector hooks for optimal component re-renders: `useActivePanel`, `usePanelSettings(panelId)`, `useChartTheme`.
  - Exports store hooks as public API.
- **When an Agent Should Read This**:
  - When creating new ergonomic selector hooks or checking component subscription patterns.
