export type Severity = "low" | "moderate" | "severe" | "critical";
export type OutbreakStatus = "active" | "monitoring" | "resolved";
export type SourceType = "who" | "cdc" | "news" | "user";

export interface Outbreak {
  id: string;
  disease_name: string;
  status: OutbreakStatus;
  severity: Severity;
  first_reported: string;
  last_updated: string;
  summary: string | null;
}

export interface OutbreakLocation {
  id: string;
  outbreak_id: string;
  latitude: number;
  longitude: number;
  country: string;
  region: string | null;
  case_count: number;
  severity_score: number;
  reported_at: string;
}

export interface Report {
  id: string;
  outbreak_id: string;
  source_type: SourceType;
  source_name: string;
  title: string;
  url: string | null;
  content: string | null;
  published_at: string | null;
  created_at: string;
}

export interface OutbreakGeoFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: {
    id: string;
    outbreak_id: string;
    disease_name: string;
    severity: Severity;
    severity_score: number;
    case_count: number;
    country: string;
    region: string | null;
    status: OutbreakStatus;
    summary: string | null;
    reported_at: string;
  };
}

export interface OutbreakGeoJSON {
  type: "FeatureCollection";
  features: OutbreakGeoFeature[];
}

export interface LayerVisibility {
  heatmap: boolean;
  hotspots: boolean;
  spread: boolean;
  newsPins: boolean;
}
