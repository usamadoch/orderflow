I want to add a **small, reliable keyboard-control system** to the existing trading chart.

The chart already has drawing tools, volume profiles, position tools, indicators, multiple chart interactions, etc. Do NOT redesign the chart. The goal is to add the most useful keyboard interactions for navigating and editing the existing canvas without breaking current behavior.

Before changing anything, inspect the existing architecture and use `map.md` and the relevant map files to locate:

- chart keyboard/event handling
- chart/canvas state
- candle/time navigation
- drawing selection and movement
- drawing creation/deletion
- undo/redo or history mechanisms
- timeframe state/change logic
- chart layout/split-chart logic
- indicator/settings dialogs
- position/trading tools

Do not read unrelated large files in full. Follow the existing map/navigation documentation and inspect only the relevant sections.

## 1. Arrow-key chart navigation

This is the highest-priority feature.

When the chart itself has focus and **nothing is selected**:

- `←` → move the chart exactly **1 candle/bar to the left**
- `→` → move the chart exactly **1 candle/bar to the right**

Preserve the chart's existing navigation behavior and implement this through the existing chart state/navigation system rather than introducing a second competing navigation mechanism.

When a drawing/object is selected:

- `←` → move the selected object **1 bar left**
- `→` → move the selected object **1 bar right**
- `↑` → move the selected object **1 minimum price tick upward**
- `↓` → move the selected object **1 minimum price tick downward**

This should behave similarly to TradingView's drawing movement: left/right movement is one bar, and up/down movement is one minimum price increment.

Most importantly:

**Arrow keys must operate on the currently selected object instead of moving the entire chart.**

Do not allow an arrow key to accidentally both move the drawing and navigate the chart.

Support this for all existing movable drawing/object types that already have position/coordinate state, including lines, rectangles, position tools, volume-profile drawings, etc.

## 2. Undo / Redo

Implement a proper chart-action history system using:

- `Ctrl + Z` → Undo
- `Ctrl + Y` → Redo

On macOS, support the equivalent Command shortcuts if the project already has cross-platform keyboard handling.

History should cover meaningful chart editing actions, including at minimum:

- creating a drawing
- deleting a drawing
- moving a drawing
- resizing a drawing
- changing a drawing's relevant editable properties, where practical
- changing a position-tool object's coordinates
- other existing canvas-object mutations that are already treated as editable chart state

Example:

1. Create rectangle at A.
2. Move rectangle from A → B.
3. `Ctrl+Z` → rectangle returns to A.
4. `Ctrl+Z` → rectangle is removed.
5. `Ctrl+Y` → rectangle is recreated.
6. `Ctrl+Y` → rectangle returns to B.

The important requirement is that undo/redo restores **actual previous state**, not merely replaying approximate actions.

If the project already has Zustand/store/history/state mechanisms, integrate with them instead of creating an unnecessary parallel state system.

Do NOT record useless high-frequency transient events as hundreds of history entries during a single drag. A completed drag should normally become one undoable action.

When a new action is performed after undoing, invalidate the redo branch appropriately.

## 3. Timeframe keyboard input

Implement fast timeframe switching similar to TradingView.

Allow the user to start typing a timeframe value and press `Enter`.

Examples:

- `1` → 1-minute timeframe
- `5` → 5-minute timeframe
- `15` → 15-minute timeframe
- `60` → 60-minute timeframe
- `240` → 4-hour timeframe
-

Do NOT hard-code only the examples above if the existing timeframe system supports arbitrary intervals.

Use the existing timeframe validation/change mechanism.

Typing timeframe input must not interfere with normal keyboard navigation while the user is typing into an actual text input/dialog.

TradingView supports typing an interval and pressing Enter to change the chart interval.

## 4. Indicator shortcut

Support:

`/`

to open the indicator search/indicator interface, but only if the project already has an indicator-selection UI that can be opened cleanly.

Do not create a large indicator library or new indicator architecture for this task.

TradingView uses `/` to open indicators.

## 6. Reset / chart utility shortcuts

Consider adding these only if the existing chart already has the corresponding functionality:

- `Alt + R` → reset chart
- `Ctrl + ↑` → zoom in
- `Ctrl + ↓` → zoom out
- `Ctrl + ←` / `Ctrl + →` → larger chart navigation jumps

Do not implement these if doing so would conflict with existing controls.

TradingView currently uses these types of shortcuts for chart navigation/zoom/reset.

## 7. Chart layout / split chart

A simple keyboard shortcut can safely split chart layout.

##

## 9. Keyboard event safety

This is extremely important.

Keyboard handling must respect context.

For example:

```text
Text input focused
    → normal text editing

Drawing selected
    → arrow keys move drawing

Nothing selected + chart focused
    → arrow keys navigate candles

Dialog/modal open
    → dialog receives keyboard events

Select/dropdown open
    → dropdown receives keyboard events

Canvas/chart focused
    → chart shortcuts active
```

Prevent shortcuts from firing when the user is typing into:

- input
- textarea
- contenteditable
- search boxes
- settings fields
- dropdown/select controls
- dialogs that should own keyboard navigation

Avoid global event listeners that steal keys from unrelated components.

## 10. Prevent duplicate/conflicting handlers

Before implementing anything, search for every existing:

- `keydown`
- `keyup`
- keyboard shortcut
- arrow navigation
- chart navigation
- undo
- redo

handler.

Determine whether there are already multiple keyboard systems.

Consolidate or integrate with the existing architecture where appropriate instead of stacking another global keyboard handler on top.

The final system must have one predictable ownership model for keyboard events.

## 11. Drawing movement requirements

For selected objects, movement must operate in the object's existing coordinate model.

Do NOT simply modify screen pixels.

For example, if a line has:

```text
time1 / price1
time2 / price2
```

then:

`←`

should move its time/bar coordinates back by one bar while preserving its price coordinates.

Similarly:

`↑`

should increase the relevant price coordinates by one tick while preserving the time coordinates.

The same principle should apply to rectangles, position tools, volume-profile selections, and other existing drawable objects according to their existing coordinate representation.

Do not create special-case coordinate systems unless absolutely necessary.

## 12. History and drawing movement interaction

Make sure keyboard movement integrates correctly with undo/redo.

Example:

```text
Select line
←
←
→
Ctrl+Z
```

The resulting state should be the actual previous committed state according to the history model.

Avoid creating three meaningless history states if the architecture treats a continuous interaction as one logical edit.

At the same time, do not make undo restore an unrelated earlier chart state.

## 13. Do not overbuild

The objective is NOT to reproduce every TradingView shortcut.

Prioritize:

1. `← / →` chart navigation
2. `← / → / ↑ / ↓` selected-object movement
3. `Ctrl+Z / Ctrl+Y` undo/redo
4. typed timeframe + Enter
5. `/` indicator access
6. `Ctrl+K` command/search access
7. useful zoom/navigation shortcuts where they fit existing architecture
8. safe access to existing chart/layout functionality

Everything else is optional and should only be implemented when it clearly fits the current application.

## 14. Verification

After implementation, verify at minimum:

### Chart navigation

- left arrow moves exactly one candle
- right arrow moves exactly one candle
- chart does not move when a drawing is selected

### Drawing movement

- selected line moves one bar per left/right press
- selected rectangle moves one bar per left/right press
- selected object moves one tick per up/down press
- object remains correctly anchored to candle/time coordinates

### Undo/redo

- create → undo → redo
- move → undo → redo
- resize → undo → redo
- delete → undo → redo
- multiple actions → multiple undo/redo
- undo → new action → redo branch correctly invalidated

### Timeframe

- numeric timeframe input works
- suffixes such as `D`, `W`, etc. work where supported
- invalid timeframe input does not break the chart
- typing into an actual text field is unaffected

### Safety

- keyboard shortcuts do not fire inside inputs
- dialogs retain keyboard control
- no duplicate key handlers cause double movement
- no drawing movement causes accidental chart navigation
- no keyboard shortcut can accidentally place a live trade

Do not stop after adding the shortcuts. Trace and test the existing state, event, rendering, and history architecture so these features behave as native parts of the chart rather than as fragile patches.
