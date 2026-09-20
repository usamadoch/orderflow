import { query } from '../lib/db/timescale/client';

async function run() {
  console.log('Running diagnostics...');

  try {
    const candlesQuery = `EXPLAIN ANALYZE SELECT * FROM market_candles WHERE symbol = 'BTCUSDT' AND contract_type = 'spot' AND timeframe = '1m' ORDER BY time DESC LIMIT 10080`;
    console.log('\n--- Candles ---');
    const candlesRes = await query(candlesQuery, []);
    candlesRes.rows.forEach(r => console.log(r['QUERY PLAN']));
  } catch (e) {
    console.error('Error on candles:', e);
  }

  try {
    const profileQuery = `EXPLAIN ANALYZE SELECT * FROM profile_rows WHERE symbol = 'BTCUSDT' AND contract_type = 'spot' AND data_source_mode = 'live' AND timeframe = '1m' AND base_bucket_size = 1.5 ORDER BY time DESC LIMIT 2500`;
    console.log('\n--- Profile ---');
    const profileRes = await query(profileQuery, []);
    profileRes.rows.forEach(r => console.log(r['QUERY PLAN']));
  } catch (e) {
    console.error('Error on profile:', e);
  }

  try {
    const footprintQuery = `EXPLAIN ANALYZE SELECT * FROM footprint_cells WHERE symbol = 'BTCUSDT' AND contract_type = 'spot' AND data_source_mode = 'live' AND timeframe = '1m' AND bucket_size = 5 ORDER BY time DESC LIMIT 2000`;
    console.log('\n--- Footprint ---');
    const footprintRes = await query(footprintQuery, []);
    footprintRes.rows.forEach(r => console.log(r['QUERY PLAN']));
  } catch (e) {
    console.error('Error on footprint:', e);
  }

  process.exit(0);
}

run();
