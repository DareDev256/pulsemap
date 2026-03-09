import { OutbreakGeoFeature } from "@/types";

interface SpreadArc {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties: {
    disease_name: string;
    severity: string;
    from_country: string;
    to_country: string;
    total_cases: number;
  };
}

interface SpreadArcCollection {
  type: "FeatureCollection";
  features: SpreadArc[];
}

/**
 * Interpolates points along a great circle between two coordinates.
 * Uses spherical linear interpolation for natural curved arcs on Mercator projection.
 */
function greatCircleArc(
  start: [number, number],
  end: [number, number],
  segments: number = 64
): [number, number][] {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lng1 = toRad(start[0]);
  const lat1 = toRad(start[1]);
  const lng2 = toRad(end[0]);
  const lat2 = toRad(end[1]);

  // Angular distance between points (haversine)
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2
      )
    );

  // Degenerate case: points are the same or antipodal
  if (d < 1e-10) return [start, end];

  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);

    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);

    const lat = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lng = Math.atan2(y, x);

    points.push([toDeg(lng), toDeg(lat)]);
  }

  return points;
}

/** Severity rank for selecting the worse severity between connected locations */
const SEVERITY_RANK: Record<string, number> = {
  low: 1,
  moderate: 2,
  severe: 3,
  critical: 4,
};

/**
 * Generates GeoJSON LineString arcs connecting outbreak locations of the same disease.
 * Creates a "threat network" visualization showing how diseases span multiple regions.
 *
 * For N locations of a disease, creates arcs between each sequential pair
 * (sorted by case_count desc → highest-impact location is the "hub").
 */
export function generateSpreadArcs(features: OutbreakGeoFeature[]): SpreadArcCollection {
  // Group features by disease
  const diseaseGroups = new Map<string, OutbreakGeoFeature[]>();
  for (const feature of features) {
    const name = feature.properties.disease_name;
    const group = diseaseGroups.get(name) || [];
    group.push(feature);
    diseaseGroups.set(name, group);
  }

  const arcs: SpreadArc[] = [];

  for (const [diseaseName, locations] of diseaseGroups) {
    // Need at least 2 locations to draw connections
    if (locations.length < 2) continue;

    // Sort by case_count descending — hub (highest cases) connects to all others
    const sorted = [...locations].sort(
      (a, b) => b.properties.case_count - a.properties.case_count
    );

    const hub = sorted[0];

    // Connect hub to every other location (star topology)
    for (let i = 1; i < sorted.length; i++) {
      const spoke = sorted[i];
      const start = hub.geometry.coordinates;
      const end = spoke.geometry.coordinates;

      // Skip if coordinates are effectively the same
      const dist = Math.abs(start[0] - end[0]) + Math.abs(start[1] - end[1]);
      if (dist < 0.5) continue;

      const worseSeverity =
        (SEVERITY_RANK[hub.properties.severity] || 0) >=
        (SEVERITY_RANK[spoke.properties.severity] || 0)
          ? hub.properties.severity
          : spoke.properties.severity;

      arcs.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: greatCircleArc(start, end),
        },
        properties: {
          disease_name: diseaseName,
          severity: worseSeverity,
          from_country: hub.properties.country,
          to_country: spoke.properties.country,
          total_cases: hub.properties.case_count + spoke.properties.case_count,
        },
      });
    }
  }

  return {
    type: "FeatureCollection",
    features: arcs,
  };
}
