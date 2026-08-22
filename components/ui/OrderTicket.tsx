'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useChartStore, type PanelId } from '../../lib/store/chart';
import { useChartRuntimeStore } from '../../lib/store/chartRuntime';
import { CHART_BEARISH_COLOR, CHART_BULLISH_COLOR } from '../../lib/config/chartColors';
import { formatPrice } from '../../lib/utils/format';
import type { OrderSide, TradingHealthStatus, TicketOrderType, ValidationResult } from '../../types/trading';

interface OrderTicketProps {
  panelId: PanelId;
}
export function OrderTicket({ panelId }: OrderTicketProps) {
  const panel = useChartStore(s => s.panels[panelId]);
  const candles = useChartRuntimeStore(s => s.panels[panelId].candles);
  const tradingStatus = useChartRuntimeStore(s => s.tradingStatus);
  const placeOrder = useChartRuntimeStore(s => s.placeOrder);
  const refreshRiskStatus = useChartRuntimeStore(s => s.refreshRiskStatus);
  const [side, setSide] = React.useState<OrderSide>('buy');
  const [orderType, setOrderType] = React.useState<TicketOrderType>('market');
  const [quantityInput, setQuantityInput] = React.useState('');
  const [priceInput, setPriceInput] = React.useState('');
  const [priceTouched, setPriceTouched] = React.useState(false);
  const [reduceOnly, setReduceOnly] = React.useState(false);
  const [leverage, setLeverage] = React.useState<number>(10);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [safeMessage, setSafeMessage] = React.useState('');
  const [safeMessageTone, setSafeMessageTone] = React.useState<'success' | 'error'>('success');
  const [health, setHealth] = React.useState<TradingHealthStatus | null>(null);

  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [hasSetDefaultQuantity, setHasSetDefaultQuantity] = React.useState(false);

  const latestPrice = React.useMemo(() => {
    for (let index = candles.length - 1; index >= 0; index -= 1) {
      const close = candles[index]?.close;
      if (Number.isFinite(close) && close > 0) return close;
    }
    return null;
  }, [candles]);

  React.useEffect(() => {
    let cancelled = false;

    async function refreshHealth() {
      try {
        const response = await fetch('/api/trading/health', { cache: 'no-store' });
        const body = (await response.json()) as TradingHealthStatus;
        if (!cancelled && response.ok) setHealth(body);
      } catch {
        if (!cancelled) setHealth(null);
      }
    }

    void refreshHealth();
    void refreshRiskStatus();

    return () => {
      cancelled = true;
    };
  }, [refreshRiskStatus]);

  React.useEffect(() => {
    if (!isInitialized) {
      setPosition({ x: window.innerWidth - 260 - 24, y: 24 });
      setIsInitialized(true);
    }
  }, [isInitialized]);

  React.useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    }
    function handlePointerUp() {
      setIsDragging(false);
    }
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, dragStart]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Prevent dragging if clicking a button inside the header
    if (target.closest('button')) return;
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  React.useEffect(() => {
    if (orderType !== 'limit' || priceInput || priceTouched || latestPrice === null) return;
    setPriceInput(String(latestPrice));
  }, [latestPrice, orderType, priceInput, priceTouched]);

  React.useEffect(() => {
    if (panel.contractType === 'spot' && reduceOnly) setReduceOnly(false);
  }, [panel.contractType, reduceOnly]);

  const quoteAsset = getQuoteAsset(panel.pair);
  const baseAsset = quoteAsset ? panel.pair.slice(0, -quoteAsset.length) : panel.pair;
  const balanceAsset = side === 'buy' ? quoteAsset : baseAsset;
  const balance = tradingStatus.balances.find(item => item.asset === balanceAsset);

  React.useEffect(() => {
    if (hasSetDefaultQuantity || latestPrice === null) return;
    
    if (balance && balance.free > 0) {
      if (side === 'buy') {
        const qty = Number(((balance.free * 0.05) / latestPrice).toFixed(4));
        setQuantityInput(String(qty > 0 ? qty : 0.001));
      } else {
        const qty = Number((balance.free * 0.05).toFixed(4));
        setQuantityInput(String(qty > 0 ? qty : 0.001));
      }
    } else {
      setQuantityInput('0.001');
    }
    setHasSetDefaultQuantity(true);
  }, [hasSetDefaultQuantity, latestPrice, balance, side]);

  const mode = health?.mode ?? tradingStatus.currentMode;
  const modeBadge = health?.modeBadge ?? tradingStatus.modeBadge;
  const connectionStatus = health?.connectionStatus ?? tradingStatus.connectionStatus;
  const liveTradingEnabled = health?.liveTradingEnabled ?? false;
  const riskStatus = tradingStatus.riskStatus;
  const quantity = Number(quantityInput);
  const price = Number(priceInput);
  const reduceOnlySupported = panel.contractType === 'futures';
  const validation = validateTicket({
    symbol: panel.pair,
    mode,
    modeBadge,
    connectionStatus,
    liveTradingEnabled,
    quantity,
    orderType,
    price,
    estimatedPrice: orderType === 'limit' ? price : latestPrice,
    contractType: panel.contractType,
    liveBlocked: tradingStatus.liveBlocked || riskStatus?.liveBlocked === true,
    killSwitchActive: tradingStatus.killSwitchActive || riskStatus?.killSwitchActive === true,
    riskBlockReasons: tradingStatus.riskBlockReasons,
    maxOrderQty: riskStatus?.maxOrderQty,
    maxOrderNotional: riskStatus?.maxOrderNotional,
    dailyOrderCountUsed: riskStatus?.dailyOrderCountUsed,
    dailyOrderCountLimit: riskStatus?.dailyOrderCountLimit,
  });
  const canReview = validation.messages.length === 0;
  const submitting = tradingStatus.orderActionLoading;

  const openConfirmation = React.useCallback(() => {
    setSafeMessage('');
    setSafeMessageTone('success');
    setShowConfirm(true);
  }, []);

  const closeConfirmation = React.useCallback(() => {
    if (submitting) return;
    setShowConfirm(false);
    setSafeMessage('');
    setSafeMessageTone('success');
  }, [submitting]);

  const confirmOrder = React.useCallback(async () => {
    if (!canReview || submitting) return;

    setSafeMessage('');
    setSafeMessageTone('success');
    const result = await placeOrder({
      symbol: panel.pair,
      contractType: panel.contractType,
      side,
      type: orderType,
      quantity,
      price: orderType === 'limit' ? price : undefined,
      estimatedPrice: orderType === 'market' && latestPrice !== null ? latestPrice : undefined,
      reduceOnly: reduceOnlySupported ? reduceOnly : false,
      leverage: reduceOnlySupported ? leverage : undefined,
      confirmed: true,
    });

    if (result.success) {
      const id = result.order?.id;
      const status = result.order?.status;
      setSafeMessageTone('success');
      setSafeMessage(id ? `Order ${id} ${status ?? 'submitted'}.` : 'Order submitted.');
      return;
    }

    setSafeMessageTone('error');
    setSafeMessage(result.errorMessage ?? 'Order placement failed.');
  }, [
    canReview,
    orderType,
    panel.contractType,
    panel.pair,
    placeOrder,
    price,
    quantity,
    reduceOnly,
    reduceOnlySupported,
    side,
    submitting,
    latestPrice,
    leverage,
  ]);

  return (
    <>
      <div 
        className={`fixed z-[100] w-[260px] max-w-[calc(100%-24px)] rounded-md border border-[#262626] bg-[#1F1F1F]/95 shadow-xl shadow-black/25 backdrop-blur transition-shadow ${isDragging ? 'shadow-accent/20 ring-1 ring-accent/20' : ''} ${!isInitialized ? 'invisible' : ''}`}
        style={isInitialized ? { left: position.x, top: position.y } : undefined}
      >
        <div 
          className={`flex items-center justify-between border-b border-[#262626] px-3 py-2 select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab active:cursor-grabbing'}`}
          onPointerDown={handlePointerDown}
        >
          <div>
            <div className="text-[11px] font-black uppercase tracking-wider text-[#E8E8E8]">{panel.pair || 'No symbol'}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-[#787B86]">
              <span>{formatMode(mode)}</span>
              <span className="text-[#4A4A4A]">/</span>
              <span>{panel.contractType}</span>
            </div>
          </div>
          <span className={getBadgeClassName(modeBadge, validation.liveBlocked)}>
            {validation.liveBlocked ? 'blocked' : modeBadge}
          </span>
        </div>

        <div className="space-y-2.5 px-3 py-3">
          <div className="grid grid-cols-2 gap-1 rounded-md border border-[#303030] bg-[#262626] p-0.5">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={`h-7 rounded text-[11px] font-black uppercase transition-colors ${
                side === 'buy' ? 'text-white' : 'text-[#9A9A9A] hover:text-[#E8E8E8]'
              }`}
              style={side === 'buy' ? { backgroundColor: CHART_BULLISH_COLOR } : undefined}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSide('sell')}
              className={`h-7 rounded text-[11px] font-black uppercase transition-colors ${
                side === 'sell' ? 'text-white' : 'text-[#9A9A9A] hover:text-[#E8E8E8]'
              }`}
              style={side === 'sell' ? { backgroundColor: CHART_BEARISH_COLOR } : undefined}
            >
              Sell
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-md border border-[#303030] bg-[#262626] p-0.5">
            <button
              type="button"
              onClick={() => setOrderType('market')}
              className={`h-7 rounded text-[10px] font-black uppercase transition-colors ${
                orderType === 'market' ? 'bg-[#3A3A3A] text-[#E8E8E8]' : 'text-[#9A9A9A] hover:text-[#E8E8E8]'
              }`}
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => {
                setOrderType('limit');
                if (!priceInput && latestPrice !== null && !priceTouched) {
                  setPriceInput(String(latestPrice));
                }
              }}
              className={`h-7 rounded text-[10px] font-black uppercase transition-colors ${
                orderType === 'limit' ? 'bg-[#3A3A3A] text-[#E8E8E8]' : 'text-[#9A9A9A] hover:text-[#E8E8E8]'
              }`}
            >
              Limit
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#787B86]">Quantity</span>
            <input
              value={quantityInput}
              onChange={event => setQuantityInput(event.target.value)}
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder={`0.00 ${baseAsset}`}
              className="h-8 w-full rounded border border-[#333333] bg-[#262626] px-2 text-[12px] font-semibold text-[#E8E8E8] outline-none placeholder:text-[#5A5A5A] focus:border-accent/70"
            />
          </label>

          {orderType === 'limit' ? (
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#787B86]">Limit Price</span>
              <input
                value={priceInput}
                onChange={event => {
                  setPriceTouched(true);
                  setPriceInput(event.target.value);
                }}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder={latestPrice === null ? '0.00' : formatPrice(latestPrice)}
                className="h-8 w-full rounded border border-[#333333] bg-[#262626] px-2 text-[12px] font-semibold text-[#E8E8E8] outline-none placeholder:text-[#5A5A5A] focus:border-accent/70"
              />
            </label>
          ) : (
            <div className="rounded border border-[#303030] bg-[#262626] px-2 py-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#787B86]">Estimated execution</div>
              <div className="mt-0.5 text-[12px] font-bold text-[#E8E8E8]">
                {latestPrice === null ? '--' : formatPrice(latestPrice)}
              </div>
            </div>
          )}

          <label className={`flex items-center justify-between rounded border border-[#303030] bg-[#262626] px-2 py-1.5 ${
            reduceOnlySupported ? 'cursor-pointer' : 'opacity-60'
          }`}>
            <span>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#B8B8B8]">Reduce Only</span>
              <span className="block text-[9px] font-semibold text-[#787B86]">
                {reduceOnlySupported ? 'Futures ticket flag' : 'Unavailable for spot'}
              </span>
            </span>
            <input
              type="checkbox"
              checked={reduceOnly}
              disabled={!reduceOnlySupported}
              onChange={event => setReduceOnly(event.target.checked)}
              className="h-4 w-4 accent-[#089981]"
            />
          </label>

          <div className="flex items-center justify-between rounded border border-[#303030] bg-[#262626] px-2 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#787B86]">Available</span>
            <span className="text-[11px] font-bold text-[#E8E8E8]">
              {balance ? `${formatBalance(balance.free)} ${balance.asset}` : '--'}
            </span>
          </div>

          {reduceOnlySupported && (
            <>
              <div className="flex items-center justify-between rounded border border-[#303030] bg-[#262626] px-2 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#787B86]">Leverage</span>
                <select
                  value={leverage}
                  onChange={(e) => setLeverage(Number(e.target.value))}
                  className="bg-transparent text-[11px] font-bold text-[#E8E8E8] outline-none"
                >
                  <option value={1} className="bg-[#262626]">1x</option>
                  <option value={2} className="bg-[#262626]">2x</option>
                  <option value={5} className="bg-[#262626]">5x</option>
                  <option value={10} className="bg-[#262626]">10x</option>
                  <option value={20} className="bg-[#262626]">20x</option>
                  <option value={50} className="bg-[#262626]">50x</option>
                  <option value={100} className="bg-[#262626]">100x</option>
                  <option value={125} className="bg-[#262626]">125x</option>
                </select>
              </div>
              <div className="flex items-center justify-between rounded border border-[#303030] bg-[#262626] px-2 py-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#787B86]">Cost / Margin</span>
                <span className="text-[11px] font-bold text-[#E8E8E8]">
                  {Number.isFinite(quantity) && latestPrice !== null
                    ? `${formatBalance((quantity * latestPrice) / leverage)} USDT`
                    : '--'}
                </span>
              </div>
            </>
          )}

          {validation.messages.length > 0 && (
            <div className="rounded border border-[#F23645]/30 bg-[#F23645]/10 px-2 py-1.5 text-[10px] font-semibold text-[#FF9BA4]">
              {validation.messages[0]}
            </div>
          )}

          <button
            type="button"
            disabled={!canReview}
            onClick={openConfirmation}
            className="h-8 w-full rounded text-[11px] font-black uppercase tracking-wider text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            style={{ backgroundColor: side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR }}
          >
            {side === 'buy' ? 'Buy' : 'Sell'}
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[360px] rounded-md border border-[#303030] bg-[#1F1F1F] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#303030] px-4 py-3">
              <div>
                <div className="text-[12px] font-black uppercase tracking-wider text-[#E8E8E8]">Confirm order</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase text-[#787B86]">{panel.pair} / {modeBadge}</div>
              </div>
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={submitting}
                className="flex h-7 w-7 items-center justify-center rounded border border-[#303030] text-[#787B86] hover:border-accent/60 hover:text-[#E8E8E8]"
                aria-label="Close order confirmation"
                title="Close"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>

            <div className="space-y-2 px-4 py-4">
              <ConfirmRow label="Side" value={side.toUpperCase()} valueColor={side === 'buy' ? CHART_BULLISH_COLOR : CHART_BEARISH_COLOR} />
              <ConfirmRow label="Symbol" value={panel.pair || '--'} />
              <ConfirmRow label="Type" value={orderType.toUpperCase()} />
              <ConfirmRow label="Quantity" value={Number.isFinite(quantity) ? `${quantityInput} ${baseAsset}` : '--'} />
              {orderType === 'limit' && <ConfirmRow label="Price" value={Number.isFinite(price) ? formatPrice(price) : '--'} />}
              {orderType === 'market' && <ConfirmRow label="Est. price" value={latestPrice === null ? '--' : formatPrice(latestPrice)} />}
              <ConfirmRow label="Mode" value={formatMode(mode)} />
              <ConfirmRow label="Market" value={panel.contractType.toUpperCase()} />
              <ConfirmRow label="Badge" value={validation.liveBlocked ? 'BLOCKED' : modeBadge.toUpperCase()} />
              {validation.messages[0] && <ConfirmRow label="Risk" value={validation.messages[0]} />}
              {reduceOnlySupported && <ConfirmRow label="Reduce only" value={reduceOnly ? 'YES' : 'NO'} />}
              {reduceOnlySupported && <ConfirmRow label="Leverage" value={`${leverage}x`} />}

              {safeMessage && (
                <div className={`rounded border px-3 py-2 text-[11px] font-semibold ${
                  safeMessageTone === 'error'
                    ? 'border-[#F23645]/30 bg-[#F23645]/10 text-[#FF9BA4]'
                    : 'border-accent/30 bg-accent/10 text-accent'
                }`}>
                  {safeMessage}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-[#303030] px-4 py-3">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={submitting}
                className="h-8 flex-1 rounded border border-[#333333] bg-[#262626] text-[11px] font-bold uppercase text-[#B8B8B8] hover:text-[#E8E8E8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmOrder}
                disabled={!canReview || submitting}
                className="h-8 flex-1 rounded bg-accent text-[11px] font-black uppercase tracking-wider text-white hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-55"
              >
                {submitting ? 'Sending' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConfirmRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between rounded border border-[#303030] bg-[#262626] px-3 py-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#787B86]">{label}</span>
      <span className="text-[11px] font-black uppercase text-[#E8E8E8]" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
    </div>
  );
}

function validateTicket(input: {
  symbol: string;
  mode: string | null | undefined;
  modeBadge: string;
  connectionStatus: string;
  liveTradingEnabled: boolean;
  quantity: number;
  orderType: TicketOrderType;
  price: number;
  estimatedPrice: number | null;
  contractType: string;
  liveBlocked: boolean;
  killSwitchActive: boolean;
  riskBlockReasons: string[];
  maxOrderQty?: number;
  maxOrderNotional?: number;
  dailyOrderCountUsed?: number;
  dailyOrderCountLimit?: number;
}): ValidationResult {
  const messages: string[] = [];
  const liveBlocked = input.liveBlocked || (input.modeBadge === 'live' && (!input.liveTradingEnabled || input.connectionStatus === 'blocked'));
  const notional = Number.isFinite(input.estimatedPrice) && input.estimatedPrice !== null
    ? input.quantity * input.estimatedPrice
    : null;

  if (!input.symbol) messages.push('Symbol is required.');
  if (!input.mode) messages.push('Trading mode is required.');
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) messages.push('Quantity must be greater than 0.');
  if (input.orderType === 'limit' && (!Number.isFinite(input.price) || input.price <= 0)) {
    messages.push('Limit price must be greater than 0.');
  }
  // Futures support is now implemented!
  if (input.contractType !== 'spot' && input.contractType !== 'futures') messages.push('Unsupported contract type selected.');
  if (input.killSwitchActive) messages.push(input.riskBlockReasons[0] ?? 'Trading kill switch is active.');
  if (liveBlocked) messages.push('Live trading is blocked until it is enabled on the server.');
  if (input.riskBlockReasons.length > 0) messages.push(input.riskBlockReasons[0]);
  if (input.maxOrderQty !== undefined && Number.isFinite(input.quantity) && input.quantity > input.maxOrderQty) {
    messages.push(`Order quantity exceeds max quantity ${input.maxOrderQty}.`);
  }
  if (input.maxOrderNotional !== undefined && notional !== null && notional > input.maxOrderNotional) {
    messages.push(`Order notional exceeds max notional ${input.maxOrderNotional}.`);
  }
  if (
    input.dailyOrderCountUsed !== undefined
    && input.dailyOrderCountLimit !== undefined
    && input.dailyOrderCountUsed >= input.dailyOrderCountLimit
  ) {
    messages.push(`Daily order count limit ${input.dailyOrderCountLimit} has been reached.`);
  }

  return { messages, liveBlocked };
}

function getQuoteAsset(symbol: string) {
  if (symbol.endsWith('USDT')) return 'USDT';
  if (symbol.endsWith('BUSD')) return 'BUSD';
  if (symbol.endsWith('USDC')) return 'USDC';
  return '';
}

function formatBalance(value: number) {
  if (!Number.isFinite(value)) return '--';
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
}

function formatMode(mode: string | null | undefined) {
  if (!mode) return 'No mode';
  return mode.replace(/_/g, ' ');
}

function getBadgeClassName(badge: string, blocked: boolean) {
  const base = 'rounded border px-2 py-1 text-[9px] font-black uppercase tracking-wider';
  if (blocked) return `${base} border-[#F23645]/40 bg-[#F23645]/10 text-[#FF9BA4]`;
  if (badge === 'live') return `${base} border-[#F23645]/40 bg-[#F23645]/10 text-[#FF9BA4]`;
  if (badge === 'paper') return `${base} border-accent/40 bg-accent/10 text-accent`;
  return `${base} border-[#089981]/40 bg-[#089981]/10 text-[#8FE3CF]`;
}
