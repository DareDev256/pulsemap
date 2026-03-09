"use client";

import { useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { OutbreakGeoJSON, OutbreakGeoFeature, LayerVisibility } from "@/types";
import { generateSpreadArcs } from "@/lib/spread-arcs";

interface PulseMapProps {
  data: OutbreakGeoJSON;
  layers: LayerVisibility;
  onFeatureClick: (feature: OutbreakGeoFeature) => void;
  flyTo?: [number, number] | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  moderate: "#eab308",
  severe: "#ef4444",
  critical: "#dc2626",
};

export default function PulseMap({
  data,
  layers,
  onFeatureClick,
  flyTo,
}: PulseMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const animationRef = useRef<number | null>(null);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  const addHotspotMarkers = useCallback(
    (mapInstance: mapboxgl.Map, features: OutbreakGeoFeature[]) => {
      clearMarkers();
      if (!layers.hotspots) return;

      features.forEach((feature) => {
        const { severity, case_count, disease_name, country } =
          feature.properties;
        const [lng, lat] = feature.geometry.coordinates;
        const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.moderate;

        // Size based on case count (log scale for visual balance)
        const size = Math.max(16, Math.min(48, 10 + Math.log10(case_count + 1) * 8));

        // Create marker element
        const el = document.createElement("div");
        el.className = "hotspot-marker";
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;

        // Pulse ring
        const ring = document.createElement("div");
        ring.className = "ring";
        ring.style.border = `2px solid ${color}`;
        el.appendChild(ring);

        // Center dot
        const dot = document.createElement("div");
        dot.className = "dot";
        dot.style.backgroundColor = color;
        dot.style.opacity = "0.85";
        el.appendChild(dot);

        // Click handler
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onFeatureClick(feature);
        });

        // Tooltip on hover
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          offset: size / 2 + 8,
          className: "pulsemap-popup",
        }).setHTML(
          `<div style="font-size:12px">
            <strong>${disease_name}</strong><br/>
            <span style="color:#64748b">${country}</span>
          </div>`
        );

        el.addEventListener("mouseenter", () => {
          popup.setLngLat([lng, lat]).addTo(mapInstance);
        });
        el.addEventListener("mouseleave", () => {
          popup.remove();
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(mapInstance);

        markersRef.current.push(marker);
      });
    },
    [layers.hotspots, onFeatureClick, clearMarkers]
  );

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN is not set");
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [20, 10],
      zoom: 2.2,
      projection: "mercator",
      attributionControl: false,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    map.current.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      "bottom-right"
    );

    map.current.on("load", () => {
      const m = map.current!;

      // Add GeoJSON source
      m.addSource("outbreaks", {
        type: "geojson",
        data: data,
      });

      // Heat map layer
      m.addLayer({
        id: "outbreak-heat",
        type: "heatmap",
        source: "outbreaks",
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "severity_score"],
            0, 0,
            0.5, 0.5,
            1, 1,
          ],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 1,
            9, 3,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0, "rgba(0,0,0,0)",
            0.1, "rgba(34,197,94,0.3)",
            0.3, "rgba(34,197,94,0.6)",
            0.5, "rgba(234,179,8,0.7)",
            0.7, "rgba(239,68,68,0.8)",
            1, "rgba(220,38,38,0.9)",
          ],
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            0, 30,
            4, 50,
            9, 80,
          ],
          "heatmap-opacity": 0.6,
        },
      });

      // Spread arc source + layers (disease network visualization)
      const spreadData = generateSpreadArcs(data.features);
      m.addSource("spread-arcs", {
        type: "geojson",
        data: spreadData,
      });

      // Glow layer — wide, soft, creates the "energy" effect
      m.addLayer({
        id: "spread-glow",
        type: "line",
        source: "spread-arcs",
        layout: {
          visibility: layers.spread ? "visible" : "none",
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": [
            "match",
            ["get", "severity"],
            "critical", "#dc2626",
            "severe", "#ef4444",
            "moderate", "#eab308",
            "low", "#22c55e",
            "#3b82f6",
          ],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            0, 4,
            4, 8,
            8, 12,
          ],
          "line-opacity": 0.15,
          "line-blur": 6,
        },
      });

      // Core layer — narrow, bright, the visible arc line
      m.addLayer({
        id: "spread-core",
        type: "line",
        source: "spread-arcs",
        layout: {
          visibility: layers.spread ? "visible" : "none",
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": [
            "match",
            ["get", "severity"],
            "critical", "#f87171",
            "severe", "#fb923c",
            "moderate", "#fbbf24",
            "low", "#4ade80",
            "#60a5fa",
          ],
          "line-width": [
            "interpolate", ["linear"], ["zoom"],
            0, 1,
            4, 1.5,
            8, 2.5,
          ],
          "line-opacity": 0.7,
          "line-dasharray": [0, 4, 3],
        },
      });

      // Animate the dash pattern for "data flowing" effect
      let dashPhase = 0;
      const animateDash = () => {
        dashPhase = (dashPhase + 0.15) % 7;
        if (m.getLayer("spread-core")) {
          m.setPaintProperty("spread-core", "line-dasharray", [
            0,
            4 + Math.sin(dashPhase) * 0.5,
            3,
          ]);
        }
        animationRef.current = requestAnimationFrame(animateDash);
      };
      if (layers.spread) {
        animationRef.current = requestAnimationFrame(animateDash);
      }

      // Add hotspot markers
      addHotspotMarkers(m, data.features);
    });

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update heatmap visibility
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    const m = map.current;

    if (m.getLayer("outbreak-heat")) {
      m.setLayoutProperty(
        "outbreak-heat",
        "visibility",
        layers.heatmap ? "visible" : "none"
      );
    }
  }, [layers.heatmap]);

  // Update spread layer visibility
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    const m = map.current;
    const vis = layers.spread ? "visible" : "none";

    if (m.getLayer("spread-glow")) {
      m.setLayoutProperty("spread-glow", "visibility", vis);
    }
    if (m.getLayer("spread-core")) {
      m.setLayoutProperty("spread-core", "visibility", vis);
    }

    // Start/stop animation based on visibility
    if (layers.spread && !animationRef.current) {
      let dashPhase = 0;
      const animateDash = () => {
        dashPhase = (dashPhase + 0.15) % 7;
        if (m.getLayer("spread-core")) {
          m.setPaintProperty("spread-core", "line-dasharray", [
            0,
            4 + Math.sin(dashPhase) * 0.5,
            3,
          ]);
        }
        animationRef.current = requestAnimationFrame(animateDash);
      };
      animationRef.current = requestAnimationFrame(animateDash);
    } else if (!layers.spread && animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, [layers.spread]);

  // Update spread arc data when outbreak data changes
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    const source = map.current.getSource("spread-arcs") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(generateSpreadArcs(data.features));
    }
  }, [data]);

  // Update hotspot markers
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    addHotspotMarkers(map.current, data.features);
  }, [layers.hotspots, data.features, addHotspotMarkers]);

  // Fly to location
  useEffect(() => {
    if (!map.current || !flyTo) return;
    map.current.flyTo({
      center: flyTo,
      zoom: 5,
      duration: 1500,
      essential: true,
    });
  }, [flyTo]);

  // Update data source
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;
    const source = map.current.getSource("outbreaks") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData(data);
    }
  }, [data]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ minHeight: "400px" }}
    />
  );
}
