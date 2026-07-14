import 'server-only';

import { createHmac } from 'crypto';

interface BinanceRestClientOptions {
  apiKey: string | null;
  apiSecret: string | null;
  restBaseUrl: string | null;
  serverTimeUrl: string | null;
  recvWindow?: number;
}

interface BinanceErrorBody {
  code?: unknown;
  msg?: unknown;
}

export class BinanceRestClientError extends Error {
  code: string;
  statusCode: number;
  binanceCode?: number;

  constructor(message: string, code: string, statusCode = 500, binanceCode?: number) {
    super(message);
    this.name = 'BinanceRestClientError';
    this.code = code;
    this.statusCode = statusCode;
    this.binanceCode = binanceCode;
  }
}

export class BinanceRestClient {
  private readonly recvWindow: number;
  private serverTimeOffsetMs = 0;
  private hasSyncedServerTime = false;

  constructor(private readonly options: BinanceRestClientOptions) {
    this.recvWindow = options.recvWindow ?? 5_000;
  }

  async signedGet<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    return this.signedRequest<T>('GET', path, params);
  }

  async signedPost<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    return this.signedRequest<T>('POST', path, params);
  }

  async signedDelete<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    return this.signedRequest<T>('DELETE', path, params);
  }

  private async signedRequest<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params: Record<string, string | number | undefined>,
    retryAfterTimeSync = true,
  ): Promise<T> {
    this.assertConfigured();

    if (!this.hasSyncedServerTime) {
      await this.syncServerTime();
    }

    const query = this.createSignedQuery(params);
    const response = await fetch(`${this.options.restBaseUrl}${path}?${query}`, {
      method,
      cache: 'no-store',
      headers: {
        'X-MBX-APIKEY': this.options.apiKey ?? '',
      },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    const error = await this.createError(response);
    if (retryAfterTimeSync && error.binanceCode === -1021) {
      await this.syncServerTime(true);
      return this.signedRequest<T>(method, path, params, false);
    }

    throw error;
  }

  private assertConfigured() {
    if (!this.options.restBaseUrl) {
      throw new BinanceRestClientError('Binance REST endpoint is not configured for this trading mode.', 'endpoint_not_configured', 400);
    }

    if (!this.options.apiKey || !this.options.apiSecret) {
      throw new BinanceRestClientError(
        'Binance API key and secret are required for this signed trading request.',
        'missing_credentials',
        401,
      );
    }
  }

  private createSignedQuery(params: Record<string, string | number | undefined>) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      searchParams.set(key, String(value));
    }

    searchParams.set('timestamp', String(Date.now() + this.serverTimeOffsetMs));
    searchParams.set('recvWindow', String(this.recvWindow));

    const unsignedQuery = searchParams.toString();
    const signature = createHmac('sha256', this.options.apiSecret ?? '')
      .update(unsignedQuery)
      .digest('hex');

    searchParams.set('signature', signature);
    return searchParams.toString();
  }

  private async syncServerTime(force = false) {
    if (!this.options.serverTimeUrl || (this.hasSyncedServerTime && !force)) {
      return;
    }

    const startedAt = Date.now();
    try {
      const response = await fetch(this.options.serverTimeUrl, {
        cache: 'no-store',
      });

      if (!response.ok) return;

      const body = (await response.json()) as { serverTime?: unknown };
      if (typeof body.serverTime !== 'number') return;

      const localMidpoint = startedAt + Math.floor((Date.now() - startedAt) / 2);
      this.serverTimeOffsetMs = body.serverTime - localMidpoint;
      this.hasSyncedServerTime = true;
    } catch {
      this.hasSyncedServerTime = true;
    }
  }

  private async createError(response: Response) {
    let body: BinanceErrorBody | null = null;

    try {
      body = (await response.json()) as BinanceErrorBody;
    } catch {
      body = null;
    }

    const binanceCode = typeof body?.code === 'number' ? body.code : undefined;
    const binanceMessage = typeof body?.msg === 'string' ? body.msg : null;
    const message = binanceMessage
      ? `Binance signed trading request failed: ${binanceMessage}`
      : `Binance signed trading request failed with HTTP ${response.status}.`;

    return new BinanceRestClientError(message, 'binance_request_failed', response.status, binanceCode);
  }
}
