import { describe, it, expect } from "vitest";
import { extractDisease, extractCountry, estimateSeverity } from "./who-parser";

// ---------------------------------------------------------------------------
// extractDisease — regex-based disease identification from WHO DON titles
// ---------------------------------------------------------------------------
describe("extractDisease", () => {
  it("matches each known disease pattern", () => {
    const cases: [string, string][] = [
      ["Cholera - Haiti", "Cholera"],
      ["Ebola virus disease - Democratic Republic of the Congo", "Ebola"],
      ["Marburg virus disease - Rwanda", "Marburg Virus"],
      ["Mpox - Sweden", "Mpox"],
      ["Monkeypox - United Kingdom", "Mpox"],
      ["Measles - Somalia", "Measles"],
      ["Dengue - Brazil", "Dengue"],
      ["Yellow Fever - Nigeria", "Yellow Fever"],
      ["Plague - Madagascar", "Plague"],
      ["Avian Influenza A(H5N1) - United States of America", "H5N1 Avian Influenza"],
      ["H5N1 bird flu - Egypt", "H5N1 Avian Influenza"],
      ["Influenza A(H1N1) - Mexico", "Influenza A (H1N1)"],
      ["Circulating vaccine-derived poliovirus - Chad", "Polio"],
      ["Meningococcal disease - Niger", "Meningitis"],
      ["Lassa Fever - Nigeria", "Lassa Fever"],
      ["Rift Valley Fever - Kenya", "Rift Valley Fever"],
      ["Diphtheria - Bangladesh", "Diphtheria"],
      ["Malaria - Burundi", "Malaria"],
      ["Zika virus disease - India", "Zika"],
      ["Chikungunya - Paraguay", "Chikungunya"],
      ["COVID-19 update - Global", "COVID-19"],
      ["SARS-CoV-2 variant - South Africa", "COVID-19"],
      ["Hepatitis E - South Sudan", "Hepatitis"],
      ["Nipah virus - Bangladesh", "Nipah Virus"],
      ["MERS-CoV - Saudi Arabia", "MERS-CoV"],
      ["Oropouche virus disease - Brazil", "Oropouche"],
      ["Middle East respiratory syndrome - Jordan", "MERS-CoV"],
    ];

    for (const [title, expected] of cases) {
      expect(extractDisease(title), `title: "${title}"`).toBe(expected);
    }
  });

  it("returns 'Unknown Disease' for unrecognized titles", () => {
    expect(extractDisease("Novel pathogen - Antarctica")).toBe("Unknown Disease");
    expect(extractDisease("")).toBe("Unknown Disease");
    expect(extractDisease("Public health update")).toBe("Unknown Disease");
  });

  it("is case-insensitive", () => {
    expect(extractDisease("CHOLERA - HAITI")).toBe("Cholera");
    expect(extractDisease("ebola - guinea")).toBe("Ebola");
    expect(extractDisease("DENGUE FEVER - brazil")).toBe("Dengue");
  });

  it("matches first disease when title contains multiple keywords", () => {
    // DISEASE_PATTERNS is ordered — cholera appears before malaria
    const result = extractDisease("Cholera and Malaria co-infection - Nigeria");
    expect(result).toBe("Cholera");
  });
});

// ---------------------------------------------------------------------------
// extractCountry — parse country from WHO DON title format "Disease - Country"
// ---------------------------------------------------------------------------
describe("extractCountry", () => {
  it("extracts country after standard dash separator", () => {
    expect(extractCountry("Cholera - Haiti")).toBe("Haiti");
    expect(extractCountry("Ebola - Democratic Republic of the Congo")).toBe(
      "Democratic Republic of the Congo"
    );
  });

  it("handles en-dash and em-dash separators", () => {
    expect(extractCountry("Cholera – Haiti")).toBe("Haiti");
    expect(extractCountry("Cholera — Haiti")).toBe("Haiti");
  });

  it("strips (update) and (situation update) suffixes", () => {
    expect(extractCountry("Mpox - Sweden (update)")).toBe("Sweden");
    expect(extractCountry("Dengue - Brazil (Situation Update)")).toBe("Brazil");
  });

  it("strips trailing 'update' text", () => {
    expect(extractCountry("Cholera - Haiti update")).toBe("Haiti");
  });

  it("returns 'Unknown' when no dash separator exists", () => {
    expect(extractCountry("Global health update")).toBe("Unknown");
    expect(extractCountry("")).toBe("Unknown");
  });

  it("preserves 'Global' as-is", () => {
    // Global is kept so fetchWHOOutbreaks can filter it out
    expect(extractCountry("COVID-19 - Global")).toBe("Global");
  });

  it("handles no space around dash", () => {
    expect(extractCountry("Cholera-Haiti")).toBe("Haiti");
  });

  it("handles extra whitespace", () => {
    expect(extractCountry("Cholera -   Haiti  ")).toBe("Haiti");
  });
});

// ---------------------------------------------------------------------------
// estimateSeverity — keyword-based severity classification
// ---------------------------------------------------------------------------
describe("estimateSeverity", () => {
  describe("explicit WHO risk assessments (highest priority)", () => {
    it("returns critical for 'risk is high'", () => {
      expect(estimateSeverity("Ebola", "The risk is high at national level")).toBe("critical");
    });

    it("returns critical for 'public health emergency'", () => {
      expect(estimateSeverity("", "Declared public health emergency of international concern")).toBe(
        "critical"
      );
    });

    it("returns severe for 'risk is moderate'", () => {
      expect(estimateSeverity("Mpox", "The risk is moderate")).toBe("severe");
    });

    it("returns moderate for 'risk is low'", () => {
      expect(estimateSeverity("Measles", "Overall risk is low")).toBe("moderate");
    });
  });

  describe("keyword fallback when no explicit risk assessment", () => {
    it("returns critical for death/fatal/emergency keywords", () => {
      expect(estimateSeverity("", "12 confirmed deaths reported")).toBe("critical");
      expect(estimateSeverity("Fatal case confirmed", "")).toBe("critical");
      expect(estimateSeverity("", "State of emergency declared")).toBe("critical");
    });

    it("returns severe for outbreak/surge/spreading keywords", () => {
      expect(estimateSeverity("", "Large outbreak in northern region")).toBe("severe");
      expect(estimateSeverity("Surge in cases", "")).toBe("severe");
      expect(estimateSeverity("", "Disease spreading rapidly")).toBe("severe");
    });

    it("returns moderate for cases/detected keywords", () => {
      expect(estimateSeverity("New cases reported", "")).toBe("moderate");
      expect(estimateSeverity("", "Virus detected in samples")).toBe("moderate");
    });

    it("returns low when no severity keywords present", () => {
      expect(estimateSeverity("Routine surveillance", "No unusual activity")).toBe("low");
      expect(estimateSeverity("", "")).toBe("low");
    });
  });

  describe("priority ordering", () => {
    it("explicit risk assessment wins over keyword fallback", () => {
      // Contains both "risk is low" and "death" — risk assessment should win
      // because it appears first in the if-chain
      expect(estimateSeverity("", "risk is low despite one death")).toBe("moderate");
    });

    it("checks title AND summary combined", () => {
      // Keyword split across title and summary
      expect(estimateSeverity("Outbreak", "in rural region")).toBe("severe");
    });
  });
});
