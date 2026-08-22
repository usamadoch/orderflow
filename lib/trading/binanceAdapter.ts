import 'server-only'

import type {
  AccountSnapshot,
  Balance,
  BrokerAdapter,
  Order,
  OrderCancelRequest,
  OrderRequest,
  OrderResult,
  Position,
  TradeFill,
} from '../../types/trading'
import type { BinanceTradingConfig } from './config'
import { BinanceRestClient } from './binanceRestClient'
import {
  asNumber,
  createRejectedOrderResult,
  getUnsupportedExecutionReason,
  normalizeBalance,
  normalizeOrder,
  normalizeTradeFill,
  type BinanceAccountResponse,
  type BinanceBalance,
  type BinanceOrderResponse,
  type BinanceTradeResponse,
} from './tradingMappers'

export class BinanceBrokerAdapter implements BrokerAdapter {
  mode: BinanceTradingConfig['mode']
  private readonly client: BinanceRestClient

  constructor(private readonly config: BinanceTradingConfig) {
    this.mode = config.mode
    this.client = new BinanceRestClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      restBaseUrl: config.restBaseUrl,
      serverTimeUrl: config.serverTimeUrl,
    })
  }

  async getAccountSnapshot(symbol?: string, recentTradesLimit?: number): Promise<AccountSnapshot> {
    const [balances, openOrders, positions, recentTrades] = await Promise.all([
      this.getBalances(),
      this.getOpenOrders(),
      this.getPositions(),
      symbol ? this.getRecentTrades(symbol, recentTradesLimit) : Promise.resolve([]),
    ])

    return {
      mode: this.config.mode,
      connectionStatus: 'connected',
      checkedAt: new Date().toISOString(),
      balances,
      positions,
      openOrders,
      recentTrades,
    }
  }

  async getOpenOrders(): Promise<Order[]> {
    const response = await this.client.signedGet<BinanceOrderResponse[]>('/api/v3/openOrders')
    const normalized = response.map(normalizeOrder)
    return normalized.filter((order): order is Order => Boolean(order))
  }

  async getPositions(): Promise<Position[]> {
    return []
  }

  async getBalances(): Promise<Balance[]> {
    const response = await this.client.signedGet<BinanceAccountResponse>('/api/v3/account')
    const balances = Array.isArray(response.balances) ? response.balances : []
    const updatedAt = asNumber(response.updateTime)

    return balances
      .map((balance: unknown) => normalizeBalance(balance as BinanceBalance, updatedAt))
      .filter((balance: Balance | null): balance is Balance => Boolean(balance))
      .filter((balance: Balance) => balance.total > 0)
  }

  async getRecentTrades(symbol?: string, limit = 50): Promise<TradeFill[]> {
    if (!symbol) return []

    const normalizedLimit = Number.isFinite(limit) ? Math.trunc(limit) : 50
    const boundedLimit = Math.min(1000, Math.max(1, normalizedLimit))
    const response = await this.client.signedGet<BinanceTradeResponse[]>('/api/v3/myTrades', {
      symbol: symbol.toUpperCase(),
      limit: boundedLimit,
    })

    return response.map(normalizeTradeFill).filter((fill): fill is TradeFill => Boolean(fill))
  }

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    const unsupportedReason = getUnsupportedExecutionReason(this.config.mode, request.contractType)
    if (unsupportedReason) {
      return createRejectedOrderResult(this.config.mode, unsupportedReason.message, unsupportedReason.reason)
    }

    if (request.reduceOnly) {
      return createRejectedOrderResult(this.config.mode, 'Reduce-only is only supported for futures orders.', 'reduce_only_not_supported_for_spot')
    }

    if (request.type !== 'market' && request.type !== 'limit') {
      return createRejectedOrderResult(this.config.mode, 'Only market and limit orders are supported.', 'unsupported_order_type')
    }

    const params: Record<string, string | number | undefined> = {
      symbol: request.symbol.toUpperCase(),
      side: request.side === 'buy' ? 'BUY' : 'SELL',
      type: request.type === 'market' ? 'MARKET' : 'LIMIT',
      quantity: request.quantity,
      newClientOrderId: request.clientOrderId,
      newOrderRespType: 'RESULT',
    }

    if (request.type === 'limit') {
      params.price = request.price
      params.timeInForce = request.timeInForce ?? 'GTC'
    }

    const response = await this.client.signedPost<BinanceOrderResponse>('/api/v3/order', params)
    const order = normalizeOrder(response)

    return {
      success: Boolean(order),
      mode: this.config.mode,
      order: order ?? undefined,
      errorMessage: order ? undefined : 'Binance order response could not be normalized.',
      rejectedReason: order ? undefined : 'order_response_normalization_failed',
    }
  }

  async cancelOrder(request: OrderCancelRequest): Promise<OrderResult> {
    const unsupportedReason = getUnsupportedExecutionReason(this.config.mode, request.contractType)
    if (unsupportedReason) {
      return createRejectedOrderResult(this.config.mode, unsupportedReason.message, unsupportedReason.reason)
    }

    const response = await this.client.signedDelete<BinanceOrderResponse>('/api/v3/order', {
      symbol: request.symbol.toUpperCase(),
      orderId: request.orderId,
      origClientOrderId: request.clientOrderId,
    })
    const order = normalizeOrder(response)

    return {
      success: Boolean(order),
      mode: this.config.mode,
      order: order ?? undefined,
      errorMessage: order ? undefined : 'Binance cancel response could not be normalized.',
      rejectedReason: order ? undefined : 'cancel_response_normalization_failed',
    }
  }
}

export function createBinanceBrokerAdapter(config: BinanceTradingConfig): BrokerAdapter {
  return new BinanceBrokerAdapter(config)
}
