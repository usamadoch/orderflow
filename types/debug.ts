import type { VolumeBarsInputData, VolumeBarsMarketSource } from './chart';

export type DebugTab = 'performance' | 'restore' | 'runtime' | 'bubbles' | 'signals' | 'store';

export interface VolumeBarsDebugSnapshot {
  panelId: string;
  volumeBarsEnabled: boolean;
  inputData: VolumeBarsInputData;
  volumeInputData: VolumeBarsInputData;
  marketSource: VolumeBarsMarketSource;
  flowSourceUsed: 'spot' | 'futures' | 'both';
  visibleBarsCount: number;
  volumeBarsVisibleCount: number;
  volumeBarsHistoricalCount: number;
  volumeBarsLiveCount: number;
  maxVisibleValue: number;
  averageValue: number | null;
  unavailableReason: string | null;
  liveOnlyReason: string | null;
}
