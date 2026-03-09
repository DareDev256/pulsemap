"use client";

import { LayerVisibility } from "@/types";

interface LayerControlsProps {
  layers: LayerVisibility;
  onToggle: (layer: keyof LayerVisibility) => void;
}

const layerConfig = [
  { key: "heatmap" as const, label: "Heat Map", icon: "🌡️" },
  { key: "hotspots" as const, label: "Hotspots", icon: "📍" },
  { key: "spread" as const, label: "Spread", icon: "🌊" },
  { key: "newsPins" as const, label: "News Pins", icon: "📰", disabled: true },
];

export default function LayerControls({
  layers,
  onToggle,
}: LayerControlsProps) {
  return (
    <div className="absolute top-4 right-4 z-10 bg-bg-surface/90 backdrop-blur-md border border-border rounded-lg p-3 shadow-lg">
      <div className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
        Layers
      </div>
      <div className="flex flex-col gap-1.5">
        {layerConfig.map(({ key, label, icon, disabled }) => (
          <label
            key={key}
            className={`flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded hover:bg-bg-surface-hover transition-colors ${
              disabled ? "opacity-40 cursor-not-allowed" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => !disabled && onToggle(key)}
              disabled={disabled}
              className="accent-accent w-3.5 h-3.5"
            />
            <span>{icon}</span>
            <span className="text-text-primary">{label}</span>
            {disabled && (
              <span className="text-[10px] text-text-secondary ml-auto">
                v2
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
