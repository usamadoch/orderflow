import { NextRequest, NextResponse } from 'next/server'
import { getRawTrades } from '../../../../lib/db/database'
import { isAllowedSymbol } from '../../../../lib/config/markets'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const symbol = searchParams.get('symbol')
  const start = Number(searchParams.get('start'))
  const end = Number(searchParams.get('end'))
  const limit = Number(searchParams.get('limit') ?? '50000')

  if (!isAllowedSymbol(symbol)) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(limit) || end <= start) {
    return NextResponse.json({ error: 'Invalid start, end, or limit' }, { status: 400 })
  }

  const rows = await getRawTrades(symbol, start, end, limit)

  return NextResponse.json(rows.map((row) => ({
    id: row.aggregate_trade_id,
    time: row.trade_time,
    price: row.price,
    quantity: row.quantity,
    isBuyerMaker: Boolean(row.is_buyer_maker),
  })))
}
