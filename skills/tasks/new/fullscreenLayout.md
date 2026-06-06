I want to add a simple focus/fullscreen layout mode.

Goal:
Create a toggle that hides the top header and the sidebar completely so the chart area can use maximum screen space.

Expected behavior:
- Add one visible button for toggling focus mode.
- When focus mode is enabled:
  - hide the top header completely
  - hide the sidebar completely
  - expand the main chart/workspace area to fill the freed space
  - show a small floating/edge button so the user can restore the layout
- When focus mode is disabled:
  - restore the header and sidebar exactly as before
  - preserve the sidebar’s previous state, including whether it was expanded or icon-collapsed
- This should work as a toggle: enable → disable → enable.

Keyboard shortcut:
Add a simple shortcut:

Alt + Shift + Z

Behavior:
- Press once: enter focus mode
- Press again: exit focus mode
- Do not trigger while the user is typing inside an input, textarea, dropdown, or editable field.

Important:
- Do not remove existing sidebar collapse behavior.
- This is separate from the current sidebar icon/full collapse.
- Current sidebar collapse should still work normally when focus mode is off.
- Focus mode should temporarily hide both header and sidebar, not permanently change their saved layout state.
- Do not change chart rendering logic, data logic, feed logic, cache logic, storage, or settings behavior.
- Keep this as a UI/layout-only change.

UX details:
- The restore button should be small and unobtrusive.
- It can sit near the top-left or top-right edge of the screen.
- Use a clear icon/label such as “Exit Focus” or an expand/collapse icon.
- Make sure the chart resizes correctly after entering/exiting focus mode.

Validation:
- Toggle using the button.
- Toggle using Alt + Shift + Z.
- Confirm header hides/shows correctly.
- Confirm sidebar hides/shows correctly.
- Confirm previous sidebar collapsed/expanded state is preserved.
- Confirm chart area expands and resizes properly.
- Confirm shortcut does not fire while typing in inputs.

Output:
1. Explain what changed.
2. List files modified.
3. Confirm focus mode hides header and sidebar.
4. Confirm previous sidebar state is preserved.
5. Confirm Alt + Shift + Z works.
6. Mention any limitation.