import { NextRequest, NextResponse } from 'next/server'
import { createBinanceBrokerAdapter } from '../../../../lib/trading/binanceAdapter'
import { createBinanceFuturesBrokerAdapter } from '../../../../lib/trading/binanceFuturesAdapter'
import { getBinanceTradingConfig, isTradingDisabled } from '../../../../lib/trading/config'
import { evaluateCancelRisk, evaluateOrderRisk, recordPlacedOrder, recordRiskFailure } from '../../../../lib/trading/risk'
import {
  assertCredentials,
  createOrderErrorResponse,
  createRejectedResult,
  getExecutionBlock,
  readDeletePayload,
  readJsonBody,
  validateCancelRequest,
  validateOrderRequest,
} from '../../../../lib/validators/orderValidation'
import type { OrderRequest } from '../../../../types/trading'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let validatedRequest: OrderRequest | null = null

  try {
    if (isTradingDisabled()) {
      return NextResponse.json(createRejectedResult('binance_testnet', 'Trading is currently disabled.', 'trading_disabled'), { status: 403 })
    }

    const payload = await readJsonBody(request)
    const validation = validateOrderRequest(payload)
    if (!validation.ok) {
      return NextResponse.json(createRejectedResult('binance_testnet', validation.message, validation.reason), { status: 400 })
    }

    validatedRequest = validation.request
    const riskDecision = evaluateOrderRisk(validation.request)
    if (!riskDecision.allowed) {
      return NextResponse.json(
        createRejectedResult(riskDecision.status.mode, riskDecision.message ?? 'Order blocked by risk controls.', riskDecision.reason ?? 'risk_rejected'),
        { status: 403 },
      )
    }

    const config = getBinanceTradingConfig()
    assertCredentials(config.apiKey, config.apiSecret)
    const adapter = config.isFutures
      ? createBinanceFuturesBrokerAdapter(config)
      : createBinanceBrokerAdapter(config)
    const result = await adapter.placeOrder(validation.request)
    if (result.success) {
      recordPlacedOrder(validation.request)
    } else if (result.errorMessage) {
      recordRiskFailure(result.errorMessage)
    }
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    if (validatedRequest) {
      recordRiskFailure(error instanceof Error ? error.message : 'Order placement failed.')
    }
    return createOrderErrorResponse(error, 'Order placement failed.')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (isTradingDisabled()) {
      return NextResponse.json(createRejectedResult('binance_testnet', 'Trading is currently disabled.', 'trading_disabled'), { status: 403 })
    }

    const config = getBinanceTradingConfig()
    const blocked = getExecutionBlock(config.mode, config.liveTradingEnabled)
    if (blocked) {
      return NextResponse.json(createRejectedResult(config.mode, blocked.message, blocked.reason), { status: 403 })
    }

    const payload = await readDeletePayload(request)
    const validation = validateCancelRequest(payload)
    if (!validation.ok) {
      return NextResponse.json(createRejectedResult(config.mode, validation.message, validation.reason), { status: 400 })
    }

    const riskDecision = evaluateCancelRisk(config.mode, validation.request.contractType)
    if (!riskDecision.allowed) {
      return NextResponse.json(
        createRejectedResult(riskDecision.status.mode, riskDecision.message ?? 'Order cancellation blocked by risk controls.', riskDecision.reason ?? 'risk_rejected'),
        { status: 403 },
      )
    }

    assertCredentials(config.apiKey, config.apiSecret)
    const adapter = config.isFutures
      ? createBinanceFuturesBrokerAdapter(config)
      : createBinanceBrokerAdapter(config)
    const result = await adapter.cancelOrder(validation.request)
    if (!result.success && result.errorMessage) {
      recordRiskFailure(result.errorMessage)
    }
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (error) {
    return createOrderErrorResponse(error, 'Order cancellation failed.')
  }
}
