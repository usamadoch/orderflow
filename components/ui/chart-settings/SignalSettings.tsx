'use client';

import { forwardRef } from 'react';
import { FigSwitch, FigSegmentedControl, FigButton, PropskitSlider } from '../fig';
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
            <FigButton
              key={signal.id}
              variant="ghost"
              size="medium"
              selected={signal.enabled}
              onClick={signal.onToggle}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] w-full ${
                signal.enabled
                  ? signal.enabledClass
                  : 'border-[#1F1F1F] bg-[#1F1F1F] text-text-dim hover:border-[#333] hover:text-main'
              }`}
            >
              <span>{signal.label}</span>
              <div className="pointer-events-none">
                <FigSwitch checked={signal.enabled} />
              </div>
            </FigButton>
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
              <PropskitSlider
                label="Min Score"
                value={panel.absorptionMinScore}
                min={30}
                max={90}
                step={5}
                onChange={(val: number) => setAbsorptionMinScore(panelId, val)}
                onInput={(val: number) => setAbsorptionMinScore(panelId, val)}
              />
            </div>

            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
              <FigSegmentedControl
                full
                value={panel.absorptionSide}
                onChange={(val) => setAbsorptionSide(panelId, val as AbsorptionSide)}
                options={[
                  { value: 'buyer', label: 'Buy' },
                  { value: 'seller', label: 'Sell' },
                  { value: 'both', label: 'Both' },
                ]}
              />
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
              <PropskitSlider
                label="Min Score"
                value={panel.exhaustionMinScore}
                min={30}
                max={90}
                step={5}
                onChange={(val: number) => setExhaustionMinScore(panelId, val)}
                onInput={(val: number) => setExhaustionMinScore(panelId, val)}
              />
            </div>

            <div className="flex flex-col gap-2 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <label className="text-[11px] font-bold text-text-dim uppercase tracking-wide mb-1">Side Filter</label>
              <FigSegmentedControl
                full
                value={panel.exhaustionSide}
                onChange={(val) => setExhaustionSide(panelId, val as ExhaustionSide)}
                options={[
                  { value: 'buyer', label: 'Buy' },
                  { value: 'seller', label: 'Sell' },
                  { value: 'both', label: 'Both' },
                ]}
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitSlider
                label="Lookback"
                value={panel.exhaustionLookback}
                min={3}
                max={8}
                step={1}
                units=" candles"
                onChange={(val: number) => setExhaustionLookback(panelId, val)}
                onInput={(val: number) => setExhaustionLookback(panelId, val)}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Show on live candle</span>
              <FigSwitch
                checked={panel.exhaustionShowProvisional}
                onChange={(checked) => setExhaustionShowProvisional(panelId, checked)}
                aria-label="Show on live candle"
              />
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
              <PropskitSlider
                label="Minimum score"
                value={panel.icebergMinScore}
                min={30}
                max={80}
                step={5}
                onChange={(val: number) => setIcebergMinScore(panelId, val)}
                onInput={(val: number) => setIcebergMinScore(panelId, val)}
              />
            </div>

            <div className="flex flex-col gap-1.5 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitSlider
                label="Lookback"
                value={panel.icebergLookback}
                min={5}
                max={20}
                step={1}
                units=" candles"
                onChange={(val: number) => setIcebergLookback(panelId, val)}
                onInput={(val: number) => setIcebergLookback(panelId, val)}
              />
            </div>

            <div className="grid grid-cols-1 gap-2">
              {[
                { label: 'Show suspected', checked: panel.icebergShowSuspected, toggle: () => setIcebergShowSuspected(panelId, !panel.icebergShowSuspected) },
                { label: 'Show labels', checked: panel.icebergShowLabels, toggle: () => setIcebergShowLabels(panelId, !panel.icebergShowLabels) },
                { label: 'Show background tint', checked: panel.icebergShowTint, toggle: () => setIcebergShowTint(panelId, !panel.icebergShowTint) },
              ].map(({ label, checked, toggle }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">{label}</span>
                  <FigSwitch
                    checked={checked}
                    onChange={toggle}
                    aria-label={`Toggle ${label}`}
                  />
                </div>
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
            <div className="flex flex-col gap-3 bg-[#1F1F1F] p-3 rounded-lg border border-[#1F1F1F]">
              <PropskitSlider
                label="Minimum score"
                value={panel.liquidityVacuumMinScore}
                min={30}
                max={90}
                step={5}
                onChange={(val: number) => setLiquidityVacuumMinScore(panelId, val)}
                onInput={(val: number) => setLiquidityVacuumMinScore(panelId, val)}
              />

              <PropskitSlider
                label="Zone opacity"
                value={Math.round(panel.liquidityVacuumOpacity * 100)}
                min={5}
                max={50}
                step={1}
                units="%"
                onChange={(val: number) => setLiquidityVacuumOpacity(panelId, val / 100)}
                onInput={(val: number) => setLiquidityVacuumOpacity(panelId, val / 100)}
              />

              <PropskitSlider
                label="Max zones"
                value={panel.liquidityVacuumMaxZones}
                min={1}
                max={20}
                step={1}
                onChange={(val: number) => setLiquidityVacuumMaxZones(panelId, val)}
                onInput={(val: number) => setLiquidityVacuumMaxZones(panelId, val)}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#141414]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-dim">Show labels</span>
              <FigSwitch
                checked={panel.liquidityVacuumShowLabels}
                onChange={(checked) => setLiquidityVacuumShowLabels(panelId, checked)}
                aria-label="Toggle Show labels"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
SignalSettings.displayName = 'SignalSettings';
