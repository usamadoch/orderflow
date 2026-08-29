import { runTimescaleMigrations } from '../lib/db/timescale/migrations'

runTimescaleMigrations()
  .then(() => {
    console.log('Migrations finished.')
    process.exit(0)
  })
  .catch((err) => {
    console.error('Migrations failed:', err)
    process.exit(1)
  })
