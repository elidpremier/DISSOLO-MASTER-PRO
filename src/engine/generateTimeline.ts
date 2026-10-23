/**
 * engine/generateTimeline.ts
 * Génération de la chronologie théorique d'un essai de dissolution.
 *
 * Responsabilité unique : produire la liste ordonnée des actions à partir
 * d'une configuration validée. Cette fonction est pure : aucun effet de bord,
 * aucune mutation, aucune détection de conflit (voir detectConflicts.ts).
 *
 * Convention temporelle (section 4.2 du cahier des charges) :
 *   - T0 = lancement de l'essai (offset 0 ms).
 *   - Cuve i introduite à : (i − 1) × introOffsetSec × 1000 ms
 *   - Prélèvement de la cuve i au temps p (minutes) :
 *       (i − 1) × introOffsetSec × 1000 + p × 60 × 1000 ms
 *
 * Tri déterministe (section 4.3, règles 5 et 6) :
 *   1. scheduledOffsetMs croissant
 *   2. À égalité : "introduction" avant "prelevement"
 *   3. À égalité : vesselId croissant
 *
 * Aucune action n'est perdue, même si plusieurs partagent la même échéance.
 */

import type { TimelineAction, TrialConfig } from "../types/timeline";
import { ConfigValidationError } from "../types/timeline";

// ---------------------------------------------------------------------------
// Validation de la configuration
// ---------------------------------------------------------------------------

/**
 * Valide la configuration d'un essai et lève une ConfigValidationError
 * avec un message explicite en cas de valeur invalide.
 *
 * @throws {ConfigValidationError}
 */
function validateConfig(config: TrialConfig): void {
  // id
  if (typeof config.id !== "string" || config.id.trim() === "") {
    throw new ConfigValidationError("id", "doit être une chaîne non vide");
  }

  // vesselCount : entier strictement positif
  if (
    !Number.isFinite(config.vesselCount) ||
    !Number.isInteger(config.vesselCount) ||
    config.vesselCount < 1
  ) {
    throw new ConfigValidationError(
      "vesselCount",
      "doit être un entier strictement positif, reçu : " +
        String(config.vesselCount)
    );
  }

  // introOffsetSec : entier ≥ 0
  if (
    !Number.isFinite(config.introOffsetSec) ||
    !Number.isInteger(config.introOffsetSec) ||
    config.introOffsetSec < 0
  ) {
    throw new ConfigValidationError(
      "introOffsetSec",
      "doit être un entier de secondes ≥ 0, reçu : " +
        String(config.introOffsetSec)
    );
  }

  // samplingTimesMin : tableau non vide, valeurs finies et strictement positives
  if (!Array.isArray(config.samplingTimesMin) || config.samplingTimesMin.length === 0) {
    throw new ConfigValidationError(
      "samplingTimesMin",
      "doit être un tableau non vide"
    );
  }
  config.samplingTimesMin.forEach((t, i) => {
    if (!Number.isFinite(t)) {
      throw new ConfigValidationError(
        "samplingTimesMin",
        `la valeur à l'index ${i} n'est pas un nombre fini : ${String(t)}`
      );
    }
    if (t <= 0) {
      throw new ConfigValidationError(
        "samplingTimesMin",
        `la valeur à l'index ${i} doit être strictement positive, reçu : ${t}`
      );
    }
  });

  // preAlertSec : fini et ≥ 0
  if (!Number.isFinite(config.preAlertSec) || config.preAlertSec < 0) {
    throw new ConfigValidationError(
      "preAlertSec",
      "doit être un nombre fini ≥ 0, reçu : " + String(config.preAlertSec)
    );
  }

  // conflictThresholdSec : fini et > 0
  if (
    !Number.isFinite(config.conflictThresholdSec) ||
    config.conflictThresholdSec <= 0
  ) {
    throw new ConfigValidationError(
      "conflictThresholdSec",
      "doit être un nombre fini strictement positif, reçu : " +
        String(config.conflictThresholdSec)
    );
  }
}

// ---------------------------------------------------------------------------
// Génération des actions
// ---------------------------------------------------------------------------

/**
 * Génère la liste triée de toutes les actions théoriques d'un essai.
 *
 * @param config - Configuration validée de l'essai.
 * @returns Tableau immuable de TimelineAction, trié de façon déterministe.
 * @throws {ConfigValidationError} si la configuration est invalide.
 */
export function generateTimeline(config: TrialConfig): TimelineAction[] {
  // Validation préalable — lève une erreur explicite si invalide
  validateConfig(config);

  const actions: TimelineAction[] = [];

  for (let vesselIndex = 1; vesselIndex <= config.vesselCount; vesselIndex++) {
    // Offset d'introduction de cette cuve (en ms depuis T0)
    const introOffsetMs = (vesselIndex - 1) * config.introOffsetSec * 1000;

    // --- Action d'introduction ---
    actions.push({
      id: `introduction-v${vesselIndex}`,
      vesselId: vesselIndex,
      type: "introduction",
      scheduledOffsetMs: introOffsetMs,
      status: "pending",
    });

    // --- Actions de prélèvement ---
    // Les temps fournis sont normalisés (triés) pour l'identifiant,
    // mais tous conservés, y compris les doublons.
    config.samplingTimesMin.forEach((timeMin, samplingIndex) => {
      const samplingOffsetMs = introOffsetMs + timeMin * 60 * 1000;
      actions.push({
        id: `prelevement-v${vesselIndex}-s${samplingIndex}`,
        vesselId: vesselIndex,
        type: "prelevement",
        scheduledOffsetMs: samplingOffsetMs,
        status: "pending",
      });
    });
  }

  // Tri déterministe (section 4.3, règles 5–6)
  actions.sort((a, b) => {
    // 1. Échéance croissante
    if (a.scheduledOffsetMs !== b.scheduledOffsetMs) {
      return a.scheduledOffsetMs - b.scheduledOffsetMs;
    }
    // 2. introduction avant prelevement
    if (a.type !== b.type) {
      return a.type === "introduction" ? -1 : 1;
    }
    // 3. vesselId croissant
    return a.vesselId - b.vesselId;
  });

  return actions;
}
