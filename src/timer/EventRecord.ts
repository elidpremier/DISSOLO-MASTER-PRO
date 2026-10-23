/**
 * timer/EventRecord.ts
 * Structure de données pour l'enregistrement complet d'une action avec horodatages.
 *
 * Chaque champ de temps utilise performance.now() (horloge monotone).
 * Les horodatages civils sont fournis pour la lisibilité du journal uniquement.
 * Conforme à la section 4.6 du cahier des charges.
 */

import type { ActionStatus, TimelineAction } from "../types/timeline";

/**
 * Enregistrement complet d'une action avec tous ses horodatages (performance.now()).
 */
export interface ActionEvent {
  /** Action source (immuable, issue du moteur M1). */
  readonly action: TimelineAction;

  /** performance.now() au moment de la pré-alerte. null si non émise. */
  announcedAtPerf: number | null;

  /** performance.now() au moment de l'échéance atteinte. null si pas encore. */
  deadlineReachedAtPerf: number | null;

  /** performance.now() au moment de la confirmation. null si non confirmé. */
  confirmedAtPerf: number | null;

  /**
   * Écart signé entre confirmation et échéance théorique, en ms.
   * écart = confirmedAtPerf − (startPerf + scheduledOffsetMs)
   * Positif = confirmé en retard. Négatif = confirmé en avance. null si non confirmé.
   */
  deviationMs: number | null;

  /**
   * Horodatage civil de la confirmation (ISO 8601).
   * Pour lisibilité du journal uniquement — ne remplace pas l'horloge monotone.
   */
  wallClockConfirmed: string | null;

  /** Statut courant de l'action. */
  status: ActionStatus;

  /** Annotation optionnelle saisie par l'opérateur à la confirmation. */
  annotation: string;

  /**
   * Vrai si la pré-alerte a été sautée (réveil tardif : l'échéance
   * était déjà dépassée au moment du traitement).
   */
  preAlertSkipped: boolean;
}

/**
 * Crée un ActionEvent initial (tout à null / pending) à partir d'une TimelineAction.
 */
export function createActionEvent(action: TimelineAction): ActionEvent {
  return {
    action,
    announcedAtPerf: null,
    deadlineReachedAtPerf: null,
    confirmedAtPerf: null,
    deviationMs: null,
    wallClockConfirmed: null,
    status: "pending",
    annotation: "",
    preAlertSkipped: false,
  };
}
