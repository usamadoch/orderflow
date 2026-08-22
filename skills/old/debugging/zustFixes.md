# Performance Cleanup — Persisted State, Runtime State, and Render Cycle Separation
## Updated Task Document

Read this entire document before touching any code.
The previous version of this task had a critical flaw: it moved high-frequency fields
from the persisted store into a runtime store, but that still keeps them inside Zustand.
Any Zustand set() call — persisted or not — notifies all subscribers.
For fields updated 60 times per second, that is 60 subscriber notification cycles per second
regardless of whether the store persists or not. Moving them to a runtime store fixes
the localStorage write problem but does not fix the render cycle problem.
This document corrects that.

---

## Task 0 — Add Computation Guards First

Before touching any state or store, add disabled-checks to all expensive calculations.
This is the fastest win and is completely independent of state changes.

Find every place in the codebase where volume profile is built and add a check at the
top of that code path: if the profile is not enabled or not visible, do nothing and return.
Do not let the engine run just because data arrived.

Find every signal detection function — absorption, exhaustion, iceberg, liquidity vacuum,
and any other pattern detection. Each one should have a single check at the very top:
if the signal is disabled in settings, return immediately without calculating anything.

Find every liquidity zone calculation. Same rule: if the feature is disabled, do not run.

These guards are one-line checks. They may eliminate more lag than everything else in
this document combined. Do them first. Do not proceed to Task 1 until they are done.

---

## Task 1 — Understand the Two Problems Being Solved

There are two separate problems that must be treated differently.

Problem one is localStorage writes. The persisted Zustand store writes to localStorage
every time any field in it changes, including runtime fields that should never be saved.
This creates unnecessary disk writes during live candle updates, signal map updates,
and restore status changes. The fix is to move those fields out of the persisted store entirely.

Problem two is React re-renders from high-frequency updates. Fields like crosshair position,
hover state, drag state, and mousemove state update up to 60 times per second.
If these live in any Zustand store — persisted or runtime — every update notifies subscribers,
which can trigger React re-renders across every component reading those fields.
Moving these to a runtime store does not fix this problem. It only fixes problem one.
The correct fix for problem two is to remove these fields from Zustand entirely and use
local refs and direct canvas redraws instead.

Do not confuse these two problems. Each has a different solution.

---

## Task 2 — Classify All State Fields

Read through the entire chart store file and every related store file.
Classify every field into one of three groups before writing any code.

Group A is persisted settings. These should stay in the persisted Zustand store exactly
as they are now. They include user preferences, chart mode, selected symbol and pair,
timeframe settings, indicator enable and disable settings, bubble settings, profile settings,
drawing tool settings, layout preferences, and the crosshair sync toggle setting.
These are things the user configures and expects to survive a page refresh.

Group B is runtime state that needs cross-component awareness but does not need
to persist across refreshes and does not update at high frequency. These should move
to a separate non-persisted Zustand store. They include loading status, connected status,
history restore status, signal result maps, absorption maps, exhaustion maps,
iceberg maps, liquidity vacuum zones, liquidity zone data, aggregate bubble event buffers,
and redraw triggers. These update occasionally, not constantly. Moving them to a
non-persisted store fixes the localStorage write problem without causing a re-render problem.

Group C is high-frequency interaction state. These must not live in any Zustand store at all.
They include crosshair position, hover state, drag state, drag offset, drag delta,
mousemove position, and any per-frame animation state. These update every frame.
The correct home for these is a local ref inside the component that owns them.

Report the full classification before writing any code. Do not begin implementation
until the classification is reviewed and confirmed.

---

## Task 3 — Move Group B to a Non-Persisted Runtime Store

Create a separate Zustand store without the persist middleware.
Call it something consistent with the existing naming pattern in the project.

Move every Group B field into this store. Keep the same method names where possible
so that existing components calling setHistoryRestoreStatus, appendAggregateBubbleEvents,
setLiquidityZones, and similar methods continue to work with minimal changes.
Only the import path and the store they point to should change.

Update every import and selector that references these fields.
Be careful not to break components that read these fields — they should now read
from the new runtime store instead of the persisted store.

After this task is done, verify that live candle updates, signal map updates,
restore status changes, and liquidity zone updates no longer trigger localStorage writes.

---

## Task 4 — Move Group C Entirely Out of Zustand

This task is the most important one for render cycle performance.

For every Group C field, remove it from whichever store it currently lives in.
Replace it with a local ref inside the component that owns the interaction.

Crosshair position is the main case here. It currently updates on every mousemove.
Remove it from the store entirely. Each chart panel should hold its own crosshair
position in a local ref. The canvas crosshair layer should redraw by reading from
that ref directly inside a requestAnimationFrame call, not by subscribing to a store.

For cross-panel crosshair sync, which is needed when the sync setting is enabled,
use a direct Zustand subscription rather than a component-level selector.
Each panel canvas subscribes once on mount using the store's subscribe method
with a selector for the shared crosshair field. When crosshair changes, the subscription
fires and triggers a canvas redraw directly — no React re-render involved.
When sync is disabled, each panel uses only its local ref and the shared field is never updated.

Drag state, hover state, and mousemove state are panel-local by nature.
These should always be local refs. They do not need to be in any store.

The expected result of this task is zero React re-renders caused by mouse movement,
regardless of whether sync is on or off. Canvas layers redraw via requestAnimationFrame
reading from refs or direct subscriptions. React is not in the loop at all for these updates.

---

## Task 5 — Preserve and Protect Persisted Settings

After Tasks 3 and 4, confirm that all Group A fields still persist correctly.
Check that chart mode, timeframe, symbol, all indicator settings, bubble settings,
profile settings, drawing settings, and layout settings survive a page refresh.

Add a migration or normalization step so that old saved localStorage state from before
this change does not crash the application. Users who had the old state saved in their
browser will have Group B and Group C fields in their stored data. On rehydration,
those extra fields should be silently stripped rather than causing errors.

Confirm that the persisted store is now smaller and contains only Group A fields.

---

## Task 6 — Multi-Panel Safety

Confirm that each chart panel has its own isolated runtime state for candles,
buffers, restore status, and local interaction state.

Runtime updates in one panel must not cause unnecessary updates in the other panel.
Persisted settings are shared and that is correct. Runtime state must remain panel-scoped.

The crosshair shared field is the one intentional exception — it exists only to sync
the crosshair position between panels when sync is enabled. Confirm this is the only
cross-panel runtime field.

---

## Task 7 — Validate

Run the TypeScript check with no-emit flag. Report any new errors introduced by this work.
Do not fix pre-existing unrelated errors, but mention them.

Manually verify the following scenarios after implementation:

Moving the mouse over one panel should not cause the other panel to React re-render
when sync is disabled.

Moving the mouse over one panel should draw the crosshair on both panels when sync
is enabled, without React re-rendering either panel.

Enabling and disabling signals should stop and start their calculations correctly.

Volume profile should not rebuild when it is disabled or not visible.

User settings should survive a page refresh exactly as before.

Loading the page after the update when old localStorage state exists should not crash.

---

## What Must Not Change

Do not change footprint aggregation logic.
Do not change volume profile calculation logic.
Do not change bubble rendering logic.
Do not change aggregate bubble persistence or history.
Do not change the collector script or any background data pipeline.
Do not change API routes.
Do not change chart visuals or indicator detection rules.
Do not change drawing tool behavior.

Only move state, add computation guards, and update references.

---

## Expected Outcome

Volume profile and signal engines do not run when disabled.
Mouse movement causes zero React re-renders.
Cross-panel crosshair sync works through direct canvas subscriptions, not React state.
Live candle updates, signal result updates, and restore status updates do not write to localStorage.
User settings survive refresh.
Drag and hover state are local refs with no store involvement.
The persisted store is smaller, cleaner, and only written when the user actually changes a setting.