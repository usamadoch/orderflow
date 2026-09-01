import { Pool } from 'pg'
import type { PoolClient, QueryResult, QueryResultRow } from 'pg'

// Cache the pool globally to prevent exhaustion during serverless cold starts
// as each hot function should reuse the same pool.
const globalPool = globalThis as unknown as { _timescalePool?: Pool }

export function getTimescalePool(): Pool {
  if (!globalPool._timescalePool) {
    const connectionString = process.env.TIMESCALEDB_URL || process.env.PG_URL
    if (!connectionString) {
      throw new Error('TIMESCALEDB_URL or PG_URL is required for the TimescaleDB driver')
    }

    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    
    globalPool._timescalePool = new Pool({
      connectionString,
      // Keep max low in serverless so concurrent lambdas don't overwhelm DB limits
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
    })

    globalPool._timescalePool.on('error', (err) => {
      console.error('[DB:Timescale] Unexpected error on idle client', err)
    })
  }

  return globalPool._timescalePool
}

export type QueryParam = string | number | boolean | Date | null | Buffer | QueryParam[]

export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: QueryParam[]
): Promise<QueryResult<R>> {
  const p = getTimescalePool()
  return p.query<R>(text, params)
}

export async function getTimescaleClient(): Promise<PoolClient> {
  const p = getTimescalePool()
  return p.connect()
}

export async function verifyTimescaleConnection() {
  try {
    const result = await query('SELECT 1 as ok')
    return { ok: result.rows[0].ok === 1 }
  } catch (error) {
    console.error('[DB:Timescale] Connection verification failed', error)
    return { ok: false, error }
  }
}
