import { RawOutbreakReport } from "./types";

const WHO_API_URL =
  "https://www.who.int/api/hubs/diseaseoutbreaknews?$orderby=PublicationDate%20desc&$top=50&$select=DonId,Title,PublicationDate,Summary,UrlName";

// Known disease keywords to extract from titles
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
  // WHO DON titles follow pattern: "Disease name - Country" or "Disease name- Country"
  const dashMatch = title.match(/[-–—]\s*(.+?)$/);
  if (dashMatch) {
    const country = dashMatch[1].trim();
    // Clean up common suffixes
    return country
      .replace(/\s*\(update\)/i, "")
      .replace(/\s*\(situation update\)/i, "")
      .replace(/\s*update$/i, "")
      .replace(/Global$/i, "Global")
      .trim();
  }
  return "Unknown";
}

function estimateSeverity(title: string, summary: string): "low" | "moderate" | "severe" | "critical" {
  const text = `${title} ${summary}`.toLowerCase();

  // Look for explicit risk assessments in WHO summaries
  if (text.includes("risk is high") || text.includes("public health emergency")) return "critical";
  if (text.includes("risk is moderate")) return "severe";
  if (text.includes("risk is low")) return "moderate";

  // Keyword-based fallback
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

export async function fetchWHOOutbreaks(): Promise<RawOutbreakReport[]> {
  try {
    const res = await fetch(WHO_API_URL, {
      headers: { "User-Agent": "PulseMap/1.0 (health-surveillance-dashboard)" },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error(`WHO API fetch failed: ${res.status}`);
      return [];
    }

    const json = await res.json();
    const items: WHODon[] = json.value || [];
    const reports: RawOutbreakReport[] = [];

    for (const item of items) {
      const disease = extractDisease(item.Title);
      const country = extractCountry(item.Title);
      const severity = estimateSeverity(item.Title, item.Summary || "");

      // Skip global updates without a specific country
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

    console.log(`WHO: Parsed ${reports.length} outbreak reports from ${items.length} DON items`);
    return reports;
  } catch (error) {
    console.error("WHO API parser error:", error);
    return [];
  }
}
