import {
  getCandles,
  initDatabase,
  insertCandle,
} from '../lib/db/database'

async function test() {
  await initDatabase()
  console.log('Tables created')

  await insertCandle('BTCUSDT', '1m', {
    open_time: 1700000000,
    open: 40000,
    high: 40100,
    low: 39900,
    close: 40050,
    volume: 12.5,
    close_time: 1700000059,
  })

  const rows = await getCandles('BTCUSDT', '1m', 1699999999, 10)
  console.log('Candles:', rows)
}

test().catch((error) => {
  console.error(error)
  process.exit(1)
})
