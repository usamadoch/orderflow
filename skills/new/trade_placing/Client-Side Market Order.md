I have a chart on the web, and I want to implement the client-side market-order execution flow.

The system should only execute **market orders**. Do not implement pending, limit, or stop orders.

The chart already has a horizontal dotted line that follows the **current market price**. I want to use this line as the starting point for placing a trade.

When I **hover over or click the current-price line, whichever is simpler**, show a small interactive control similar to how TradingView provides draggable SL/TP controls.

The user should be able to:

1. Interact with the current-price line.
2. Drag the line downward or upward to define the **Stop Loss (SL) price**.
3. The dragged level should represent the exact SL price.
4. Dragging alone must **not send or execute an order**.
5. After the user finishes dragging, display a small **Confirm** button/control.
6. Only when the user explicitly clicks **Confirm** should the client send the order request to the local backend bridge.
7. The client should send only the information necessary for execution, primarily the **exact SL price**.

The client should **not calculate lot size, risk percentage, or position size**.

The EA will handle all of that.

The EA should receive:

- Market-order direction
- Exact SL price
- Any other minimal information required to complete the execution

The EA already has a default risk percentage, for example **1%**. Based on the current market price and the received SL price, the EA will calculate:

- Risk distance
- Appropriate lot size
- Position size
- SL
- TP

By default, the trade should have a **1R TP** so that it has a defined exit target. The client should still be able to manage the trade afterward.

The important execution flow is:

**Current Price → Drag SL → Release → Confirm → Send Request → Backend Bridge → EA → Calculate Lot Size → Execute Market Order**

Keep this implementation simple. The client should only be responsible for the interaction, selecting the SL price, confirmation, and sending the execution request. Do not add unnecessary order types or complex trading logic.
