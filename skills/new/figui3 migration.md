# FigUI3 Migration — Phase-by-Phase Execution Plan

## How to use this document

Run one phase's instructions with your agent, then check that phase's verification criteria yourself (or have the agent report against them explicitly). All criteria pass → move to the next phase. Anything fails → fix and re-verify before proceeding. Don't start the next phase's instructions until the current one's criteria are fully met — that's the whole point of not batching, which has mattered every time so far in this project.

Canvas-drawn pixels (candles, footprint, drawings, bubbles) are never in scope, at any phase — only DOM UI. The 15 "Canvas Overlay" buttons (TP/SL cancel, position close) ARE in scope since they're DOM elements positioned over canvas — they're just held to Phase 7 for other reasons (real money).

## Standing rules — apply to every phase below, not just Phase 1

1. **Shadow DOM vs Light DOM check, every new component type.** Before assuming a new figui3 element needs no `.popup-contrast` patch, inspect it in devtools for a `#shadow-root` node. Shadow-DOM components are naturally isolated (CSS custom properties still theme them correctly). Light-DOM components need an explicit exclusion added to `globals.css`, same pattern as the `fig-switch` fix in Phase 0.
2. **Reuse the Phase 1 wrapper.** Once the ref+event-listener React wrapper pattern exists, every later phase uses it — no phase should hand-roll its own ref+effect boilerplate again.
3. **No phase is complete on `tsc`/lint success alone.** Every phase's criteria below require an actual rendered/behavioral check. If a report claims completion without one, it isn't done yet.
4. **`fig-editor`/`fig-lab` (PropsKit, fig-select, fig-fill-picker) are cleared to use** — PolyForm Shield 1.0.0 confirmed non-competing for this use case (Phase 0 finding). No need to re-litigate this per phase.

---

## Phase 0 — Infrastructure ✅ Complete

**Goal:** Token mapping, TypeScript declarations, client boundaries, `.popup-contrast` safety, all verified empirically — done, kept here for reference only.

**Verification criteria (met):**

- [x] Full `--figma-color-*` token list extracted from actual installed source, not guessed.
- [x] Shadow DOM vs Light DOM confirmed for `fig-button` and `fig-switch` specifically.
- [x] Real rendered `<fig-button>` inside `.popup-contrast`, screenshot + computed styles confirm brand accent applies and no visual distortion.
- [x] `npx tsc --noEmit` clean.

---

## Phase 1 — Pilot: Toggle Switches (18) + Icon-only Buttons (16)

**Goal:** Validate the full integration pattern (theming, wrapper, events) on the simplest, most repeated component shapes before touching anything with complex state.

**Instructions to give your agent:**

```
Migrate all 18 pill-toggle-switch buttons and all 16 icon-only utility
buttons (close, favorite star, lock, refresh, visibility, maximize/minimize)
identified in the earlier button-archetype audit to <fig-switch> and
<fig-button icon> respectively.

1. Build ONE reusable React wrapper (hook or thin component) for
   ref-based attribute setting + addEventListener event binding, per the
   figui3 docs' React integration example. Every migrated component in
   this and all future phases uses this same wrapper — do not
   reimplement the ref+effect pattern per component.
2. For fig-switch specifically: it's confirmed Light DOM — confirm the
   existing .popup-contrast exclusion from Phase 0 still covers every
   instance once real usage replaces the test mount.
3. For fig-button icon: confirm Shadow DOM (check for #shadow-root) same
   as the Phase 0 test button — if it differs for the icon variant,
   patch .popup-contrast accordingly.
4. Preserve exact current behavior (checked state, disabled state,
   onClick/onChange handlers) — this phase changes rendering only, not
   logic.
5. Do NOT touch: Toolbar & Header Action Buttons (83), Trading Execution
   buttons, Canvas Overlay buttons, Segment/Tab selectors, Modal/Form
   action buttons, Color swatch buttons — those are later phases.

Report which files were touched and a count of switches/icon-buttons
actually migrated vs the 18/16 expected.
```

**Verification criteria:**

- [ ] Every migrated toggle switch visually reflects on/off state correctly and fires the same store update it did before migration (spot-check 3+ across different settings panels).
- [ ] Every migrated icon button fires its original action (close, lock, favorite, etc.) — not just renders.
- [ ] Reusable wrapper exists as its own file/hook, not inlined per usage.
- [ ] No visual regression from `.popup-contrast` on any migrated instance (screenshot check, not assumption).
- [ ] Migrated count matches or explains any gap from 18 switches / 16 icon buttons.
- [ ] `npx tsc --noEmit` clean.

---

## Phase 2 — Segmented Controls (11) + First Full Panel

**Goal:** Prove a complete settings panel can be fully migrated end-to-end before scaling to the other 14.

**Instructions to give your agent:**

```
1. Migrate all 11 segment/tab-style buttons (timeframe pills, settings
   category tabs, Spot/Perp toggles) to <fig-segmented-control>/<fig-segment>.
2. Fully migrate VwapSettings.tsx — every control in that panel (dropdowns,
   switches, sliders, number inputs) — to figui3 equivalents
   (fig-select, fig-switch, propskit-slider, propskit-number). This is
   the first complete panel; use it to validate PropsKit components
   specifically, not just buttons.
3. Run the Shadow/Light DOM check (Standing Rule 1) on
   fig-segmented-control, fig-select, propskit-slider, and
   propskit-number before assuming no further .popup-contrast patches
   are needed.
4. Do NOT touch the other 14 chart-settings panels yet — this phase is
   VwapSettings only, as the proof case.

Report which of VwapSettings' controls were migrated, and results of the
Shadow/Light DOM check for each new component type used.
```

**Verification criteria:**

- [ ] All 11 segmented controls behave identically to before (correct selection, correct store updates).
- [ ] VwapSettings.tsx fully renders via figui3 components with no leftover raw `<button>`/`<select>`/`<input>` elements for controls that should now be migrated.
- [ ] Opening VwapSettings, changing every setting, and confirming the chart actually responds (not just that the UI control changes) — full behavioral check, not visual-only.
- [ ] Shadow/Light DOM results documented for `fig-segmented-control`, `fig-select`, `propskit-slider`, `propskit-number`; `.popup-contrast` patched for any found to be Light DOM.
- [ ] `npx tsc --noEmit` clean.

---

## Phase 3 — Popup/Modal Unification (Part 1: Simple Anchored Popups)

**Goal:** Replace hand-rolled Escape/click-outside/positioning logic with `fig-popup`/`fig-dialog`, starting with the simplest cases.

**Instructions to give your agent:**

```
Migrate these to fig-popup, in this order, confirming each works before
moving to the next: ChartLayoutDropdown.tsx, ChartModeSelector.tsx.

Then migrate the more complex ones: ChartSettingsDropdown.tsx (both its
modes — centered indicator dialog AND the draggable/resizable floating
settings window; confirm fig-popup/fig-dialog's built-in drag support
covers the resizable window case, or flag if custom logic must remain),
IndicatorsModal.tsx.

Explicitly excluded from this phase: OrderTicket.tsx, the in-canvas
position-close confirmation modal in ChartCanvas.tsx, BubblesDocsModal.tsx,
PairSelector.tsx, StorageManager.tsx, ColorPickerPopover.tsx — later phases.

Run the Shadow/Light DOM check on fig-popup and fig-dialog before assuming
no patch is needed.
```

**Verification criteria:**

- [ ] Each migrated popup opens/closes on the same triggers as before (button click, Escape, click-outside).
- [ ] ChartSettingsDropdown's draggable/resizable window behavior confirmed working via fig-dialog's native drag support, OR explicitly documented as retained custom logic if fig-dialog couldn't cover it — not silently dropped.
- [ ] No z-index/stacking regressions — open two previously-independent popups in sequence and confirm no visual overlap bugs.
- [ ] `npx tsc --noEmit` clean.

---

## Phase 4 — Remaining Settings Panels (14) + PropsKit Rollout

**Goal:** Apply the Phase 2 pattern to the rest of the settings panels now that it's proven once.

**Instructions to give your agent:**

```
Migrate the remaining 14 chart-settings/* panels (all except VwapSettings,
already done) to figui3/PropsKit components, following the exact pattern
established in Phase 2. One panel at a time; do not batch all 14 into one
commit — verify each renders and behaves correctly before moving to the
next panel in the list:

GeneralChartSettings, CanvasSettings, AlertsSettings, FootprintSettings,
VolumeProfileSettings, HistoricalSessionProfileSettings, SessionsSettings,
CvdSettings, VolumeBarsSettings, BubbleSettings, LiquidityMapSettings,
HeatmapSettings, StatsSettings, SignalSettings.

Note: CanvasSettings and SessionsSettings each open a child
ColorPickerPopover — leave ColorPickerPopover itself untouched (Phase 5),
just confirm the parent panel's own controls migrate correctly around it.
```

**Verification criteria:**

- [ ] Each of the 14 panels opens and every control changes the correct chart behavior (not just UI state) — spot check at least 3 settings per panel, not just that it renders.
- [ ] CanvasSettings/SessionsSettings still successfully open the (still-unmigrated) ColorPickerPopover with no integration break at that boundary.
- [ ] `npx tsc --noEmit` clean after all 14, run once at the end, not per-panel.

---

## Phase 5 — ColorPickerPopover Consolidation (Optional — your call)

**Goal:** Replace the custom color/opacity picker (built earlier in this project) with `propskit-color`/`fig-fill-picker`, unifying its two separate positioning code paths (settings-anchored vs. canvas-anchored drawing toolbar) into one `fig-popup`-based implementation.

This undoes recently-shipped, verified custom work. Decide explicitly whether the consolidation is worth it before starting — skipping this phase entirely and keeping the current custom picker is a legitimate choice, not a failure to finish the migration.

**Instructions to give your agent (if proceeding):**

```
Replace ColorPickerPopover.tsx's two positioning modes (settings-panel
anchored, canvas-drawing-toolbar anchored) with a single fig-popup-based
implementation using propskit-color or fig-fill-picker. Confirm the
drawing-tool-specific features built earlier (opacity slider, custom hex
input, box fill/border separation) are all preserved — this is a
reimplementation, not a feature removal.
```

**Verification criteria:**

- [ ] Every feature the custom picker had (opacity, hex input, box fill/border split, viewport clamping) still works identically.
- [ ] Both call sites (settings panel, canvas drawing toolbar) use the same single implementation, not two anymore.
- [ ] `npx tsc --noEmit` clean.

---

## Phase 6 — Toolbar & Header Action Buttons (83)

**Goal:** Bulk migration of the largest, most heterogeneous bucket — left for last because the pattern is fully proven by now, so this is volume, not novel risk.

**Instructions to give your agent:**

```
Migrate the remaining 83 toolbar/header compound buttons (text+icon
triggers for dropdowns, focus mode, drawing tool selection, pair
selector trigger, layout selector, etc.) across the 24 files identified
in the earlier audit, to <fig-button> with appropriate variants. Batch by
file, verifying each file's buttons still trigger their correct actions
before moving to the next file.
```

**Verification criteria:**

- [ ] Every migrated button still triggers its original action — given the volume here, spot-check at least one button per file, not just a handful overall.
- [ ] No layout breakage in the header/toolbar row (these are dense, horizontally-packed UI — check for wrapping/overflow issues at a few different window widths).
- [ ] `npx tsc --noEmit` clean.

---

## Phase 7 — Trading Execution, Canvas Overlay, OrderTicket, Position-Close Modal

**Goal:** The real-money-adjacent surfaces, done last and with extra caution.

**Instructions to give your agent:**

```
Migrate: Trading Execution buttons (16 — BUY/SELL, limit submit, order
cancellation in OrdersPanel.tsx and OrderTicket.tsx), Canvas Overlay
buttons (15 — TP/SL cancel, position close confirmation in
ChartCanvas.tsx), OrderTicket.tsx itself (to fig-dialog if applicable),
and the in-canvas position-close confirmation modal.

Preserve exact color semantics (green buy, red sell) explicitly via
--figma-color-bg-success / --figma-color-bg-danger tokens already
confirmed to exist in Phase 0's token audit — do not let these
accidentally shift to default figui3 colors.
```

**Verification criteria:**

- [ ] Manual QA pass, not just automated/visual: place a real (testnet) BUY order, a real SELL order, cancel an open order, and confirm a position close — through the migrated UI — and confirm the actual trading action fired correctly, not just that the button looks right.
- [ ] BUY button is unambiguously green, SELL unambiguously red — visually confirm against the original hex values (`#089981` / `#F23645`), not just "close enough."
- [ ] No accidental double-submit risk introduced by any change in button event handling (single click still means single order).
- [ ] `npx tsc --noEmit` clean.
- [ ] This phase gets a manual sign-off from you specifically before considering the migration complete — not agent self-report alone, given what's at stake here.
