# OrderFlow Chart - Change Log

## [2026-06-09] - UI: Chart Info Row Polish
- **What changed**:
  - Restyled the top-left chart info row to feel more like an independent TradingView legend line with larger text, clearer pair/market/source separation, and a small connection status dot.
  - Kept the Spot/Futures/Both source buttons in the info row but made them lighter inline text controls instead of boxed header-style controls.
- **Why it changed**:
  - The first chart info row was too compact and still read like a small toolbar instead of chart legend information.
- **Impact summary**:
  - The chart info row is easier to scan above indicators while Flow Source behavior, indicator collapse behavior, toolbar behavior, and chart logic remain unchanged.

## [2026-06-09] - UI: Chart Info Row and Compact Drawing Toolbar
- **What changed**:
  - Removed the Binance/source/loading cluster from the panel header while keeping the pair selector and existing chart controls in place.
  - Added a top-left chart info row above the indicator labels showing pair, chart market type, Binance, Spot/Futures/Both source buttons, and panel-scoped loading dots.
  - Reused the existing indicator collapse state so one control now hides or shows both the chart info row and indicator list.
  - Added a right-side collapse/expand control to the floating drawing toolbar.
  - Made the floating drawing toolbar more compact by reducing container spacing/padding and shrinking tool buttons; the collapsed toolbar remains draggable.
- **Why it changed**:
  - The panel header was crowded by market/feed/source/loading information, and the floating drawing toolbar needed a smaller footprint while idle.
- **Impact summary**:
  - Flow Source behavior, chart rendering, drawing behavior, indicators, data fetching, and restore logic are unchanged.
  - The chart area now carries the market/source legend where users scan indicators, and the toolbar can collapse into a small draggable pill.

## [2026-06-09] - UI: TradingView Colors and Header Loading Dots
- **What changed**:
  - Added shared chart bullish/bearish color constants for `#089981` and `#f23645`, plus RGB/rgba helpers and legacy semantic color normalization.
  - Updated candlesticks, footprint cells/delta, footprint thin candles, bubbles, Volume bars, price line, CVD defaults, liquidity bid/ask helpers, iceberg/absorption visuals, measurement colors, and Long/Short drawing risk/reward visuals to use the shared green/red theme.
  - Updated global bullish/bearish CSS variables and nearby chart-control accents to the same green/red defaults.
  - Removed the normal chart-area detailed restore/loading badge and added small panel-scoped animated loading dots in each chart panel header.
  - Kept detailed restore/loading status data in runtime/debug paths instead of showing it in the normal chart UI.
- **Why it changed**:
  - Chart visuals used older mismatched green/red defaults and the normal UI exposed detailed loading text that should only be visible through debug surfaces.
- **Impact summary**:
  - Bullish/buy/up chart visuals now consistently use `#089981`; bearish/sell/down visuals use `#f23645`.
  - Loading feedback is smaller and panel-specific while data fetching, restore, rendering, indicators, settings, and debug logic remain unchanged.

## [2026-06-09] - UI: Popup Control Contrast
- **What changed**:
  - Added a scoped popup contrast layer that keeps popup shells on `#1F1F1F` while giving inner controls a clearer `#262626` surface.
  - Applied the contrast layer to Global Settings, indicator settings dialogs, the symbol selector modal, floating drawing/profile toolbars, and the internal debug popup.
  - Improved inactive control borders to `#333333`/`#3A3A3A` for inputs, selects, unselected buttons, setting boxes/cards, and popup inner controls.
  - Improved range slider visibility with `#3A3A3A` inactive tracks, accent-colored thumbs/progress where supported, and a subtle `#5A5A5A` thumb border.
  - Kept selected/accent controls on their existing blue or semantic selected styling.
- **Why it changed**:
  - The prior dark theme cleanup made many popup controls the same `#1F1F1F` as their parent popup, reducing contrast for inactive buttons, fields, cards, sliders, and drag handles.
- **Impact summary**:
  - Popup controls are easier to distinguish without changing popup layout, settings behavior, indicator behavior, chart logic, or data flow.
  - The elevated popup style remains intact while controls have a clearer visual hierarchy.

## [2026-06-08] - UI: Consistent Dark Theme Surfaces
- **What changed**:
  - Set the main app, chart panel, canvas, CVD, header/sidebar, price scale, and time scale surfaces to `#0F0F0F`.
  - Set elevated/floating UI surfaces such as settings windows, symbol selector modal, drawing toolbars, tooltips, indicator hover controls, restore badge, and debug panel surfaces to `#1F1F1F`.
  - Added an explicit chart canvas background fill so the canvas itself uses the main dark surface.
  - Kept existing border, text, accent, and semantic status colors while removing the mixed dark surface tokens from the scoped chart/UI files.
  - Kept chart behavior, data flow, settings behavior, toolbar behavior, and panel layout unchanged.
  - Updated chart grid drawing so horizontal and vertical grid lines are explicitly 1px and pixel-aligned.
- **Why it changed**:
  - The chart UI used several close but inconsistent dark colors across main surfaces and floating panels, making the dark theme look uneven and the grid visually heavy.
- **Impact summary**:
  - The app now has a simpler two-level dark hierarchy: `#0F0F0F` for the main chart/app surface and `#1F1F1F` for elevated UI.
  - Canvas grid lines should render thinner and cleaner without changing chart logic or interactions.

## [2026-06-08] - Fix: Safe Footprint Restore Window
- **What changed**:
  - Kept `needsFootprintWork` intact for footprint mode, footprint-cell bubbles, CVD, footprint-dependent signals, liquidity vacuum, and browser market writes.
  - Changed stored footprint restore to derive a bounded current/visible chart window, clamp oversized footprint spans, and fetch canonical `1m/$5` rows in 2-hour chunks.
  - Made footprint chunk failures local to footprint hydration so candle/live chart restore can still complete.
  - Added footprint restore diagnostics for requested range, clamped range, chunk count, rows per chunk, range-too-large skips, and failure reason in restore status/debug views.
  - Tightened `/api/history/footprint` to reject range requests over 2 hours of canonical 1m footprint data with a clear JSON error.
  - Updated `skills/map.md` for the changed API, feed, chart status, debug panel, and restore status responsibilities.
- **Why it changed**:
  - Candle panels can still legitimately need footprint/order-flow data for enabled features, but the restore path could request an oversized footprint range in one call and fail or lag the panel.
- **Impact summary**:
  - Footprint-dependent features still enable footprint work when needed.
  - Initial footprint restore no longer asks the API for multi-day footprint history in one request.
  - Oversized visible/current restore spans are clamped and chunked, with failures reported without breaking candle rendering.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-08] - Fix: Volume History After Flow Source Cleanup
- **What changed**:
  - Changed the Volume renderer so `Input Data = Volume` always builds bars from visible candle history and updates the live candle bar from candle volume.
  - Kept Orders/Agg Trades Volume inputs on the existing aggregate-event path, with Flow Source filtering and explicit aggregate-data unavailable/live-only debug reasons.
  - Stopped treating non-active Flow Source as a reason to require aggregate events for plain candle-volume rendering.
  - Added Volume debug fields for visible, historical, live counts, input data, Flow Source used, and live-only reason.
  - Reviewed the Bubbles Flow Source path: footprint-cell bubbles still use footprint cells, and aggregate-trade bubbles still resolve Spot/Futures/Both through the shared panel Flow Source.
  - Updated `skills/map.md` for the renderer and debug responsibility changes.
- **Why it changed**:
  - The Flow Source cleanup accidentally routed Volume input through aggregate-event filtering when the panel Flow Source was `Both` or differed from the chart contract, causing restored candle-volume history to disappear.
- **Impact summary**:
  - Volume now renders historical bars from restored candles whenever candle volume exists.
  - The latest live candle continues updating the current Volume bar.
  - Orders/Agg Trades do not fake missing aggregate history; debug reports when only live aggregate bars are available or aggregate data is unavailable.
  - Bubbles continue to use the shared Flow Source without restoring duplicate Market Source controls.

## [2026-06-08] - UI: Indicator Source Cleanup
- **What changed**:
  - Removed the duplicate `Market Source` selector from Bubbles settings while keeping Bubble Source, Size By, thresholds, side filter, scale mode, and radius controls unchanged.
  - Renamed the user-facing `Volume Bars` indicator to `Volume` in indicator labels and the settings popup title/section.
  - Removed the duplicate `Market Source` selector from Volume settings while keeping input data, filters, color, opacity, height, values, average line, text size, and average length controls unchanged.
  - Routed Bubbles and Volume source props through the panel Flow Source from the chart header, leaving the existing persisted source fields in place for compatibility.
  - Updated `skills/map.md` for the changed settings, label, panel bridge, feed source-routing, and renderer responsibilities.
- **Why it changed**:
  - Bubbles and Volume had indicator-level market source controls that could conflict with the chart header Flow Source.
- **Impact summary**:
  - Bubbles and Volume now use the panel Flow Source instead of separate indicator source selectors.
  - Existing Bubbles and Volume display/filter/settings behavior remains intact aside from the removed duplicate source controls.
  - Feed, candle price source, footprint calculation, aggregate bubble rendering logic, Volume rendering logic, persistence, profile logic, and debug panel behavior are otherwise unchanged.

## [2026-06-08] - UI: Flow Source Moved To Chart Header
- **What changed**:
  - Removed the `Contract Type` control from the Global Settings chart tab while keeping the underlying panel contract state intact.
  - Removed the old Global Settings `Aggregate Trades` spot/futures/both source selector from the chart tab.
  - Added a compact panel-scoped `Flow` selector beside the chart symbol and `Binance` label in the panel toolbar, backed by the existing `dataSourceMode` state.
  - Updated `skills/map.md` for the toolbar and settings-window responsibilities.
- **Why it changed**:
  - Instrument selection already defines Spot versus Perpetual Futures candles, and the trade-flow source belongs near the chart symbol instead of in global settings.
- **Impact summary**:
  - Each split chart panel can independently choose Flow Source = Spot, Futures, or Both.
  - Candle price source, selected symbol, contract type state, footprint calculations, bubbles, Volume Bars, and Volume Profile logic are unchanged.

## [2026-06-08] - Feature: Volume Bars Indicator
- **What changed**:
  - Added a default-off `Volume Bars` indicator to the top-left indicator labels with eye toggle and its own focused settings dialog.
  - Added persisted per-timeframe Volume Bars settings for input data, market source, min/max filters, color mode, opacity, height, value text, text size, average line, and average length.
  - Added a visible-range bottom histogram renderer using candle volume for the cheap default path, existing aggregate-trade buffers for Orders/Aggregate Trades/non-active market-source modes, and optional footprint volume fallback when candle volume is unavailable.
  - Expanded aggregate-trade buffering/hydration gates so Volume Bars can reuse existing aggregate events only when enabled and configured to need them.
  - Added Volume Bars debug snapshots with enabled/input/visible-count/max/average fields.
  - Updated `skills/map.md` for the changed responsibilities and new renderer.
- **Why it changed**:
  - The app needed Volume Bars as an independent indicator, not a signal or global setting, while preserving hidden-work rules when disabled.
- **Impact summary**:
  - New panels keep Volume Bars hidden by default.
  - Enabling Volume Bars renders bottom-aligned volume bars for visible candles and supports Volume, Orders, and Aggregate Trades modes where source data exists.
  - Aggregate trade work remains off unless bubbles or Volume Bars settings require it.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-07] - UI: Crypto Selector Settings-Style Modal
- **What changed**:
  - Changed `PairSelector` so the symbol chooser opens as a fixed settings-style modal/window with backdrop, header, close button, backdrop close, and Escape close.
  - Kept the existing panel-scoped symbol, Spot, and Perpetual Futures selection behavior unchanged.
  - Updated `skills/map.md` for the selector responsibility.
- **Why it changed**:
  - The selector needed to match the existing settings modal style instead of behaving like a small dropdown.
- **Impact summary**:
  - The chart header still shows one rounded current-symbol button.
  - Clicking it now opens a modal-style selector rather than an anchored dropdown.
  - Instrument selection still updates only the active chart panel.
  - `npx.cmd tsc --noEmit` passes.

## [2026-06-07] - Feature: Crypto Instrument Selector
- **What changed**:
  - Replaced the chart header BTC/ETH toggle with the existing panel-scoped `PairSelector` rendered as one rounded current-symbol button.
  - Expanded `PairSelector` into a local Binance USDT popup with the supported hardcoded symbols and expandable Spot / Perpetual Futures options.
  - Selecting an option now updates only that panel's pair, contract type, and aligned data source mode, then closes the popup; futures displays with a `.P` suffix.
  - Expanded shared allowed symbols to BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, and LTC USDT markets.
  - Updated `skills/map.md` for the toolbar, selector, and market config responsibilities.
- **Why it changed**:
  - Chart panels needed a simple per-panel Binance symbol/instrument selector instead of a fixed BTC/ETH toggle.
- **Impact summary**:
  - Each chart panel can independently switch between supported Binance Spot and Perpetual Futures instruments.
  - Candle/history validation accepts the new supported symbols.
  - No collector, persistence, comparison overlay, or external symbol search behavior was added.
  - `npx.cmd tsc --noEmit` passes.
