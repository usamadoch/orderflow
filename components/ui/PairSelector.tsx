'use client';

import React from 'react';
import { ChevronDown, X } from 'lucide-react';
import { FigButton, FigSegmentedControl, FigPopup } from './fig';
import { ALLOWED_SYMBOLS, type AllowedSymbol } from '../../lib/config/markets';
import { useChartStore, PanelId, type ContractType } from '../../lib/store/chart';

interface PairSelectorProps {
  panelId?: PanelId;
  position?: 'bottom left' | 'bottom right' | 'bottom center';
}

type FilterTab = 'all' | 'futures' | 'spot';

const SYMBOL_METADATA: Record<
  AllowedSymbol,
  { name: string; iconBg: string; iconColor: string; symbolChar: string }
> = {
  BTCUSDT: { name: 'Bitcoin', iconBg: '#F7931A', iconColor: '#FFFFFF', symbolChar: '₿' },
  ETHUSDT: { name: 'Ethereum', iconBg: '#627EEA', iconColor: '#FFFFFF', symbolChar: 'Ξ' },
  SOLUSDT: {
    name: 'Solana',
    iconBg: 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)',
    iconColor: '#FFFFFF',
    symbolChar: 'S',
  },
  BNBUSDT: { name: 'BNB', iconBg: '#F3BA2F', iconColor: '#1E1E1E', symbolChar: '◆' },
  XRPUSDT: { name: 'XRP', iconBg: '#23292F', iconColor: '#FFFFFF', symbolChar: '✕' },
  ADAUSDT: { name: 'Cardano', iconBg: '#0033AD', iconColor: '#FFFFFF', symbolChar: '₳' },
  DOGEUSDT: { name: 'Dogecoin', iconBg: '#C2A633', iconColor: '#FFFFFF', symbolChar: 'Ð' },
  AVAXUSDT: { name: 'Avalanche', iconBg: '#E84142', iconColor: '#FFFFFF', symbolChar: '▲' },
  LINKUSDT: { name: 'Chainlink', iconBg: '#375BD2', iconColor: '#FFFFFF', symbolChar: '⬡' },
  LTCUSDT: { name: 'Litecoin', iconBg: '#345D9D', iconColor: '#FFFFFF', symbolChar: 'Ł' },
};

function BinanceLogo() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-label="Binance">
      <path d="M12 2L6 8L8.12 10.12L12 6.24L15.88 10.12L18 8L12 2Z" fill="#F3BA2F" />
      <path d="M2 12L4.12 9.88L8 13.76L5.88 15.88L2 12Z" fill="#F3BA2F" />
      <path d="M12 10.24L9.88 12.36L12 14.48L14.12 12.36L12 10.24Z" fill="#F3BA2F" />
      <path d="M22 12L18.12 15.88L16 13.76L19.88 9.88L22 12Z" fill="#F3BA2F" />
      <path d="M12 22L18 16L15.88 13.88L12 17.76L8.12 13.88L6 16L12 22Z" fill="#F3BA2F" />
    </svg>
  );
}

interface InstrumentItem {
  id: string;
  symbol: AllowedSymbol;
  contractType: ContractType;
  ticker: string;
  description: string;
  tags: string;
  name: string;
  iconBg: string;
  iconColor: string;
  symbolChar: string;
}

export function PairSelector({ 
  panelId = 'left',
  position = 'bottom left',
}: PairSelectorProps) {
  const panel = useChartStore((s) => s.panels[panelId]);
  const setPair = useChartStore((s) => s.setPair);
  const setContractType = useChartStore((s) => s.setContractType);
  const setDataSourceMode = useChartStore((s) => s.setDataSourceMode);
  const setActivePanel = useChartStore((s) => s.setActivePanel);

  const [isOpen, setIsOpen] = React.useState(false);
  const [activeFilter, setActiveFilter] = React.useState<FilterTab>('all');

  const selectInstrument = React.useCallback(
    (symbol: string, contractType: ContractType) => {
      setActivePanel(panelId);
      setPair(panelId, symbol);
      setContractType(panelId, contractType);
      setDataSourceMode(panelId, contractType);
      setIsOpen(false);
    },
    [panelId, setActivePanel, setContractType, setDataSourceMode, setPair]
  );

  const displaySymbol = panel.contractType === 'futures' ? `${panel.pair}.P` : panel.pair;
  const triggerId = `pair-selector-trigger-${panelId}`;

  const instruments = React.useMemo<InstrumentItem[]>(() => {
    const list: InstrumentItem[] = [];

    ALLOWED_SYMBOLS.forEach((sym) => {
      const meta = SYMBOL_METADATA[sym] || {
        name: sym,
        iconBg: '#3A3A3A',
        iconColor: '#FFFFFF',
        symbolChar: sym[0],
      };

      if (activeFilter === 'all' || activeFilter === 'futures') {
        list.push({
          id: `${sym}-futures`,
          symbol: sym,
          contractType: 'futures',
          ticker: `${sym}.P`,
          description: `${meta.name} / TetherUS PERPETUAL CONTRACT`,
          tags: 'swap crypto defi',
          name: meta.name,
          iconBg: meta.iconBg,
          iconColor: meta.iconColor,
          symbolChar: meta.symbolChar,
        });
      }

      if (activeFilter === 'all' || activeFilter === 'spot') {
        list.push({
          id: `${sym}-spot`,
          symbol: sym,
          contractType: 'spot',
          ticker: sym,
          description: `${meta.name} / TetherUS Spot`,
          tags: 'spot crypto',
          name: meta.name,
          iconBg: meta.iconBg,
          iconColor: meta.iconColor,
          symbolChar: meta.symbolChar,
        });
      }
    });

    return list;
  }, [activeFilter]);

  return (
    <div className="relative">
      <FigButton
        id={triggerId}
        variant="ghost"
        size="small"
        selected={isOpen}
        onClick={() => {
          setActivePanel(panelId);
          setIsOpen((open) => !open);
        }}
        className="h-6 min-w-[88px] gap-1.5 px-2 text-[11px] font-bold tracking-tight"
        title={`${panelId === 'left' ? 'Left' : 'Right'} panel symbol`}
        aria-expanded={isOpen}
      >
        <span>{displaySymbol}</span>
        <ChevronDown
          size={12}
          strokeWidth={2.5}
          className={`shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
        />
      </FigButton>

      <FigPopup
        open={isOpen}
        anchor={`#${triggerId}`}
        position={position}
        offset="0 4"
        dropdown
        onClose={() => setIsOpen(false)}
        className="z-50 w-[420px] rounded-xl border border-[#282828] bg-[#181818] p-1.5 shadow-2xl select-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2 pt-1 pb-1">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#787B86]">
            Binance USDT
          </span>
          <FigButton
            variant="ghost"
            icon
            size="compact"
            onClick={() => setIsOpen(false)}
            title="Close"
            aria-label="Close"
            className="h-5 w-5 text-[#787B86] hover:text-white"
          >
            <X size={12} strokeWidth={2.5} />
          </FigButton>
        </div>

        {/* Filter Tabs using FigSegmentedControl */}
        <div className="px-1 pb-1.5 pt-0.5">
          <FigSegmentedControl
            full
            size="small"
            value={activeFilter}
            onChange={(val: string) => setActiveFilter(val as FilterTab)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'futures', label: 'Perpetual Futures' },
              { value: 'spot', label: 'Spot' },
            ]}
          />
        </div>

        {/* Instruments List */}
        <div className="flex max-h-[360px] flex-col gap-0.5 overflow-y-auto custom-scrollbar px-1 pt-0.5">
          {instruments.map((item) => {
            const isSelected =
              panel.pair === item.symbol && panel.contractType === item.contractType;

            return (
              <FigButton
                key={item.id}
                variant="ghost"
                size="medium"
                selected={isSelected}
                onClick={() => selectInstrument(item.symbol, item.contractType)}
                className={`group flex items-center justify-between rounded-lg px-2 py-1.5 text-left w-full transition-all ${
                  isSelected
                    ? 'bg-[#282828] border border-[#383838] text-white'
                    : 'border border-transparent text-[#E0E0E0] hover:bg-[#242424] hover:text-white'
                }`}
                title={`${item.ticker} - ${item.description}`}
                aria-label={`${item.ticker} - ${item.description}`}
              >
                {/* Left: Coin Icon + Ticker + Description */}
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 select-none shadow-sm"
                    style={{
                      background: item.iconBg,
                      color: item.iconColor,
                    }}
                  >
                    {item.symbolChar}
                  </div>

                  <span className="font-bold text-[12px] text-[#2962FF] tracking-wide shrink-0 min-w-[78px]">
                    {item.ticker}
                  </span>

                  <span className="text-[10px] text-[#787B86] group-hover:text-[#A0A0A0] truncate max-w-[140px] transition-colors">
                    {item.description}
                  </span>
                </div>

                {/* Right: Tag + Binance Badge */}
                <div className="flex items-center gap-2.5 shrink-0 pl-1">
                  <span className="text-[9px] text-[#787B86] hidden sm:inline">
                    {item.tags}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-[#D1D4DC]">Binance</span>
                    <BinanceLogo />
                  </div>
                </div>
              </FigButton>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-1 pt-1.5 pb-0.5 border-t border-[#242424] text-center text-[10px] text-[#555555]">
          Binance Spot & USDT-Margined Perpetual Futures
        </div>
      </FigPopup>
    </div>
  );
}
