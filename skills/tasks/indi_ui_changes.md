Improve indicator visibility defaults and indicator settings UX.

Context:

* The chart has indicators such as Bubbles, heatmap, liquidity, etc.
* indicator settings currently live inside the global settings modal/dropdown under an Indicators tab.
* This is becoming hard to navigate.
* Indicator labels already appear on the chart top left, and indicators have settings icons next to eye for hide or view mode.

Goal:
Make indicators hidden by default, move each indicator’s settings into its own popup/dialog opened from its own settings icon, and clean up the default selected global settings.

Do not rebuild the chart or indicator systems. Keep existing indicator logic working. This is mainly a UX/settings organization task.

1. Hide indicators by default

Update default chart/panel state so indicators are disabled/hidden by default unless explicitly enabled by the user.

Important:

* Do not remove the indicators.
* Do not break persisted user settings.
* Existing saved settings should still load normally.
* Only new/default panels should start with indicators hidden.

2. Move indicator settings out of global setttings Indicators tab

Currently, indicator-specific settings are hard to find inside global settings.

Change UX so each indicator has its own settings popup/dialog.

Expected behavior:

* Each indicator row/label/button should have a settings icon.
* Clicking that settings icon opens that indicator’s own popup/dialog.
* Example:

  * Bubble settings icon → opens only Volume Bubble settings

Do not force the user to open global settings → Indicators tab → find the indicator.

3. Popup/dialog behavior

Each indicator popup/dialog should:

* contain only settings relevant to that indicator
* use the existing setting controls where possible
* update the same underlying state as before
* close when user clicks outside, presses Escape, or clicks close
* not interfere with chart dragging/zooming after closed
* be positioned near the settings icon if using a popover, or centered if using a dialog

Keep design consistent with the current UI.

4. Global settings cleanup

Global settings should no longer be the main place for detailed indicator configuration.

The global settings can still contain:

* general chart settings
* theme/display settings

But detailed indicator settings should move to each indicator’s own popup.

If the global Indicators tab still exists:

* simplify it
* remove duplicated detailed controls
* keep only high-level enable/disable toggles if needed

5. Default selected global settings changes

Review and update the default selected/global settings so the initial chart opens cleaner.

Make sure defaults are reasonable:

* indicators hidden by default
* no heavy overlays enabled by default
* chart should open fast and visually clean
* user can enable indicators manually and configure them through each indicator popup

Preserve backward compatibility with persisted settings.

6. State/persistence

Make sure all changed defaults and moved controls still use the existing store/persistence system.

Do not create duplicate settings state.

If a setting already exists in Zustand/store/persisted panel settings, reuse it.

7. Validation

Run:

* `npx.cmd tsc --noEmit`

If lint has existing unrelated failures, mention them but do not fix unrelated files.

Expected result:

* New chart panels open with indicators hidden by default.
* User can enable indicators manually.
* Clicking an indicator’s settings icon opens a focused popup/dialog for that indicator.
* Detailed indicator settings are no longer buried inside global settings.
* Existing indicator logic and persisted settings remain stable.
