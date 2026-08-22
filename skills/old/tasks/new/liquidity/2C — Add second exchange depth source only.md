Implement the next liquidity depth-source step: add one additional exchange depth source.

Goal:
Add a second exchange orderbook/depth source so liquidity is not limited to Binance only.

Preferred exchange:
Use Bybit first if it is simpler and has public depth snapshot + WebSocket depth stream support for BTCUSDT-style markets. If Bybit is not suitable in this codebase, use OKX and explain why.

Implement:
- New depth adapter for the selected exchange
- REST depth snapshot
- WebSocket depth stream
- normalization into existing OrderbookManager format
- depth source setting in the UI/settings store

Depth source options should become:
- Binance
- Bybit or OKX

Keep market type separate from exchange source:
- contract type = spot/futures
- depth source = Binance/Bybit/OKX

Do not combine exchanges yet.
Do not rebuild heatmap yet.
Do not change storage/MongoDB.
Do not change footprint/profile/candle logic.

Expected behavior:
- User can select depth source from settings.
- Binance depth still works.
- New exchange depth connects and renders liquidity through the existing overlay.
- If a selected exchange/market type is unsupported, show a safe fallback or disabled state instead of breaking the chart.

Validation:
- Select Binance depth and confirm it works.
- Select new exchange depth and confirm it connects.
- Confirm snapshot loads.
- Confirm live depth updates.
- Confirm changing depth source cleans up old subscription.
- Confirm no mixed data from old source remains.

Output:
- Explain selected exchange and why.
- List files changed.
- Confirm depth source setting works.
- Confirm old depth subscription cleanup works.
- Mention unsupported market limitations.