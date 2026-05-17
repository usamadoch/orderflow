export interface LiquidityZone {
  price:       number;       // center price of the zone
  totalQty:    number;       // total BTC quantity in this zone
  side:        'bid' | 'ask';
  zoneSize:    number;       // price range this zone covers (in $)
  intensity:   number;       // 0–1, scaled relative to largest zone visible
  levelCount:  number;       // how many individual levels were merged
}

// --- Historical Tracking (Level 2) ---

export interface SnapshotZone {
  price:    number;
  qty:      number;
  side:     'bid' | 'ask';
}

export interface LiquiditySnapshot {
  timestamp:    number;           // unix ms when this snapshot was taken
  candleTime:   number;           // which candle this snapshot belongs to
  zones:        SnapshotZone[];
}

export interface LiquidityHistory {
  snapshots:    LiquiditySnapshot[];    // ordered oldest → newest
  maxSnapshots: number;                 // cap, default 200
}

export interface LiquidityBehavior {
  peakQty:        number;    // maximum qty seen at this level
  currentQty:     number;    // qty in the most recent snapshot
  firstSeen:      number;    // index of first snapshot where qty > 0
  lastSeen:       number;    // index of last snapshot where qty > 0
  appearances:    number;    // how many snapshots had qty > 0
  wasPulled:      boolean;   // disappeared before price reached it
  wasConsumed:    boolean;   // disappeared as price traded through it
  ageScore:       number;    // 0–1, how old is this level (1 = oldest visible)
}

export interface HeatmapRow {
  price:        number;
  side:         'bid' | 'ask' | 'both';    // which side had liquidity here
  peakQty:      number;                    // highest qty ever seen at this level
  currentQty:   number;                    // qty in most recent snapshot (0 if gone)
  ageScore:     number;                    // 0–1, 1 = oldest, 0 = newest
  behavior:     LiquidityBehavior;         // from getLiquidityBehavior()
  intensity:    number;                    // 0–1, scaled against global peak
}
