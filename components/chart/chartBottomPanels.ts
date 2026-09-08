import { IndicatorId, StatsIndicatorItem } from '@/types/chart';
import { STATS_GRID_ROW_HEIGHT } from './drawStatsGrid';

export type BottomIndicatorId = 'stats' | 'volumeBars';

export interface BottomPanelLayout {
  id: BottomIndicatorId;
  top: number;
  height: number;
  bottom: number;
}

export interface BottomPanelsComputedLayout {
  totalHeight: number;
  mainChartHeight: number;
  panels: BottomPanelLayout[];
  statsPanel?: BottomPanelLayout;
  volumePanel?: BottomPanelLayout;
}

export interface ComputeBottomPanelsOptions {
  activeIndicators?: IndicatorId[];
  statsIndicatorEnabled: boolean;
  statsIndicatorItems: StatsIndicatorItem[] | string[];
  volumeBarsEnabled: boolean;
  volumeBarsHeightPct: number;
  canvasHeight: number;
  timeAxisHeight: number;
}

export function computeBottomPanelsLayout(options: ComputeBottomPanelsOptions): BottomPanelsComputedLayout {
  const {
    statsIndicatorEnabled,
    statsIndicatorItems,
    volumeBarsEnabled,
    volumeBarsHeightPct,
    canvasHeight,
    timeAxisHeight,
  } = options;

  const isStatsActive = Boolean(statsIndicatorEnabled && statsIndicatorItems && statsIndicatorItems.length > 0);
  const isVolumeActive = Boolean(volumeBarsEnabled);

  const statsHeight = isStatsActive ? statsIndicatorItems.length * STATS_GRID_ROW_HEIGHT : 0;

  // Only docked bottom panels (like stats grid) reduce mainChartHeight.
  // Volume bars render directly on the main chart canvas as an overlay.
  const totalHeight = isStatsActive ? statsHeight : 0;
  const mainChartHeight = Math.max(40, canvasHeight - timeAxisHeight - totalHeight);

  const rawVolumeHeight = Math.round(mainChartHeight * (Math.max(8, Math.min(35, volumeBarsHeightPct || 18)) / 100));
  const volumeHeight = isVolumeActive ? Math.max(28, Math.min(Math.round(mainChartHeight * 0.35), rawVolumeHeight)) : 0;

  const panels: BottomPanelLayout[] = [];
  let statsPanel: BottomPanelLayout | undefined;
  let volumePanel: BottomPanelLayout | undefined;

  if (isVolumeActive) {
    volumePanel = {
      id: 'volumeBars',
      top: Math.max(0, mainChartHeight - volumeHeight),
      height: volumeHeight,
      bottom: mainChartHeight,
    };
  }

  if (isStatsActive) {
    statsPanel = {
      id: 'stats',
      top: mainChartHeight,
      height: statsHeight,
      bottom: mainChartHeight + statsHeight,
    };
    panels.push(statsPanel);
  }

  return {
    totalHeight,
    mainChartHeight,
    panels,
    statsPanel,
    volumePanel,
  };
}
