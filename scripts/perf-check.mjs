import { performance } from 'node:perf_hooks';

const BASE_URL = 'http://localhost:3000/api';
const TIMEOUT_MS = 5000;

async function checkEndpoint(name, url) {
  console.log(`Checking ${name}...`);
  const start = performance.now();
  
  try {
    const res = await fetch(url);
    const end = performance.now();
    const duration = end - start;

    if (!res.ok) {
      console.error(`❌ [${name}] Failed with status ${res.status}`);
      process.exitCode = 1;
      return;
    }

    const size = Buffer.byteLength(await res.text(), 'utf8');
    const sizeMb = (size / 1024 / 1024).toFixed(2);

    if (duration > TIMEOUT_MS) {
      console.error(`❌ [${name}] Performance regression! Took ${Math.round(duration)}ms (limit: ${TIMEOUT_MS}ms). Payload size: ${sizeMb} MB`);
      process.exitCode = 1;
    } else {
      console.log(`✅ [${name}] Passed in ${Math.round(duration)}ms. Payload size: ${sizeMb} MB`);
    }
  } catch (error) {
    console.error(`❌ [${name}] Request failed:`, error.message);
    process.exitCode = 1;
  }
}

async function runTests() {
  const now = Math.floor(Date.now() / 1000);
  const start = now - (7 * 24 * 60 * 60); // 7 days ago

  const tests = [
    {
      name: 'Candles (1m, 7 days)',
      url: `${BASE_URL}/history/candles?symbol=BTCUSDT&timeframe=1m&limit=10080`
    },
    {
      name: 'Profile (1m, 6 hours)',
      url: `${BASE_URL}/history/profile?symbol=BTCUSDT&timeframe=1m&start=${start}&end=${start + 6 * 3600}&baseBucketSize=2.5&contractType=spot&dataSourceMode=spot`
    },
    {
      name: 'Footprint (1m, 1 hour)',
      url: `${BASE_URL}/history/footprint?symbol=BTCUSDT&timeframe=1m&start=${start}&end=${start + 3600}&bucketSize=5.0&contractType=spot&dataSourceMode=spot`
    }
  ];

  console.log('Running performance regression suite...');
  console.log('-----------------------------------------');

  for (const test of tests) {
    await checkEndpoint(test.name, test.url);
  }

  if (process.exitCode === 1) {
    console.error('\n❌ Performance regression suite failed!');
  } else {
    console.log('\n✅ All performance tests passed!');
  }
}

runTests();
