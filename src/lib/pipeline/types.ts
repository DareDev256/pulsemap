export interface RawOutbreakReport {
  disease_name: string;
  country: string;
  region: string | null;
  title: string;
  summary: string;
  url: string | null;
  source_type: "who" | "cdc" | "news" | "user";
  source_name: string;
  published_at: string;
  severity_hint: "low" | "moderate" | "severe" | "critical" | null;
  case_count: number | null;
}
