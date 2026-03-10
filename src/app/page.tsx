"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Navbar from "@/components/Navbar";
import PulseMap from "@/components/PulseMap";
import LayerControls from "@/components/LayerControls";
import Legend from "@/components/Legend";
import OutbreakDetail from "@/components/OutbreakDetail";
import Feed from "@/components/Feed";
import StatsBar from "@/components/StatsBar";
import TimelineSlider from "@/components/TimelineSlider";
import { seedOutbreaks, seedFeedItems, FeedItem } from "@/lib/seed-data";
import { fetchOutbreakGeoJSON, fetchFeedItems } from "@/lib/fetch-outbreaks";
import { OutbreakGeoJSON, OutbreakGeoFeature, LayerVisibility } from "@/types";

export default function Home() {
  const [layers, setLayers] = useState<LayerVisibility>({
    heatmap: true,
    hotspots: true,
    spread: false,
    newsPins: false,
  });
  const [outbreakData, setOutbreakData] = useState<OutbreakGeoJSON>(seedOutbreaks);
  const [feedItems, setFeedItems] = useState<FeedItem[]>(seedFeedItems);
  const [selectedFeature, setSelectedFeature] =
    useState<OutbreakGeoFeature | null>(null);
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dataSource, setDataSource] = useState<"loading" | "supabase" | "static">("loading");
  const [timelineValue, setTimelineValue] = useState(100);

  // Fetch live data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [geoData, feed] = await Promise.all([
          fetchOutbreakGeoJSON(),
          fetchFeedItems(),
        ]);

        if (geoData.features.length > 0) {
          setOutbreakData(geoData);
          setDataSource("supabase");
        } else {
          setDataSource("static");
        }

        if (feed.length > 0) {
          setFeedItems(feed);
        }
      } catch {
        console.warn("Failed to fetch from Supabase, using static data");
        setDataSource("static");
      }
    }

    loadData();
  }, []);

  // Precompute timestamps once (avoids re-parsing Date strings in every downstream memo)
  const { timestamps, minTs, maxTs } = useMemo(() => {
    const ts = outbreakData.features.map((f) => new Date(f.properties.reported_at).getTime());
    if (ts.length === 0) return { timestamps: ts, minTs: 0, maxTs: 0 };
    let lo = ts[0], hi = ts[0];
    for (let i = 1; i < ts.length; i++) {
      if (ts[i] < lo) lo = ts[i];
      if (ts[i] > hi) hi = ts[i];
    }
    return { timestamps: ts, minTs: lo, maxTs: hi };
  }, [outbreakData]);

  // Filter features by timeline position
  const filteredData = useMemo(() => {
    if (timelineValue >= 100) return outbreakData;
    if (timestamps.length === 0) return outbreakData;
    const cutoff = minTs + ((maxTs - minTs) * timelineValue) / 100;
    return {
      ...outbreakData,
      features: outbreakData.features.filter(
        (_, i) => timestamps[i] <= cutoff
      ),
    };
  }, [outbreakData, timelineValue, timestamps, minTs, maxTs]);

  const filteredFeed = useMemo(() => {
    if (timelineValue >= 100) return feedItems;
    const visibleIds = new Set(filteredData.features.map((f) => f.properties.outbreak_id));
    return feedItems.filter((item) => visibleIds.has(item.outbreak_id));
  }, [feedItems, filteredData, timelineValue]);

  const handleLayerToggle = useCallback((layer: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const handleFeatureClick = useCallback((feature: OutbreakGeoFeature) => {
    setSelectedFeature(feature);
    setFlyTo(feature.geometry.coordinates);
  }, []);

  const handleFeedItemClick = useCallback(
    (outbreakId: string) => {
      const feature = outbreakData.features.find(
        (f) => f.properties.outbreak_id === outbreakId
      );
      if (feature) {
        handleFeatureClick(feature);
      }
    },
    [handleFeatureClick, outbreakData]
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <Navbar onSearch={handleSearch} />

      {/* Map Section */}
      <div className="relative flex-1" style={{ minHeight: "55vh" }}>
        <PulseMap
          data={filteredData}
          layers={layers}
          onFeatureClick={handleFeatureClick}
          flyTo={flyTo}
        />
        <LayerControls layers={layers} onToggle={handleLayerToggle} />
        <Legend layers={layers} />

        {/* Data source indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md border ${
            dataSource === "supabase"
              ? "bg-heat-low/10 border-heat-low/30 text-heat-low"
              : dataSource === "static"
              ? "bg-heat-moderate/10 border-heat-moderate/30 text-heat-moderate"
              : "bg-accent/10 border-accent/30 text-accent"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              dataSource === "supabase" ? "bg-heat-low" :
              dataSource === "static" ? "bg-heat-moderate" : "bg-accent animate-pulse"
            }`} />
            {dataSource === "supabase" ? "Live Data" :
             dataSource === "static" ? "Static Data" : "Loading..."}
          </div>
        </div>

        <OutbreakDetail
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
        />
      </div>

      {/* Stats Bar */}
      <StatsBar data={filteredData} />

      {/* Timeline Slider */}
      <TimelineSlider
        features={outbreakData.features}
        value={timelineValue}
        onChange={setTimelineValue}
      />

      {/* Feed Section */}
      <div className="flex-none border-t border-border" style={{ height: "calc(35vh - 68px)" }}>
        <Feed
          items={filteredFeed}
          searchQuery={searchQuery}
          onItemClick={handleFeedItemClick}
        />
      </div>
    </div>
  );
}
