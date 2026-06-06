Reorganize indicator-related settings into a dedicated Indicators tab.

Goal:
The global settings dropdown currently has settings scattered across Chart, Profile, Sessions, panel header, and other places. I want all indicator-related controls grouped under one clean Indicators tab.

Create/update a global settings tab named:

Indicators

Move these existing settings into the Indicators tab:

1. Sessions
- Remove the separate Sessions tab.
- Move all existing session controls into Indicators.
- Sessions should become one indicator section inside Indicators.

2. CVD
- Move CVD settings from the Profile tab into Indicators.
- Remove CVD toggle/control from the panel header if it exists there.
- CVD should be controlled from the Indicators tab.

3. Bubbles
- Move bubble settings from the Chart tab into Indicators.
- Bubble visibility and bubble-related settings should live under Indicators.

For now, only move:
- Sessions
- CVD
- Bubbles

Do not add VWAP yet.

Important:
- Keep the actual behavior the same.
- Do not change calculations.
- Do not change rendering logic.
- Do not change market data, feeds, MongoDB, storage, footprint, volume profile, heatmap, or signals.
- This is settings organization only.

Expected result:
- Global settings has an Indicators tab.
- Sessions, CVD, and Bubbles are inside Indicators.
- Old duplicated controls are removed from their previous places.
- Existing settings still persist and work.
- Panel header becomes cleaner if CVD/session/bubble controls existed there.

After implementation, confirm:
- Indicators tab exists.
- Sessions settings moved there.
- CVD settings moved there.
- Bubble settings moved there.
- Old scattered controls removed.
- Behavior is unchanged.