I need an **MT5 EA script** that completes the market-order execution flow.

The system should only execute **market orders** for now.

The EA will receive information from the backend bridge, including:

- Market-order direction
- Exact SL price

Once the EA receives the request, it should use the **current market price at that moment** and calculate everything required to place the trade.

The EA should have a default risk percentage of **1%**.

Based on the current market price and the SL price received from the client, the EA should calculate:

- How far the SL is from the current market price
- The appropriate lot size
- The position size
- The required risk based on the configured percentage

The EA should then place the market order very quickly.

The SL should be the exact SL price received from the client.

For the TP, use **1R by default**, so there is a defined TP and the trade can end either at the SL or TP. The client can manage the trade afterward.

The important part is that the **EA calculates the lot size and risk itself**. The web client only provides the SL price and order direction.

The basic flow is:

**Backend Request → EA Receives Request → Get Current Market Price → Calculate Lot Size Based on 1% Risk + SL → Set SL → Set 1R TP → Execute Market Order**

If it is simple to support fetching account/order information as well, such as account balance or the number of current trades, we can include that. Otherwise, ignore it for now.

The main concern right now is simply **reliably placing the market trade with the correct SL, calculated lot size, and default 1R TP**.