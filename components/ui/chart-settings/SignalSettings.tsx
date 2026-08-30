import { forwardRef } from 'react';
import { useChartStore, PanelId, AbsorptionSide, ExhaustionSide } from '../../../lib/store/chart';

interface SignalSettingsProps {
  panelId: PanelId;
}

export const SignalSettings = forwardRef<HTMLDivElement, SignalSettingsProps>(({ panelId }, ref) => {
  const panel = useChartStore(s => s.panels[panelId]);
  
  const setAbsorptionEnabled = useChartStore(s => s.setAbsorptionEnabled);
  const setAbsorptionMinScore = useChartStore(s => s.setAbsorptionMinScore);
  const setAbsorptionSide = useChartStore(s => s.setAbsorptionSide);
  
  const setExhaustionEnabled = useChartStore(s => s.setExhaustionEnabled);
  const setExhaustionMinScore = useChartStore(s => s.setExhaustionMinScore);
  const setExhaustionSide = useChartStore(s => s.setExhaustionSide);
  const setExhaustionLookback = useChartStore(s => s.setExhaustionLookback);
  const setExhaustionShowProvisional = useChartStore(s => s.setExhaustionShowProvisional);
  
  const setIcebergEnabled = useChartStore(s => s.setIcebergEnabled);
  const setIcebergMinScore = useChartStore(s => s.setIcebergMinScore);
  const setIcebergLookback = useChartStore(s => s.setIcebergLookback);
  const setIcebergShowSuspected = useChartStore(s => s.setIcebergShowSuspected);
  const setIcebergShowLabels = useChartStore(s => s.setIcebergShowLabels);
  const setIcebergShowTint = useChartStore(s => s.setIcebergShowTint);
  
  const setLiquidityVacuumEnabled = useChartStore(s => s.setLiquidityVacuumEnabled);
  const setLiquidityVacuumMinScore = useChartStore(s => s.setLiquidityVacuumMinScore);
  const setLiquidityVacuumShowLabels = useChartStore(s => s.setLiquidityVacuumShowLabels);
  const setLiquidityVacuumOpacity = useChartStore(s => s.setLiquidityVacuumOpacity);
  const setLiquidityVacuumMaxZones = useChartStore(s => s.setLiquidityVacuumMaxZones);

  const signalToggles = [
    {
      id: 'absorption',
      label: 'Absorption',
      enabled: panel.absorptionEnabled,
      onToggle: () => setAbsorptionEnabled(panelId, !panel.absorptionEnabled),
      enabledClass: 'bg-[#089981]/10 border-[#089981]/60 text-[#089981]',
    },
    {
      id: 'exhaustion',
      label: 'Exhaustion',
      enabled: panel.exhaustionEnabled,
      onToggle: () => setExhaustionEnabled(panelId, !panel.exhaustionEnabled),
      enabledClass: 'bg-[#F0B90B]/10 border-[#F0B90B]/60 text-[#F0B90B]',
    },
    {
      id: 'iceberg',
      label: 'Iceberg',
      enabled: panel.icebergEnabled,
      onToggle: () => setIcebergEnabled(panelId, !panel.icebergEnabled),
      enabledClass: 'bg-[#089981]/10 border-[#089981]/60 text-[#089981]',
    },
    {
      id: 'liquidity-vacuum',
      label: 'Liquidity Vacuum',
      enabled: panel.liquidityVacuumEnabled,
      onToggle: () => setLiquidityVacuumEnabled(panelId, !panel.liquidityVacuumEnabled),
      enabledClass: 'bg-[#3D7EFF]/10 border-[#3D7EFF]/60 text-[#3D7EFF]',
    },
  ];

  return (
    <div ref={ref} className="space-y-8">
      {/* Signal Toggles */}
      <div className="space-y-4">
        <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Signal Toggles</div>
        <div className="grid grid-cols-1 gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
          {signalToggles.map((signal) => (
            <button
              key={signal.id}
              onClick={signal.onToggle}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-200 ${
                signal.enabled
                  ? signal.enabledClass
                  : 'border-[#1F1F1F] bg-[#1F1F1F] text-text-dim hover:border-[#333] hover:text-main'
              }`}
            >
              <span>{signal.label}</span>
              <div
                className={`relative h-4 w-8 rounded-full transition-colors duration-200 ${
                  signal.enabled ? 'bg-current/25' : 'bg-[#1F1F1F]'
                }`}
              >
                <div
                  className={`absolute top-1 h-2 w-2 rounded-full bg-current transition-all duration-200 ${
                    signal.enabled ? 'left-5' : 'left-1'
                  }`}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Absorption Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Absorption Signals</div>
          <span className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-[0.18em] ${panel.absorptionEnabled ? 'border-[#089981]/60 text-[#089981]' : 'border-[#1F1F1F] text-text-dim/50'}`}>
            {panel.absorptionEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {panel.absorptionEnabled && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Score</label>
                <span className="text-[12px] font-mono font-bold text-[#089981]">{panel.absorptionMinScore}</span>
              </div>
              <input
                type="range"
                value={panel.absorptionMinScore}
                onChange={(e) => setAbsorptionMinScore(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#089981]"
                min="30" max="90" step="5"
              />
            </div>

            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
              <div className="flex gap-1">
                {(['buyer', 'seller', 'both'] as AbsorptionSide[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setAbsorptionSide(panelId, s)}
                    className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.absorptionSide === s
                      ? 'bg-[#1F1F1F] border-[#089981] text-[#089981]'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                  >
                    {s === 'buyer' ? 'Buy' : s === 'seller' ? 'Sell' : 'Both'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Exhaustion Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Exhaustion Signals</div>
          <span className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-[0.18em] ${panel.exhaustionEnabled ? 'border-[#F0B90B]/60 text-[#F0B90B]' : 'border-[#1F1F1F] text-text-dim/50'}`}>
            {panel.exhaustionEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {panel.exhaustionEnabled && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Min Score</label>
                <span className="text-[12px] font-mono font-bold text-[#F0B90B]">{panel.exhaustionMinScore}</span>
              </div>
              <input
                type="range"
                value={panel.exhaustionMinScore}
                onChange={(e) => setExhaustionMinScore(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#F0B90B]"
                min="30" max="90" step="5"
              />
            </div>

            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
              <div className="flex gap-1">
                {(['buyer', 'seller', 'both'] as ExhaustionSide[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setExhaustionSide(panelId, s)}
                    className={`flex-1 py-1.5 rounded text-[10px] font-black uppercase transition-all duration-200 border ${panel.exhaustionSide === s
                      ? 'bg-[#1F1F1F] border-[#F0B90B] text-[#F0B90B]'
                      : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                      }`}
                  >
                    {s === 'buyer' ? 'Buy' : s === 'seller' ? 'Sell' : 'Both'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Lookback window</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.exhaustionLookback} Candles</span>
              </div>
              <input
                type="range"
                value={panel.exhaustionLookback}
                onChange={(e) => setExhaustionLookback(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="3" max="8" step="1"
              />
            </div>

            <div className="flex items-center justify-between bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Show on live candle</label>
              <button
                onClick={() => setExhaustionShowProvisional(panelId, !panel.exhaustionShowProvisional)}
                className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${panel.exhaustionShowProvisional ? 'bg-[#3D7EFF]' : 'bg-[#1F1F1F]'
                  }`}
              >
                <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all duration-200 ${panel.exhaustionShowProvisional ? 'left-5' : 'left-1'
                  }`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Iceberg Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Iceberg Detection</div>
          <span className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-[0.18em] ${panel.icebergEnabled ? 'border-[#089981]/60 text-[#089981]' : 'border-[#1F1F1F] text-text-dim/50'}`}>
            {panel.icebergEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {panel.icebergEnabled && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Minimum score</label>
                <span className="text-[12px] font-mono font-bold text-[#089981]">{panel.icebergMinScore}</span>
              </div>
              <input
                type="range"
                value={panel.icebergMinScore}
                onChange={(e) => setIcebergMinScore(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#089981]"
                min="30" max="80" step="5"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Lookback window</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.icebergLookback} Candles</span>
              </div>
              <input
                type="range"
                value={panel.icebergLookback}
                onChange={(e) => setIcebergLookback(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="5" max="20" step="1"
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              {[
                ['Show suspected', panel.icebergShowSuspected, () => setIcebergShowSuspected(panelId, !panel.icebergShowSuspected)],
                ['Show labels', panel.icebergShowLabels, () => setIcebergShowLabels(panelId, !panel.icebergShowLabels)],
                ['Show background tint', panel.icebergShowTint, () => setIcebergShowTint(panelId, !panel.icebergShowTint)],
              ].map(([label, enabled, onClick]) => (
                <button
                  key={label as string}
                  onClick={onClick as () => void}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${enabled
                    ? 'bg-[#089981]/5 border-[#089981] text-[#089981]'
                    : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                    }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider">{label as string}</span>
                  <div className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-[#089981] shadow-[0_0_8px_rgba(8,153,129,0.5)]' : 'bg-[#1F1F1F]'}`} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Liquidity Vacuum Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black text-text-dim/50 uppercase tracking-[0.2em]">Liquidity Vacuum</div>
          <span className={`rounded-full border px-2 py-1 text-[9px] font-black tracking-[0.18em] ${panel.liquidityVacuumEnabled ? 'border-[#3D7EFF]/60 text-[#3D7EFF]' : 'border-[#1F1F1F] text-text-dim/50'}`}>
            {panel.liquidityVacuumEnabled ? 'ON' : 'OFF'}
          </span>
        </div>

        {panel.liquidityVacuumEnabled && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Minimum score</label>
                <span className="text-[12px] font-mono font-bold text-[#3D7EFF]">{panel.liquidityVacuumMinScore}</span>
              </div>
              <input
                type="range"
                value={panel.liquidityVacuumMinScore}
                onChange={(e) => setLiquidityVacuumMinScore(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#3D7EFF]"
                min="30" max="90" step="5"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Zone opacity</label>
                <span className="text-[12px] font-mono font-bold text-[#3D7EFF]">{Math.round(panel.liquidityVacuumOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                value={panel.liquidityVacuumOpacity * 100}
                onChange={(e) => setLiquidityVacuumOpacity(panelId, Number(e.target.value) / 100)}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-[#3D7EFF]"
                min="5" max="50" step="1"
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide">Max zones</label>
                <span className="text-[12px] font-mono font-bold text-accent">{panel.liquidityVacuumMaxZones}</span>
              </div>
              <input
                type="range"
                value={panel.liquidityVacuumMaxZones}
                onChange={(e) => setLiquidityVacuumMaxZones(panelId, Number(e.target.value))}
                className="w-full h-1 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer accent-accent"
                min="1" max="20" step="1"
              />
            </div>

            <button
              onClick={() => setLiquidityVacuumShowLabels(panelId, !panel.liquidityVacuumShowLabels)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 w-full ${panel.liquidityVacuumShowLabels
                ? 'bg-[#3D7EFF]/5 border-[#3D7EFF] text-[#3D7EFF]'
                : 'bg-[#1F1F1F] border-[#1F1F1F] text-text-dim hover:border-[#333]'
                }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider">Show labels</span>
              <div className={`w-1.5 h-1.5 rounded-full ${panel.liquidityVacuumShowLabels ? 'bg-[#3D7EFF] shadow-[0_0_8px_rgba(61,126,255,0.5)]' : 'bg-[#1F1F1F]'}`} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
SignalSettings.displayName = 'SignalSettings';
