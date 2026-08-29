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
    activeIndicators = ['volumeBars', 'stats'],
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
  const rawVolumeHeight = Math.round(canvasHeight * (Math.max(8, Math.min(35, volumeBarsHeightPct || 18)) / 100));
  const volumeHeight = isVolumeActive ? Math.max(28, Math.min(Math.round(canvasHeight * 0.35), rawVolumeHeight)) : 0;

  // Determine active bottom indicators in user-specified order from activeIndicators
  const orderList: BottomIndicatorId[] = [];
  const seen = new Set<BottomIndicatorId>();

  for (const id of activeIndicators) {
    if (id === 'stats' && isStatsActive && !seen.has('stats')) {
      orderList.push('stats');
      seen.add('stats');
    } else if (id === 'volumeBars' && isVolumeActive && !seen.has('volumeBars')) {
      orderList.push('volumeBars');
      seen.add('volumeBars');
    }
  }

  // Fallback: If an indicator is active but missing from activeIndicators list, append it
  if (isVolumeActive && !seen.has('volumeBars')) {
    orderList.push('volumeBars');
    seen.add('volumeBars');
  }
  if (isStatsActive && !seen.has('stats')) {
    orderList.push('stats');
    seen.add('stats');
  }

  const totalHeight = (isStatsActive ? statsHeight : 0) + (isVolumeActive ? volumeHeight : 0);
  const mainChartHeight = Math.max(40, canvasHeight - timeAxisHeight - totalHeight);

  let currentY = mainChartHeight;
  const panels: BottomPanelLayout[] = [];
  let statsPanel: BottomPanelLayout | undefined;
  let volumePanel: BottomPanelLayout | undefined;

  for (const id of orderList) {
    const height = id === 'stats' ? statsHeight : volumeHeight;
    const panelLayout: BottomPanelLayout = {
      id,
      top: currentY,
      height,
      bottom: currentY + height,
    };
    panels.push(panelLayout);
    if (id === 'stats') statsPanel = panelLayout;
    if (id === 'volumeBars') volumePanel = panelLayout;
    currentY += height;
  }

  return {
    totalHeight,
    mainChartHeight,
    panels,
    statsPanel,
    volumePanel,
  };
}
