Improve drawing-tool UX by adding a TradingView-style draggable favorites toolbar.

Goal:
Move the existing drawing tool selections out of the panel dropdown and into a small draggable floating toolbar, similar to TradingView’s favorite drawing tools bar.

Current behavior:
Each panel has a drawing/tools dropdown with tools like:
- Horizontal Line
- Vertical Line
- Line
- Box
- Profile
- Measure/Ruler tool

The drawing mechanisms already exist. Do not recreate drawing logic.

What I want:
- Add a draggable floating drawing toolbar.
- Put the common drawing tools directly on this toolbar:
  - Horizontal Line
  - Vertical Line
  - Line
  - Box
- These toolbar buttons should use the existing tool-selection actions/state.
- Selecting a tool from the toolbar should behave exactly like selecting it from the current dropdown.
- The toolbar should be draggable so I can place it where I want on the chart/workspace.
- Toolbar position should persist if current UI persistence supports it.

Dropdown cleanup:
- Remove Horizontal Line, Vertical Line, Line, and Box from the panel dropdown.
- Keep only:
  - Profile
  - Measure/Ruler tool
inside the dropdown for now.

Important:
- Do not create new drawing mechanics.
- Do not change how drawings are rendered.
- Do not change drawing storage/state behavior except toolbar position if needed.
- Do not change chart data, feeds, MongoDB, footprint, volume profile, heatmap, or signal logic.
- This is only a UX/control relocation task.

Behavior:
- Toolbar button active state should reflect the currently selected drawing tool.
- Clicking the active tool again can either keep it active or toggle it off, following current app behavior.
- Toolbar should not block normal chart interaction more than necessary.
- Dragging toolbar should not create drawings accidentally.
- Toolbar should work per panel or globally, whichever matches current tool-state design best, but do not break split-panel behavior.

Validation:
- Horizontal Line works from toolbar.
- Vertical Line works from toolbar.
- Line works from toolbar.
- Box works from toolbar.
- Existing drawings still render/edit/delete as before.
- Dropdown only keeps Profile and Measure/Ruler.
- Toolbar can be dragged.
- Toolbar position persists if implemented.
- No market-data/chart calculation behavior changed.

Output:
1. Explain what changed.
2. List files modified.
3. Confirm tools use existing drawing logic.
4. Confirm dropdown was cleaned up.
5. Confirm toolbar drag behavior.
6. Mention any limitation.