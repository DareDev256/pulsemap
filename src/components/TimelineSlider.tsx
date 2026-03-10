"use client";

import { useMemo, useCallback } from "react";
import { OutbreakGeoFeature } from "@/types";

interface TimelineSliderProps {
  features: OutbreakGeoFeature[];
  value: number;
  onChange: (value: number) => void;
}

const BINS = 24;

function minMax(arr: number[]): [number, number] {
  let lo = arr[0], hi = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < lo) lo = arr[i];
    if (arr[i] > hi) hi = arr[i];
  }
  return [lo, hi];
}

function buildSparkline(timestamps: number[], min: number, range: number): number[] {
  if (timestamps.length === 0) return Array(BINS).fill(0);
  const counts = Array(BINS).fill(0) as number[];
  for (const ts of timestamps) counts[Math.min(BINS - 1, Math.floor(((ts - min) / range) * BINS))]++;
  return counts;
}

function arrMax(arr: number[]): number {
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function TimelineSlider({ features, value, onChange }: TimelineSliderProps) {
  const { sparkline, maxCount, minTs, maxTs, sortedTs } = useMemo(() => {
    const ts = features.map((f) => new Date(f.properties.reported_at).getTime());
    if (ts.length === 0) return { sparkline: Array(BINS).fill(0) as number[], maxCount: 1, minTs: 0, maxTs: 0, sortedTs: [] as number[] };
    const [min, max] = minMax(ts);
    const range = (max - min) || 1;
    const s = buildSparkline(ts, min, range);
    const sorted = ts.slice().sort((a, b) => a - b);
    return { sparkline: s, maxCount: Math.max(arrMax(s), 1), minTs: min, maxTs: max, sortedTs: sorted };
  }, [features]);

  const cutoff = minTs + ((maxTs - minTs) * value) / 100;

  const visibleCount = useMemo(() => {
    if (sortedTs.length === 0) return 0;
    let lo = 0, hi = sortedTs.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sortedTs[mid] <= cutoff) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }, [sortedTs, cutoff]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value)),
    [onChange]
  );

  if (features.length === 0) return null;

  return (
    <div className="flex items-end gap-2 px-4 py-2 bg-bg-surface/80 border-t border-border backdrop-blur-sm">
      <span className="text-[10px] text-text-secondary tabular-nums whitespace-nowrap w-14">{fmtDate(minTs)}</span>
      <div className="flex-1 flex flex-col gap-0 min-w-0">
        <div className="flex items-end gap-px h-5" aria-hidden="true">
          {sparkline.map((count, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-sm transition-colors duration-200"
              style={{
                height: `${Math.max(2, (count / maxCount) * 100)}%`,
                backgroundColor: (i / BINS) * 100 <= value
                  ? count > maxCount * 0.6 ? "var(--heat-severe)" : "var(--accent)"
                  : "var(--border)",
              }}
            />
          ))}
        </div>
        <input
          type="range" min={0} max={100} step={1} value={value}
          onChange={handleChange}
          className="timeline-range w-full"
          aria-label={`Timeline filter: showing outbreaks through ${fmtDate(cutoff)}`}
          aria-valuetext={`${fmtDate(cutoff)} — ${visibleCount} of ${features.length} outbreaks`}
        />
      </div>
      <span className="text-[10px] text-text-secondary tabular-nums whitespace-nowrap w-14 text-right">{fmtDate(maxTs)}</span>
      <div className="flex items-center gap-1 pl-2 border-l border-border shrink-0">
        <span className="text-xs font-semibold text-text-primary tabular-nums">{visibleCount}</span>
        <span className="text-[10px] text-text-secondary">/{features.length}</span>
      </div>
    </div>
  );
}
