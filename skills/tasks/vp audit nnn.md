AUDIT ONLY. Do not fix yet.

Volume Profile looks faulty/useless visually.

Problem:
Custom Volume Profile and default attached Volume Profile both render as noisy horizontal bars. It does not form readable auction shapes like P-shape, b-shape, D-shape, HVN/LVN structure, or clear high/low volume areas like TradingView/DeepCharts-style profiles.

Changing row size does not solve it. The issue may be:
- profile calculation
- row aggregation
- width normalization
- visual width scaling
- min width/opacity
- bid/ask/delta rendering
- profile source data
- wrong selected candle/time range
- custom/default render mismatch

Goal:
Find exactly why the Volume Profile does not visually represent traded volume clearly.

Audit these areas:

1. Data source
- Is VP built from profile_rows_ts restored rows, live trades, raw trades, footprint cells, or fallback candles?
- For a custom selected range, how many candles/trades/profile rows are actually used?
- Are restored collector rows being used or only live browser rows?

2. Row aggregation
- For the selected profile range, print the final profile rows:
  - bucketPrice
  - bidVol
  - askVol
  - totalVol
  - delta
  - tradeCount
- Confirm rows are grouped into the intended visual bucket size.
- Confirm bucket boundaries are correct.

3. Width calculation
For each drawn row, log/sample:
- row totalVol
- maxVol / POC volume
- volume ratio = totalVol / maxVol
- scale mode used
- final pixel width
- min width clamp applied or not
- opacity used

Question:
Are weak rows being visually inflated until they look almost equal to strong rows?

4. POC / HVN / LVN
- Is POC actually the highest totalVol row?
- Are there secondary HVNs?
- Are LVNs real low-volume valleys or just noisy micro gaps?
- Does VAH/VAL come from the same rows being drawn?

5. Custom vs default VP
- Do custom VP and default VP use the same buildProfile math?
- Do they use same scaling and rendering rules?
- Is custom VP slicing the correct time range after drawing?

6. Visual comparison
For one selected visible range, output:
- top 10 rows by total volume
- bottom 10 nonzero rows
- POC row
- total volume
- max row volume
- median row volume
- number of rows below 5% of POC
- number of rows below 10% of POC

7. Root cause
Tell me clearly whether the issue is:
- data is genuinely noisy
- row aggregation is wrong
- width normalization is wrong
- min width/opacity exaggerates weak rows
- restored/live data mismatch
- renderer draws correctly but settings are bad
- custom profile range is wrong

Create audit document:

artifacts/volume_profile_shape_audit.md

Required sections:
# Volume Profile Shape Audit

## 1. Current VP Data Source
## 2. Selected Range Row Data
## 3. Width / Scaling Calculation
## 4. POC / HVN / LVN Accuracy
## 5. Custom vs Default Profile Path
## 6. Why The Profile Looks Noisy
## 7. Root Cause
## 8. Recommended Fix Plan

Do not change runtime code.
Do not change storage.
Do not change collector.
Do not change rendering yet.
Only inspect and document.