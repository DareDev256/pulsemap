import { supabase } from "./supabase";
import { OutbreakGeoJSON, OutbreakGeoFeature, Severity, OutbreakStatus } from "@/types";
import { FeedItem } from "./seed-data";

export async function fetchOutbreakGeoJSON(): Promise<OutbreakGeoJSON> {
  const { data, error } = await supabase
    .from("outbreak_locations")
    .select(`
      id,
      outbreak_id,
      latitude,
      longitude,
      country,
      region,
      case_count,
      severity_score,
      reported_at,
      outbreaks (
        id,
        disease_name,
        status,
        severity,
        summary
      )
    `);

  if (error) {
    console.error("Error fetching outbreaks:", error);
    return { type: "FeatureCollection", features: [] };
  }

  const features: OutbreakGeoFeature[] = (data || []).map((loc) => {
    const outbreak = loc.outbreaks as unknown as {
      id: string;
      disease_name: string;
      status: OutbreakStatus;
      severity: Severity;
      summary: string | null;
    };

    return {
      type: "Feature" as const,
      geometry: {
        type: "Point" as const,
        coordinates: [loc.longitude, loc.latitude] as [number, number],
      },
      properties: {
        id: loc.id,
        outbreak_id: loc.outbreak_id,
        disease_name: outbreak.disease_name,
        severity: outbreak.severity,
        severity_score: loc.severity_score,
        case_count: loc.case_count,
        country: loc.country,
        region: loc.region,
        status: outbreak.status,
        summary: outbreak.summary,
        reported_at: loc.reported_at || new Date().toISOString(),
      },
    };
  });

  return { type: "FeatureCollection", features };
}

export async function fetchFeedItems(): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from("reports")
    .select(`
      id,
      outbreak_id,
      source_type,
      source_name,
      title,
      published_at,
      outbreaks (
        disease_name,
        severity,
        outbreak_locations (
          country
        )
      )
    `)
    .order("published_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching reports:", error);
    return [];
  }

  return (data || []).map((report) => {
    const outbreak = report.outbreaks as unknown as {
      disease_name: string;
      severity: Severity;
      outbreak_locations: { country: string }[];
    };

    return {
      id: report.id,
      outbreak_id: report.outbreak_id,
      source_type: report.source_type as FeedItem["source_type"],
      source_name: report.source_name,
      disease_name: outbreak.disease_name,
      title: report.title,
      location: outbreak.outbreak_locations?.[0]?.country || "Unknown",
      published_at: report.published_at || "",
      severity: outbreak.severity as Severity,
    };
  });
}
