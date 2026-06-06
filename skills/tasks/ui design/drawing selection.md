Implement TradingView-style drawing selection and styling controls.

Goal:
Improve existing drawing tools UX. Do not create new drawing mechanics. Use the existing line/box drawing logic and add selection + styling controls.

Affected drawing types:

* Horizontal line
* Vertical line
* Ray/line that starts from selected point and extends right
* Box/rectangle

Required behavior:

1. Drawings should be selectable

* Clicking an existing drawing selects it.
* Clicking empty chart area deselects it.
* Selected drawing should show a small floating toolbar near the drawing or near the mouse/selection area.
* Toolbar disappears when drawing is deselected.

2. Floating drawing toolbar
   For selected lines, show controls:

* Delete
* Lock/unlock
* Stroke width dropdown: 1px, 2px, 3px, 4px
* Color picker with these colors:

  * #F23645
  * #FF9801
  * #FFEB3B
  * #4CAF50
  * #089981
  * #00BCD4
  * #2962FF
  * #673AB7
  * #E91E63

3. Box/rectangle controls
   For selected box, use the same toolbar controls:

* Delete
* Lock/unlock
* Stroke width dropdown
* Border color picker

For now, do not add fill/background color. Treat box like line styling only.

4. Lock behavior

* Locked drawing cannot be moved/edited.
* Locked drawing can still be selected so it can be unlocked or deleted.
* Lock state should persist with the drawing state if drawings already persist.

5. Styling behavior

* Changing color updates selected drawing immediately.
* Changing stroke width updates selected drawing immediately.
* Delete removes selected drawing.
* Existing drawings should keep default style if they do not have style fields yet.
* Add style fields in a backward-compatible way.

6. Important constraints

* Do not change market data.
* Do not change feeds.
* Do not change MongoDB/storage.
* Do not change footprint, Volume Profile, heatmap, indicators, or collector.
* Do not rewrite the drawing system.
* Only add drawing selection, toolbar UI, and style/lock/delete controls.

Validation:

* Draw horizontal line, select it, change color, change width, lock/unlock, delete.
* Draw vertical line, same tests.
* Draw ray/right-extending line, same tests.
* Draw box, change border color/width, lock/unlock, delete.
* Click outside drawing and toolbar disappears.
* Locked drawing cannot be moved.
* Existing drawings still render with default style.
* Pan/zoom/new candles should not break drawing position.

Output:

1. Explain what changed.
2. List files modified.
3. Confirm existing drawing logic was reused.
4. Confirm selectable drawings and toolbar work.
5. Confirm style fields are backward-compatible.
