import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock ---
// We mock the entire supabase module so fetch-outbreaks gets our fake client.
// The chain: supabase.from(table).select(cols) → { data, error }
// For reports: .select(cols).order(col, opts).limit(n) → { data, error }

let mockSelectResult: { data: unknown[] | null; error: unknown | null } = {
  data: [],
  error: null,
};

const mockLimit = vi.fn(() => Promise.resolve(mockSelectResult));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockSelect = vi.fn(() => {
  // If order/limit won't be called (outbreak_locations query), resolve directly
  return Object.assign(Promise.resolve(mockSelectResult), {
    order: mockOrder,
    limit: mockLimit,
  });
});
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("./supabase", () => ({
  supabase: { from: mockFrom },
}));

// Import AFTER mock is registered
const { fetchOutbreakGeoJSON, fetchFeedItems } = await import(
  "./fetch-outbreaks"
);

// --- Test data factories ---
function makeLocationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "loc-1",
    outbreak_id: "ob-1",
    latitude: -4.0383,
    longitude: 21.7587,
    country: "DR Congo",
    region: "Eastern Provinces",
    case_count: 48251,
    severity_score: 0.95,
    outbreaks: {
      id: "ob-1",
      disease_name: "Mpox (Clade Ib)",
      status: "active",
      severity: "critical",
      summary: "Ongoing mpox outbreak with sustained community transmission.",
    },
    ...overrides,
  };
}

function makeReportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "r-1",
    outbreak_id: "ob-1",
    source_type: "who",
    source_name: "WHO",
    title: "Mpox multi-country outbreak — Situation update",
    published_at: "2026-02-01T08:00:00Z",
    outbreaks: {
      disease_name: "Mpox (Clade Ib)",
      severity: "critical",
      outbreak_locations: [{ country: "DR Congo" }],
    },
    ...overrides,
  };
}

// --- Tests ---
beforeEach(() => {
  vi.clearAllMocks();
  mockSelectResult = { data: [], error: null };
});

describe("fetchOutbreakGeoJSON", () => {
  it("returns a valid FeatureCollection with features mapped from Supabase rows", async () => {
    const row = makeLocationRow();
    mockSelectResult = { data: [row], error: null };

    const result = await fetchOutbreakGeoJSON();

    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toHaveLength(1);

    const feature = result.features[0];
    expect(feature.type).toBe("Feature");
    expect(feature.geometry.type).toBe("Point");
    // GeoJSON is [lng, lat]
    expect(feature.geometry.coordinates).toEqual([21.7587, -4.0383]);
    expect(feature.properties.disease_name).toBe("Mpox (Clade Ib)");
    expect(feature.properties.severity).toBe("critical");
    expect(feature.properties.case_count).toBe(48251);
    expect(feature.properties.country).toBe("DR Congo");
    expect(feature.properties.status).toBe("active");
  });

  it("queries the outbreak_locations table with joined outbreaks", async () => {
    mockSelectResult = { data: [], error: null };
    await fetchOutbreakGeoJSON();
    expect(mockFrom).toHaveBeenCalledWith("outbreak_locations");
    expect(mockSelect).toHaveBeenCalled();
    // Verify the select includes the join
    const selectArg = mockSelect.mock.calls[0][0] as string;
    expect(selectArg).toContain("outbreaks");
    expect(selectArg).toContain("disease_name");
  });

  it("returns empty FeatureCollection on Supabase error", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSelectResult = {
      data: null,
      error: { message: "connection refused", code: "PGRST000" },
    };

    const result = await fetchOutbreakGeoJSON();

    expect(result.type).toBe("FeatureCollection");
    expect(result.features).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      "Error fetching outbreaks:",
      expect.objectContaining({ message: "connection refused" })
    );
    consoleError.mockRestore();
  });

  it("handles null data gracefully (returns empty features)", async () => {
    mockSelectResult = { data: null, error: null };
    const result = await fetchOutbreakGeoJSON();
    expect(result.features).toEqual([]);
  });

  it("maps multiple rows preserving all property fields", async () => {
    const rows = [
      makeLocationRow({ id: "loc-1", country: "DR Congo" }),
      makeLocationRow({
        id: "loc-2",
        country: "Rwanda",
        latitude: -1.9403,
        longitude: 29.8739,
        severity_score: 0.75,
        case_count: 3842,
        outbreaks: {
          id: "ob-2",
          disease_name: "Mpox (Clade Ib)",
          status: "active",
          severity: "severe",
          summary: "Cross-border mpox spread.",
        },
      }),
    ];
    mockSelectResult = { data: rows, error: null };

    const result = await fetchOutbreakGeoJSON();
    expect(result.features).toHaveLength(2);
    expect(result.features[0].properties.country).toBe("DR Congo");
    expect(result.features[1].properties.country).toBe("Rwanda");
    expect(result.features[1].properties.severity).toBe("severe");
    expect(result.features[1].geometry.coordinates).toEqual([29.8739, -1.9403]);
  });

  it("preserves null region values", async () => {
    mockSelectResult = {
      data: [makeLocationRow({ region: null })],
      error: null,
    };
    const result = await fetchOutbreakGeoJSON();
    expect(result.features[0].properties.region).toBeNull();
  });
});

describe("fetchFeedItems", () => {
  it("returns feed items mapped from Supabase report rows", async () => {
    const row = makeReportRow();
    mockSelectResult = { data: [row], error: null };

    const result = await fetchFeedItems();

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: "r-1",
      outbreak_id: "ob-1",
      source_type: "who",
      source_name: "WHO",
      disease_name: "Mpox (Clade Ib)",
      title: "Mpox multi-country outbreak — Situation update",
      location: "DR Congo",
      published_at: "2026-02-01T08:00:00Z",
      severity: "critical",
    });
  });

  it("queries reports table ordered by published_at desc, limited to 20", async () => {
    mockSelectResult = { data: [], error: null };
    await fetchFeedItems();
    expect(mockFrom).toHaveBeenCalledWith("reports");
    expect(mockOrder).toHaveBeenCalledWith("published_at", {
      ascending: false,
    });
    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it("returns empty array on Supabase error", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockSelectResult = {
      data: null,
      error: { message: "RLS policy violation" },
    };

    const result = await fetchFeedItems();

    expect(result).toEqual([]);
    expect(consoleError).toHaveBeenCalledWith(
      "Error fetching reports:",
      expect.objectContaining({ message: "RLS policy violation" })
    );
    consoleError.mockRestore();
  });

  it("falls back to 'Unknown' when outbreak_locations is empty", async () => {
    const row = makeReportRow({
      outbreaks: {
        disease_name: "Cholera",
        severity: "severe",
        outbreak_locations: [],
      },
    });
    mockSelectResult = { data: [row], error: null };

    const result = await fetchFeedItems();
    expect(result[0].location).toBe("Unknown");
  });

  it("falls back to empty string when published_at is null", async () => {
    const row = makeReportRow({ published_at: null });
    mockSelectResult = { data: [row], error: null };

    const result = await fetchFeedItems();
    expect(result[0].published_at).toBe("");
  });

  it("handles null data gracefully", async () => {
    mockSelectResult = { data: null, error: null };
    const result = await fetchFeedItems();
    expect(result).toEqual([]);
  });

  it("correctly maps different source types", async () => {
    const rows = [
      makeReportRow({ id: "r-1", source_type: "who", source_name: "WHO" }),
      makeReportRow({ id: "r-2", source_type: "cdc", source_name: "CDC" }),
      makeReportRow({
        id: "r-3",
        source_type: "news",
        source_name: "Reuters",
      }),
    ];
    mockSelectResult = { data: rows, error: null };

    const result = await fetchFeedItems();
    expect(result).toHaveLength(3);
    expect(result[0].source_type).toBe("who");
    expect(result[1].source_type).toBe("cdc");
    expect(result[2].source_type).toBe("news");
  });
});
