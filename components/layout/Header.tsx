'use client';

import { PairSelector } from '../ui/PairSelector';
import { TimeframeSelector } from '../ui/TimeframeSelector';
import { ConnectionStatus } from '../ui/ConnectionStatus';
import { ChartModeToggle } from '../ui/ChartModeToggle';
import { BucketSizeInput } from '../ui/BucketSizeInput';

export function Header() {
  return (
    <header className="h-10 border-b border-border bg-surface flex items-center px-4 justify-between shrink-0 shadow-sm z-20">
      <div className="flex items-center gap-6">
        <h1 className="font-extrabold text-base text-accent tracking-tighter flex items-center gap-2">
          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
          OrderFlow
        </h1>
        <div className="h-4 w-[1px] bg-border mx-1" />
        <div className="flex items-center gap-4">
          <PairSelector />
          <TimeframeSelector />
          <ChartModeToggle />
          <BucketSizeInput />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ConnectionStatus />
      </div>
    </header>
  );
}
