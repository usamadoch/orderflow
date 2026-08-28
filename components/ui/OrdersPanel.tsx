'use client';

import React, { useState, useCallback } from 'react';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';
import { useChartStore } from '../../lib/store/chart';
import { formatPrice, formatVol, formatDateTime } from '../../lib/utils/format';
import { CHART_BULLISH_COLOR, CHART_BEARISH_COLOR } from '../../lib/config/chartColors';

export function OrdersPanel() {
  const symbol         = useChartStore(s => s.panels.left.pair);
  const globalTimezone = useChartStore(s => s.globalTimezone);
  const globalTimeFormat = useChartStore(s => s.globalTimeFormat);
  const openOrders     = useChartRuntimeStore(s => s.tradingStatus.openOrders);
  const recentTrades   = useChartRuntimeStore(s => s.tradingStatus.recentTrades);
  const positions      = useChartRuntimeStore(s => s.tradingStatus.positions);
  const cancelOrder    = useChartRuntimeStore(s => s.cancelOrder);
  const placeOrder     = useChartRuntimeStore(s => s.placeOrder);
  const refreshAccountSnapshot = useChartRuntimeStore(s => s.refreshAccountSnapshot);
  const contractType   = useChartStore(s => s.panels.left.contractType);

  const [activeTab, setActiveTab]     = useState<'positions' | 'open' | 'history'>('positions');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);
  const [refreshing, setRefreshing]   = useState(false);

  // Switch to Trade History tab and force-refresh so fills appear immediately
  const handleSwitchHistory = useCallback(async () => {
    setActiveTab('history');
    if (!refreshing) {
      setRefreshing(true);
      try {
        await refreshAccountSnapshot(symbol, 100);
      } finally {
        setRefreshing(false);
      }
    }
  }, [refreshing, refreshAccountSnapshot, symbol]);

  // Manual refresh for the active tab
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refreshAccountSnapshot(symbol, 100);
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, refreshAccountSnapshot, symbol]);

  const handleCancel = async (sym: string, orderId: string) => {
    setCancellingId(orderId);
    try {
      await cancelOrder({ symbol: sym, orderId });
    } finally {
      setCancellingId(null);
    }
  };

  const handleClosePosition = async (sym: string, side: 'long' | 'short', quantity: number) => {
    setClosingSymbol(sym);
    try {
      await placeOrder({
        symbol: sym,
        contractType: contractType,
        side: side === 'long' ? 'sell' : 'buy',
        type: 'market',
        quantity,
        reduceOnly: true,
        confirmed: true,
      });
    } finally {
      setClosingSymbol(null);
    }
  };

  const TAB_BASE = 'h-full text-[11px] font-bold uppercase tracking-wider transition-colors border-b-2 flex items-center';
  const TAB_ACTIVE = 'text-accent border-accent';
  const TAB_IDLE   = 'text-[#787B86] border-transparent hover:text-[#B8B8B8]';

  return (
    <div className="flex flex-col h-64 border-t border-[#262626] bg-[#0F0F0F] select-text">

      {/* ── Tabs Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 h-9 border-b border-[#1F1F1F] bg-[#141414] shrink-0">
        <div className="flex items-center gap-6 h-full">
          <button
            id="orders-panel-tab-positions"
            onClick={() => setActiveTab('positions')}
            className={`${TAB_BASE} ${activeTab === 'positions' ? TAB_ACTIVE : TAB_IDLE}`}
          >
            Positions
            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-black ${
              positions.length > 0 ? 'bg-accent/20 text-accent' : 'bg-[#2A2A2A] text-[#555]'
            }`}>
              {positions.length}
            </span>
          </button>

          <button
            id="orders-panel-tab-open"
            onClick={() => setActiveTab('open')}
            className={`${TAB_BASE} ${activeTab === 'open' ? TAB_ACTIVE : TAB_IDLE}`}
          >
            Open Orders
            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-black ${
              openOrders.length > 0 ? 'bg-accent/20 text-accent' : 'bg-[#2A2A2A] text-[#555]'
            }`}>
              {openOrders.length}
            </span>
          </button>

          <button
            id="orders-panel-tab-history"
            onClick={handleSwitchHistory}
            className={`${TAB_BASE} ${activeTab === 'history' ? TAB_ACTIVE : TAB_IDLE}`}
          >
            Trade History
            {recentTrades.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-[#2A2A2A] text-[#787B86]">
                {recentTrades.length}
              </span>
            )}
          </button>

        </div>

        {/* Refresh button */}
        <button
          id="orders-panel-refresh"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh"
          className="flex items-center gap-1 text-[10px] text-[#555] hover:text-[#B8B8B8] transition-colors disabled:opacity-40"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            className={refreshing ? 'animate-spin' : ''}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 16h5v5" />
          </svg>
          {refreshing ? 'Syncing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse">

          {/* Column headers */}
          <thead className="sticky top-0 bg-[#0F0F0F] z-10 border-b border-[#1F1F1F]">
            {activeTab === 'positions' ? (
              <tr>
                {['Symbol', 'Size', 'Entry Price', 'Mark Price', 'Liq. Price', 'Margin Ratio', 'Unrealized PNL', 'Action'].map(h => (
                  <th key={h} className={`px-3 py-2 text-[10px] font-bold text-[#555] uppercase tracking-wider whitespace-nowrap ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            ) : activeTab === 'open' ? (
              <tr>
                {['Time', 'Symbol', 'Side', 'Type', 'Price', 'Qty', 'Filled%', 'Status', 'Action'].map(h => (
                  <th key={h} className={`px-3 py-2 text-[10px] font-bold text-[#555] uppercase tracking-wider whitespace-nowrap ${h === 'Action' ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            ) : (
              <tr>
                {['Time', 'Symbol', 'Side', 'Price', 'Qty', 'Fee', 'Order ID'].map(h => (
                  <th key={h} className="px-3 py-2 text-[10px] font-bold text-[#555] uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            )}
          </thead>

          <tbody>
            {/* ── Positions ─────────────────────────────────────────────── */}
            {activeTab === 'positions' && (
              positions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[11px] text-[#555]">
                    <div className="flex flex-col items-center gap-1.5">
                      <span>No open positions</span>
                    </div>
                  </td>
                </tr>
              ) : (
                positions.map(pos => {
                  const pnlColor = pos.unrealizedPnl && pos.unrealizedPnl > 0 ? CHART_BULLISH_COLOR : (pos.unrealizedPnl && pos.unrealizedPnl < 0 ? CHART_BEARISH_COLOR : '#555');
                  return (
                    <tr
                      key={`${pos.symbol}-${pos.side}`}
                      className="border-b border-[#161616] hover:bg-[#171717] transition-colors"
                    >
                      <td className="px-3 py-2 text-[11px] font-bold text-[#C8C8C8]">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded"
                            style={{
                              color: pos.side === 'long' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR,
                              background: pos.side === 'long' ? `${CHART_BULLISH_COLOR}18` : `${CHART_BEARISH_COLOR}18`,
                            }}
                          >
                            {pos.leverage}x
                          </span>
                          {pos.symbol}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] font-mono text-[#D8D8D8]">
                        <span style={{ color: pos.side === 'long' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR }}>
                          {pos.side === 'short' ? '-' : ''}{formatVol(pos.quantity)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] font-mono text-[#C8C8C8]">{pos.entryPrice ? formatPrice(pos.entryPrice) : '--'}</td>
                      <td className="px-3 py-2 text-[11px] font-mono text-[#C8C8C8]">{pos.markPrice ? formatPrice(pos.markPrice) : '--'}</td>
                      <td className="px-3 py-2 text-[11px] font-mono text-[#E4A336]">{pos.liquidationPrice ? formatPrice(pos.liquidationPrice) : '--'}</td>
                      <td className="px-3 py-2 text-[11px] font-mono text-[#C8C8C8]">{pos.marginType === 'cross' ? 'Cross' : 'Isolated'}</td>
                      <td className="px-3 py-2 text-[11px] font-mono font-bold" style={{ color: pnlColor }}>
                        {pos.unrealizedPnl !== undefined ? pos.unrealizedPnl.toFixed(2) : '--'} USDT
                        {pos.roe !== undefined && (
                          <span className="ml-2 text-[10px] font-semibold opacity-80">
                            {pos.roe > 0 ? '+' : ''}{pos.roe.toFixed(2)}%
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleClosePosition(pos.symbol, pos.side as 'long' | 'short', pos.quantity)}
                          disabled={closingSymbol === pos.symbol}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2A2A2A] text-[#B8B8B8] hover:bg-[#3A3A3A] hover:text-[#E8E8E8] transition-colors disabled:opacity-40"
                        >
                          {closingSymbol === pos.symbol ? 'Closing…' : 'Close'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )
            )}

            {/* ── Open Orders ─────────────────────────────────────────────── */}
            {activeTab === 'open' && (
              openOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-[11px] text-[#555]">
                    <div className="flex flex-col items-center gap-1.5">
                      <span>No open orders</span>
                      <span className="text-[10px] text-[#3A3A3A]">
                        Market orders fill instantly — check Trade History
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                openOrders.map(order => (
                  <tr
                    key={order.id}
                    className="border-b border-[#161616] hover:bg-[#171717] transition-colors"
                  >
                    <td className="px-3 py-2 text-[10px] text-[#555] whitespace-nowrap">{formatDateTime(order.createdAt, globalTimezone, globalTimeFormat)}</td>
                    <td className="px-3 py-2 text-[11px] font-bold text-[#C8C8C8]">{order.symbol}</td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[11px] font-black uppercase px-1.5 py-0.5 rounded"
                        style={{
                          color: order.side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR,
                          background: order.side === 'buy' ? `${CHART_BULLISH_COLOR}18` : `${CHART_BEARISH_COLOR}18`,
                        }}
                      >
                        {order.side}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[10px] font-semibold text-[#787B86] uppercase">{order.type}</td>
                    <td className="px-3 py-2 text-[11px] font-mono text-[#D8D8D8]">{order.price ? formatPrice(order.price) : <span className="text-[#555]">Market</span>}</td>
                    <td className="px-3 py-2 text-[11px] font-mono text-[#C8C8C8]">{formatVol(order.quantity)}</td>
                    <td className="px-3 py-2 text-[11px] font-mono">
                      <span className={order.filledQuantity > 0 ? 'text-[#26A69A]' : 'text-[#555]'}>
                        {((order.filledQuantity / order.quantity) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="text-[10px] font-bold uppercase text-[#787B86]">
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        id={`cancel-order-${order.id}`}
                        onClick={() => handleCancel(order.symbol, order.id)}
                        disabled={cancellingId === order.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider text-[#F23645] hover:bg-[#F23645]/10 border border-transparent hover:border-[#F23645]/25 transition-colors disabled:opacity-40"
                      >
                        {cancellingId === order.id ? 'Cancelling…' : 'Cancel'}
                      </button>
                    </td>
                  </tr>
                ))
              )
            )}

            {/* ── Trade History ────────────────────────────────────────────── */}
            {activeTab === 'history' && (
              recentTrades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[11px] text-[#555]">
                    <div className="flex flex-col items-center gap-1.5">
                      <span>{refreshing ? 'Loading trades…' : 'No recent trades found'}</span>
                      {!refreshing && (
                        <span className="text-[10px] text-[#3A3A3A]">
                          Trades are loaded for symbol: <span className="text-[#555]">{symbol}</span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                [...recentTrades]
                  .sort((a, b) => b.time - a.time)
                  .map(trade => (
                    <tr
                      key={trade.id}
                      className="border-b border-[#161616] hover:bg-[#171717] transition-colors"
                    >
                      <td className="px-3 py-2 text-[10px] text-[#555] whitespace-nowrap">{formatDateTime(trade.time, globalTimezone, globalTimeFormat)}</td>
                      <td className="px-3 py-2 text-[11px] font-bold text-[#C8C8C8]">{trade.symbol}</td>
                      <td className="px-3 py-2">
                        <span
                          className="text-[11px] font-black uppercase px-1.5 py-0.5 rounded"
                          style={{
                            color: trade.side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR,
                            background: trade.side === 'buy' ? `${CHART_BULLISH_COLOR}18` : `${CHART_BEARISH_COLOR}18`,
                          }}
                        >
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] font-mono text-[#D8D8D8]">{formatPrice(trade.price)}</td>
                      <td className="px-3 py-2 text-[11px] font-mono text-[#C8C8C8]">{formatVol(trade.quantity)}</td>
                      <td className="px-3 py-2 text-[10px] font-mono text-[#555]">
                        {trade.fee != null ? `${trade.fee} ${trade.feeAsset ?? ''}`.trim() : '—'}
                      </td>
                      <td className="px-3 py-2 text-[10px] font-mono text-[#3A3A3A] truncate max-w-[100px]">{trade.orderId}</td>
                    </tr>
                  ))
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
