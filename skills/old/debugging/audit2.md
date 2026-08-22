Audit “hidden but still working” performance waste across the chart app.

Do not implement fixes yet. Only inspect and report. Do not change code unless temporary measurement logs are absolutely necessary, and if added, clearly mark them.

Context:

* The app has many optional indicators/signals/overlays.
* Some features may be visually hidden but still doing background work.
* Hidden should not mean “calculate but don’t draw.”
* Disabled should mean:

  * no fetch
  * no restore
  * no calculation
  * no filtering/scanning
  * no rendering
  * no unnecessary store updates
  * no unnecessary localStorage persistence writes

Goal:
Find every feature that is disabled/hidden in UI but still doing work in the background.

Audit these areas:

1. Indicators

Check whether these run work while disabled/hidden:

* Volume Bubbles
* Aggregate Trade Bubbles
* CVD
* Sessions
* Heat Map
* Liquidity overlay/indicator
* Footprint
* Volume Profile/default profile/custom profiles

For each one, report:

* where enabled/visible state lives
* whether data restore/fetch still happens when hidden
* whether calculations still happen when hidden
* whether canvas rendering still happens when hidden
* whether store updates still happen when hidden
* exact files/functions involved

2. Signals

Signals are not indicators. Do not treat them as indicators.

Audit whether these calculate while disabled/hidden:

* Absorption
* Exhaustion
* Iceberg
* Liquidity signals/markers

For each signal, report:

* whether detection/scanning still runs when signal is disabled
* whether results are stored/updated even when hidden
* whether canvas draw still loops through signal data even when hidden
* exact files/functions involved

3. Restore/fetch gating

Check if the frontend still restores data for features that are disabled.

Examples:

* profile restore when no profile is enabled
* aggregate bubble restore when bubble source is not Aggregate Trades
* raw trade restore when raw trade restore flag is false
* footprint restore when footprint is disabled
* signal-related restore/fetch if any

Report which restore paths are always running and which are properly gated.

4. Canvas redraw work

Inspect `ChartCanvas` and drawing functions.

Find any expensive work that happens before checking enabled flags.

Examples:

* building profile before `defaultProfileEnabled` check
* filtering aggregate bubbles before bubble visibility check
* calculating signal markers before signal enabled check
* generating footprint display cells before footprint enabled check
* drawing functions called even when feature is hidden

Report exact locations and expected early-return fixes.

5. Zustand/store persistence waste

Audit store updates that may trigger persistence or redraw while not needed.

Check:

* crosshair updates
* mousemove updates
* redraw triggers
* restore status
* bar width
* aggregate bubble buffer appends
* transient UI state
* hover state
* countdown/time updates

Report:

* which transient states are persisted unnecessarily
* which updates cause localStorage writes
* which updates cause redraws
* whether they should move to non-persisted state/ref/local component state

6. Multi-chart / multi-panel behavior

Check what happens when there are multiple chart panels.

Report:

* whether disabled indicators still calculate per panel
* whether each panel has separate feed subscriptions
* whether hidden panels still process live data
* whether each panel duplicates restore/fetch work
* whether aggregate bubbles/footprint/profile work multiplies per panel
* whether settings/state updates in one panel cause other panels to redraw

7. Output format

Give the report in this exact structure:

A. Short summary
B. Biggest hidden-work problems ranked by severity
C. Indicator-by-indicator audit table
D. Signal-by-signal audit table
E. Restore/fetch gating issues
F. Canvas/rendering early-return issues
G. Zustand/persistence waste
H. Multi-chart/multi-panel risks
I. Recommended fix plan in phases
J. Quick-win prompt outline for the first implementation task

Important:
Do not implement fixes yet.
Do not refactor.
Do not add new features.
Only audit and report.
