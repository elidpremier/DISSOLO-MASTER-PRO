import { describe, expect, it } from "vitest";
import { calculateDescriptiveStatistics, compareProfiles, correctSuccessiveSampling, toMgPerL } from "../science";
import type { DissolutionCorrectionConfig, RawMeasurement } from "../../types/science";
import { ScientificValidationError } from "../../types/science";

const correction: DissolutionCorrectionConfig = {
  mediumVolumeMl: 900,
  sampleVolumeMl: 10,
  replacementMode: "full",
  referenceAmountMg: 100,
};

function measurement(id: string, time: number, value: number): RawMeasurement {
  return { id, vesselId: 1, samplingTimeMin: time, value, unit: "mg/L", analyticalMethod: "uv-vis", dilutionFactor: 1 };
}

describe("Correction des prélèvements successifs", () => {
  it("applique la formule avec remplacement complet et préserve les données brutes", () => {
    const results = correctSuccessiveSampling([measurement("m2", 10, 20), measurement("m1", 5, 10)], correction);
    // T5 : 900 mL × 10 mg/L / 1000 = 9 mg ; T10 : (900×20 + 10×10)/1000 = 18,1 mg
    expect(results.map((r) => r.cumulativeAmountMg)).toEqual([9, 18.1]);
    expect(results[1].dissolvedPercent).toBeCloseTo(18.1);
    expect(results[0].raw.id).toBe("m1");
  });

  it("applique la formule sans remplacement", () => {
    const results = correctSuccessiveSampling([measurement("m1", 5, 10), measurement("m2", 10, 20)], { ...correction, replacementMode: "none" });
    // T10 : ((900 - 10) × 20 + 10 × 10) / 1000 = 17,9 mg
    expect(results[1].cumulativeAmountMg).toBeCloseTo(17.9);
  });

  it("corrige explicitement le facteur de dilution et accepte les unités équivalentes", () => {
    const raw = { ...measurement("m1", 5, 3), unit: "µg/mL" as const, dilutionFactor: 2 };
    const result = correctSuccessiveSampling([raw], correction)[0];
    expect(toMgPerL(3, "µg/mL")).toBe(3);
    expect(result.correctedConcentrationMgPerL).toBe(6);
    expect(result.cumulativeAmountMg).toBeCloseTo(5.4);
  });

  it("rejette deux temps identiques dans une même cuve", () => {
    expect(() => correctSuccessiveSampling([measurement("a", 5, 1), measurement("b", 5, 2)], correction)).toThrow(ScientificValidationError);
  });
});

describe("Statistiques descriptives", () => {
  it("calcule la moyenne, l'écart-type d'échantillon et le CV", () => {
    const stats = calculateDescriptiveStatistics([10, 20, 30]);
    expect(stats.mean).toBe(20);
    expect(stats.sampleStandardDeviation).toBeCloseTo(10);
    expect(stats.coefficientOfVariationPercent).toBeCloseTo(50);
  });

  it("ne fabrique pas un SD/CV pour un seul résultat", () => {
    expect(calculateDescriptiveStatistics([12])).toMatchObject({ count: 1, mean: 12, sampleStandardDeviation: null, coefficientOfVariationPercent: null });
  });
});

describe("Comparaison de profils", () => {
  const rules = { id: "research-f1-f2", version: "1.0.0", minimumPoints: 3 };
  const ref = [{ timeMin: 5, dissolvedPercent: 20 }, { timeMin: 10, dissolvedPercent: 50 }, { timeMin: 15, dissolvedPercent: 80 }];

  it("calcule f1 et f2 sans conclure sur la similitude", () => {
    const result = compareProfiles(ref, [{ timeMin: 5, dissolvedPercent: 25 }, { timeMin: 10, dissolvedPercent: 55 }, { timeMin: 15, dissolvedPercent: 85 }], rules);
    expect(result.f1).toBeCloseTo(10);
    // f2 = 50 × log10(100 / √(1 + 25)) = 64,6257…
    expect(result.f2).toBeCloseTo(64.626, 3);
    expect(result.notEvaluableReasons).toEqual([]);
  });

  it("refuse un calcul avec des temps non alignés", () => {
    const result = compareProfiles(ref, [{ timeMin: 5, dissolvedPercent: 25 }, { timeMin: 10, dissolvedPercent: 55 }, { timeMin: 20, dissolvedPercent: 85 }], rules);
    expect(result.f1).toBeNull();
    expect(result.notEvaluableReasons).not.toHaveLength(0);
  });
});
