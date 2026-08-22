# Phase 7 — UI Polish

---

## Goal

Clean up and complete the interface. Everything in this phase sits on top of a fully working chart — no new data logic, no canvas changes. Pure UI layer: toolbar completeness, a stats sidebar, keyboard shortcuts, and a settings panel.

All previous phases must be complete before starting this phase.

---

## 1. Toolbar (Complete Pass)

**File:** `components/ui/Toolbar.tsx` — already exists from Phase 3/implementation guide, this is the final version

The toolbar is a single horizontal strip pinned to the top. Left side holds chart controls. Right side holds connection status.

### Layout

```
[ BTC/USDT ] [ ETH/USDT ]  |  [ 1m ] [ 5m ] [ 15m ] [ 1h ] [ 4h ]  |  [ CANDLE ] [ FOOTPRINT ]  |  [$100 bucket]     ·  LIVE
```

Left group: pair selector
Second group: timeframe selector
Third group: chart mode toggle
Fourth group: bucket size input (only visible when mode is `footprint`)
Far right: connection status dot + label

### Pair Selector

- Buttons for `BTCUSDT` and `ETHUSDT`
- Active pair: background `#3D7EFF`, text white
- Inactive: transparent background, text `#4A4A4A`
- On click: calls `setPair` from store — store clears candles, feed re-subscribes automatically

### Timeframe Selector

- Buttons: `1m`, `5m`, `15m`, `1h`, `4h`
- Active timeframe: border `1px solid #3D7EFF`, text `#E8E8E8`
- Inactive: no border, text `#4A4A4A`
- Different visual treatment from pair selector — active state is outline not filled — signals these are related but different types of control

### Chart Mode Toggle

- Two buttons: `CANDLE`, `FOOTPRINT`
- Active: background `#1F1F1F`, text `#E8E8E8`
- Inactive: transparent, text `#4A4A4A`

### Bucket Size Input

- Only rendered when `chartMode === 'footprint'`
- Number input, value bound to `bucketSize` from store
- On change: calls `setBucketSize` — engine resets, cells rebuild
- Min value: `10`. Max value: `1000`. Step: `10`
- Label to its left: `$` prefix, muted gray
- Width: 70px
- Debounce the input by 300ms — do not reset the engine on every keystroke while typing

### Connection Status

- Far right of toolbar
- Dot + text: `LIVE` (teal) or `DISCONNECTED` (red)
- Dot size: 8px circle
- Font: `JetBrains Mono`, 11px

### Toolbar Styling

- Background: `#141414`
- Bottom border: `1px solid #1F1F1F`
- Height: 42px fixed
- All items vertically centered
- Gap between groups: thin 1px divider `#1F1F1F`, 20px tall
- Horizontal padding: 12px left and right
- Font across all buttons: `JetBrains Mono`, 12px

---

## 2. Sidebar — Session Stats

**File:** `components/ui/Sidebar.tsx`

A narrow right-side panel showing live session stats derived from the aggregation engine and candle store. Sits to the right of the chart, below the toolbar.

Width: 180px fixed. Background `#141414`. Left border `1px solid #1F1F1F`.

### Stats to Display

**Session Delta**
- Sum of all `FootprintCandle.delta` values across all candles in memory
- Label: `SESSION Δ`
- Value: colored positive (`#26A69A`) or negative (`#EF5350`), with sign prefix
- Updates on every new candle close

**Highest Volume Level**
- The price bucket with the highest `totalVol` across all candles — same as the session-wide POC
- Label: `HVN` (High Volume Node)
- Value: the price as a number, neutral color `#E8E8E8`

**Lowest Volume Level**
- Opposite — the price bucket with the least volume
- Label: `LVN` (Low Volume Node)
- Value: price, muted color `#8A8A8A`

**Current Candle Delta**
- Delta of only the most recent (live) candle
- Label: `CANDLE Δ`
- Value: colored positive/negative, updates as trades come in
- This is the one that flickers in real time

**Buy/Sell Ratio**
- Across all visible candles: total ask volume / total bid volume
- Label: `B/S`
- Value: formatted as `1.24` or `0.87` — above 1.0 means more buying aggression
- Color: `#26A69A` if > 1.0, `#EF5350` if < 1.0

**Total Volume**
- Sum of all OHLCV volume across candles in memory
- Label: `TOTAL VOL`
- Value: abbreviated e.g. `1.24k BTC`

### Where the Data Comes From

Sidebar reads from two places:
- `candles[]` from Zustand store — for OHLCV stats and candle count
- `engine.getAllFootprintCandles()` — for delta, HVN, LVN, bid/ask ratio

Sidebar does not subscribe to trade-level updates. It updates whenever `candles` array changes in the store (i.e. on candle close or live candle update). For the current candle delta specifically, it also needs to update on trade ingestion — wire this via a `lastTradeTime` counter in the store that gets bumped every 500ms by FeedProvider, so the sidebar re-renders at a throttled rate.

### Sidebar Layout

Each stat is its own row:
```
LABEL          VALUE
SESSION Δ      +4,821
CANDLE Δ       −124
HVN            30,100
LVN            29,800
B/S            1.14
TOTAL VOL      824 BTC
```

- Label: `JetBrains Mono`, 9px, `#4A4A4A`, uppercase
- Value: `JetBrains Mono`, 13px, colored per stat
- Row padding: 10px horizontal, 6px vertical
- Thin separator `#1F1F1F` between rows
- Section header at top: `SESSION` in 9px, `#3D7EFF`, all caps

---

## 3. Keyboard Shortcuts

**File:** `hooks/useKeyboardShortcuts.ts`

A single `useEffect` with a `keydown` listener attached to `window`. Mounted once in the root page component.

### Shortcut Map

| Key | Action |
|---|---|
| `1` | Set timeframe to `1m` |
| `2` | Set timeframe to `5m` |
| `3` | Set timeframe to `15m` |
| `4` | Set timeframe to `1h` |
| `5` | Set timeframe to `4h` |
| `C` | Switch chart mode to `candle` |
| `F` | Switch chart mode to `footprint` |
| `R` | Reset zoom — set `barWidth` back to default (12px), `scrollOffset` back to 0 |
| `[` | Decrease bucket size by one step (÷ 2, clamped to min 10) |
| `]` | Increase bucket size by one step (× 2, clamped to max 1000) |
| `Escape` | Close settings panel if open |

### Important Guard

Before handling any key, check `e.target` — if the user is focused on an input element, do nothing. Otherwise `1`–`5` would fire while typing numbers in the bucket size input.

```ts
if ((e.target as HTMLElement).tagName === 'INPUT') return
```

### Reset Zoom

`R` key resets `scrollOffset` and `barWidth`. These live inside `usePanZoom` which is inside `ChartCanvas`. To allow an external reset, lift `barWidth` and `scrollOffset` state up — either into Zustand or into a shared context — so the keyboard hook can write to them.

Recommended: add `barWidth` and `scrollOffset` to Zustand store with `setBarWidth` and `setScrollOffset` actions. `usePanZoom` then reads from and writes to the store instead of local state. This also fixes any future issue where other components need to read zoom state.

### Mounting

```tsx
// app/page.tsx
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

export default function Page() {
  useKeyboardShortcuts()
  // ...
}
```

---

## 4. Settings Panel

**File:** `components/ui/SettingsPanel.tsx`

A slide-in panel from the right side. Toggled by a gear icon button in the toolbar (far right, left of connection status).

### Open/Close State

`isPanelOpen: boolean` in Zustand store, with `togglePanel` action.

Panel animates in with a CSS transition: `transform: translateX(0)` when open, `transform: translateX(100%)` when closed. Width: 240px. Position: `fixed`, `top: 42px` (below toolbar), `right: 0`, `height: calc(100vh - 42px)`. Background `#141414`. Left border `1px solid #1F1F1F`. `z-index: 50`.

### Settings Fields

**Bucket Size**
- Same as toolbar input, duplicated here for discoverability
- Number input, min 10, max 1000, step 10

**Value Area Threshold**
- Default: 70%
- Range: 50%–90%, step 5%
- Slider input (`<input type="range">`)
- Displayed as a percentage label next to the slider
- On change: update `vaThreshold` in store, profile recalculates on next redraw
- Add `vaThreshold: number` (default `0.70`) to Zustand store and pass it into `buildProfile` and `drawVolumeProfile`

**POC Color**
- Color picker (`<input type="color">`)
- Default: `#F0B90B`
- On change: update `pocColor` in store, used in `drawVolumeProfile`

**VA Lines Color**
- Color picker
- Default: `#3D7EFF`
- On change: update `vaColor` in store

**Bull Candle Color**
- Color picker, default `#26A69A`
- Updates `bullColor` in store, used in `drawCandles` and `drawFootprint`

**Bear Candle Color**
- Color picker, default `#EF5350`
- Updates `bearColor` in store

**Profile Width**
- Slider, range 60px–200px, default 120px
- Updates `profileWidth` in store
- `useCoordinates` and `drawVolumeProfile` read from store instead of the hardcoded constant

### Store Additions for Settings

Add to Zustand store:

```ts
vaThreshold:  number        // default 0.70
pocColor:     string        // default '#F0B90B'
vaColor:      string        // default '#3D7EFF'
bullColor:    string        // default '#26A69A'
bearColor:    string        // default '#EF5350'
profileWidth: number        // default 120
isPanelOpen:  boolean       // default false
```

All draw functions currently use hardcoded color strings — replace those with values read from the store.

### Settings Panel Layout

```
⚙ SETTINGS                    ✕

CHART
  Bull Color      [picker]
  Bear Color      [picker]

VOLUME PROFILE
  Width           [slider] 120px
  POC Color       [picker]
  VA Color        [picker]
  Value Area      [slider] 70%

ORDER FLOW
  Bucket Size     [input]  $100
```

- Section headers: 9px, `#3D7EFF`, uppercase, with a thin bottom border
- Labels: 11px, `#8A8A8A`
- Values/inputs: right-aligned in each row
- Row height: 36px
- All inputs styled to match dark theme — no default browser chrome

---

## 5. Settings Persistence

Settings should survive a page refresh. Use `localStorage`.

### Approach

In Zustand, use the `persist` middleware from `zustand/middleware`:

```ts
import { persist } from 'zustand/middleware'

export const useChartStore = create(
  persist<ChartState>(
    (set) => ({ ...initialState }),
    {
      name: 'orderflow-settings',
      // Only persist settings — not live data
      partialize: (state) => ({
        pair:         state.pair,
        timeframe:    state.timeframe,
        chartMode:    state.chartMode,
        bucketSize:   state.bucketSize,
        vaThreshold:  state.vaThreshold,
        pocColor:     state.pocColor,
        vaColor:      state.vaColor,
        bullColor:    state.bullColor,
        bearColor:    state.bearColor,
        profileWidth: state.profileWidth,
        barWidth:     state.barWidth,
      }),
    }
  )
)
```

`partialize` is the key — it controls what gets written to `localStorage`. Never persist `candles`, `trades`, `connected`, or `isPanelOpen`. Those are session-only.

---

## 6. Gear Icon Button in Toolbar

Add to the right side of the toolbar:

- SVG gear icon, 16×16
- Click: calls `togglePanel` from store
- Color: `#8A8A8A` normally, `#E8E8E8` when panel is open
- Sits between the bucket size input and the connection status dot

---

## File Checklist

```
components/ui/
├── Toolbar.tsx              — final version, all controls
├── Sidebar.tsx              — session stats panel
└── SettingsPanel.tsx        — slide-in settings

hooks/
└── useKeyboardShortcuts.ts  — keydown handler, all shortcuts

lib/store/chart.ts           — settings fields + persistence added

Behavior:
├── Toolbar shows all controls, groups separated by dividers
├── Bucket size input debounced, only in footprint mode
├── Sidebar shows 6 live session stats, throttled update
├── All keyboard shortcuts work, guarded against input focus
├── R resets zoom and scroll to default
├── Settings panel slides in from right
├── Color and threshold changes reflect immediately on canvas
├── All settings persist across page refresh via localStorage
└── Candles and connection state never persisted
```

---

## What This Phase Does Not Cover

- Mobile / responsive layout
- Multiple chart layouts or split view
- Custom indicator builder
- Export / screenshot