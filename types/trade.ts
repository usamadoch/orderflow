export interface Trade {
  time: number;
  price: number;
  quantity: number;
  isBuyerMaker: boolean; // false = aggressive buy, true = aggressive sell
}
