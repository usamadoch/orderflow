'use client';

import { useChartStore } from '../../lib/store/chart';

export function BucketSizeInput() {
  const bucketSize = useChartStore((state) => state.bucketSize);
  const setBucketSize = useChartStore((state) => state.setBucketSize);

  return (
    <div className="flex items-center gap-2 text-xs text-text-dim ml-2 border-l border-border pl-4">
      <label htmlFor="bucketSize" className="uppercase font-medium tracking-wider">
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
        className="w-16 bg-background border border-border rounded px-2 py-1 text-right text-xs focus:border-accent focus:outline-none font-mono text-[#E8E8E8]"
        step="10"
        min="1"
      />
    </div>
  );
}
