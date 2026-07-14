import { NextRequest, NextResponse } from 'next/server';
import { isAllowedContractType, isAllowedSymbol } from '../../../../lib/config/markets';
import { createBinanceBrokerAdapter } from '../../../../lib/trading/binanceAdapter';
import { BinanceRestClientError } from '../../../../lib/trading/binanceRestClient';
import { getBinanceTradingConfig, TradingConfigError } from '../../../../lib/trading/config';
import { evaluateCancelRisk, evaluateOrderRisk, recordPlacedOrder, recordRiskFailure } from '../../../../lib/trading/risk';
import type {
  OrderCancelRequest,
  OrderContractType,
  OrderRequest,
  OrderResult,
  OrderSide,
  OrderTimeInForce,
  OrderType,
  TradingMode,
} from '../../../../types/trading';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type UnknownRecord = Record<string, unknown>;

export async function POST(request: NextRequest) {
  let validatedRequest: OrderRequest | null = null;

  try {
    const payload = await readJsonBody(request);
    const validation = validateOrderRequest(payload);
    if (!validation.ok) {
      return NextResponse.json(createRejectedResult('binance_testnet', validation.message, validation.reason), { status: 400 });
    }

    validatedRequest = validation.request;
    const riskDecision = evaluateOrderRisk(validation.request);
    if (!riskDecision.allowed) {
      return NextResponse.json(
        createRejectedResult(riskDecision.status.mode, riskDecision.message ?? 'Order blocked by risk controls.', riskDecision.reason ?? 'risk_rejected'),
        { status: 403 },
      );
    }

    const config = getBinanceTradingConfig();
    assertCredentials(config.apiKey, config.apiSecret);
    const result = await createBinanceBrokerAdapter(config).placeOrder(validation.request);
    if (result.success) {
      recordPlacedOrder(validation.request);
    } else if (result.errorMessage) {
      recordRiskFailure(result.errorMessage);
    }
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    if (validatedRequest) {
      recordRiskFailure(error instanceof Error ? error.message : 'Order placement failed.');
    }
    return createOrderErrorResponse(error, 'Order placement failed.');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const config = getBinanceTradingConfig();
    const blocked = getExecutionBlock(config.mode, config.liveTradingEnabled);
    if (blocked) {
      return NextResponse.json(createRejectedResult(config.mode, blocked.message, blocked.reason), { status: 403 });
    }

    const payload = await readDeletePayload(request);
    const validation = validateCancelRequest(payload);
    if (!validation.ok) {
      return NextResponse.json(createRejectedResult(config.mode, validation.message, validation.reason), { status: 400 });
    }

    const riskDecision = evaluateCancelRisk(config.mode, validation.request.contractType);
    if (!riskDecision.allowed) {
      return NextResponse.json(
        createRejectedResult(riskDecision.status.mode, riskDecision.message ?? 'Order cancellation blocked by risk controls.', riskDecision.reason ?? 'risk_rejected'),
        { status: 403 },
      );
    }

    assertCredentials(config.apiKey, config.apiSecret);
    const result = await createBinanceBrokerAdapter(config).cancelOrder(validation.request);
    if (!result.success && result.errorMessage) {
      recordRiskFailure(result.errorMessage);
    }
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return createOrderErrorResponse(error, 'Order cancellation failed.');
  }
}

async function readJsonBody(request: NextRequest): Promise<UnknownRecord> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as UnknownRecord : {};
  } catch {
    return {};
  }
}

async function readDeletePayload(request: NextRequest): Promise<UnknownRecord> {
  const body = await readJsonBody(request);
  const query: UnknownRecord = {};

  for (const key of ['symbol', 'contractType', 'orderId', 'clientOrderId']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value !== null) query[key] = value;
  }

  return {
    ...query,
    ...body,
  };
}

function validateOrderRequest(payload: UnknownRecord):
  | { ok: true; request: OrderRequest }
  | { ok: false; message: string; reason: string } {
  const symbol = normalizeSymbol(payload.symbol);
  if (!symbol) return { ok: false, message: 'A supported symbol is required.', reason: 'invalid_symbol' };

  const contractType = normalizeContractType(payload.contractType);
  if (!contractType) return { ok: false, message: 'Unsupported contract type selected.', reason: 'unsupported_contract_type' };

  const side = normalizeSide(payload.side);
  if (!side) return { ok: false, message: 'Order side must be buy or sell.', reason: 'invalid_order_side' };

  const type = normalizeOrderType(payload.type);
  if (!type) return { ok: false, message: 'Only market and limit orders are supported.', reason: 'unsupported_order_type' };

  const quantity = normalizePositiveNumber(payload.quantity);
  if (quantity === null) return { ok: false, message: 'Quantity must be greater than 0.', reason: 'invalid_quantity' };

  const price = type === 'limit' ? normalizePositiveNumber(payload.price) : undefined;
  if (type === 'limit' && price === null) {
    return { ok: false, message: 'Limit price must be greater than 0.', reason: 'invalid_limit_price' };
  }

  const timeInForce = normalizeTimeInForce(payload.timeInForce);
  if (payload.timeInForce !== undefined && !timeInForce) {
    return { ok: false, message: 'Unsupported time-in-force selected.', reason: 'unsupported_time_in_force' };
  }

  return {
    ok: true,
    request: {
      symbol,
      contractType,
      side,
      type,
      quantity,
      price: price ?? undefined,
      estimatedPrice: normalizePositiveNumber(payload.estimatedPrice) ?? undefined,
      timeInForce,
      clientOrderId: normalizeOptionalId(payload.clientOrderId),
      reduceOnly: payload.reduceOnly === true,
      confirmed: payload.confirmed === true,
    },
  };
}

function validateCancelRequest(payload: UnknownRecord):
  | { ok: true; request: OrderCancelRequest }
  | { ok: false; message: string; reason: string } {
  const symbol = normalizeSymbol(payload.symbol);
  if (!symbol) return { ok: false, message: 'A supported symbol is required.', reason: 'invalid_symbol' };

  const contractType = normalizeContractType(payload.contractType);
  if (!contractType) return { ok: false, message: 'Unsupported contract type selected.', reason: 'unsupported_contract_type' };

  const orderId = normalizeOptionalId(payload.orderId);
  const clientOrderId = normalizeOptionalId(payload.clientOrderId);
  if (!orderId && !clientOrderId) {
    return {
      ok: false,
      message: 'An orderId or clientOrderId is required to cancel an order.',
      reason: 'missing_cancel_order_id',
    };
  }

  return {
    ok: true,
    request: {
      symbol,
      contractType,
      orderId,
      clientOrderId,
    },
  };
}

function normalizeSymbol(value: unknown) {
  if (typeof value !== 'string') return null;
  const symbol = value.trim().toUpperCase();
  return isAllowedSymbol(symbol) ? symbol : null;
}

function normalizeContractType(value: unknown): OrderContractType | null {
  if (value === undefined || value === null || value === '') return 'spot';
  if (typeof value !== 'string') return null;
  const contractType = value.trim().toLowerCase();
  return isAllowedContractType(contractType) ? contractType : null;
}

function normalizeSide(value: unknown): OrderSide | null {
  if (value === 'buy' || value === 'sell') return value;
  return null;
}

function normalizeOrderType(value: unknown): Extract<OrderType, 'market' | 'limit'> | null {
  if (value === 'market' || value === 'limit') return value;
  return null;
}

function normalizeTimeInForce(value: unknown): OrderTimeInForce | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'GTC' || value === 'IOC' || value === 'FOK') return value;
  return undefined;
}

function normalizePositiveNumber(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeOptionalId(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 64 ? normalized : undefined;
}

function getExecutionBlock(mode: TradingMode, liveTradingEnabled: boolean) {
  if (mode === 'binance_testnet') return null;
  if (mode === 'binance_live' && !liveTradingEnabled) {
    return {
      message: 'Binance live trading mode is blocked because BINANCE_ENABLE_LIVE_TRADING is not true.',
      reason: 'live_trading_disabled',
    };
  }
  return {
    message: 'Only Binance testnet order execution is supported.',
    reason: 'unsupported_trading_mode',
  };
}

function assertCredentials(apiKey: string | null, apiSecret: string | null) {
  if (!apiKey || !apiSecret) {
    throw new BinanceRestClientError(
      'Binance API key and secret are required for order execution.',
      'missing_credentials',
      401,
    );
  }
}

function createOrderErrorResponse(error: unknown, fallback: string) {
  if (error instanceof TradingConfigError) {
    return NextResponse.json(createRejectedResult(error.safeStatus.mode, error.message, error.code), {
      status: error.statusCode,
    });
  }

  if (error instanceof BinanceRestClientError) {
    return NextResponse.json(createRejectedResult('binance_testnet', error.message, error.code), {
      status: error.statusCode,
    });
  }

  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json(createRejectedResult('binance_testnet', message, 'order_request_failed'), {
    status: 500,
  });
}

function createRejectedResult(mode: TradingMode, errorMessage: string, rejectedReason: string): OrderResult {
  return {
    success: false,
    mode,
    errorMessage,
    rejectedReason,
  };
}
