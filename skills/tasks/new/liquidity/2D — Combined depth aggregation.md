Implement combined depth aggregation for liquidity sources.

Goal:
Allow liquidity overlay to use combined orderbook depth from multiple exchanges when selected.

Current depth sources:
- Binance
- second exchange adapter already added

Add new depth source option:
- Combined

Combined behavior:
- Subscribe to depth snapshot/stream from Binance and the second exchange.
- Normalize both into the same bucket format.
- Aggregate liquidity by price bucket.
- Keep source attribution if possible, but the first version can aggregate total size per bucket.
- Avoid double-counting within the same exchange.
- Clean up all subscriptions when switching away from Combined.

Important:
- Combined depth is for liquidity visualization only.
- Do not change candles/trades source.
- Do not change footprint/profile logic.
- Do not change MongoDB/storage.
- Do not rebuild the full heatmap engine yet.

Settings:
Depth source options should include:
- Binance
- Bybit/OKX
- Combined

Expected behavior:
- Binance mode = only Binance depth.
- Second exchange mode = only second exchange depth.
- Combined mode = merged liquidity from both.
- Switching source should reset/clear current orderbook/liquidity state so stale levels do not remain.

Validation:
- Test Binance only.
- Test second exchange only.
- Test Combined.
- Confirm Combined shows stronger/more populated liquidity levels.
- Confirm source switching clears stale liquidity.
- Confirm no duplicate stream leaks.
- Confirm subscriber/stream counts look correct in debug metrics if available.

Output:
- Explain aggregation method.
- List files changed.
- Confirm Combined mode works.
- Confirm stale liquidity is cleared on source switch.
- Mention limitations, especially that exchanges can have different liquidity and precision.