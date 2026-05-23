export const ALLOWED_SYMBOLS = ['BTCUSDT', 'ETHUSDT'] as const
export const ALLOWED_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h'] as const

export type AllowedSymbol = (typeof ALLOWED_SYMBOLS)[number]
export type AllowedTimeframe = (typeof ALLOWED_TIMEFRAMES)[number]
export type MarketContractType = 'spot' | 'futures'
export type MarketDataSourceMode = 'spot' | 'futures' | 'both'
export const FINE_PROFILE_STORAGE_TIMEFRAME = '1m'

export function isAllowedSymbol(symbol: string | null): symbol is AllowedSymbol {
  return ALLOWED_SYMBOLS.includes(symbol as AllowedSymbol)
}

export function isAllowedTimeframe(timeframe: string | null): timeframe is AllowedTimeframe {
  return ALLOWED_TIMEFRAMES.includes(timeframe as AllowedTimeframe)
}

export function isAllowedContractType(contractType: string | null): contractType is MarketContractType {
  return contractType === 'spot' || contractType === 'futures'
}

export function isAllowedDataSourceMode(mode: string | null): mode is MarketDataSourceMode {
  return mode === 'spot' || mode === 'futures' || mode === 'both'
}
