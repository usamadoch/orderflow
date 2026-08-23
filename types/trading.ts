export type TradingMode = 'binance_testnet' | 'binance_futures_testnet' | 'binance_live' | 'local_paper';

export type TradingModeBadge = 'testnet' | 'futures' | 'live' | 'paper';

export type TradingConnectionStatus = 'unknown' | 'connected' | 'degraded' | 'disconnected' | 'blocked';

export type TradingUserStreamStatus =
  | 'idle'
  | 'starting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'
  | 'blocked';

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit' | 'stop_market' | 'stop_limit';

export type OrderTimeInForce = 'GTC' | 'IOC' | 'FOK';

export type OrderContractType = 'spot' | 'futures';

export type OrderStatus =
  | 'pending'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'expired';

export interface OrderRequest {
  symbol: string;
  contractType?: OrderContractType;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  estimatedPrice?: number;
  stopPrice?: number;
  timeInForce?: OrderTimeInForce;
  clientOrderId?: string;
  reduceOnly?: boolean;
  /** Futures only — leverage multiplier (1-125). */
  leverage?: number;
  confirmed?: boolean;
}

export interface OrderCancelRequest {
  symbol: string;
  contractType?: OrderContractType;
  orderId?: string;
  clientOrderId?: string;
}

export interface OrderModifyRequest extends OrderCancelRequest {
  side: OrderSide;
  quantity: number;
  price: number;
  timeInForce?: OrderTimeInForce;
}

export interface TradeFill {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  price: number;
  quantity: number;
  fee?: number;
  feeAsset?: string;
  time: number;
}

export interface Order {
  id: string;
  clientOrderId?: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  filledQuantity: number;
  averagePrice?: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: OrderTimeInForce;
  createdAt: number;
  updatedAt?: number;
  fills?: TradeFill[];
}

export interface OrderResult {
  success: boolean;
  mode: TradingMode;
  order?: Order;
  errorMessage?: string;
  rejectedReason?: string;
}

export interface Position {
  symbol: string;
  side: 'long' | 'short' | 'flat';
  quantity: number;
  entryPrice?: number;
  markPrice?: number;
  unrealizedPnl?: number;
  leverage?: number;
  updatedAt?: number;
  /** Futures-native fields */
  liquidationPrice?: number;
  marginType?: 'cross' | 'isolated';
  /** Notional value of the position */
  notional?: number;
  /** Return on equity % */
  roe?: number;
}

/**
 * Virtual Position: client-side aggregation of filled spot trades into a
 * position-like abstraction. Binance Spot does not provide native positions,
 * so this is derived from trade history and account holdings.
 */
export interface VirtualPosition {
  id: string;
  symbol: string;
  /** 'long' for net-buy holdings, 'short' for net-sell. */
  side: 'long' | 'short';
  quantity: number;
  /** Weighted average entry price across all contributing fills. */
  entryPrice: number;
  /** Unrealised PnL calculated against latest market price (not persisted). */
  unrealizedPnl?: number;
  status: 'open' | 'closed';
  openedAt: number;
  updatedAt?: number;
  /** IDs of the fills that built this position, for reconciliation. */
  fillIds: string[];
}

/**
 * Bracket order attached to a VirtualPosition.
 * Kept separate so multiple TP targets, trailing stops, and partial exits
 * can be supported in later phases without breaking the Position model.
 */
export interface BracketOrder {
  id: string;
  positionId: string;
  symbol: string;
  /** Stop-loss price level. */
  stopLossPrice?: number;
  /** Take-profit price level. */
  takeProfitPrice?: number;
  stopLossStatus: 'none' | 'active' | 'triggered' | 'cancelled';
  takeProfitStatus: 'none' | 'active' | 'triggered' | 'cancelled';
  /** Binance order ID for the SL order once placed on exchange (Phase 4). */
  stopLossOrderId?: string;
  /** Binance order ID for the TP order once placed on exchange (Phase 4). */
  takeProfitOrderId?: string;
  updatedAt?: number;
}

/**
 * Drag state for SL/TP handles on the chart canvas.
 * Only one handle can be dragged at a time.
 */
export interface BracketDragState {
  positionId: string;
  handle: 'sl' | 'tp';
  previewPrice: number;
}

/**
 * State for dragging the current price line to define a Stop Loss for a new Market Order.
 */
export interface MarketOrderDragState {
  symbol: string;
  startPrice: number;
  slPrice: number;
  direction: 'buy' | 'sell';
}

export interface Balance {
  asset: string;
  free: number;
  locked: number;
  total: number;
  updatedAt?: number;
}

export interface AccountSnapshot {
  mode: TradingMode;
  connectionStatus: TradingConnectionStatus;
  checkedAt: string;
  balances: Balance[];
  positions: Position[];
  openOrders: Order[];
  recentTrades: TradeFill[];
}

export interface TradingUserStreamStatusPayload {
  mode: TradingMode;
  streamStatus: TradingUserStreamStatus;
  connected: boolean;
  reconnecting: boolean;
  lastEventAt: string | null;
  reconnectCount: number;
  lastErrorMessage: string | null;
  listenKeyActive: boolean;
  listenKeyLastKeepaliveAt: string | null;
  listenKeyExpiresAt: string | null;
  reconciliationLoading: boolean;
  lastReconciledAt: string | null;
  checkedAt: string;
}

export interface BrokerAdapter {
  mode: TradingMode;
  getAccountSnapshot(symbol?: string, recentTradesLimit?: number): Promise<AccountSnapshot>;
  getOpenOrders(): Promise<Order[]>;
  getPositions(): Promise<Position[]>;
  getBalances(): Promise<Balance[]>;
  getRecentTrades(symbol?: string, limit?: number): Promise<TradeFill[]>;
  placeOrder(request: OrderRequest): Promise<OrderResult>;
  cancelOrder(request: OrderCancelRequest): Promise<OrderResult>;
}

export interface BinanceServerTimeStatus {
  checked: boolean;
  ok: boolean;
  serverTime?: number;
  latencyMs?: number;
  errorMessage?: string;
}

export interface TradingHealthStatus {
  mode: TradingMode;
  modeBadge: TradingModeBadge;
  connectionStatus: TradingConnectionStatus;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  liveTradingEnabled: boolean;
  serverTime: BinanceServerTimeStatus;
  checkedAt: string;
  errorMessage?: string;
}

export interface TradingRiskStatusPayload {
  mode: TradingMode;
  modeBadge: TradingModeBadge;
  liveTradingEnabled: boolean;
  liveBlocked: boolean;
  killSwitchActive: boolean;
  requireConfirmation: boolean;
  riskConfigValid: boolean;
  maxOrderNotional: number;
  maxOrderQty: number;
  dailyOrderCountUsed: number;
  dailyOrderCountLimit: number;
  dailyEstimatedNotionalUsed: number;
  dailyLossUsed: number | null;
  dailyLossLimit: number;
  blockReasons: string[];
  lastRiskRejectionReason: string | null;
  counterStorage: 'memory';
  checkedAt: string;
}

export type PendingModifyOrder = {
  order: Order;
  originalPrice: number;
  newPrice: number;
  quantity: number;
};

export type TicketOrderType = Extract<OrderType, 'market' | 'limit'>;

export interface ValidationResult {
  messages: string[];
  liveBlocked: boolean;
}
