





I want to clean up raw_trades persistence so it is source-safe and scalable.

Goal:
Make raw_trades storage/query identity explicit and safe for spot/futures/source modes, instead of being symbol-only or implicitly spot-only.

Important:
Do not change footprint cache behavior.
Do not change volume profile cache behavior.
Do not change feed registry behavior.
Do not change chart UI.
Do not migrate database technology.
Keep this focused on raw_trades schema, writes, queries, and fallback behavior.

Current problem:
raw_trades appears to be symbol-only / spot-only in practice. That is unsafe if raw trades are ever used for restore, fallback, backfill, replay, or cross-source analysis.

New raw_trades identity should include explicit source fields:

- symbol
- sourceType: spot | futures
- contractType if needed
- dataSourceMode if needed
- trade timestamp
- price
- quantity
- side / buyer maker info if available
- trade id / event id if available
- normalized fields used by the app

Tasks:

1. Audit current raw_trades usage
Before changing behavior, identify:
- where raw_trades are written
- where raw_trades are restored
- which features depend on raw_trades
- whether it is only spot/spot fallback or used elsewhere

2. Schema/source-scope cleanup
Update raw_trades schema/migration so stored rows are source-safe.
Add indexes/unique keys appropriate for:
- sourceType + symbol + timestamp
- sourceType + symbol + trade id if available
- restore by sourceType/symbol/time range

3. Write logic
When saving raw trades, explicitly write the sourceType.
Do not mix spot and futures trades under the same symbol-only key.

4. Restore/query logic
Any raw trade restore should require source identity.
Do not allow ambiguous symbol-only raw trade restore unless explicitly marked legacy.

5. Legacy handling
If old rows exist, isolate them as legacy or ignore them safely.
Do not silently mix old symbol-only rows with new source-scoped rows.

6. Keep fallback behavior safe
If raw_trades fallback is only valid for spot/spot, keep it gated.
Do not accidentally use spot raw trades for futures/both views.

Validation:
- Spot raw trades restore only for spot source.
- Futures raw trades do not mix with spot.
- Source switch does not reuse wrong raw trade data.
- Existing footprint/profile base caches still work.
- Refresh persistence still works.
- No chart rendering regression.

Output:
1. Explain current raw_trades usage found.
2. Explain schema changes.
3. List files modified.
4. Confirm writes are source-scoped.
5. Confirm restores are source-scoped.
6. Confirm legacy rows cannot silently mix.
7. Mention any remaining limitation.