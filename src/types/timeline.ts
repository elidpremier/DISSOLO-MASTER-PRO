/**
 * types/timeline.ts
 * Définitions de types pour le moteur temporel de DissoloMaster Pro.
 *
 * Hypothèses documentées :
 * - Le décalage d'introduction (introOffsetSec) est un entier de secondes ≥ 0.
 * - Les temps de prélèvement (samplingTimesMin) sont en minutes, strictement positifs.
 * - T0 est le moment de lancement de l'essai (référence temporelle globale).
 * - Toutes les échéances internes sont calculées en millisecondes depuis T0.
 * - Cuve 1 est introduite à T0 ; cuve i à (i − 1) × introOffsetSec secondes.
 * - Chaque prélèvement est relatif à l'introduction de sa propre cuve.
 */

// ---------------------------------------------------------------------------
// Types d'action et de statut
// ---------------------------------------------------------------------------

/** Type d'action dans la chronologie. */
export type ActionType = "introduction" | "prelevement";

/**
 * Statut d'une action.
 * - pending    : en attente, non encore notifiée
 * - announced  : pré-alerte émise (T − preAlertSec)
 * - confirmed  : l'opérateur a confirmé l'action
 * - missed     : l'échéance est dépassée sans confirmation
 * - cancelled  : annulée explicitement
 */
export type ActionStatus =
  | "pending"
  | "announced"
  | "confirmed"
  | "missed"
  | "cancelled";

// ---------------------------------------------------------------------------
// Configuration d'un essai
// ---------------------------------------------------------------------------

/**
 * Configuration complète d'un essai de dissolution.
 * Toutes les valeurs invalides doivent être rejetées avec un message explicite.
 */
export interface TrialConfig {
  /** Identifiant ou nom de l'essai. */
  id: string;

  /** Nombre de cuves : entier strictement positif. */
  vesselCount: number;

  /**
   * Décalage d'introduction entre cuves consécutives, en secondes entières ≥ 0.
   * Décalage nul = toutes les cuves introduites simultanément à T0.
   */
  introOffsetSec: number;

  /**
   * Liste des temps de prélèvement, en minutes, strictement positifs.
   * L'ordre fourni n'est pas supposé trié ; le moteur normalisera.
   * Les doublons sont conservés avec un avertissement mais ne sont pas supprimés.
   */
  samplingTimesMin: number[];

  /**
   * Durée de la pré-alerte avant l'échéance, en secondes.
   * Valeur par défaut : 5 s.
   */
  preAlertSec: number;

  /**
   * Seuil en dessous duquel deux actions consécutives sont signalées comme
   * conflit potentiel, en secondes.
   * Valeur par défaut : 15 s.
   * Ce seuil est configurable ; il ne constitue pas une règle réglementaire.
   */
  conflictThresholdSec: number;
}

// ---------------------------------------------------------------------------
// Action de la chronologie
// ---------------------------------------------------------------------------

/**
 * Représentation d'une action dans la chronologie générée.
 * Les champs sont en lecture seule : le moteur ne modifie jamais
 * silencieusement une action existante.
 */
export interface TimelineAction {
  /** Identifiant unique et déterministe (format : "<type>-v<vesselId>-<index>"). */
  id: string;

  /** Numéro de cuve, indexé à 1. */
  vesselId: number;

  /** Type d'action. */
  type: ActionType;

  /**
   * Échéance théorique en millisecondes depuis T0.
   * Calculs :
   *   introduction : (vesselId − 1) × introOffsetSec × 1000
   *   prelevement  : introduction + samplingTimeMin × 60 × 1000
   */
  scheduledOffsetMs: number;

  /** Statut courant de l'action. Initialisé à "pending". */
  status: ActionStatus;
}

// ---------------------------------------------------------------------------
// Diagnostic de conflit
// ---------------------------------------------------------------------------

/**
 * Sévérité d'un conflit détecté.
 * - warning     : deux actions proches, attention requise
 * - operational : l'enchaînement paraît difficile ou impossible
 *   (réservé aux versions intégrant les durées opératoires)
 */
export type ConflictSeverity = "warning" | "operational";

/**
 * Diagnostic de conflit entre deux actions consécutives.
 * La détection ne modifie jamais la chronologie.
 */
export interface ConflictDiagnostic {
  /** Identifiant de la première action (échéance la plus précoce). */
  actionIdA: string;

  /** Identifiant de la seconde action. */
  actionIdB: string;

  /** Écart entre les deux échéances, en millisecondes. */
  gapMs: number;

  /** Sévérité du conflit. */
  severity: ConflictSeverity;

  /** Description lisible du conflit, à afficher à l'utilisateur. */
  description: string;
}

// ---------------------------------------------------------------------------
// Erreurs de validation
// ---------------------------------------------------------------------------

/**
 * Erreur levée lorsqu'une configuration d'essai est invalide.
 * Le message indique le champ concerné et la raison du rejet.
 */
export class ConfigValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string
  ) {
    super(`[ConfigValidationError] Champ "${field}" : ${message}`);
    this.name = "ConfigValidationError";
  }
}
