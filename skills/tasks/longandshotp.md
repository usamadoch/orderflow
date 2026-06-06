Implement Long Position and Short Position drawing tools for the chart, similar to TradingView’s position tools.

These tools are only visual measuring/drawing tools. They must not place trades, connect to active positions, or care where current market price is. User should be able to draw them anywhere on the chart, even far away from current price.

Add two new buttons on panels header:

* Long Position
* Short Position


Main drawing behavior:

* User selects Long Position or Short Position from the toolbox.
* Instead of dropping a default 1:1 box immediately, allow the user to click and drag on the chart.
* The initial drag should define the risk/stop-loss area.
* After mouse release, create the full position drawing.
* Automatically create a small take-profit/reward area on the opposite side.
* User can then drag/resize the entry, stop-loss, and take-profit levels manually.
* Risk/reward calculations must update live while dragging or resizing.

Long Position behavior:

* Stop-loss/risk box is below entry.
* Take-profit/reward box is above entry.

Short Position behavior:

* Stop-loss/risk box is above entry.
* Take-profit/reward box is below entry.

Visual behavior:

* Risk/stop-loss area should be red.
* Reward/take-profit area should be green.
* Entry line should separate the two zones.
* Show labels and values like TradingView’s position tool as closely as possible.
* Copy the same type of displayed details TradingView shows: entry price, stop price, target price, risk/reward ratio, price movement, percentage movement, and pip/point distance where applicable.

Interaction requirements:

* Entire position drawing should be selectable.
* Entry, stop, and target lines should have draggable handles.
* Moving any handle should immediately recalculate all displayed values.
* User should be able to move the whole drawing without changing its proportions.
* User should be able to delete the drawing like other drawing tools.
* It should persist/behave like existing chart drawings if drawing persistence already exists.

Important:
This is not an order placement tool.
This is not tied to current market price.
This is not tied to open positions.
This is simply a TradingView-style Long/Short Position measuring drawing tool, with one improvement: user draws the risk area first by dragging instead of dropping a fixed 1:1 template.
