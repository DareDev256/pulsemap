import { NextRequest, NextResponse } from "next/server";
import { processReports } from "@/lib/pipeline/dedup";
import { fetchWHOByDateRange } from "@/lib/pipeline/who-parser";
import { RawOutbreakReport } from "@/lib/pipeline/types";
import { validatePipelineAuth, sanitizeErrorMessage } from "@/lib/pipeline/auth";
import { safeJsonResponse } from "@/lib/pipeline/validate";

export const maxDuration = 120; // Backfill may process larger batches
export const dynamic = "force-dynamic";

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

// Allowed source values — reject anything outside this set
const ALLOWED_SOURCES = new Set(["who", "all"]);

export async function POST(request: NextRequest) {
  // Fail-closed auth: rejects when CRON_SECRET is missing or token is wrong
  const authError = validatePipelineAuth(request);
  if (authError) return authError;

  const startTime = Date.now();

  try {
    const parsed = await safeJsonResponse<Record<string, unknown>>(request, "backfill request");
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }
    const body = parsed.data;
    const { startDate, endDate, limit = 200 } = body as {
      startDate?: string;
      endDate?: string;
      limit?: number;
      source?: string;
    };

    // Validate source against allowlist — never reflect raw user input
    const source = ALLOWED_SOURCES.has(body.source) ? body.source : null;
    if (body.source && !source) {
      return NextResponse.json(
        { error: "Unsupported source. Available: who, all" },
        { status: 400 }
      );
    }
    const safeSource = source || "who";

    // Validate required fields
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: "startDate must be before endDate" },
        { status: 400 }
      );
    }

    // Cap limit to prevent abuse
    const safeLim = Math.min(Math.max(1, Number(limit) || 200), 500);

    console.log(`[Backfill] ${safeSource} from ${startDate} to ${endDate} (limit ${safeLim})`);

    let reports: RawOutbreakReport[] = [];

    if (safeSource === "who" || safeSource === "all") {
      reports = await fetchWHOByDateRange(startDate, endDate, safeLim);
    }

    console.log(`[Backfill] Fetched ${reports.length} reports, processing...`);

    const result = await processReports(reports);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      query: { startDate, endDate, source: safeSource, limit: safeLim },
      fetched: reports.length,
      results: {
        new_outbreaks: result.newOutbreaks,
        new_locations: result.newLocations,
        new_reports: result.newReports,
        skipped_duplicates: result.skippedDuplicates,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error("[Backfill] Error:", error);

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
