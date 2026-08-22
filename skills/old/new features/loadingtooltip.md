Replace detailed loading tooltip with small three-dot loading indicator.

Issue:

* The chart currently shows detailed loading text/tooltips like candlestick data, footprint, volume profile, etc.
* I do not want this detailed loading information in the normal UI.

Goal:
Show a simple three-dot loading indicator in the chart panel header instead.

1. Remove/hide detailed loading tooltip

Hide the current detailed loading tooltip/prompt from the normal chart UI.

Do not delete the underlying loading/debug information if it is used internally.

2. Add panel header loading dots

Add a small three-dot loader in each chart panel header.

Example:

`● ● ●`

The dots should blink one by one:

dot 1 → dot 2 → dot 3 → repeat

3. Panel scoped

The loader must be panel-specific.

If only the left panel is loading, show dots only on the left panel header.

If only the right panel is loading, show dots only on the right panel header.

4. When to show

Show the dots when that panel is loading/restoring any chart data, including:

* candles
* footprint
* volume profile
* aggregate bubbles
* history restore

Hide the dots when loading is complete.

5. Keep debug info separate

Do not show detailed loading text in the normal UI.

Detailed loading/restoring information should remain available only in:

* Market Debug panel
* console/debug snapshot if already implemented

6. Styling

Keep it small and subtle.
Place it near the panel header controls/symbol area.

Do not make it a big overlay.

7. Do not change behavior

Only change loading UI.

Do not change:

* data fetching
* restore logic
* chart rendering
* indicators
* signals
* settings
* debug logic

8. Validation

Run:

`npx.cmd tsc --noEmit`

Expected:

* detailed loading tooltip is gone from normal UI
* small animated three-dot loader appears in the correct panel header while loading
* loader disappears when loading is done
* Market Debug still keeps detailed restore/loading info
