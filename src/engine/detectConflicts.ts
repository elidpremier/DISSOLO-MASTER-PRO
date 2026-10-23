/**
 * engine/detectConflicts.ts
 * Détection des conflits entre actions consécutives d'une chronologie.
 *
 * Responsabilité unique : analyser une liste d'actions déjà triées et
 * signaler les paires dont l'écart est inférieur au seuil configuré.
 *
 * Règles fondamentales (section 4.4 du cahier des charges) :
 *   - Le moteur ne supprime jamais d'action.
 *   - Le moteur ne déplace jamais d'action.
 *   - Le seuil (conflictThresholdSec) est configurable.
 *   - Deux niveaux de sévérité : "warning" et "operational".
 *     (Le niveau "operational" sera utilisé dans les versions intégrant
 *      les durées opératoires ; il n'est pas calculé ici.)
 *
 * Hypothèse : la liste d'actions reçue est déjà triée par scheduledOffsetMs
 * croissant (produite par generateTimeline).
 */

import type { ConflictDiagnostic, TimelineAction, TrialConfig } from "../types/timeline";

/**
 * Détecte les conflits potentiels entre actions consécutives.
 *
 * @param actions - Liste d'actions triée par scheduledOffsetMs croissant.
 * @param config  - Configuration de l'essai (pour le seuil).
 * @returns Liste des conflits détectés (peut être vide). La chronologie n'est pas modifiée.
 */
export function detectConflicts(
  actions: TimelineAction[],
  config: TrialConfig
): ConflictDiagnostic[] {
  const thresholdMs = config.conflictThresholdSec * 1000;
  const diagnostics: ConflictDiagnostic[] = [];

  // Comparaison de chaque paire d'actions consécutives dans la chronologie triée
  for (let i = 0; i < actions.length - 1; i++) {
    const actionA = actions[i];
    const actionB = actions[i + 1];

    // Calcul de l'écart (toujours ≥ 0 car la liste est triée)
    const gapMs = actionB.scheduledOffsetMs - actionA.scheduledOffsetMs;

    if (gapMs < thresholdMs) {
      diagnostics.push({
        actionIdA: actionA.id,
        actionIdB: actionB.id,
        gapMs,
        // Sévérité "warning" par défaut (pas de durées opératoires dans M1)
        severity: "warning",
        description:
          `Conflit potentiel : "${actionA.id}" (cuve ${actionA.vesselId}, ${actionA.type}) ` +
          `et "${actionB.id}" (cuve ${actionB.vesselId}, ${actionB.type}) ` +
          `sont séparées de ${(gapMs / 1000).toFixed(1)} s, ` +
          `inférieur au seuil de ${config.conflictThresholdSec} s.`,
      });
    }
  }

  return diagnostics;
}
