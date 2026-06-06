Implement the next liquidity architecture step: depth source abstraction plus Binance futures depth support.

Goal:
Separate orderbook/depth source from the current spot-only Binance depth implementation, and support Binance futures depth when the selected market/contract type is futures.

Current issue:
Liquidity/orderbook currently uses Binance spot depth only, even when chart candles/trades are futures. This can make liquidity misleading.

Implement:

1. Depth source abstraction
Create a clean depth/orderbook adapter interface for:
- fetch orderbook snapshot
- subscribe depth stream
- normalize depth updates into the existing OrderbookManager format

Keep it simple and compatible with the existing OrderbookManager.

2. Binance spot depth adapter
Move/route current Binance spot depth behavior through the new depth adapter abstraction.

3. Binance futures depth adapter
Add Binance futures orderbook support:
- futures REST depth snapshot
- futures depth WebSocket stream
- normalized update format matching existing orderbook update handling

4. Settings/routing
Depth source should follow selected contract type for now:
- spot chart → Binance spot depth
- futures chart → Binance futures depth

Do not add Bybit/OKX yet.
Do not add combined exchange depth yet.
Do not rebuild the heatmap engine yet.
Do not change MongoDB/storage.
Do not change footprint/profile/candle logic.

Expected behavior:
- Spot chart uses Binance spot orderbook.
- Futures chart uses Binance futures orderbook.
- Existing liquidity overlay still renders, but now from the correct depth source.
- No spot-depth data should be shown on a futures chart unless explicitly selected later.

Validation:
- Open spot chart and confirm spot depth connects.
- Switch to futures chart and confirm futures depth connects.
- Confirm orderbook snapshot loads for both.
- Confirm depth stream updates for both.
- Confirm liquidity zones still render.
- Confirm no duplicate depth subscriptions when not needed.

Output:
- Explain files changed.
- Confirm depth adapter abstraction exists.
- Confirm Binance spot depth still works.
- Confirm Binance futures depth works.
- Confirm depth source follows contract type.