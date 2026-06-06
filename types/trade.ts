export interface Trade {
  id?: number;
  firstTradeId?: number;
  lastTradeId?: number;
  time: number;
  price: number;
  quantity: number;
  isBuyerMaker: boolean; // false = aggressive buy, true = aggressive sell
}
