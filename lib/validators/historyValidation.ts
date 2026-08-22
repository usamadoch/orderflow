import {
  isAllowedContractType,
  isAllowedDataSourceMode,
  isAllowedSymbol,
  type MarketContractType,
} from '../config/markets'

export function normalizeTimeParam(value: number): number {
  if (!Number.isFinite(value)) return NaN
  return value < 10_000_000_000 ? value * 1000 : value
}

export function resolveContractTypes(
  marketSource: string | null,
  contractType: string | null,
  activeContractType: string | null,
): MarketContractType[] | null {
  const requestedSource = marketSource ?? contractType

  if (requestedSource === 'both') return ['spot', 'futures']

  if (requestedSource === 'active') {
    if (isAllowedContractType(activeContractType)) return [activeContractType]
    if (isAllowedContractType(contractType)) return [contractType]
    return null
  }

  if (isAllowedContractType(requestedSource)) return [requestedSource]

  return null
}

export function validateHistoryQueryParams(
  symbol: string | null,
  contractType: string | null,
  dataSourceMode?: string | null,
): boolean {
  if (!isAllowedSymbol(symbol)) return false
  if (contractType != null && !isAllowedContractType(contractType)) return false
  if (dataSourceMode != null && !isAllowedDataSourceMode(dataSourceMode)) return false
  return true
}
