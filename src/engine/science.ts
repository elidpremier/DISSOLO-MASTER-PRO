/**
 * Moteur scientifique pur (M4) : corrections de prélèvements, statistiques
 * descriptives et facteurs f1/f2. Les formules sont celles du cahier des
 * charges et restent indépendantes de l'interface et du stockage.
 */

import {
  type CorrectedMeasurement,
  type DescriptiveStatistics,
  type DissolutionCorrectionConfig,
  type DissolutionProfilePoint,
  type ProfileComparisonResult,
  type ProfileComparisonRules,
  type RawMeasurement,
  ScientificValidationError,
} from "../types/science";

const ML_PER_L = 1_000;

/** Convertit une concentration compatible en mg/L. */
export function toMgPerL(value: number, unit: RawMeasurement["unit"]): number {
  assertFinitePositiveOrZero("value", value);
  // 1 µg/mL = 1 mg/L : les deux unités actuellement admises sont équivalentes.
  switch (unit) {
    case "mg/L":
    case "µg/mL":
      return value;
  }
}

/**
 * Corrige les prélèvements successifs d'une même cuve.
 *
 * Hypothèses : milieu homogène, prélèvement représentatif, même volume à
 * chaque temps. "full" applique Qn = V×Cn + Vs×ΣCi ; "none" applique
 * Qn = [V−(n−1)×Vs]×Cn + Vs×ΣCi. Les concentrations sont corrigées du
 * facteur de dilution avant la formule.
 */
export function correctSuccessiveSampling(
  measurements: RawMeasurement[],
  config: DissolutionCorrectionConfig
): CorrectedMeasurement[] {
  validateCorrectionConfig(config);
  if (measurements.length === 0) {
    throw new ScientificValidationError("measurements", "au moins une mesure est requise.");
  }

  const vesselId = measurements[0]?.vesselId;
  if (measurements.some((m) => m.vesselId !== vesselId)) {
    throw new ScientificValidationError("measurements", "toutes les mesures doivent appartenir à la même cuve.");
  }

  const sorted = [...measurements].sort((a, b) => a.samplingTimeMin - b.samplingTimeMin || a.id.localeCompare(b.id));
  let previousTime = -Infinity;
  let previousConcentrationSum = 0;

  return sorted.map((raw, index) => {
    validateMeasurement(raw);
    if (raw.samplingTimeMin <= previousTime) {
      throw new ScientificValidationError("samplingTimeMin", "les temps doivent être strictement croissants pour une même cuve.");
    }
    previousTime = raw.samplingTimeMin;

    const concentrationMgPerL = toMgPerL(raw.value, raw.unit);
    const correctedConcentrationMgPerL = concentrationMgPerL * raw.dilutionFactor;
    const effectiveVolumeMl = config.replacementMode === "full"
      ? config.mediumVolumeMl
      : config.mediumVolumeMl - index * config.sampleVolumeMl;

    if (effectiveVolumeMl <= 0) {
      throw new ScientificValidationError("sampleVolumeMl", "le volume restant doit rester strictement positif à chaque prélèvement.");
    }

    const cumulativeAmountMg =
      (effectiveVolumeMl * correctedConcentrationMgPerL + config.sampleVolumeMl * previousConcentrationSum) /
      ML_PER_L;
    previousConcentrationSum += correctedConcentrationMgPerL;

    return {
      raw,
      concentrationMgPerL,
      correctedConcentrationMgPerL,
      cumulativeAmountMg,
      dissolvedPercent: (cumulativeAmountMg / config.referenceAmountMg) * 100,
    };
  });
}

/** Calcule moyenne, écart-type d'échantillon et %CV sans imputer de valeur manquante. */
export function calculateDescriptiveStatistics(values: number[]): DescriptiveStatistics {
  if (values.length === 0) {
    throw new ScientificValidationError("values", "au moins une valeur valide est requise.");
  }
  values.forEach((value) => assertFinitePositiveOrZero("values", value));
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length === 1) {
    return { count: 1, mean, sampleStandardDeviation: null, coefficientOfVariationPercent: null };
  }
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  const sampleStandardDeviation = Math.sqrt(variance);
  return {
    count: values.length,
    mean,
    sampleStandardDeviation,
    coefficientOfVariationPercent: mean === 0 ? null : (sampleStandardDeviation / mean) * 100,
  };
}

/**
 * Calcule f1 et f2 sur des profils moyens alignés. Aucun seuil réglementaire
 * n'est appliqué : le résultat numérique ne porte pas de conclusion.
 */
export function compareProfiles(
  reference: DissolutionProfilePoint[],
  test: DissolutionProfilePoint[],
  rules: ProfileComparisonRules
): ProfileComparisonResult {
  validateRules(rules);
  const reasons: string[] = [];
  const refByTime = toProfileMap(reference, "reference", reasons);
  const testByTime = toProfileMap(test, "test", reasons);
  const times = [...refByTime.keys()].sort((a, b) => a - b);

  if (reference.length !== test.length || times.some((time) => !testByTime.has(time))) {
    reasons.push("Les profils doivent contenir exactement les mêmes temps de prélèvement.");
  }
  if (times.length < rules.minimumPoints) {
    reasons.push(`Au moins ${rules.minimumPoints} points communs sont requis par les règles sélectionnées.`);
  }
  if (reasons.length > 0) return { rules, f1: null, f2: null, notEvaluableReasons: reasons };

  const absoluteDifferences = times.map((time) => Math.abs(refByTime.get(time)! - testByTime.get(time)!));
  const referenceSum = times.reduce((sum, time) => sum + refByTime.get(time)!, 0);
  if (referenceSum === 0) {
    return { rules, f1: null, f2: null, notEvaluableReasons: ["La somme des pourcentages de référence ne peut pas être nulle pour calculer f1."] };
  }
  const meanSquaredDifference = times.reduce((sum, time) => sum + (refByTime.get(time)! - testByTime.get(time)!) ** 2, 0) / times.length;
  return {
    rules,
    f1: (100 * absoluteDifferences.reduce((sum, value) => sum + value, 0)) / referenceSum,
    f2: 50 * Math.log10(100 / Math.sqrt(1 + meanSquaredDifference)),
    notEvaluableReasons: [],
  };
}

function toProfileMap(points: DissolutionProfilePoint[], field: string, reasons: string[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const point of points) {
    if (!Number.isFinite(point.timeMin) || point.timeMin <= 0 || !Number.isFinite(point.dissolvedPercent) || point.dissolvedPercent < 0) {
      reasons.push(`Le profil ${field} contient un point invalide.`);
      continue;
    }
    if (map.has(point.timeMin)) reasons.push(`Le profil ${field} contient plusieurs points à ${point.timeMin} min.`);
    map.set(point.timeMin, point.dissolvedPercent);
  }
  return map;
}

function validateCorrectionConfig(config: DissolutionCorrectionConfig): void {
  assertFiniteStrictlyPositive("mediumVolumeMl", config.mediumVolumeMl);
  assertFiniteStrictlyPositive("sampleVolumeMl", config.sampleVolumeMl);
  assertFiniteStrictlyPositive("referenceAmountMg", config.referenceAmountMg);
  if (config.replacementMode !== "full" && config.replacementMode !== "none") {
    throw new ScientificValidationError("replacementMode", "doit être \"full\" ou \"none\".");
  }
}

function validateMeasurement(measurement: RawMeasurement): void {
  if (!measurement.id.trim()) throw new ScientificValidationError("id", "ne peut pas être vide.");
  if (!Number.isInteger(measurement.vesselId) || measurement.vesselId < 1) {
    throw new ScientificValidationError("vesselId", "doit être un entier strictement positif.");
  }
  assertFiniteStrictlyPositive("samplingTimeMin", measurement.samplingTimeMin);
  assertFinitePositiveOrZero("value", measurement.value);
  assertFiniteStrictlyPositive("dilutionFactor", measurement.dilutionFactor);
}

function validateRules(rules: ProfileComparisonRules): void {
  if (!rules.id.trim() || !rules.version.trim()) throw new ScientificValidationError("rules", "id et version sont requis.");
  if (!Number.isInteger(rules.minimumPoints) || rules.minimumPoints < 1) {
    throw new ScientificValidationError("minimumPoints", "doit être un entier supérieur ou égal à 1.");
  }
}

function assertFiniteStrictlyPositive(field: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new ScientificValidationError(field, "doit être un nombre fini strictement positif.");
}

function assertFinitePositiveOrZero(field: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) throw new ScientificValidationError(field, "doit être un nombre fini positif ou nul.");
}
