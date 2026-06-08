Update default bullish/bearish canvas colors across the chart UI.

Goal:
Use TradingView-style Japanese candlestick colors as the global default green/red theme for chart visuals.

Use these colors:

* Bullish green: `#089981`
* Bearish red: `#f23645`

Apply them to:

1. Candlesticks

Update candle colors:

* body green: `#089981`
* body red: `#f23645`
* border green: `#089981`
* border red: `#f23645`
* wick green: `#089981`
* wick red: `#f23645`

2. Footprint colors

Update footprint bullish/bearish colors to use the same green/red base.

For footprint volume intensity:

* highest-volume bucket should use the strongest version of the color
* lower-volume buckets should use the same color with lower opacity/intensity
* do not use random green/red variants

3. Other chart visuals

Use the same default green/red colors for:

* volume bars
* bubbles
* delta/up-down coloring
* buy/sell canvas elements
* any other chart element currently using old green/red colors

4. Centralize colors

Put these colors in one shared place if possible, for example:

* global CSS variables
* chart theme constants
* shared canvas color config

Avoid hardcoding different green/red colors in multiple files.

5. Do not change behavior

Only update color values.

Do not change:

* candle logic
* footprint calculations
* bubble logic
* volume logic
* indicator settings
* data fetching
* layout

6. Validation

Run:

`npx.cmd tsc --noEmit`

Expected:

* candles use `#089981` and `#f23645`
* footprint uses the same colors with opacity/intensity scaling
* bubbles and volume bars use the same default green/red colors
* no old mismatched red/green colors remain in chart visuals
