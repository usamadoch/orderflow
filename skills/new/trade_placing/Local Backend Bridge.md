I need a small backend bridge script that I can run on **localhost** alongside my web application, which is also running locally.

The purpose of this script is to receive the market-order request from the web client and pass it to the EA.

The client will send the request only after the user confirms the order.

The request should contain the necessary information, including:

- Market-order direction
- Exact SL price

The backend does not need to calculate the lot size, percentage, or anything related to risk. The EA will handle that.

The backend should simply receive the request from the client and send it to the EA so the EA can execute the market order.

Keep this script small and simple because the only thing I care about right now is placing a **market order**.

Also, if it is easy to fetch the order and account information through the same bridge, such as:

- Total account balance
- Current balance
- Number of trades
- Current/open orders

we can support that as well. But if it makes the implementation unnecessarily complicated, we can ignore it for now.

The main purpose of this bridge is simply:

**Web Client → Local Backend Bridge → EA**