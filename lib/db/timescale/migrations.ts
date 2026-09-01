import { getTimescalePool } from './client'

export async function runTimescaleMigrations() {
  const pool = getTimescalePool()
  const client = await pool.connect()

  const retentionDays = process.env.MARKET_DATA_RETENTION_DAYS 
    ? parseInt(process.env.MARKET_DATA_RETENTION_DAYS, 10) 
    : 90
    
  const retentionInterval = `INTERVAL '${retentionDays} days'`
  // Compress data older than 7 days
  const compressionInterval = `INTERVAL '7 days'`

  try {
    await client.query('BEGIN')

    // 1. Candles
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_candles (
        time         TIMESTAMPTZ NOT NULL,
        symbol       TEXT NOT NULL,
        contract_type TEXT NOT NULL,
        timeframe    TEXT NOT NULL,
        open         DOUBLE PRECISION,
        high         DOUBLE PRECISION,
        low          DOUBLE PRECISION,
        close        DOUBLE PRECISION,
        volume       DOUBLE PRECISION,
        trade_count  INTEGER DEFAULT 0,
        close_time   TIMESTAMPTZ,
        stored_at    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (symbol, contract_type, timeframe, time)
      );
    `)
    await client.query(`SELECT create_hypertable('market_candles', 'time', if_not_exists => TRUE);`)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_candles_lookup 
      ON market_candles (symbol, contract_type, timeframe, time DESC);
    `)
    // Retention policy for candles (requires continuous aggregates to be handled carefully if added later)
    await client.query(`
      SELECT add_retention_policy('market_candles', ${retentionInterval}, if_not_exists => TRUE);
    `).catch(() => {}) // Catch if already exists and timescaledb version doesn't support if_not_exists fully
    
    // 2. Footprint Cells
    await client.query(`
      CREATE TABLE IF NOT EXISTS footprint_cells (
        time              TIMESTAMPTZ NOT NULL,
        symbol            TEXT NOT NULL,
        contract_type     TEXT NOT NULL,
        data_source_mode  TEXT NOT NULL,
        timeframe         TEXT NOT NULL,
        bucket_size       DOUBLE PRECISION NOT NULL,
        candle_time_sec   BIGINT NOT NULL,
        bucket_price      DOUBLE PRECISION NOT NULL,
        bid_vol           DOUBLE PRECISION DEFAULT 0,
        ask_vol           DOUBLE PRECISION DEFAULT 0,
        total_vol         DOUBLE PRECISION DEFAULT 0,
        delta             DOUBLE PRECISION DEFAULT 0,
        stored_at         TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (symbol, contract_type, data_source_mode, timeframe, bucket_size, time, bucket_price)
      );
    `)
    await client.query(`SELECT create_hypertable('footprint_cells', 'time', if_not_exists => TRUE);`)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_footprint_lookup
      ON footprint_cells (symbol, contract_type, data_source_mode, timeframe, bucket_size, time);
    `)
    await client.query(`
      SELECT add_retention_policy('footprint_cells', ${retentionInterval}, if_not_exists => TRUE);
    `).catch(() => {})

    // 3. Profile Rows
    await client.query(`
      CREATE TABLE IF NOT EXISTS profile_rows (
        time              TIMESTAMPTZ NOT NULL,
        symbol            TEXT NOT NULL,
        contract_type     TEXT NOT NULL,
        data_source_mode  TEXT NOT NULL,
        timeframe         TEXT NOT NULL,
        candle_time_sec   BIGINT NOT NULL,
        base_bucket_size  DOUBLE PRECISION NOT NULL,
        bucket_price NUMERIC NOT NULL,
        bid_vol NUMERIC NOT NULL DEFAULT 0,
        ask_vol NUMERIC NOT NULL DEFAULT 0,
        total_vol NUMERIC NOT NULL DEFAULT 0,
        trade_count NUMERIC NOT NULL DEFAULT 0,
        order_count NUMERIC NOT NULL DEFAULT 0,
        stored_at         TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (symbol, contract_type, data_source_mode, timeframe, base_bucket_size, time, bucket_price)
      );
    `)
    await client.query(`SELECT create_hypertable('profile_rows', 'time', if_not_exists => TRUE);`)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_profile_lookup
      ON profile_rows (symbol, contract_type, data_source_mode, timeframe, base_bucket_size, time);
    `)
    await client.query(`
      SELECT add_retention_policy('profile_rows', ${retentionInterval}, if_not_exists => TRUE);
    `).catch(() => {})

    // 4. Aggregate Bubbles
    await client.query(`
      CREATE TABLE IF NOT EXISTS aggregate_bubble_events (
        event_time          TIMESTAMPTZ NOT NULL,
        symbol              TEXT NOT NULL,
        contract_type       TEXT NOT NULL,
        aggregate_trade_id  BIGINT NOT NULL,
        event_time_ms       BIGINT NOT NULL,
        price               DOUBLE PRECISION NOT NULL,
        side                TEXT NOT NULL,
        volume              DOUBLE PRECISION NOT NULL,
        trade_count         INTEGER NOT NULL,
        first_trade_id      BIGINT NOT NULL,
        last_trade_id       BIGINT NOT NULL,
        qualified_by        TEXT[] DEFAULT '{}',
        min_volume_at_ingest      DOUBLE PRECISION DEFAULT 0,
        min_trade_count_at_ingest INTEGER DEFAULT 0,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (symbol, contract_type, aggregate_trade_id, event_time)
      );
    `)
    await client.query(`SELECT create_hypertable('aggregate_bubble_events', 'event_time', if_not_exists => TRUE);`)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_bubbles_restore
      ON aggregate_bubble_events (symbol, contract_type, event_time);
    `)
    // Deduplication index (needs event_time to be part of unique constraint for hypertables)
    // See the UNIQUE constraint above which includes event_time.
    await client.query(`
      SELECT add_retention_policy('aggregate_bubble_events', ${retentionInterval}, if_not_exists => TRUE);
    `).catch(() => {})

    // 5. Collector Meta (KV store, not a hypertable)
    await client.query(`
      CREATE TABLE IF NOT EXISTS collector_meta (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `)

    // 6. Compression policies — compress chunks older than 7 days
    for (const table of ['market_candles', 'footprint_cells', 'profile_rows', 'aggregate_bubble_events']) {
      await client.query(`
        ALTER TABLE ${table} SET (
          timescaledb.compress,
          timescaledb.compress_segmentby = 'symbol'
        );
      `).catch(() => {}) // Ignore if already set
      await client.query(`
        SELECT add_compression_policy('${table}', ${compressionInterval}, if_not_exists => TRUE);
      `).catch(() => {}) // Ignore if already set or not supported
    }

    // Schema updates for existing installations
    await client.query(`
      ALTER TABLE profile_rows 
      ADD COLUMN IF NOT EXISTS order_count NUMERIC NOT NULL DEFAULT 0;
    `).catch(() => {})

    await client.query('COMMIT')
    console.log('[DB:Timescale] Migrations and schema verification complete.')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[DB:Timescale] Migrations failed:', error)
    throw error
  } finally {
    client.release()
  }
}
