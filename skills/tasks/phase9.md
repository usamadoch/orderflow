Created At: 2026-05-08T16:48:57Z
Completed At: 2026-05-08T22:15:00Z




# Phase 9 — Multiple Chart Panels

---

## Goal

Split the chart area into two independent panels side by side. Left panel and right panel. Each has its own pair, timeframe, chart mode, and feed connection. Everything else — toolbar, sidebar, settings — stays shared at the top level.

Two panels maximum. No dynamic splitting, no drag-to-resize for MVP.

---

## Layout

```
┌─────────────────────────────────────────────────┐
│                   Toolbar                        │
├───────────────────────┬─────────────────────────┤
│                       │                         │
│     Panel Left        │      Panel Right        │
│                       │                         │
│   [pair] [tf] [mode]  │  [pair] [tf] [mode]     │
│                       │                         │
└───────────────────────┴─────────────────────────┘
```

Each panel has its own mini-toolbar strip at the top — pair, timeframe, and mode selectors scoped to that panel only. The main toolbar at the top only holds global controls: connection status, settings gear, and the panel toggle button.

Panels split 50/50 by default. A thin `1px` divider `#1F1F1F` separates them.

---

## Panel Toggle

Add a layout toggle button to the main toolbar:

- Single icon: one rectangle — single panel mode
- Split icon: two rectangles side by side — dual panel mode
- Clicking switches between the two modes
- `layoutMode: 'single' | 'dual'` added to Zustand store
- In single mode, only the left panel renders at full width
- In dual mode, both panels render at 50% width each

---

## Panel State

Each panel needs its own isolated state — pair, timeframe, chart mode, bucket size, scroll offset, bar width. This must not bleed between panels.

### Approach: Panel Store

Instead of one global chart store holding a single pair/timeframe, introduce a panel-scoped store.

Create a `PanelState` type:

```ts
interface PanelState {
  id:           'left' | 'right'
  pair:         string
  timeframe:    string
  chartMode:    ChartMode
  bucketSize:   number
  barWidth:     number
  scrollOffset: number
  candles:      Candle[]
  connected:    boolean
  isLoadingHistory: boolean
}
```

In Zustand, store both panels:

```ts
interface ChartStore {
  panels: {
    left:  PanelState
    right: PanelState
  }
  layoutMode: 'single' | 'dual'
  // ... shared settings (colors, vaThreshold, profileWidth etc.) remain at top level
}
```

All per-panel actions take a `panelId: 'left' | 'right'` as their first argument:
- `setPair(panelId, pair)`
- `setTimeframe(panelId, tf)`
- `pushCandle(panelId, candle)`
- `pushAllCandles(panelId, candles)`
- `setConnected(panelId, v)`
- `setBarWidth(panelId, v)`
- `setScrollOffset(panelId, v)`

Shared settings (colors, VA threshold, profile width) stay at the top level — both panels inherit them.

---

## FeedProvider — One Per Panel

The current `FeedProvider` manages one feed connection. In dual panel mode, two independent connections are needed.

### Approach

Rename the existing provider to `PanelFeedProvider`. It takes a `panelId` prop and manages the feed for that panel only.

`PanelFeedProvider` reads `pair`, `timeframe`, `bucketSize` from `panels[panelId]` in the store instead of the top-level fields. All store actions it calls are scoped with `panelId`.

Each panel also needs its own `AggregationEngine` instance. The engine ref moves inside `PanelFeedProvider` — one engine per panel, independent.

Each panel also needs its own `ChartEngineContext` — or the context needs to become panel-scoped. Simplest approach: pass the engine down as a prop to `ChartCanvas` directly rather than via context, since the panel component tree is now explicit.

### In `app/page.tsx`

```
<PanelFeedProvider panelId="left">
  <ChartPanel panelId="left" />
</PanelFeedProvider>

{layoutMode === 'dual' && (
  <PanelFeedProvider panelId="right">
    <ChartPanel panelId="right" />
  </PanelFeedProvider>
)}
```

---

## ChartPanel Component

**File:** `components/chart/ChartPanel.tsx`

New wrapper component. Takes `panelId` as prop. Renders:

1. `PanelToolbar` — scoped controls for this panel
2. `ChartCanvas` — the canvas, now receiving `panelId` and `engine` as props

`ChartPanel` is what gets duplicated in dual mode. `ChartCanvas` itself does not need to know about panels — it just receives its data via props instead of reading directly from the top-level store.

---

## ChartCanvas — Props Instead of Direct Store Access

**File:** `components/chart/ChartCanvas.tsx`

Currently `ChartCanvas` reads `candles`, `chartMode`, `bucketSize` directly from the top-level Zustand store. This must change so each panel can have independent state.

Refactor `ChartCanvas` to accept these as props:

```ts
interface ChartCanvasProps {
  panelId:    'left' | 'right'
  candles:    Candle[]
  chartMode:  ChartMode
  bucketSize: number
  barWidth:   number
  scrollOffset: number
  engine:     AggregationEngine
  onBarWidthChange:     (v: number) => void
  onScrollOffsetChange: (v: number) => void
}
```

`ChartPanel` reads from `panels[panelId]` in the store and passes everything down. `ChartCanvas` becomes a pure rendering component — it receives state and calls callbacks, no direct store access except for shared settings (colors, profileWidth, vaThreshold).

---

## PanelToolbar Component

**File:** `components/ui/PanelToolbar.tsx`

Scoped version of the main toolbar. Smaller, no connection status, no settings gear.

Contains:
- Pair selector — calls `setPair(panelId, pair)`
- Timeframe selector — calls `setTimeframe(panelId, tf)`
- Chart mode toggle — calls `setChartMode(panelId, mode)`
- Bucket size input — visible in footprint mode only

Sits as a thin strip at the top of each `ChartPanel`. Background `#0D0D0D` (slightly darker than main toolbar to visually subordinate it). Height: 32px. Font size: 11px throughout.

---

## Main Toolbar Changes

**File:** `components/ui/Toolbar.tsx`

Remove pair, timeframe, chart mode, and bucket size from the main toolbar — those move into `PanelToolbar`. 

Main toolbar now only holds:
- App name / logo left side
- Layout toggle button (single / dual)
- Settings gear icon
- Connection status (shows combined — if either panel is connected show LIVE)

---

## Keyboard Shortcuts Update

**File:** `hooks/useKeyboardShortcuts.ts`

Shortcuts need to know which panel is "active" — the one the user last interacted with (clicked or hovered).

Add `activePanel: 'left' | 'right'` to Zustand store. Updated whenever the user mouses into a panel — `onMouseEnter` on `ChartPanel` sets `activePanel`.

All shortcuts then apply to `activePanel` instead of a hardcoded panel id:
- `1`–`5` → `setTimeframe(activePanel, tf)`
- `C` / `F` → `setChartMode(activePanel, mode)`
- `R` → `setBarWidth(activePanel, default)` + `setScrollOffset(activePanel, 0)`
- `[` / `]` → `setBucketSize(activePanel, ...)`

---

## Sidebar Update

**File:** `components/ui/Sidebar.tsx`

Sidebar now shows stats for the active panel only. Reads from `panels[activePanel]` and the active panel's engine.

Add a small `LEFT` / `RIGHT` indicator at the top of the sidebar showing which panel's stats are being displayed. Switch automatically when `activePanel` changes.

---

## Persistence Update

**File:** `lib/store/chart.ts`

Persist both panels' config (pair, timeframe, chartMode, bucketSize, barWidth) under separate keys:

```ts
partialize: (state) => ({
  layoutMode:       state.layoutMode,
  panels: {
    left:  { pair, timeframe, chartMode, bucketSize, barWidth },
    right: { pair, timeframe, chartMode, bucketSize, barWidth },
  },
  // shared settings
  vaThreshold, pocColor, vaColor, bullColor, bearColor, profileWidth,
})
```

Never persist `candles`, `connected`, `isLoadingHistory`, `scrollOffset`, `activePanel`.

---

## Migration from Single Panel Store

The existing store has top-level `pair`, `timeframe`, `chartMode` etc. These need to move into `panels.left` and `panels.right`. This is a breaking change to the store shape.

Clear `localStorage` once during development after this change — the old persisted shape will cause a hydration mismatch. Add a `version: 2` field to the persist config so Zustand auto-clears stale storage on version bump.

---

## File Checklist

```
lib/store/chart.ts
├── PanelState type
├── panels.left and panels.right in store
├── layoutMode field
├── activePanel field
├── All per-panel actions take panelId
└── persist version bumped to 2

components/chart/
├── ChartPanel.tsx            — new wrapper, panelId prop
└── ChartCanvas.tsx           — refactored to accept props, no direct store reads

components/ui/
├── PanelToolbar.tsx          — new, scoped per-panel controls
└── Toolbar.tsx               — stripped to global controls only
└── Sidebar.tsx               — reads from activePanel

components/FeedProvider.tsx   — renamed PanelFeedProvider, takes panelId prop

hooks/useKeyboardShortcuts.ts — all actions use activePanel

app/page.tsx
└── two PanelFeedProvider + ChartPanel blocks, second gated on layoutMode

Behavior:
├── Single mode: left panel fills full width
├── Dual mode: left and right panels at 50/50
├── Each panel has independent pair, timeframe, mode, zoom, scroll
├── Keyboard shortcuts target the hovered panel
├── Sidebar stats reflect active panel
├── Both panels persist config across refresh
└── Shared settings (colors, thresholds) apply to both panels
```

---

## What This Does Not Cover

- Drag to resize panel widths
- More than two panels
- Synced crosshair across panels
- Saving and loading named layouts