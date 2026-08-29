import { FootprintCandle } from '../../types/footprint';
import { BASE_FOOTPRINT_BUCKET_SIZE } from './engine';

export class MirrorAggregationEngine {
  private footprintMap = new Map<number, FootprintCandle>();
  private displayBucketSize: number;

  constructor(bucketSize: number) {
    this.displayBucketSize = Math.max(BASE_FOOTPRINT_BUCKET_SIZE, bucketSize);
  }

  setDisplayBucketSize(bucketSize: number) {
    this.displayBucketSize = Math.max(BASE_FOOTPRINT_BUCKET_SIZE, bucketSize);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setDisplayTimeframeSeconds(_seconds: number) {
    // We don't use this directly in the mirror engine, but FeedProvider calls it
  }

  getDisplayBucketSize() {
    return this.displayBucketSize;
  }

  // The worker sends updated footprint candles, we just store them.
  hydrateFootprintCandles(footprints: FootprintCandle[]) {
    for (const fp of footprints) {
      if (fp) {
        this.footprintMap.set(fp.time, fp);
      }
    }
  }

  getFootprintCandle(time: number): FootprintCandle | null {
    return this.footprintMap.get(time) || null;
  }

  getAllFootprintCandles(): FootprintCandle[] {
    return Array.from(this.footprintMap.values()).sort((a, b) => a.time - b.time);
  }
  
  hasBaseFootprintCandle(time: number): boolean {
    return this.footprintMap.has(time);
  }

  // We don't ingest trades or candles locally anymore, the worker does it.
  // These are stubs to prevent FeedProvider from crashing before we fully refactor it.
  ingestTrade() {}
  ingestCandle() {}
  hydrateBaseFootprintCandle() {}
  trim() {}
  releaseSharedBaseCache() {}
  reset() {
    this.footprintMap.clear();
  }
  setSharedBaseCache() {}
}
