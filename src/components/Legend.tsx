"use client";

import { LayerVisibility } from "@/types";

interface LegendProps {
  layers?: LayerVisibility;
}

export default function Legend({ layers }: LegendProps) {
  return (
    <div className="absolute bottom-6 left-4 z-10 bg-bg-surface/90 backdrop-blur-md border border-border rounded-lg px-4 py-3 shadow-lg">
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
        Severity
      </div>
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-heat-low" />
          <span className="text-xs text-text-secondary mr-2">Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-heat-moderate" />
          <span className="text-xs text-text-secondary mr-2">Moderate</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-heat-severe" />
          <span className="text-xs text-text-secondary mr-2">Severe</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-heat-critical animate-pulse" />
          <span className="text-xs text-text-secondary">Critical</span>
        </div>
      </div>
      {layers?.spread && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="spread-legend-line" />
            <span className="text-xs text-text-secondary">Disease spread network</span>
          </div>
        </div>
      )}
    </div>
  );
}
