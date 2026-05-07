import { FeedProvider } from '../components/FeedProvider';
import { PairSelector } from '../components/ui/PairSelector';
import { TimeframeSelector } from '../components/ui/TimeframeSelector';
import { ConnectionStatus } from '../components/ui/ConnectionStatus';
import { ChartModeToggle } from '../components/ui/ChartModeToggle';
import { BucketSizeInput } from '../components/ui/BucketSizeInput';
import { ChartCanvas } from '../components/chart/ChartCanvas';

export default function Home() {
  return (
    <FeedProvider>
      <div className="flex flex-col h-screen overflow-hidden text-main bg-background">
        {/* Toolbar */}
        <header className="h-10 border-b border-border bg-surface flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="font-bold text-base text-accent tracking-tight">OrderFlow</h1>
            <PairSelector />
            <TimeframeSelector />
            <ChartModeToggle />
            <BucketSizeInput />
          </div>
          <div>
            <ConnectionStatus />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-48 border-r border-border bg-surface p-3 hidden md:flex flex-col gap-4 shrink-0 z-10 shadow-lg">
            <div>
              <h2 className="text-text-muted text-[10px] uppercase font-bold tracking-wider mb-2">Data Settings</h2>
              <div className="flex flex-col gap-2">
                <label className="text-xs flex justify-between items-center text-text-dim">
                  Tick Size
                  <input type="text" className="w-12 bg-background border border-border rounded px-1.5 py-0.5 text-right text-xs focus:border-accent focus:outline-none" defaultValue="0.5" />
                </label>
              </div>
            </div>
          </aside>

          {/* Chart Area */}
          <main className="flex-1 relative flex flex-col bg-[#0D0D0D]">
            <ChartCanvas />
          </main>
        </div>
      </div>
    </FeedProvider>
  );
}
