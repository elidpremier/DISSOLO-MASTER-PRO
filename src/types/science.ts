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

/** Origine de la quantification : concentration déjà calculée ou E1% en spectro. */
export type QuantificationMethod = "concentration" | "e1-percent";

/** Métadonnées de recherche nécessaires pour reconstruire le contexte de l'essai. */
export interface LaboratoryMetadata {
  operatorId: string;
  productName: string;
  batchId: string;
  dosageForm: string;
  methodReference: string;
  methodVersion: string;
  apparatusId: string;
  instrumentId: string;
  mediumDescription: string;
  temperatureC?: number;
  rotationRpm?: number;
  notes?: string;
}

/** Paramètres analytiques communs à une série de mesures. */
export interface AnalyticalMethodConfig {
  analyticalMethod: AnalyticalMethod;
  quantificationMethod: QuantificationMethod;
  concentrationUnit: ConcentrationUnit;
  e1Percent?: number;
  pathLengthCm?: number;
  wavelengthNm?: number;
  blankDescription?: string;
  targetAbsorbanceMin?: number;
  targetAbsorbanceMax?: number;
}

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
  /** En mode e1-percent, value correspond à l'absorbance mesurée. */
  quantificationMethod?: QuantificationMethod;
  /** Absorbance spécifique E1% (solution à 1 % m/V, trajet optique 1 cm). */
  e1Percent?: number;
  /** Longueur de trajet optique de la cuve, en cm. */
  pathLengthCm?: number;
  /** Lectures UV répétées, si renseignées ; value conserve leur moyenne utilisée. */
  absorbanceReading1?: number;
  absorbanceReading2?: number;
  /** Facteur multiplicatif appliqué à la concentration mesurée (≥ 1). */
  dilutionFactor: number;
  /** Groupe de comparaison (p. ex. « Référence » ou « Essai »). */
  formulation?: string;
  /** Teneur en principe actif par unité de cette formulation, en mg. */
  referenceAmountMg?: number;
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
  methodConfig?: AnalyticalMethodConfig;
  laboratoryMetadata: LaboratoryMetadata;
  measurements: RawMeasurement[];
  updatedAt: string;
  revision: number;
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
  minimumUnitsPerFormulation?: number;
  maximumCoefficientOfVariationPercent?: number;
}

export type ProfileCheckStatus = "pass" | "fail" | "not-evaluated";

export interface ProfileComparisonCheck {
  id: string;
  label: string;
  status: ProfileCheckStatus;
  detail: string;
}

export interface ProfileComparisonContext {
  referenceUnitCount?: number;
  testUnitCount?: number;
  referenceCoefficientOfVariationByTime?: Map<number, number | null>;
  testCoefficientOfVariationByTime?: Map<number, number | null>;
}

export interface ProfileComparisonResult {
  rules: ProfileComparisonRules;
  f1: number | null;
  f2: number | null;
  checks: ProfileComparisonCheck[];
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
