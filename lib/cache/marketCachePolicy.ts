export const MARKET_CACHE_RETENTION_MINUTES = getNumberEnv(
  ['NEXT_PUBLIC_MARKET_CACHE_RETENTION_MINUTES', 'MARKET_CACHE_RETENTION_MINUTES'],
  360,
);

export const MARKET_CACHE_INACTIVE_GRACE_MS = getNumberEnv(
  ['NEXT_PUBLIC_MARKET_CACHE_INACTIVE_GRACE_MS', 'MARKET_CACHE_INACTIVE_GRACE_MS'],
  8 * 60 * 1000,
);

export const MARKET_CACHE_CLEANUP_INTERVAL_MS = getNumberEnv(
  ['NEXT_PUBLIC_MARKET_CACHE_CLEANUP_INTERVAL_MS', 'MARKET_CACHE_CLEANUP_INTERVAL_MS'],
  45 * 1000,
);

export const MARKET_CACHE_MAX_BASE_SLICES = getNumberEnv(
  ['NEXT_PUBLIC_MARKET_CACHE_MAX_BASE_SLICES', 'MARKET_CACHE_MAX_BASE_SLICES'],
  720,
);

export const MARKET_CACHE_MAX_FOOTPRINT_CELLS = getNumberEnv(
  ['NEXT_PUBLIC_MARKET_CACHE_MAX_FOOTPRINT_CELLS', 'MARKET_CACHE_MAX_FOOTPRINT_CELLS'],
  100_000,
);

export const MARKET_CACHE_MAX_PROFILE_ROWS = getNumberEnv(
  ['NEXT_PUBLIC_MARKET_CACHE_MAX_PROFILE_ROWS', 'MARKET_CACHE_MAX_PROFILE_ROWS'],
  150_000,
);

export const MARKET_CACHE_MAX_CANDLES = getNumberEnv(
  ['NEXT_PUBLIC_MARKET_CACHE_MAX_CANDLES', 'MARKET_CACHE_MAX_CANDLES'],
  500,
);

export function getRetentionCutoffSeconds(latestTimeSeconds: number) {
  return latestTimeSeconds - MARKET_CACHE_RETENTION_MINUTES * 60;
}

export function getCleanupTimestamp() {
  return Date.now();
}

function getNumberEnv(names: string[], fallback: number) {
  for (const name of names) {
    const value = process.env[name];
    if (value === undefined) continue;

    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return fallback;
}
