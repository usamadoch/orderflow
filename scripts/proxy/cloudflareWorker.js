/**
 * Cloudflare Worker: Binance Public Market Data Proxy
 * 
 * Purpose:
 * Routes public REST backfill requests (aggTrades) from geo-restricted VPS (e.g. Enzonic US)
 * to Binance without getting blocked by HTTP 451.
 * 
 * Free Tier:
 * Cloudflare Workers provides 100,000 free requests per day (infinitely more than needed for backfills).
 * 
 * Deployment:
 * 1. Log in to your free Cloudflare account: https://dash.cloudflare.com
 * 2. Go to "Workers & Pages" -> "Create application" -> "Create Worker".
 * 3. Name your worker (e.g. `binance-market-proxy`), click "Deploy".
 * 4. Click "Edit code", paste this entire file content, and click "Deploy".
 * 5. Copy your worker URL (e.g. `https://binance-market-proxy.yourname.workers.dev`).
 * 6. Set in your `.env.local` or VPS environment:
 *    BINANCE_REST_PROXY_URL=https://binance-market-proxy.yourname.workers.dev
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'binance-market-proxy', time: Date.now() }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Determine target host based on path
    let targetOrigin = 'https://fapi.binance.com';
    if (url.pathname.startsWith('/api')) {
      targetOrigin = 'https://data-api.binance.vision';
    } else if (url.pathname.startsWith('/fapi')) {
      targetOrigin = 'https://fapi.binance.com';
    }

    const targetUrl = new URL(`${targetOrigin}${url.pathname}${url.search}`);

    // Build clean forwarding headers
    const forwardHeaders = new Headers();
    forwardHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    forwardHeaders.set('Accept', 'application/json, text/plain, */*');
    forwardHeaders.set('Accept-Encoding', 'gzip, deflate, br');

    try {
      const response = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: forwardHeaders,
      });

      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Proxy fetch failed', message: error.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
