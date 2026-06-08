'use client';

import React from 'react';
import { Copy, RefreshCw, X } from 'lucide-react';
import {
  createCopySnapshot,
  getDebugPanelSnapshot,
  getRecentRestoreCalls,
  isDebugPanelEnabled,
  type DebugPanelSnapshot,
} from '@/lib/debug/debugPanelAdapter';

type DebugTab = 'performance' | 'restore' | 'runtime' | 'bubbles' | 'signals' | 'store';

const TABS: Array<{ id: DebugTab; label: string }> = [
  { id: 'performance', label: 'Performance' },
  { id: 'restore', label: 'Restore' },
  { id: 'runtime', label: 'Runtime' },
  { id: 'bubbles', label: 'Bubbles' },
  { id: 'signals', label: 'Signals' },
  { id: 'store', label: 'Store/Updates' },
];

const MISSING = 'Not instrumented yet';

export function DebugPanel() {
  const enabled = isDebugPanelEnabled();
  const [open, setOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<DebugTab>('performance');
  const [snapshot, setSnapshot] = React.useState<DebugPanelSnapshot | null>(null);
  const [copyStatus, setCopyStatus] = React.useState('');

  const refresh = React.useCallback(() => {
    if (!enabled) return;
    setSnapshot(getDebugPanelSnapshot());
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!event.ctrlKey || !event.shiftKey || key !== 'd') return;
      event.preventDefault();
      setOpen((current) => !current);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled || !open) return;

    refresh();
    const interval = window.setInterval(refresh, 1000);
    return () => window.clearInterval(interval);
  }, [enabled, open, refresh]);

  const copySnapshot = React.useCallback(async () => {
    const current = snapshot ?? getDebugPanelSnapshot();
    const copyPayload = createCopySnapshot(current);

    try {
      await navigator.clipboard.writeText(JSON.stringify(copyPayload, null, 2));
      setCopyStatus('Copied');
      window.setTimeout(() => setCopyStatus(''), 1400);
    } catch {
      setCopyStatus('Copy failed');
      window.setTimeout(() => setCopyStatus(''), 1800);
    }
  }, [snapshot]);

  if (!enabled || !open) return null;

  const current = snapshot ?? getDebugPanelSnapshot();

  return (
    <div className="popup-contrast fixed right-4 top-16 z-[80] flex max-h-[calc(100vh-5rem)] w-[min(920px,calc(100vw-2rem))] flex-col overflow-hidden rounded-md border border-[#2A2F35] bg-[#1F1F1F]/95 text-main shadow-2xl backdrop-blur">
      <div className="flex min-h-11 items-center justify-between border-b border-[#1F252B] px-3">
        <div className="min-w-0">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-text-muted">Market Debug</div>
          <div className="truncate text-[10px] font-mono text-text-dim">
            {new Date(current.timestamp).toLocaleTimeString()} / {current.marketDebug?.enabled ? 'metrics enabled' : 'metrics unavailable'}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {copyStatus && <span className="mr-1 text-[10px] font-semibold text-accent">{copyStatus}</span>}
          <button
            type="button"
            onClick={refresh}
            className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-text-muted transition-colors hover:border-accent/50 hover:text-main"
            title="Refresh"
            aria-label="Refresh debug snapshot"
          >
            <RefreshCw size={14} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={copySnapshot}
            className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-text-muted transition-colors hover:border-accent/50 hover:text-main"
            title="Copy Snapshot"
            aria-label="Copy debug snapshot"
          >
            <Copy size={14} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-text-muted transition-colors hover:border-red-400/50 hover:text-red-200"
            title="Close"
            aria-label="Close debug panel"
          >
            <X size={15} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[#1F252B] px-2 py-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`h-8 shrink-0 rounded border px-3 text-[11px] font-bold transition-colors ${
              activeTab === tab.id
                ? 'border-accent/60 bg-accent/15 text-main'
                : 'border-white/10 bg-[#1F1F1F] text-text-muted hover:border-white/20 hover:text-main'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {activeTab === 'performance' && <PerformanceTab snapshot={current} />}
        {activeTab === 'restore' && <RestoreTab snapshot={current} />}
        {activeTab === 'runtime' && <RuntimeTab snapshot={current} />}
        {activeTab === 'bubbles' && <BubblesTab snapshot={current} />}
        {activeTab === 'signals' && <SignalsTab snapshot={current} />}
        {activeTab === 'store' && <StoreTab snapshot={current} />}
      </div>
    </div>
  );
}

function PerformanceTab({ snapshot }: { snapshot: DebugPanelSnapshot }) {
  const debug = snapshot.marketDebug;

  return (
    <div className="space-y-3">
      <Section title="Global Totals">
        {debug ? (
          <MetricGrid
            items={[
              ['Active streams', debug.totals.activeStreams],
              ['Active caches', debug.totals.activeCaches],
              ['Stream events', debug.totals.streamEvents],
              ['Cache hits', debug.totals.cacheHits],
              ['Cache misses', debug.totals.cacheMisses],
              ['Restore requests', debug.totals.restoreRequests],
              ['Restore dedupe', debug.totals.restoreDedupe],
              ['Live trade dedupe', debug.totals.liveTradeDedupe],
            ]}
          />
        ) : (
          <EmptyState text="Market debug snapshot is unavailable." />
        )}
      </Section>

      <Section title="Stream Rates">
        {debug && debug.streams.length > 0 ? (
          <Table
            headers={['Type', 'Key', 'Subs', 'Events', 'Rate/sec']}
            rows={debug.streams.map((stream) => [
              stream.streamType,
              stream.key,
              stream.subscriberCount,
              stream.eventCount,
              formatNumber(stream.eventRatePerSecond, 2),
            ])}
          />
        ) : (
          <EmptyState text="No stream metrics yet." />
        )}
      </Section>

      <Section title="Future Timings">
        <MetricGrid
          items={[
            ['Total redraw time', MISSING],
            ['Candles draw time', MISSING],
            ['Footprint draw time', MISSING],
            ['Bubbles draw time', MISSING],
            ['Volume Profile draw time', MISSING],
            ['Signals draw time', MISSING],
            ['Drawings/tools draw time', MISSING],
            ['Redraw count/sec', MISSING],
          ]}
        />
      </Section>
    </div>
  );
}

function RestoreTab({ snapshot }: { snapshot: DebugPanelSnapshot }) {
  const calls = getRecentRestoreCalls(snapshot);

  return (
    <div className="space-y-3">
      <Section title="Current Panel Status">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {panelEntries(snapshot).map(([panelId, runtime]) => (
            <PanelBlock key={panelId} title={`${panelId} panel`}>
              <InfoRow label="Stage" value={runtime.historyRestoreStatus?.stage ?? 'idle'} />
              <InfoRow label="Message" value={runtime.historyRestoreStatus?.message ?? 'No restore status'} />
              <InfoRow label="Live connected" value={runtime.historyRestoreStatus?.liveConnected ?? runtime.connected} />
              <InfoRow label="Candles" value={runtime.historyRestoreStatus?.candleCount ?? runtime.candleCount} />
              <InfoRow label="Profile rows" value={runtime.historyRestoreStatus?.profileRowCount ?? 0} />
              <InfoRow label="Footprint rows" value={runtime.historyRestoreStatus?.footprintRowCount ?? 0} />
              <InfoRow label="Raw trade restore skipped" value={formatMaybe(runtime.historyRestoreStatus?.rawTradeRestoreSkipped)} />
              <InfoRow label="Profile restore skipped" value={formatMaybe(runtime.historyRestoreStatus?.profileRestoreSkipped)} />
              <InfoRow label="Footprint restore skipped" value={formatMaybe(runtime.historyRestoreStatus?.footprintRestoreSkipped)} />
              <InfoRow label="Footprint requested" value={formatSecondsRange(runtime.historyRestoreStatus?.footprintRequestedRange)} />
              <InfoRow label="Footprint clamped" value={formatSecondsRange(runtime.historyRestoreStatus?.footprintClampedRange)} />
              <InfoRow label="Footprint chunks" value={runtime.historyRestoreStatus?.footprintChunkCount ?? 0} />
              <InfoRow label="Rows per chunk" value={formatRowsPerChunk(runtime.historyRestoreStatus?.footprintRowsPerChunk)} />
              <InfoRow label="Range too large skipped" value={formatMaybe(runtime.historyRestoreStatus?.footprintRangeTooLargeSkipped)} />
              <InfoRow label="Footprint failure" value={runtime.historyRestoreStatus?.footprintRestoreFailureReason ?? 'none'} />
            </PanelBlock>
          ))}
        </div>
      </Section>

      <Section title="Recent Restore Calls">
        {calls.length > 0 ? (
          <Table
            headers={['Kind', 'Key', 'Rows', 'Skipped', 'Status']}
            rows={calls.map((call) => [
              call.kind,
              call.key,
              call.rowsFetched ?? call.rowsWritten ?? call.failedRows ?? 0,
              call.skippedRows ?? 0,
              formatDetailStatus(call.details),
            ])}
          />
        ) : (
          <EmptyState text="No restore diagnostics yet." />
        )}
      </Section>
    </div>
  );
}

function RuntimeTab({ snapshot }: { snapshot: DebugPanelSnapshot }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {panelEntries(snapshot).map(([panelId, runtime]) => {
        const settings = snapshot.settings.panels[panelId];
        return (
          <PanelBlock key={panelId} title={`${panelId} panel`}>
            <InfoRow label="Symbol" value={settings.pair} />
            <InfoRow label="Timeframe" value={settings.timeframe} />
            <InfoRow label="Chart mode" value={settings.chartMode} />
            <InfoRow label="Contract type" value={settings.contractType} />
            <InfoRow label="Data source" value={settings.dataSourceMode} />
            <InfoRow label="Connected" value={runtime.connected} />
            <InfoRow label="Loading history" value={runtime.isLoadingHistory} />
            <InfoRow label="Candles" value={runtime.candleCount} />
            <InfoRow label="Trades buffer" value={runtime.tradeCount} />
            <InfoRow label="Footprint work" value={settings.needsFootprintWork ? settings.footprintWorkReasons.join(', ') : 'disabled'} />
            <InfoRow label="Liquidity zones" value={runtime.liquidityZoneCount} />
            <InfoRow label="Orderbook status" value={settings.liquidityEnabled || settings.liquidityHeatmapEnabled ? 'Depth stream metrics available globally' : 'disabled'} />
            <InfoRow label="Heatmap status" value={settings.liquidityHeatmapEnabled ? 'enabled' : 'disabled'} />
          </PanelBlock>
        );
      })}
    </div>
  );
}

function BubblesTab({ snapshot }: { snapshot: DebugPanelSnapshot }) {
  const aggregateBubbles = snapshot.marketDebug?.aggregateBubbles ?? {};

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {panelEntries(snapshot).map(([panelId, runtime]) => {
        const settings = snapshot.settings.panels[panelId];
        const bubbleDebug = aggregateBubbles[panelId];

        return (
          <PanelBlock key={panelId} title={`${panelId} panel`}>
            <InfoRow label="Bubble source" value={bubbleDebug?.bubbleSource ?? settings.bubbleSource} />
            <InfoRow label="Aggregate market source" value={bubbleDebug?.aggregateBubbleMarketSource ?? settings.aggregateBubbleMarketSource} />
            <InfoRow label="Buffer" value={`${bubbleDebug?.bufferSize ?? runtime.aggregateBubbleEventCount} / ${bubbleDebug?.maxBufferSize ?? 'n/a'}`} />
            <InfoRow label="Live count" value={bubbleDebug?.liveEventCount ?? runtime.aggregateBubbleLiveCount} />
            <InfoRow label="Restored count" value={bubbleDebug?.restoredEventCount ?? runtime.aggregateBubbleRestoredCount} />
            <InfoRow label="Restored spot/futures" value={`${bubbleDebug?.restoredSpotCount ?? 0} / ${bubbleDebug?.restoredFuturesCount ?? 0}`} />
            <InfoRow label="Visible count" value={bubbleDebug?.visibleEventCount ?? 0} />
            <InfoRow label="Rendered count" value={bubbleDebug?.renderedCount ?? 0} />
            <InfoRow label="Size by" value={bubbleDebug?.settings.sizeBy ?? settings.bubbleSizeBy} />
            <InfoRow label="Scale mode" value={bubbleDebug?.settings.scaleMode ?? settings.bubbleScaleMode} />
            <InfoRow label="Min volume" value={bubbleDebug?.settings.minVolume ?? MISSING} />
            <InfoRow label="Min orders" value={bubbleDebug?.settings.minOrders ?? MISSING} />
            <InfoRow label="Filter reasons" value={bubbleDebug ? formatRecord(bubbleDebug.filterReasons) : 'No aggregate bubble debug yet'} />
            <JsonSnippet label="Latest rendered" value={bubbleDebug?.latestRendered ?? null} />
          </PanelBlock>
        );
      })}
    </div>
  );
}

function SignalsTab({ snapshot }: { snapshot: DebugPanelSnapshot }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {panelEntries(snapshot).map(([panelId, runtime]) => (
          <PanelBlock key={panelId} title={`${panelId} panel`}>
            <InfoRow label="Absorption count" value={runtime.absorptionCount} />
            <InfoRow label="Exhaustion count" value={runtime.exhaustionCount} />
            <InfoRow label="Iceberg count" value={runtime.icebergCount} />
            <InfoRow label="Liquidity vacuum count" value={runtime.liquidityVacuumCount} />
          </PanelBlock>
        ))}
      </div>
      <Section title="Future Signal Metrics">
        <MetricGrid
          items={[
            ['Signal compute timings', MISSING],
            ['Signal draw timings', MISSING],
          ]}
        />
      </Section>
    </div>
  );
}

function StoreTab({ snapshot }: { snapshot: DebugPanelSnapshot }) {
  return (
    <div className="space-y-3">
      <Section title="Persisted Settings Summary">
        <MetricGrid
          items={[
            ['Layout mode', snapshot.settings.layoutMode],
            ['Focus mode', formatBool(snapshot.settings.focusMode)],
            ['Panel count', snapshot.settings.panelCount],
            ['Active panel', snapshot.settings.activePanel],
            ['Active panel ids', snapshot.settings.activePanelIds.join(', ')],
          ]}
        />
      </Section>

      <Section title="Runtime Store Summary">
        <MetricGrid
          items={[
            ['Crosshair active panel', snapshot.runtime.crosshair.activePanel ?? 'none'],
            ['Left candles', snapshot.runtime.panels.left.candleCount],
            ['Right candles', snapshot.runtime.panels.right.candleCount],
            ['Left aggregate bubbles', snapshot.runtime.panels.left.aggregateBubbleEventCount],
            ['Right aggregate bubbles', snapshot.runtime.panels.right.aggregateBubbleEventCount],
          ]}
        />
      </Section>

      <Section title="Future Update Metrics">
        <MetricGrid
          items={[
            ['Store updates/sec', MISSING],
            ['localStorage writes/sec', MISSING],
            ['Mousemove updates/sec', MISSING],
            ['Redraw triggers/sec', MISSING],
          ]}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[#20262C] bg-[#1F1F1F]">
      <div className="border-b border-[#1A2026] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-text-muted">
        {title}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function PanelBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[#20262C] bg-[#1F1F1F] p-3">
      <div className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-text-muted">{title}</div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function MetricGrid({ items }: { items: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded border border-white/10 bg-[#1F1F1F] px-2 py-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-text-dim">{label}</div>
          <div className="mt-1 break-words text-xs font-mono text-main">{formatValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 text-xs">
      <span className="text-text-dim">{label}</span>
      <span className="min-w-0 break-words font-mono text-main">{formatValue(value)}</span>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-[#1F252B] text-[10px] uppercase tracking-[0.08em] text-text-dim">
            {headers.map((header) => (
              <th key={header} className="px-2 py-2 font-black">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-b border-white/5 last:border-0">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-[280px] px-2 py-2 align-top font-mono text-text-muted">
                  <span className="break-words">{formatValue(cell)}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function JsonSnippet({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="pt-2">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-text-dim">{label}</div>
      <pre className="max-h-32 overflow-auto rounded border border-white/10 bg-[#1F1F1F] p-2 text-[10px] leading-relaxed text-text-muted">
        {value ? JSON.stringify(value, null, 2) : 'null'}
      </pre>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="text-xs font-medium text-text-dim">{text}</div>;
}

function panelEntries(snapshot: DebugPanelSnapshot) {
  return Object.entries(snapshot.runtime.panels) as Array<[
    keyof DebugPanelSnapshot['runtime']['panels'],
    DebugPanelSnapshot['runtime']['panels'][keyof DebugPanelSnapshot['runtime']['panels']],
  ]>;
}

function formatDetailStatus(details: Record<string, unknown> | undefined) {
  if (!details) return 'n/a';
  return String(details.status ?? details.reason ?? details.source ?? 'recorded');
}

function formatRecord(record: Record<string, number>) {
  const entries = Object.entries(record);
  if (entries.length === 0) return 'none';
  return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
}

function formatMaybe(value: boolean | undefined) {
  return value === undefined ? 'n/a' : formatBool(value);
}

function formatSecondsRange(range: { startSeconds: number; endSeconds: number } | null | undefined) {
  if (!range) return 'n/a';
  const start = new Date(range.startSeconds * 1000).toISOString();
  const end = new Date(range.endSeconds * 1000).toISOString();
  const minutes = Math.max(0, Math.round((range.endSeconds - range.startSeconds) / 60));
  return `${start} -> ${end} (${minutes}m)`;
}

function formatRowsPerChunk(rows: number[] | undefined) {
  if (!rows || rows.length === 0) return 'n/a';
  return rows.join(', ');
}

function formatBool(value: boolean) {
  return value ? 'yes' : 'no';
}

function formatNumber(value: number, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function formatValue(value: React.ReactNode) {
  if (typeof value === 'boolean') return formatBool(value);
  if (value === null || value === undefined) return 'n/a';
  return value;
}
