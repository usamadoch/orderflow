import { NextResponse } from 'next/server';
import { getTradingRiskStatus } from '../../../../lib/trading/risk';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(getTradingRiskStatus());
}
