/**
 * Centralized client-side data loading for PulseMap dashboard.
 *
 * Single entry point for all outbreak data fetching — prevents page components
 * from importing Supabase queries directly and ensures consistent error handling.
 */

import { fetchOutbreakGeoJSON, fetchFeedItems } from "./fetch-outbreaks";
import { seedOutbreaks, seedFeedItems } from "./seed-data";
import type { OutbreakGeoJSON } from "@/types";
import type { FeedItem } from "./seed-data";

export type DataSource = "loading" | "supabase" | "static";

export interface DashboardData {
  outbreakData: OutbreakGeoJSON;
  feedItems: FeedItem[];
  dataSource: DataSource;
}

/**
 * Load all dashboard data in a single call.
 *
 * Fetches outbreak GeoJSON and feed items concurrently from Supabase.
 * Falls back to static seed data on failure or empty results — the UI
 * should always render something.
 */
export async function loadDashboardData(): Promise<DashboardData> {
  try {
    const [geoData, feed] = await Promise.all([
      fetchOutbreakGeoJSON(),
      fetchFeedItems(),
    ]);

    const hasGeo = geoData.features.length > 0;
    const hasFeed = feed.length > 0;

    return {
      outbreakData: hasGeo ? geoData : seedOutbreaks,
      feedItems: hasFeed ? feed : seedFeedItems,
      dataSource: hasGeo ? "supabase" : "static",
    };
  } catch {
    console.warn("Failed to fetch from Supabase, using static data");
    return {
      outbreakData: seedOutbreaks,
      feedItems: seedFeedItems,
      dataSource: "static",
    };
  }
}
