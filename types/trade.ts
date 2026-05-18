export interface Trade {
  id?: number;
  time: number;
  price: number;
  quantity: number;
  isBuyerMaker: boolean; // false = aggressive buy, true = aggressive sell
}
