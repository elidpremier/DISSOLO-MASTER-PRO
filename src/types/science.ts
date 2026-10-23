/**
 * Types du module scientifique (M4).
 *
 * Les mesures brutes sont volontairement séparées des résultats corrigés :
 * aucune conversion, correction ou exclusion n'écrase la donnée saisie.
 */

/** Méthode analytique déclarée par l'opérateur. */
export type AnalyticalMethod = "uv-vis" | "clhp";

/** Unités de concentration prises en charge par le moteur initial. */
export type ConcentrationUnit = "mg/L" | "µg/mL";

/** Mode de remplacement après chaque prélèvement. */
export type ReplacementMode = "full" | "none";

/** Mesure brute, sans correction de dilution ni de prélèvement. */
export interface RawMeasurement {
  id: string;
  vesselId: number;
  samplingTimeMin: number;
  value: number;
  unit: ConcentrationUnit;
  analyticalMethod: AnalyticalMethod;
  /** Facteur multiplicatif appliqué à la concentration mesurée (≥ 1). */
  dilutionFactor: number;
  annotation?: string;
}

/** Paramètres expérimentaux requis pour la correction des prélèvements. */
export interface DissolutionCorrectionConfig {
  mediumVolumeMl: number;
  sampleVolumeMl: number;
  replacementMode: ReplacementMode;
  /** Quantité de principe actif de référence, en mg, pour le calcul du %. */
  referenceAmountMg: number;
}

/** Ensemble de données M4 lié à un essai, conservé à part de la chronologie. */
export interface ScientificDataset {
  correctionConfig: DissolutionCorrectionConfig;
  measurements: RawMeasurement[];
  updatedAt: string;
}

/** Résultat dérivé d'une mesure brute ; les deux valeurs coexistent. */
export interface CorrectedMeasurement {
  raw: RawMeasurement;
  concentrationMgPerL: number;
  correctedConcentrationMgPerL: number;
  cumulativeAmountMg: number;
  dissolvedPercent: number;
}

/** Statistiques descriptives d'une série de valeurs valides. */
export interface DescriptiveStatistics {
  count: number;
  mean: number;
  sampleStandardDeviation: number | null;
  coefficientOfVariationPercent: number | null;
}

/** Point agrégé d'un profil, généralement par temps de prélèvement. */
export interface DissolutionProfilePoint {
  timeMin: number;
  dissolvedPercent: number;
}

/** Règles explicites, identifiées et versionnées, appliquées à f1/f2. */
export interface ProfileComparisonRules {
  id: string;
  version: string;
  minimumPoints: number;
}

export interface ProfileComparisonResult {
  rules: ProfileComparisonRules;
  f1: number | null;
  f2: number | null;
  /** Les motifs empêchent toute conclusion implicite ou réglementaire. */
  notEvaluableReasons: string[];
}

/** Erreur de validation scientifique, avec le champ mis en cause. */
export class ScientificValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(`[ScientificValidationError] Champ "${field}" : ${message}`);
    this.name = "ScientificValidationError";
  }
}
