import { supabaseAdmin } from "./supabase-admin";
import { RawOutbreakReport } from "./types";
import { geocodeLocation } from "./geocode";

interface ProcessResult {
  newOutbreaks: number;
  newLocations: number;
  newReports: number;
  skippedDuplicates: number;
}

export async function processReports(reports: RawOutbreakReport[]): Promise<ProcessResult> {
  const result: ProcessResult = {
    newOutbreaks: 0,
    newLocations: 0,
    newReports: 0,
    skippedDuplicates: 0,
  };

  if (reports.length === 0) return result;

  // Fetch existing outbreaks for dedup
  const { data: existingOutbreaks } = await supabaseAdmin
    .from("outbreaks")
    .select("id, disease_name, severity, status");

  // Fetch existing report titles for dedup
  const { data: existingReports } = await supabaseAdmin
    .from("reports")
    .select("title");

  const existingTitles = new Set(
    (existingReports || []).map((r) => r.title.toLowerCase().trim())
  );

  // Build outbreak lookup: disease_name -> outbreak record
  const outbreakMap = new Map<string, { id: string; severity: string }>();
  for (const ob of existingOutbreaks || []) {
    // Key by disease name (we might have multiple outbreaks of same disease
    // in different countries, but for simplicity we match by disease name)
    if (!outbreakMap.has(ob.disease_name)) {
      outbreakMap.set(ob.disease_name, { id: ob.id, severity: ob.severity });
    }
  }

  for (const report of reports) {
    // Skip if we already have this exact report title
    if (existingTitles.has(report.title.toLowerCase().trim())) {
      result.skippedDuplicates++;
      continue;
    }

    // Skip unknown diseases
    if (report.disease_name === "Unknown Disease") {
      result.skippedDuplicates++;
      continue;
    }

    // Skip unknown countries
    if (report.country === "Unknown") {
      result.skippedDuplicates++;
      continue;
    }

    // Find or create the outbreak
    let outbreakId: string;
    const existing = outbreakMap.get(report.disease_name);

    if (existing) {
      outbreakId = existing.id;

      // Update severity if the new report suggests higher severity
      const severityRank = { low: 1, moderate: 2, severe: 3, critical: 4 };
      if (
        report.severity_hint &&
        severityRank[report.severity_hint] > severityRank[existing.severity as keyof typeof severityRank]
      ) {
        await supabaseAdmin
          .from("outbreaks")
          .update({ severity: report.severity_hint, last_updated: new Date().toISOString() })
          .eq("id", outbreakId);
      }
    } else {
      // Create new outbreak
      const { data: newOutbreak, error } = await supabaseAdmin
        .from("outbreaks")
        .insert({
          disease_name: report.disease_name,
          status: "active",
          severity: report.severity_hint || "moderate",
          first_reported: report.published_at,
          summary: report.summary.substring(0, 500),
        })
        .select("id")
        .single();

      if (error || !newOutbreak) {
        console.error(`Failed to create outbreak for ${report.disease_name}:`, error);
        continue;
      }

      outbreakId = newOutbreak.id;
      outbreakMap.set(report.disease_name, {
        id: outbreakId,
        severity: report.severity_hint || "moderate",
      });
      result.newOutbreaks++;
    }

    // Geocode and check if we already have this location
    const coords = await geocodeLocation(report.country, report.region);
    if (coords) {
      // Check if we already have a location for this outbreak + country
      const { data: existingLoc } = await supabaseAdmin
        .from("outbreak_locations")
        .select("id, case_count")
        .eq("outbreak_id", outbreakId)
        .eq("country", report.country)
        .limit(1);

      if (!existingLoc || existingLoc.length === 0) {
        // Insert new location
        const severityScoreMap = { low: 0.3, moderate: 0.5, severe: 0.75, critical: 0.9 };
        const { error } = await supabaseAdmin
          .from("outbreak_locations")
          .insert({
            outbreak_id: outbreakId,
            latitude: coords.latitude,
            longitude: coords.longitude,
            country: report.country,
            region: report.region,
            case_count: report.case_count || 0,
            severity_score: severityScoreMap[report.severity_hint || "moderate"],
          });

        if (!error) result.newLocations++;
      }
    }

    // Insert the report
    const { error: reportError } = await supabaseAdmin
      .from("reports")
      .insert({
        outbreak_id: outbreakId,
        source_type: report.source_type,
        source_name: report.source_name,
        title: report.title,
        url: report.url,
        content: report.summary,
        published_at: report.published_at,
      });

    if (!reportError) {
      result.newReports++;
      existingTitles.add(report.title.toLowerCase().trim());
    }
  }

  return result;
}
