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
  normalizeFuturesBalance,
  normalizeOrder,
  normalizePosition,
  normalizeTradeFill,
  type BinanceOrderResponse,
  type BinanceTradeResponse,
  type FuturesAccountResponse,
  type FuturesBalance,
  type FuturesPositionRisk,
} from './tradingMappers'

export class BinanceFuturesBrokerAdapter implements BrokerAdapter {
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

  async getBalances(): Promise<Balance[]> {
    const response = await this.client.signedGet<FuturesAccountResponse>('/fapi/v2/account')
    const assets = Array.isArray(response.assets) ? response.assets : []
    const updatedAt = asNumber(response.updateTime)

    return assets
      .map((asset: unknown) => normalizeFuturesBalance(asset as FuturesBalance, updatedAt))
      .filter((b: Balance | null): b is Balance => Boolean(b))
      .filter((b: Balance) => b.total > 0)
  }

  async getPositions(): Promise<Position[]> {
    const response = await this.client.signedGet<FuturesPositionRisk[]>('/fapi/v2/positionRisk')
    const positions = Array.isArray(response) ? response : []
    return positions
      .map(normalizePosition)
      .filter((p): p is Position => Boolean(p))
      .filter((p) => p.side !== 'flat')
  }

  async getOpenOrders(): Promise<Order[]> {
    const response = await this.client.signedGet<BinanceOrderResponse[]>('/fapi/v1/openOrders')
    const orders = Array.isArray(response) ? response : []
    return orders.map(normalizeOrder).filter((o): o is Order => Boolean(o))
  }

  async getRecentTrades(symbol?: string, limit = 50): Promise<TradeFill[]> {
    if (!symbol) return []
    const boundedLimit = Math.min(1000, Math.max(1, Math.trunc(Number.isFinite(limit) ? limit : 50)))
    const response = await this.client.signedGet<BinanceTradeResponse[]>('/fapi/v1/userTrades', {
      symbol: symbol.toUpperCase(),
      limit: boundedLimit,
    })
    const trades = Array.isArray(response) ? response : []
    return trades.map(normalizeTradeFill).filter((t): t is TradeFill => Boolean(t))
  }

  async placeOrder(request: OrderRequest): Promise<OrderResult> {
    if (request.contractType === 'spot') {
      return createRejectedOrderResult(this.config.mode, 'Use the Spot adapter for spot orders.', 'wrong_adapter')
    }

    if (request.type !== 'market' && request.type !== 'limit') {
      return createRejectedOrderResult(this.config.mode, 'Only market and limit orders are supported.', 'unsupported_order_type')
    }

    if (request.leverage && Number.isFinite(request.leverage) && request.leverage >= 1) {
      try {
        await this.client.signedPost('/fapi/v1/leverage', {
          symbol: request.symbol.toUpperCase(),
          leverage: Math.round(request.leverage),
        })
      } catch {
        // Non-fatal leverage error
      }
    }

    const params: Record<string, string | number | undefined> = {
      symbol: request.symbol.toUpperCase(),
      side: request.side === 'buy' ? 'BUY' : 'SELL',
      type: request.type === 'market' ? 'MARKET' : 'LIMIT',
      quantity: request.quantity,
      newClientOrderId: request.clientOrderId,
      reduceOnly: request.reduceOnly === true ? 'true' : undefined,
    }

    if (request.type === 'limit') {
      params.price = request.price
      params.timeInForce = request.timeInForce ?? 'GTC'
    }

    const response = await this.client.signedPost<BinanceOrderResponse>('/fapi/v1/order', params)
    const order = normalizeOrder(response)

    return {
      success: Boolean(order),
      mode: this.config.mode,
      order: order ?? undefined,
      errorMessage: order ? undefined : 'Futures order response could not be normalized.',
      rejectedReason: order ? undefined : 'order_response_normalization_failed',
    }
  }

  async cancelOrder(request: OrderCancelRequest): Promise<OrderResult> {
    const response = await this.client.signedDelete<BinanceOrderResponse>('/fapi/v1/order', {
      symbol: request.symbol.toUpperCase(),
      orderId: request.orderId,
      origClientOrderId: request.clientOrderId,
    })
    const order = normalizeOrder(response)

    return {
      success: Boolean(order),
      mode: this.config.mode,
      order: order ?? undefined,
      errorMessage: order ? undefined : 'Futures cancel response could not be normalized.',
      rejectedReason: order ? undefined : 'cancel_response_normalization_failed',
    }
  }
}

export function createBinanceFuturesBrokerAdapter(config: BinanceTradingConfig): BrokerAdapter {
  return new BinanceFuturesBrokerAdapter(config)
}
