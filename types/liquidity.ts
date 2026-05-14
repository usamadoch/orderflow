export interface LiquidityZone {
  price:       number;       // center price of the zone
  totalQty:    number;       // total BTC quantity in this zone
  side:        'bid' | 'ask';
  zoneSize:    number;       // price range this zone covers (in $)
  intensity:   number;       // 0–1, scaled relative to largest zone visible
  levelCount:  number;       // how many individual levels were merged
}
