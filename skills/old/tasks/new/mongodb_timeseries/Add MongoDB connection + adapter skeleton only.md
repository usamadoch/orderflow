Implement only the MongoDB storage foundation. Do not migrate actual market data writes yet.

Goal:
Add MongoDB connection support and a storage adapter skeleton behind an environment flag, while keeping current libSQL behavior as default.

Important constraints:
- Do not replace libSQL yet.
- Do not change chart behavior.
- Do not change feed/cache behavior.
- Do not migrate candles/footprint/profile writes in this task.
- Do not remove existing DB code.
- Current app must continue working with MARKET_DB_DRIVER=libsql or no env flag.

Implement:

1. MongoDB connection module
Add something like:
lib/db/mongo/client.ts

Support env vars:
- MONGODB_URI
- MONGODB_DB_NAME
- MARKET_DB_DRIVER=mongodb

Connection should be singleton-safe for Next.js/dev reload.

2. Storage adapter abstraction
Create a common adapter layer, for example:
lib/db/storageAdapter.ts

It should expose the storage methods currently needed by the app, but initially can delegate all existing methods to libSQL.

3. MongoDB adapter skeleton
Create:
lib/db/mongo/marketStorageMongo.ts

Add placeholder/skeleton methods for:
- write candles
- read candles
- write footprint rows
- read footprint rows
- write profile rows
- read profile rows
- write candle delta if needed
- collector/meta methods if needed

Do not wire market data writes to Mongo yet unless the method is safely unused/test-only.

4. Driver selector
Add a small selector:
- if MARKET_DB_DRIVER=mongodb use Mongo adapter
- otherwise use existing libSQL adapter

But keep libSQL as default and make sure app behavior is unchanged.

5. Optional health/debug
Add a simple dev-only function or log to verify Mongo connection when enabled.

Validation:
- With no Mongo env vars, app works exactly as before.
- TypeScript passes.
- Lint passes.
- If MONGODB_URI is provided and MARKET_DB_DRIVER=mongodb, connection can be initialized without changing runtime market writes yet.

Output:
1. Explain files changed.
2. Confirm libSQL remains default.
3. Confirm MongoDB is behind env flag.
4. Confirm no market-data write path was migrated yet.
5. Mention how to test Mongo connection.