import { ProxyAgent, fetch as undiciFetch } from 'undici'
import { storeCandles } from '../db/timescale/repositories/candleRepository'
import type { CandleRow, StoreClosedCandleInput } from '../db/storageAdapter'
import type { Candle } from '../../types/candle'

let proxyAgentInstance: ProxyAgent | null = null
let lastConfiguredProxy: string | null = null

function getProxyAgent(): ProxyAgent | undefined {
  const proxyUrl = process.env.BINANCE_PROXY_URL || process.env.HTTPS_PROXY || process.env.HTTP_PROXY
  if (!proxyUrl) return undefined
  if (proxyAgentInstance && lastConfiguredProxy === proxyUrl) {
    return proxyAgentInstance
  }
  lastConfiguredProxy = proxyUrl
  proxyAgentInstance = new ProxyAgent(proxyUrl)
  return proxyAgentInstance
}

interface FetchBinanceCandlesOptions {
  symbol: string
  contractType: string
  timeframe: string
  since?: number
  until?: number
  limit: number
}

export async function fetchAndStoreBinanceCandles({
  symbol,
  contractType,
  timeframe,
  since = 0,
  until = 0,
  limit = 500,
}: FetchBinanceCandlesOptions): Promise<CandleRow[]> {
  const isFutures = contractType === 'futures'
  const baseUrl = isFutures
    ? 'https://fapi.binance.com/fapi/v1/klines'
    : 'https://api.binance.com/api/v3/klines'
  const batchLimit = isFutures ? 1500 : 1000
  const dispatcher = getProxyAgent()

  const boundedLimit = Math.max(1, Math.min(limit, 10080))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawKlines: any[][] = []
  let currentEndTime = until > 0 ? until * 1000 : undefined

  while (rawKlines.length < boundedLimit) {
    const fetchCount = Math.min(batchLimit, boundedLimit - rawKlines.length)
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      interval: timeframe,
      limit: String(fetchCount),
    })
    if (since > 0 && !currentEndTime) {
      params.set('startTime', String(since * 1000))
    }
    if (currentEndTime) {
      params.set('endTime', String(currentEndTime))
    }

    const url = `${baseUrl}?${params.toString()}`
    try {
      const res = await undiciFetch(url, { dispatcher })
      if (!res.ok) {
        console.warn(`[serverBinanceCandles] Binance responded with ${res.status} for ${symbol} ${timeframe}`)
        break
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await res.json()) as any[][]
      if (!Array.isArray(data) || data.length === 0) break

      // Newest batches first when walking backwards with endTime
      if (rawKlines.length === 0) {
        rawKlines = data
      } else {
        const oldestExistingTime = rawKlines[0][0]
        const older = data.filter((k) => k[0] < oldestExistingTime)
        if (older.length === 0) break
        rawKlines = [...older, ...rawKlines]
      }

      currentEndTime = data[0][0] - 1
      if (data.length < fetchCount) break // reached beginning of history
    } catch (err) {
      console.error(`[serverBinanceCandles] Fetch failed for ${symbol} ${timeframe}:`, err)
      break
    }
  }

  if (rawKlines.length === 0) {
    return []
  }

  const nowMs = Date.now()
  const storeInputs: StoreClosedCandleInput[] = []
  const rows: CandleRow[] = []

  rawKlines.forEach((k, idx) => {
    const openTimeSec = Math.floor(k[0] / 1000)
    const closeTimeSec = Math.floor(k[6] / 1000)
    const isClosed = k[6] < nowMs

    const candle: Candle = {
      time: openTimeSec,
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      tradeCount: parseInt(k[8], 10),
      isClosed,
    }

    if (isClosed) {
      storeInputs.push({
        symbol,
        contractType,
        dataSourceMode: contractType,
        timeframe,
        candle,
        cells: [],
        delta: 0,
        buyVol: 0,
        sellVol: 0,
      })
    }

    rows.push({
      id: idx + 1,
      symbol,
      timeframe,
      open_time: openTimeSec,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      trade_count: candle.tradeCount || 0,
      close_time: closeTimeSec,
      stored_at: Math.floor(nowMs / 1000),
    })
  })

  // Persist closed candles to TimescaleDB in chunks of 1000 asynchronously
  if (storeInputs.length > 0) {
    void (async () => {
      try {
        const CHUNK_SIZE = 1000
        for (let i = 0; i < storeInputs.length; i += CHUNK_SIZE) {
          const chunk = storeInputs.slice(i, i + CHUNK_SIZE)
          await storeCandles(chunk)
        }
        console.log(`[serverBinanceCandles] Persisted ${storeInputs.length} ${timeframe} candles for ${symbol} (${contractType}) to TimescaleDB`)
      } catch (err) {
        console.error(`[serverBinanceCandles] Failed to persist candles to TimescaleDB:`, err)
      }
    })()
  }

  return rows
}
