import 'server-only'

import type {
  AccountSnapshot,
  Balance,
  Order,
  Position,
  TradeFill,
  TradingUserStreamStatus,
  TradingUserStreamStatusPayload,
} from '../../types/trading'
import type { BinanceTradingConfig } from './config'
import { createBinanceBrokerAdapter } from './binanceAdapter'
import { createBinanceFuturesBrokerAdapter } from './binanceFuturesAdapter'
import {
  asNumber,
  asString,
  createListenKey,
  getFillKey,
  keepaliveListenKey,
  normalizeExecutionReportFill,
  normalizeExecutionReportOrder,
  normalizeStreamBalance,
  parseEvent,
  safeErrorMessage,
  type BinanceExecutionReport,
  type UnknownRecord,
} from './userStreamClient'

function createAdapter(config: BinanceTradingConfig) {
  return config.isFutures
    ? createBinanceFuturesBrokerAdapter(config)
    : createBinanceBrokerAdapter(config)
}

const KEEPALIVE_INTERVAL_MS = 30 * 60 * 1000
const LISTEN_KEY_TTL_MS = 60 * 60 * 1000
const MAX_RECONNECT_DELAY_MS = 30_000
const MAX_RECENT_TRADES = 200

interface StartOptions {
  symbol?: string
  recentTradesLimit?: number
}

export class BinanceUserDataStreamManager {
  private socket: WebSocket | null = null
  private listenKey: string | null = null
  private listenKeyCreatedAt: number | null = null
  private listenKeyLastKeepaliveAt: number | null = null
  private keepaliveTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectCount = 0
  private connectionGeneration = 0
  private startingPromise: Promise<void> | null = null
  private streamStatus: TradingUserStreamStatus = 'idle'
  private lastEventAt: string | null = null
  private lastErrorMessage: string | null = null
  private reconciliationLoading = false
  private lastReconciledAt: string | null = null
  private lastOptions: StartOptions = {}
  private balances: Balance[] = []
  private openOrders: Order[] = []
  private positions: Position[] = []
  private recentTrades: TradeFill[] = []

  constructor(private readonly config: BinanceTradingConfig) {}

  async ensureStarted(options: StartOptions = {}) {
    this.lastOptions = {
      symbol: options.symbol ?? this.lastOptions.symbol,
      recentTradesLimit: options.recentTradesLimit ?? this.lastOptions.recentTradesLimit,
    }

    if (this.streamStatus === 'connected' || this.streamStatus === 'starting' || this.streamStatus === 'reconnecting') {
      if (this.startingPromise) await this.startingPromise
      return
    }

    this.startingPromise = this.start()
    try {
      await this.startingPromise
    } finally {
      this.startingPromise = null
    }
  }

  async reconcile(symbol = this.lastOptions.symbol, recentTradesLimit = this.lastOptions.recentTradesLimit) {
    this.lastOptions = {
      symbol: symbol ?? this.lastOptions.symbol,
      recentTradesLimit: recentTradesLimit ?? this.lastOptions.recentTradesLimit,
    }
    this.reconciliationLoading = true

    try {
      const adapter = createAdapter(this.config)
      const snapshot = await adapter.getAccountSnapshot(symbol, recentTradesLimit)
      this.applySnapshot(snapshot)
      this.lastErrorMessage = null
      return snapshot
    } catch (error) {
      this.lastErrorMessage = safeErrorMessage(error, 'Binance account stream reconciliation failed.')
      throw error
    } finally {
      this.reconciliationLoading = false
    }
  }

  getStatus(): TradingUserStreamStatusPayload {
    const listenKeyExpiresAt = this.listenKeyCreatedAt
      ? new Date(this.listenKeyCreatedAt + LISTEN_KEY_TTL_MS).toISOString()
      : null

    return {
      mode: this.config.mode,
      streamStatus: this.streamStatus,
      connected: this.isSocketOpen(),
      reconnecting: this.streamStatus === 'reconnecting',
      lastEventAt: this.lastEventAt,
      reconnectCount: this.reconnectCount,
      lastErrorMessage: this.lastErrorMessage,
      listenKeyActive: Boolean(this.listenKey),
      listenKeyLastKeepaliveAt: this.listenKeyLastKeepaliveAt
        ? new Date(this.listenKeyLastKeepaliveAt).toISOString()
        : null,
      listenKeyExpiresAt,
      reconciliationLoading: this.reconciliationLoading,
      lastReconciledAt: this.lastReconciledAt,
      checkedAt: new Date().toISOString(),
    }
  }

  getSnapshot(): AccountSnapshot {
    return {
      mode: this.config.mode,
      connectionStatus: this.isSocketOpen() ? 'connected' : 'degraded',
      checkedAt: this.lastReconciledAt ?? new Date().toISOString(),
      balances: this.balances,
      positions: this.positions,
      openOrders: this.openOrders,
      recentTrades: this.recentTrades,
    }
  }

  stop() {
    this.connectionGeneration += 1
    this.clearTimer('keepalive')
    this.clearTimer('reconnect')
    this.closeSocket()
    this.listenKey = null
    this.listenKeyCreatedAt = null
    this.listenKeyLastKeepaliveAt = null
    this.streamStatus = 'disconnected'
  }

  private async start() {
    if (!this.config.restBaseUrl || !this.config.userStreamWsBaseUrl) {
      this.streamStatus = 'blocked'
      this.lastErrorMessage = 'Binance user data stream is not configured for this trading mode.'
      return
    }

    if (!this.config.apiKey || !this.config.apiSecret) {
      this.streamStatus = 'error'
      this.lastErrorMessage = 'Binance API key and secret are required to start the user data stream.'
      return
    }

    if (typeof WebSocket === 'undefined') {
      this.streamStatus = 'error'
      this.lastErrorMessage = 'WebSocket is not available in this server runtime.'
      return
    }

    this.streamStatus = this.reconnectCount > 0 ? 'reconnecting' : 'starting'
    this.closeSocket()

    try {
      this.listenKey = await createListenKey(this.config)
      this.listenKeyCreatedAt = Date.now()
      this.listenKeyLastKeepaliveAt = null
      this.scheduleKeepalive()
      this.connectSocket(this.listenKey)
      await this.reconcile(this.lastOptions.symbol, this.lastOptions.recentTradesLimit).catch(() => undefined)
    } catch (error) {
      this.lastErrorMessage = safeErrorMessage(error, 'Binance user data stream start failed.')
      this.streamStatus = 'error'
      this.scheduleReconnect()
    }
  }

  private connectSocket(listenKey: string) {
    const generation = ++this.connectionGeneration
    const socket = new WebSocket(`${this.config.userStreamWsBaseUrl}/${encodeURIComponent(listenKey)}`)
    this.socket = socket

    socket.onopen = () => {
      if (generation !== this.connectionGeneration) return
      this.streamStatus = 'connected'
      this.lastErrorMessage = null
    }

    socket.onmessage = (event) => {
      if (generation !== this.connectionGeneration) return
      this.handleMessage(event.data)
    }

    socket.onerror = () => {
      if (generation !== this.connectionGeneration) return
      this.lastErrorMessage = 'Binance user data stream WebSocket error.'
      this.streamStatus = 'reconnecting'
    }

    socket.onclose = () => {
      if (generation !== this.connectionGeneration) return
      if (this.streamStatus !== 'disconnected') {
        this.streamStatus = 'reconnecting'
        this.scheduleReconnect()
      }
    }
  }

  private async keepalive() {
    if (!this.listenKey) return
    try {
      await keepaliveListenKey(this.config, this.listenKey)
      this.listenKeyLastKeepaliveAt = Date.now()
      this.scheduleKeepalive()
    } catch (error) {
      this.lastErrorMessage = safeErrorMessage(error, 'Binance user data stream keepalive failed.')
      this.streamStatus = 'reconnecting'
      this.scheduleReconnect(true)
    }
  }

  private handleMessage(data: unknown) {
    const event = parseEvent(data)
    if (!event) return

    const eventType = typeof event.e === 'string' ? event.e : null
    const eventTime = asNumber(event.E) ?? Date.now()
    this.lastEventAt = new Date(eventTime).toISOString()

    if (eventType === 'outboundAccountPosition') {
      this.mergeAccountPosition(event, eventTime)
      return
    }

    if (eventType === 'balanceUpdate') {
      this.mergeBalanceUpdate(event, eventTime)
      return
    }

    if (eventType === 'executionReport') {
      this.mergeExecutionReport(event as BinanceExecutionReport, eventTime)
      return
    }

    if (eventType === 'listenKeyExpired') {
      this.lastErrorMessage = 'Binance user data stream listenKey expired.'
      this.streamStatus = 'reconnecting'
      this.scheduleReconnect(true)
    }
  }

  private mergeAccountPosition(event: UnknownRecord, eventTime: number) {
    const balances = Array.isArray(event.B) ? event.B : []
    for (const rawBalance of balances) {
      if (!rawBalance || typeof rawBalance !== 'object') continue
      const balance = normalizeStreamBalance(rawBalance as UnknownRecord, eventTime)
      if (!balance) continue
      this.upsertBalance(balance)
    }
  }

  private mergeBalanceUpdate(event: UnknownRecord, eventTime: number) {
    const asset = asString(event.a)
    const delta = asNumber(event.d)
    if (!asset || delta === undefined) return

    const existing = this.balances.find((balance) => balance.asset === asset)
    const free = Math.max(0, (existing?.free ?? 0) + delta)
    const locked = existing?.locked ?? 0
    this.upsertBalance({
      asset,
      free,
      locked,
      total: free + locked,
      updatedAt: asNumber(event.T) ?? eventTime,
    })
  }

  private mergeExecutionReport(event: BinanceExecutionReport, eventTime: number) {
    const order = normalizeExecutionReportOrder(event, eventTime)
    if (order) {
      if (order.status === 'open' || order.status === 'partially_filled' || order.status === 'pending') {
        this.upsertOrder(order)
      } else {
        this.openOrders = this.openOrders.filter((existing) => existing.id !== order.id)
      }
    }

    const fill = normalizeExecutionReportFill(event, eventTime)
    if (fill) {
      this.upsertFill(fill)
    }
  }

  private upsertBalance(balance: Balance) {
    const byAsset = new Map(this.balances.map((existing) => [existing.asset, existing]))
    byAsset.set(balance.asset, balance)
    this.balances = Array.from(byAsset.values())
      .filter((entry) => entry.total > 0)
      .sort((a, b) => a.asset.localeCompare(b.asset))
  }

  private upsertOrder(order: Order) {
    const byId = new Map(this.openOrders.map((existing) => [existing.id, existing]))
    byId.set(order.id, order)
    this.openOrders = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  private upsertFill(fill: TradeFill) {
    const byId = new Map(this.recentTrades.map((existing) => [getFillKey(existing), existing]))
    byId.set(getFillKey(fill), fill)
    this.recentTrades = Array.from(byId.values())
      .sort((a, b) => b.time - a.time)
      .slice(0, MAX_RECENT_TRADES)
  }

  private applySnapshot(snapshot: AccountSnapshot) {
    this.balances = snapshot.balances
    this.openOrders = snapshot.openOrders
    this.positions = snapshot.positions
    this.recentTrades = snapshot.recentTrades
    this.lastReconciledAt = snapshot.checkedAt
  }

  private scheduleKeepalive() {
    this.clearTimer('keepalive')
    this.keepaliveTimer = setTimeout(() => {
      void this.keepalive()
    }, KEEPALIVE_INTERVAL_MS)
  }

  private scheduleReconnect(recreateListenKey = false) {
    this.clearTimer('reconnect')
    this.clearTimer('keepalive')
    this.closeSocket()
    if (recreateListenKey) {
      this.listenKey = null
      this.listenKeyCreatedAt = null
      this.listenKeyLastKeepaliveAt = null
    }

    this.reconnectCount += 1
    const delay = Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** Math.min(5, this.reconnectCount - 1))
    this.reconnectTimer = setTimeout(() => {
      this.startingPromise = this.start()
      void this.startingPromise.finally(() => {
        this.startingPromise = null
      })
    }, delay)
  }

  private closeSocket() {
    const socket = this.socket
    this.socket = null
    if (!socket) return

    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      socket.close()
    }
  }

  private clearTimer(name: 'keepalive' | 'reconnect') {
    const timer = name === 'keepalive' ? this.keepaliveTimer : this.reconnectTimer
    if (timer) clearTimeout(timer)
    if (name === 'keepalive') {
      this.keepaliveTimer = null
    } else {
      this.reconnectTimer = null
    }
  }

  private isSocketOpen() {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN && this.streamStatus === 'connected')
  }
}

let streamManager: BinanceUserDataStreamManager | null = null
let streamManagerKey: string | null = null

export function getBinanceUserDataStreamManager(config: BinanceTradingConfig) {
  const key = [
    config.mode,
    config.restBaseUrl,
    config.userStreamWsBaseUrl,
    Boolean(config.apiKey),
    Boolean(config.apiSecret),
  ].join('|')

  if (!streamManager || streamManagerKey !== key) {
    streamManager?.stop()
    streamManager = new BinanceUserDataStreamManager(config)
    streamManagerKey = key
  }

  return streamManager
}
