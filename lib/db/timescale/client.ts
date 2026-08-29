import { Pool } from 'pg'
import type { PoolClient, QueryResult, QueryResultRow } from 'pg'

let pool: Pool | null = null

export function getTimescalePool(): Pool {
  if (!pool) {
    const connectionString = process.env.TIMESCALEDB_URL || process.env.PG_URL
    if (!connectionString) {
      throw new Error('TIMESCALEDB_URL or PG_URL is required for the TimescaleDB driver')
    }

    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
    
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
    })

    pool.on('error', (err) => {
      console.error('[DB:Timescale] Unexpected error on idle client', err)
    })
  }

  return pool
}

export async function query<R extends QueryResultRow = any>(
  text: string,
  params?: any[]
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
