Clean up chart UI organization with three small UI/state tasks.

Goal:
Reduce clutter and organize tools/indicators more cleanly. This is UI/state organization only.

Do not change:

* market data
* feeds
* MongoDB/storage
* footprint calculations
* Volume Profile calculations
* heatmap calculations
* collector script
* chart rendering logic except UI placement/state wiring

Task 1: Clean sidebar and turn it into a thin tools sidebar

Current sidebar has low-value content like size input field for tick, signal counts, absorption/exhaustion counts, and expand/collapse behavior.

Change it to:

* Move the tick adjestor input field into the global settings dropdown.
* Remove signal/count display clutter from the sidebar.
* Remove expandable/full sidebar behavior.
* Sidebar should stay as a thin/minimized tools sidebar by default, similar to TradingView.
* It should not expand into a large panel anymore.



Task 2: Persist indicator-list collapsed/expanded state

Current top-left indicator list has a small collapse/expand control.

Change:

* Persist whether the indicator list is collapsed or expanded.
* After refresh, it should remember the last state.
* This should be local UI persistence only.
* Do not affect whether indicators themselves are enabled/disabled.

Task 3: Move Heatmap and Liquidity Map into Indicators UX

Heatmap and Liquidity Map should be treated as indicators.

Change settings organization:

* Move Heatmap settings from Chart tab into Indicators tab.
* Move Liquidity Map settings from Chart tab into Indicators tab.
* Remove the Liquidity Map toggle/button from the panel header.
* Heatmap and Liquidity Map should appear in the top-left indicator list like CVD, Sessions, Bubbles, VOP/Volume Profile, etc.
* Each should have the same indicator-row UX:

  * name
  * eye icon to show/hide
  * settings icon to open the Indicators tab / relevant section

Important:

* Keep Heatmap and Liquidity Map behavior the same.
* Only move controls and indicator-list visibility.
* Do not change their calculation/rendering.

Validation:

* Sidebar is thin by default and no longer expands.
* Size input moved to global settings.
* Sidebar clutter/counts removed.
* Indicator list collapsed/expanded state persists after refresh.
* Heatmap and Liquidity Map settings are under Indicators.
* Heatmap and Liquidity Map appear in the top-left indicator list.
* Panel header no longer has Liquidity Map toggle.
* Existing indicator behavior still works.
* No market-data/storage/calculation logic changed.

Output:

1. Explain what changed.
2. List files modified.
3. Confirm sidebar cleanup.
5. Confirm indicator collapse state persistence.
6. Confirm Heatmap/Liquidity Map moved into Indicators.
7. Mention any limitation.
