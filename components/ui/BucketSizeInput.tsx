'use client';

import { useChartStore } from '../../lib/store/chart';

export function BucketSizeInput() {
  const bucketSize = useChartStore((state) => state.bucketSize);
  const setBucketSize = useChartStore((state) => state.setBucketSize);

  return (
    <div className="flex items-center gap-2 text-[10px] text-text-dim ml-2 border-l border-border pl-4 h-6">
      <label htmlFor="bucketSize" className="uppercase font-black tracking-[0.1em]">
        Bucket
      </label>
      <input
        id="bucketSize"
        type="number"
        value={bucketSize}
        onChange={(e) => {
          const val = Number(e.target.value);
          if (val > 0) {
            setBucketSize(val);
          }
        }}
        className="w-14 bg-surface border border-border rounded-md px-1.5 py-0.5 text-right text-[11px] font-bold focus:border-accent focus:ring-1 focus:ring-accent/20 focus:outline-none transition-all text-main"
        step="1"
        min="1"
      />
    </div>
  );
}
