import pg from 'pg'

const pool = new pg.Pool({
  connectionString: process.env.PG_URL,
  ssl: { rejectUnauthorized: false }
})

pool.query('SELECT NOW()')
  .then(res => {
    console.log('Connected successfully:', res.rows)
    process.exit(0)
  })
  .catch(err => {
    console.error('Connection failed:', err)
    process.exit(1)
  })
