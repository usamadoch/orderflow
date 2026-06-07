'use client';

import React from 'react';
import { ChevronDown, X } from 'lucide-react';
import { ALLOWED_SYMBOLS } from '../../lib/config/markets';
import { useChartStore, PanelId, type ContractType } from '../../lib/store/chart';

const CONTRACT_OPTIONS: Array<{ label: string; value: ContractType }> = [
  { label: 'Spot', value: 'spot' },
  { label: 'Perpetual Futures', value: 'futures' },
];

export function PairSelector({ panelId = 'left' }: { panelId?: PanelId }) {
  const panel = useChartStore(s => s.panels[panelId]);
  const setPair = useChartStore(s => s.setPair);
  const setContractType = useChartStore(s => s.setContractType);
  const setDataSourceMode = useChartStore(s => s.setDataSourceMode);
  const setActivePanel = useChartStore(s => s.setActivePanel);
  const [isOpen, setIsOpen] = React.useState(false);
  const [expandedSymbol, setExpandedSymbol] = React.useState<string | null>(panel.pair);

  const displaySymbol = panel.contractType === 'futures' ? `${panel.pair}.P` : panel.pair;

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  React.useEffect(() => {
    if (isOpen) setExpandedSymbol(panel.pair);
  }, [isOpen, panel.pair]);

  const selectInstrument = React.useCallback((symbol: string, contractType: ContractType) => {
    setActivePanel(panelId);
    setPair(panelId, symbol);
    setContractType(panelId, contractType);
    setDataSourceMode(panelId, contractType);
    setIsOpen(false);
  }, [panelId, setActivePanel, setContractType, setDataSourceMode, setPair]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setActivePanel(panelId);
          setIsOpen(open => !open);
        }}
        className={`h-6 min-w-[88px] flex items-center justify-between gap-1.5 rounded-md border px-2 text-[11px] font-bold tracking-tight transition-all duration-150 ${
          isOpen
            ? 'border-accent bg-accent/10 text-accent shadow-sm shadow-accent/10'
            : 'border-[#1A1A1A] bg-[#080808] text-[#E8E8E8] hover:border-accent/60 hover:text-white'
        }`}
        title={`${panelId === 'left' ? 'Left' : 'Right'} panel symbol`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span>{displaySymbol}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={`shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="pointer-events-auto fixed inset-0 z-[1000] flex items-center justify-center bg-black/20 px-3 py-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${panelId === 'left' ? 'Left' : 'Right'} panel crypto symbol selector`}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex max-h-[min(640px,calc(100vh-48px))] w-full max-w-[420px] flex-col overflow-hidden rounded-xl border border-[#1F1F1F] bg-[#0D0D0D] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1F1F1F] bg-[#080808]/50 p-4">
              <div className="flex flex-col">
                <h3 className="text-[12px] font-black uppercase tracking-[0.15em] text-accent">Symbol</h3>
                <span className="text-[9px] font-bold uppercase tracking-tighter text-text-dim/60">
                  {panelId} Panel
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-text-dim transition-colors hover:text-main"
                title="Close"
                aria-label="Close symbol selector"
              >
                <X size={16} />
              </button>
            </div>

            <div className="border-b border-[#1A1A1A] px-4 py-2 text-[10px] font-black uppercase tracking-wide text-[#787B86]">
              Binance USDT
            </div>
            <div className="custom-scrollbar overflow-y-auto p-2">
              {ALLOWED_SYMBOLS.map((symbol) => {
                const expanded = expandedSymbol === symbol;
                const selectedSymbol = panel.pair === symbol;

                return (
                  <div key={symbol} className="border-b border-[#111] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setExpandedSymbol(expanded ? null : symbol)}
                      className={`flex h-9 w-full items-center justify-between rounded-md px-3 text-left text-[11px] font-bold transition-colors ${
                        selectedSymbol
                          ? 'bg-[#151515] text-[#E8E8E8]'
                          : 'text-[#A5A7AD] hover:bg-[#151515] hover:text-white'
                      }`}
                      aria-expanded={expanded}
                    >
                      <span>{symbol}</span>
                      <ChevronDown
                        size={12}
                        strokeWidth={2.5}
                        className={`transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {expanded && (
                      <div className="bg-[#080808] px-2 pb-2">
                        {CONTRACT_OPTIONS.map((option) => {
                          const selected = selectedSymbol && panel.contractType === option.value;
                          const label = option.value === 'futures' ? `${symbol}.P` : symbol;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => selectInstrument(symbol, option.value)}
                              className={`mt-1 flex h-8 w-full items-center justify-between rounded-md border px-2.5 text-[11px] font-semibold transition-all ${
                                selected
                                  ? 'border-accent bg-accent text-white shadow-sm shadow-accent/20'
                                  : 'border-[#1A1A1A] bg-[#101010] text-[#A5A7AD] hover:border-accent/60 hover:text-white'
                              }`}
                            >
                              <span>{option.label}</span>
                              <span className="text-[10px] opacity-70">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
