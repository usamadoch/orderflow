# Pi Deployment

Use the production Next.js server for 24/7 Raspberry Pi operation.

```bash
npm install -g pm2
pnpm build
pm2 start "pnpm start" --name orderflow-app
pm2 save
pm2 startup
```

Run the exact command printed by `pm2 startup`; it depends on the Pi user and Node.js path.

After code changes:

```bash
pnpm build && pm2 restart orderflow-app
```

Useful checks:

```bash
pm2 status
pm2 logs orderflow-app --lines 500
pm2 monit
```

Use production database settings on the Pi:

```bash
TURSO_DATABASE_URL=file:./data/market.db
DB_RETENTION_HOURS=48
NODE_ENV=production
```
