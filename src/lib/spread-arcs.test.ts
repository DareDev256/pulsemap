import { describe, it, expect } from "vitest";
import { generateSpreadArcs } from "./spread-arcs";
import { OutbreakGeoFeature } from "@/types";

function makeFeature(
  disease: string,
  coords: [number, number],
  severity: string = "moderate",
  caseCount: number = 100,
  country: string = "Test"
): OutbreakGeoFeature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: coords },
    properties: {
      id: `${disease}-${country}`,
      outbreak_id: disease.toLowerCase().replace(/\s/g, "-"),
      disease_name: disease,
      severity: severity as OutbreakGeoFeature["properties"]["severity"],
      severity_score: 0.5,
      case_count: caseCount,
      country,
      region: null,
      status: "active",
      summary: null,
    },
  };
}

describe("generateSpreadArcs", () => {
  it("returns empty collection when no features provided", () => {
    const result = generateSpreadArcs([]);
    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(0);
  });

  it("returns empty when all diseases have only one location", () => {
    const features = [
      makeFeature("Cholera", [10, 20], "severe", 500, "Somalia"),
      makeFeature("Ebola", [30, 0], "critical", 200, "Uganda"),
    ];
    const result = generateSpreadArcs(features);
    expect(result.features).toHaveLength(0);
  });

  it("creates arcs for diseases with multiple locations", () => {
    const features = [
      makeFeature("Mpox", [29, -4], "critical", 10000, "DR Congo"),
      makeFeature("Mpox", [30, -2], "severe", 500, "Rwanda"),
      makeFeature("Mpox", [29.5, -3], "moderate", 200, "Burundi"),
    ];
    const result = generateSpreadArcs(features);
    // Star topology: hub (DR Congo) connects to Rwanda and Burundi = 2 arcs
    expect(result.features).toHaveLength(2);
  });

  it("uses highest case count location as hub", () => {
    const features = [
      makeFeature("Dengue", [-43, -22], "critical", 980000, "Brazil"),
      makeFeature("Dengue", [90, 23], "severe", 50000, "Bangladesh"),
      makeFeature("Dengue", [-99, 19], "moderate", 25000, "Mexico"),
    ];
    const result = generateSpreadArcs(features);
    // All arcs should originate from Brazil (highest cases)
    result.features.forEach((arc) => {
      expect(arc.properties.from_country).toBe("Brazil");
    });
  });

  it("assigns worse severity between connected locations", () => {
    const features = [
      makeFeature("Cholera", [45, 2], "critical", 5000, "Somalia"),
      makeFeature("Cholera", [38, 9], "moderate", 1000, "Ethiopia"),
    ];
    const result = generateSpreadArcs(features);
    expect(result.features[0].properties.severity).toBe("critical");
  });

  it("generates curved arc coordinates (not just 2 points)", () => {
    const features = [
      makeFeature("H5N1", [116, 39], "moderate", 300, "China"),
      makeFeature("H5N1", [-98, 38], "moderate", 100, "USA"),
    ];
    const result = generateSpreadArcs(features);
    const arc = result.features[0];
    // Should have 65 points (64 segments + 1)
    expect(arc.geometry.coordinates.length).toBe(65);
  });

  it("skips arcs when locations are too close together", () => {
    const features = [
      makeFeature("Test", [29.0, -4.0], "moderate", 500, "A"),
      makeFeature("Test", [29.1, -4.1], "moderate", 100, "B"),
    ];
    const result = generateSpreadArcs(features);
    // Distance is ~0.2, below the 0.5 threshold
    expect(result.features).toHaveLength(0);
  });

  it("handles multiple diseases independently", () => {
    const features = [
      makeFeature("Mpox", [29, -4], "critical", 10000, "DR Congo"),
      makeFeature("Mpox", [30, -2], "severe", 500, "Rwanda"),
      makeFeature("Cholera", [45, 2], "critical", 5000, "Somalia"),
      makeFeature("Cholera", [38, 9], "moderate", 1000, "Ethiopia"),
      makeFeature("Ebola", [32, 1], "severe", 300, "Uganda"),
    ];
    const result = generateSpreadArcs(features);
    // Mpox: 1 arc, Cholera: 1 arc, Ebola: 0 arcs (single location)
    expect(result.features).toHaveLength(2);

    const diseases = result.features.map((f) => f.properties.disease_name);
    expect(diseases).toContain("Mpox");
    expect(diseases).toContain("Cholera");
  });
});
