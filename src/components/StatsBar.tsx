"use client";

import { useMemo } from "react";
import { OutbreakGeoJSON, Severity } from "@/types";

interface StatsBarProps {
  data: OutbreakGeoJSON;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toLocaleString();
}

const severityOrder: Severity[] = ["critical", "severe", "moderate", "low"];
const severityColors: Record<Severity, string> = {
  critical: "bg-heat-critical",
  severe: "bg-heat-severe",
  moderate: "bg-heat-moderate",
  low: "bg-heat-low",
};

export default function StatsBar({ data }: StatsBarProps) {
  const stats = useMemo(() => {
    const features = data.features;
    const totalOutbreaks = features.length;
    const totalCases = features.reduce((sum, f) => sum + f.properties.case_count, 0);
    const countries = new Set(features.map((f) => f.properties.country)).size;
    const criticalCount = features.filter((f) => f.properties.severity === "critical").length;

    // Severity distribution for the bar
    const bySeverity = severityOrder.map((sev) => ({
      severity: sev,
      count: features.filter((f) => f.properties.severity === sev).length,
    }));

    // Top disease by case count
    const diseaseMap = new Map<string, number>();
    for (const f of features) {
      const name = f.properties.disease_name;
      diseaseMap.set(name, (diseaseMap.get(name) || 0) + f.properties.case_count);
    }
    const topDisease = [...diseaseMap.entries()].sort((a, b) => b[1] - a[1])[0];

    return { totalOutbreaks, totalCases, countries, criticalCount, bySeverity, topDisease };
  }, [data]);

  if (stats.totalOutbreaks === 0) return null;

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 bg-bg-surface/80 border-y border-border backdrop-blur-sm overflow-x-auto">
      {/* Outbreaks */}
      <StatCell label="Outbreaks" value={stats.totalOutbreaks.toString()} />

      <Divider />

      {/* Total Cases */}
      <StatCell label="Cases" value={formatCount(stats.totalCases)} />

      <Divider />

      {/* Countries */}
      <StatCell label="Countries" value={stats.countries.toString()} />

      <Divider />

      {/* Critical Alerts */}
      <div className="flex items-center gap-1.5 px-2 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-heat-critical animate-pulse" />
        <span className="text-xs font-semibold text-heat-critical tabular-nums">
          {stats.criticalCount}
        </span>
        <span className="text-[10px] text-text-secondary uppercase tracking-wider">
          Critical
        </span>
      </div>

      <Divider />

      {/* Severity distribution bar */}
      <div className="flex items-center gap-1.5 px-2 shrink-0">
        <div className="flex h-1.5 w-20 rounded-full overflow-hidden bg-border">
          {stats.bySeverity
            .filter((s) => s.count > 0)
            .map((s) => (
              <div
                key={s.severity}
                className={`${severityColors[s.severity]} transition-all duration-500`}
                style={{ width: `${(s.count / stats.totalOutbreaks) * 100}%` }}
              />
            ))}
        </div>
        <span className="text-[10px] text-text-secondary uppercase tracking-wider">
          Severity
        </span>
      </div>

      {/* Top disease — pushed right */}
      {stats.topDisease && (
        <>
          <div className="flex-1" />
          <div className="flex items-center gap-1.5 px-2 shrink-0">
            <span className="text-[10px] text-text-secondary uppercase tracking-wider">
              Top
            </span>
            <span className="text-xs font-medium text-text-primary truncate max-w-[120px]">
              {stats.topDisease[0]}
            </span>
            <span className="text-[10px] text-text-secondary tabular-nums">
              {formatCount(stats.topDisease[1])}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 shrink-0">
      <span className="text-xs font-semibold text-text-primary tabular-nums">{value}</span>
      <span className="text-[10px] text-text-secondary uppercase tracking-wider">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-3 bg-border shrink-0" />;
}
