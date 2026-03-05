import { NextRequest, NextResponse } from "next/server";
import { fetchWHOOutbreaks } from "@/lib/pipeline/who-parser";
import { fetchReliefWebOutbreaks } from "@/lib/pipeline/reliefweb-parser";
import { processReports } from "@/lib/pipeline/dedup";
import { validatePipelineAuth, sanitizeErrorMessage } from "@/lib/pipeline/auth";

export const maxDuration = 60; // Allow up to 60s for the pipeline
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Fail-closed auth: rejects when CRON_SECRET is missing or token is wrong
  const authError = validatePipelineAuth(request);
  if (authError) return authError;

  const startTime = Date.now();

  try {
    console.log("[Pipeline] Starting outbreak data update...");

    // Fetch from all sources in parallel
    const [whoReports, reliefWebReports] = await Promise.all([
      fetchWHOOutbreaks(),
      fetchReliefWebOutbreaks(),
    ]);

    const allReports = [...whoReports, ...reliefWebReports];
    console.log(`[Pipeline] Fetched ${allReports.length} total reports (WHO: ${whoReports.length}, ReliefWeb: ${reliefWebReports.length})`);

    // Process, deduplicate, and insert
    const result = await processReports(allReports);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    const summary = {
      success: true,
      duration: `${duration}s`,
      sources: {
        who: whoReports.length,
        reliefweb: reliefWebReports.length,
      },
      results: {
        new_outbreaks: result.newOutbreaks,
        new_locations: result.newLocations,
        new_reports: result.newReports,
        skipped_duplicates: result.skippedDuplicates,
      },
      timestamp: new Date().toISOString(),
    };

    console.log("[Pipeline] Complete:", JSON.stringify(summary));

    return NextResponse.json(summary);
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error("[Pipeline] Error:", error);

    return NextResponse.json(
      {
        success: false,
        duration: `${duration}s`,
        error: sanitizeErrorMessage(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
