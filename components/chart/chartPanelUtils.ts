import type { Order, Position, TradeFill, VirtualPosition, BracketOrder } from '@/types/trading';
import type { Candle } from '@/types/candle';
import type { PanelState } from '@/lib/store/chart';
import { getHistoricalSessionRanges, HistoricalSessionRange } from '@/lib/utils/historicalSessions';

export function filterOrdersBySymbol(orders: Order[], symbol: string): Order[] {
  if (process.env.NEXT_PUBLIC_DISABLE_TRADING === 'true') return [];
  const upper = symbol.toUpperCase();
  return orders.filter(order => order.symbol.toUpperCase() === upper);
}

export function filterPositionsBySymbol(positions: Position[], symbol: string): Position[] {
  if (process.env.NEXT_PUBLIC_DISABLE_TRADING === 'true') return [];
  const upper = symbol.toUpperCase();
  return positions.filter(pos => pos.symbol.toUpperCase() === upper);
}

export function filterRecentTradesBySymbol(trades: TradeFill[], symbol: string): TradeFill[] {
  if (process.env.NEXT_PUBLIC_DISABLE_TRADING === 'true') return [];
  const upper = symbol.toUpperCase();
  return trades.filter(trade => trade.symbol.toUpperCase() === upper);
}

export function filterVirtualPositionsBySymbol(virtualPositions: VirtualPosition[], symbol: string): VirtualPosition[] {
  if (process.env.NEXT_PUBLIC_DISABLE_TRADING === 'true') return [];
  const upper = symbol.toUpperCase();
  return virtualPositions.filter(vp => vp.symbol.toUpperCase() === upper && vp.status === 'open');
}

export function filterBracketOrdersForVirtualPositions(bracketOrders: BracketOrder[], virtualPositions: VirtualPosition[]): BracketOrder[] {
  if (process.env.NEXT_PUBLIC_DISABLE_TRADING === 'true') return [];
  return bracketOrders.filter(b => virtualPositions.some(vp => vp.id === b.positionId));
}

export function computeHistoricalSessionRanges(panel: PanelState, candles: Candle[]): HistoricalSessionRange[] {
  if (!panel.historicalSessionProfileEnabled) return [];
  const latestTimeMs = candles.length > 0 ? candles[candles.length - 1].time * 1000 : Date.now();
  return getHistoricalSessionRanges(
    latestTimeMs,
    panel.historicalSessionProfileCount,
    panel.historicalSessionProfileStartHour,
    panel.historicalSessionProfileStartMin,
    panel.historicalSessionProfileEndHour,
    panel.historicalSessionProfileEndMin
  );
}
