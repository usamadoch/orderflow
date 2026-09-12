/**
 * perfInstrumentation.ts
 *
 * INSTRUMENTATION ONLY — no production logic, no fixes.
 *
 * Provides:
 *   1. A PerformanceObserver that logs every long task >=50ms to console
 *      AND appends it to an in-memory ring buffer accessible via
 *      `window.__ltBuf` for post-hoc inspection.
 *
 *   2. `markStart(label)` / `markEnd(label)` helpers that bracket known
 *      expensive call-sites with performance.mark() + performance.measure().
 *      Each completed measure is also stored in `window.__markBuf` so that
 *      longtask entries can be cross-referenced with which marked function
 *      was executing at that moment.
 *
 * Usage:
 *   import { initLongTaskObserver, markStart, markEnd } from '@/lib/debug/perfInstrumentation';
 *   // call initLongTaskObserver() once (idempotent) from a useEffect with []
 *
 * Console output — longtask:
 *   [LT] +1234.56ms  dur=87ms  attr=self  ← inside: [buildProfile(92.0ms)]
 *
 * Console output — measure (only when >=10ms):
 *   [MARK] buildProfile  dur=92.3ms  start=+1234.56ms
 *
 * Browser console inspection:
 *   window.__ltBuf    → recent long task entries (newest at end, max 200)
 *   window.__markBuf  → recent measure entries (newest at end, max 200)
 */

export interface LongTaskEntry {
  type: 'longtask';
  startTime: number;    // ms since page load (performance.now() epoch)
  duration: number;     // ms
  wallTime: string;     // HH:MM:SS.mmm (local time)
  attribution: string;  // containerType from PerformanceLongTaskTiming
}

export interface MarkEntry {
  type: 'mark';
  label: string;
  startTime: number;    // ms since page load
  duration: number;     // ms
  wallTime: string;
}

const RING_SIZE = 200;

// Module-level singletons so the buffers survive re-renders
const _ltBuf: LongTaskEntry[] = [];
const _markBuf: MarkEntry[] = [];
let _observerInstalled = false;

function toWallTime(perfNow: number): string {
  const abs = (typeof performance !== 'undefined' ? performance.timeOrigin : 0) + perfNow;
  const d = new Date(abs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function pushRing<T>(buf: T[], entry: T): void {
  buf.push(entry);
  if (buf.length > RING_SIZE) buf.shift();
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Long-task observer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Install the PerformanceObserver for 'longtask' entries.
 * Safe to call multiple times — installs only once per page lifetime.
 * Call from a useEffect with [] dependency array.
 */
export function initLongTaskObserver(): void {
  if (typeof window === 'undefined') return;
  if (_observerInstalled) return;
  _observerInstalled = true;

  // Expose ring buffers on window for live console inspection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__ltBuf = _ltBuf;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__markBuf = _markBuf;

  if (!('PerformanceObserver' in window)) {
    console.warn('[perf-instr] PerformanceObserver not supported.');
    return;
  }

  const supportedTypes = PerformanceObserver.supportedEntryTypes ?? [];
  if (!supportedTypes.includes('longtask')) {
    console.warn('[perf-instr] "longtask" entry type not supported (enable in chrome://flags or use a Chromium build).');
    return;
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration < 50) continue;

      // PerformanceLongTaskTiming attribution (Chromium-specific)
      let attribution = 'self';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lt = entry as any;
      if (Array.isArray(lt.attribution) && lt.attribution.length > 0) {
        attribution = lt.attribution[0]?.containerType ?? 'self';
      }

      const ltEntry: LongTaskEntry = {
        type: 'longtask',
        startTime: entry.startTime,
        duration: entry.duration,
        wallTime: toWallTime(entry.startTime),
        attribution,
      };
      pushRing(_ltBuf, ltEntry);

      // Cross-reference: find any marks whose window overlaps this long task
      const ltEnd = entry.startTime + entry.duration;
      const overlapping = _markBuf
        .filter(m => m.startTime >= entry.startTime - 10 && (m.startTime + m.duration) <= ltEnd + 10)
        .map(m => `${m.label}(${m.duration.toFixed(0)}ms)`)
        .join(', ');
      const overlapStr = overlapping ? `  ← inside: [${overlapping}]` : '';

      console.log(
        `%c[LT] %c${ltEntry.wallTime}  dur=%c${ltEntry.duration.toFixed(0)}ms%c  attr=${attribution}${overlapStr}`,
        'color:#ff6b6b;font-weight:bold',
        'color:#888',
        'color:#ff6b6b;font-weight:bold',
        'color:#888',
      );
    }
  });

  try {
    observer.observe({ type: 'longtask', buffered: false });
    console.log(
      '%c[perf-instr] LongTask observer active (threshold: 50ms). Inspect: window.__ltBuf / window.__markBuf',
      'color:#4ecdc4;font-weight:bold',
    );
  } catch (e) {
    console.warn('[perf-instr] observer.observe failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. mark / measure helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Begin a named bracket. Pair with markEnd(label).
 * Label must be unique per concurrent call site (not re-entrant).
 */
export function markStart(label: string): void {
  if (typeof performance === 'undefined') return;
  try {
    performance.mark(`__pi_s_${label}`);
  } catch { /* instrumentation must never throw */ }
}

/**
 * End a named bracket and record the measure.
 * Only logs to console when duration >=10ms to keep noise low.
 */
export function markEnd(label: string): void {
  if (typeof performance === 'undefined') return;
  try {
    const startMark = `__pi_s_${label}`;
    const endMark   = `__pi_e_${label}`;
    const measure   = `__pi_m_${label}`;
    performance.mark(endMark);
    const m = performance.measure(measure, startMark, endMark);

    if (m.duration >= 10) {
      const entry: MarkEntry = {
        type: 'mark',
        label,
        startTime: m.startTime,
        duration: m.duration,
        wallTime: toWallTime(m.startTime),
      };
      pushRing(_markBuf, entry);

      console.log(
        `%c[MARK] %c${label}  %cdur=${m.duration.toFixed(1)}ms%c  @${entry.wallTime}`,
        'color:#ffd93d;font-weight:bold',
        'color:#fff',
        'color:#ffd93d;font-weight:bold',
        'color:#888',
      );
    }

    // Clean up timeline entries to avoid memory growth
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(measure);
  } catch { /* swallow */ }
}
