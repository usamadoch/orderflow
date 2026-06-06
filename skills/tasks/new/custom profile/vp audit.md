Audit only. Do not implement fixes yet.

I want to audit the custom/default Volume Profile math and rendering because the profile visually looks noisy/scattered and does not clearly show auction structure like P-shape, b-shape, D-shape, HVN/LVN, or clear high/low volume areas.

Focus area:
display row size + width normalization + visual clamping.

Current concern:
The Volume Profile may be calculating correctly, but visually it feels off:
- low-volume rows still look too large
- high-volume rows do not stand out enough
- profile shape looks spiky/noisy instead of readable
- POC/HVN/LVN structure is not visually clear
- custom profiles and default profiles may not be using consistent scaling
- filled profile mode may be visually exaggerating weak rows

Audit these areas:

1. Raw profile data
- What data source is used for custom profile and default profile?
- Are rows built from fine profile rows, raw trades, or fallback data?
- Are rows aggregated correctly by selected profile row size?
- Are empty/near-empty rows included?

2. Row size / resolution
- How does profileResolutionTicks / row size affect displayed rows?
- Is 0.5 / 1 tick too fine for BTC visual structure?
- Does row size change actually aggregate rows correctly?
- Are bucket boundaries aligned consistently?

3. Width normalization
- How is each row width calculated?
- Is max width based on true POC/max volume row?
- Are all rows scaled relative to the same max row?
- Is normalization per-profile or per-row by mistake?
- Are bid/ask/delta/total volume mixed incorrectly?

4. Visual clamping
- Is there a minimum width that makes tiny rows look too big?
- Is min row height or opacity making weak volume appear stronger than it is?
- Are width clamps hiding the difference between weak and strong rows?
- Does filled mode inflate low-volume areas?

5. POC / VA / HVN / LVN
- Is POC calculated from the same rows used for drawing?
- Are VAH/VAL based on correct total volume distribution?
- Are LVNs detected from real valleys or visual noise?
- Are HVN/LVN markers useful or misleading?

6. Custom vs default profile consistency
- Do custom drawn profiles and default attached profile use same aggregation/math?
- Do they use same width normalization rules?
- Do they use same row-size settings?
- Are there separate render paths causing different visuals?

7. Visual readability
- Why does the profile fail to show clear shape?
- Is this because of real BTC data/noise?
- Or because row size, normalization, or clamping is distorting the display?
- What settings would make profile structure more readable?

Output:
Create audit document:

artifacts/volume_profile_rendering_audit.md

Required sections:
# Volume Profile Rendering Audit

## 1. Current Profile Data Flow
## 2. Row Size / Aggregation Behavior
## 3. Width Normalization
## 4. Visual Clamping and Filled Mode
## 5. POC / VA / HVN / LVN Accuracy
## 6. Custom vs Default Profile Consistency
## 7. Why The Profile Looks Noisy
## 8. Recommended Fix Order

Important:
- Be honest if the calculation is correct and the issue is only visual resolution.
- Be honest if width scaling/clamping is distorting the shape.
- Do not change runtime code.
- Do not change storage, MongoDB, feeds, cache, or profile engine behavior.
- Update skills/map.md and skills/log.md only if project convention requires it, and keep those updates short.