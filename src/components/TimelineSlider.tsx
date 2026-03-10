"use client";

import { useMemo, useCallback } from "react";
import { OutbreakGeoFeature } from "@/types";

interface TimelineSliderProps {
  features: OutbreakGeoFeature[];
  value: number;
  onChange: (value: number) => void;
}

const BINS = 24;

function buildSparkline(features: OutbreakGeoFeature[]): number[] {
  if (features.length === 0) return Array(BINS).fill(0);
  const timestamps = features.map((f) => new Date(f.properties.reported_at).getTime());
  const min = Math.min(...timestamps);
  const range = (Math.max(...timestamps) - min) || 1;
  const counts = Array(BINS).fill(0) as number[];
  for (const ts of timestamps) counts[Math.min(BINS - 1, Math.floor(((ts - min) / range) * BINS))]++;
  return counts;
}

const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function TimelineSlider({ features, value, onChange }: TimelineSliderProps) {
  const { sparkline, maxCount, minTs, maxTs } = useMemo(() => {
    const s = buildSparkline(features);
    const ts = features.map((f) => new Date(f.properties.reported_at).getTime());
    return { sparkline: s, maxCount: Math.max(...s, 1), minTs: Math.min(...ts), maxTs: Math.max(...ts) };
  }, [features]);

  const cutoff = minTs + ((maxTs - minTs) * value) / 100;
  const visibleCount = useMemo(
    () => features.filter((f) => new Date(f.properties.reported_at).getTime() <= cutoff).length,
    [features, cutoff]
  );

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
