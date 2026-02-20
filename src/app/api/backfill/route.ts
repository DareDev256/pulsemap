import { NextRequest, NextResponse } from "next/server";
import { processReports } from "@/lib/pipeline/dedup";
import { RawOutbreakReport } from "@/lib/pipeline/types";

export const maxDuration = 120; // Backfill may process larger batches
export const dynamic = "force-dynamic";

const WHO_BASE_URL =
  "https://www.who.int/api/hubs/diseaseoutbreaknews";

const DISEASE_PATTERNS: [RegExp, string][] = [
  [/cholera/i, "Cholera"],
  [/ebola/i, "Ebola"],
  [/marburg/i, "Marburg Virus"],
  [/mpox|monkeypox/i, "Mpox"],
  [/measles/i, "Measles"],
  [/dengue/i, "Dengue"],
  [/yellow fever/i, "Yellow Fever"],
  [/plague/i, "Plague"],
  [/avian influenza|h5n1|bird flu/i, "H5N1 Avian Influenza"],
  [/influenza a\(h1n1\)|h1n1/i, "Influenza A (H1N1)"],
  [/polio/i, "Polio"],
  [/meningitis|meningococcal/i, "Meningitis"],
  [/lassa fever/i, "Lassa Fever"],
  [/rift valley fever/i, "Rift Valley Fever"],
  [/diphtheria/i, "Diphtheria"],
  [/malaria/i, "Malaria"],
  [/zika/i, "Zika"],
  [/chikungunya/i, "Chikungunya"],
  [/covid|sars-cov/i, "COVID-19"],
  [/hepatitis/i, "Hepatitis"],
  [/nipah/i, "Nipah Virus"],
  [/mers/i, "MERS-CoV"],
  [/oropouche/i, "Oropouche"],
  [/respiratory syndrome/i, "MERS-CoV"],
];

function extractDisease(title: string): string {
  for (const [pattern, name] of DISEASE_PATTERNS) {
    if (pattern.test(title)) return name;
  }
  return "Unknown Disease";
}

function extractCountry(title: string): string {
  const dashMatch = title.match(/[-–—]\s*(.+?)$/);
  if (dashMatch) {
    return dashMatch[1]
      .trim()
      .replace(/\s*\(update\)/i, "")
      .replace(/\s*\(situation update\)/i, "")
      .replace(/\s*update$/i, "")
      .replace(/Global$/i, "Global")
      .trim();
  }
  return "Unknown";
}

function estimateSeverity(
  title: string,
  summary: string
): "low" | "moderate" | "severe" | "critical" {
  const text = `${title} ${summary}`.toLowerCase();
  if (text.includes("risk is high") || text.includes("public health emergency")) return "critical";
  if (text.includes("risk is moderate")) return "severe";
  if (text.includes("risk is low")) return "moderate";
  if (text.includes("death") || text.includes("fatal") || text.includes("emergency")) return "critical";
  if (text.includes("outbreak") || text.includes("surge") || text.includes("spreading")) return "severe";
  if (text.includes("cases") || text.includes("detected")) return "moderate";
  return "low";
}

interface WHODon {
  DonId: string;
  Title: string;
  PublicationDate: string;
  Summary: string;
  UrlName: string;
}

async function fetchWHOByDateRange(
  startDate: string,
  endDate: string,
  limit: number
): Promise<RawOutbreakReport[]> {
  const filter = `PublicationDate ge ${startDate}T00:00:00Z and PublicationDate le ${endDate}T23:59:59Z`;
  const params = new URLSearchParams({
    $filter: filter,
    $orderby: "PublicationDate desc",
    $top: String(limit),
    $select: "DonId,Title,PublicationDate,Summary,UrlName",
  });

  const url = `${WHO_BASE_URL}?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "PulseMap/1.0 (health-surveillance-dashboard)" },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`WHO API returned ${res.status}: ${res.statusText}`);
  }

  const json = await res.json();
  const items: WHODon[] = json.value || [];
  const reports: RawOutbreakReport[] = [];

  for (const item of items) {
    const disease = extractDisease(item.Title);
    const country = extractCountry(item.Title);
    const severity = estimateSeverity(item.Title, item.Summary || "");

    if (country === "Global" || country === "Global update") continue;

    reports.push({
      disease_name: disease,
      country,
      region: null,
      title: item.Title,
      summary: (item.Summary || "").substring(0, 500),
      url: `https://www.who.int/emergencies/disease-outbreak-news/item/${item.UrlName}`,
      source_type: "who",
      source_name: "WHO",
      published_at: new Date(item.PublicationDate).toISOString(),
      severity_hint: severity,
      case_count: null,
    });
  }

  return reports;
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d));
}

export async function POST(request: NextRequest) {
  // Auth — same pattern as cron endpoint
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const body = await request.json();
    const { startDate, endDate, source = "who", limit = 200 } = body;

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

    console.log(`[Backfill] ${source} from ${startDate} to ${endDate} (limit ${safeLim})`);

    let reports: RawOutbreakReport[] = [];

    if (source === "who" || source === "all") {
      reports = await fetchWHOByDateRange(startDate, endDate, safeLim);
    } else {
      return NextResponse.json(
        { error: `Unsupported source: ${source}. Available: who, all` },
        { status: 400 }
      );
    }

    console.log(`[Backfill] Fetched ${reports.length} reports, processing...`);

    const result = await processReports(reports);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      query: { startDate, endDate, source, limit: safeLim },
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
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
