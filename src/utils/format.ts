/**
 * utils/format.ts
 * Fonctions de formatage pour l'affichage des durées, écarts et types d'action.
 *
 * Ces fonctions sont pures (sans effets de bord) et utilisées dans toutes les vues.
 * Les unités sont toujours présentes dans les valeurs retournées (section 4.2).
 */

import type { ActionType } from "../types/timeline";

// ---------------------------------------------------------------------------
// Durées et offsets
// ---------------------------------------------------------------------------

/**
 * Formate un offset positif en ms sous la forme "MM:SS".
 * Exemple : 90 000 → "01:30"
 */
export function formatOffsetMs(ms: number): string {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Formate un compte à rebours (peut être négatif = dépassement) en texte lisible.
 * Exemples : 90 000 → "01m 30s" | -5 000 → "+5s (dépassé)"
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) {
    const over = Math.ceil(Math.abs(ms) / 1000);
    return over === 0 ? "MAINTENANT" : `+${over}s`;
  }
  const totalSec = Math.ceil(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) {
    return `${min}m ${String(sec).padStart(2, "0")}s`;
  }
  return `${totalSec}s`;
}

/**
 * Formate un écart signé en ms sous la forme "±X.X s".
 * Retourne "—" si null.
 */
export function formatDeviation(ms: number | null): string {
  if (ms === null) return "—";
  const sign = ms >= 0 ? "+" : "";
  return `${sign}${(ms / 1000).toFixed(1)} s`;
}

// ---------------------------------------------------------------------------
// Types d'action
// ---------------------------------------------------------------------------

/** Libellé court d'un type d'action. */
export function actionLabel(type: ActionType): string {
  return type === "introduction" ? "Introduction" : "Prélèvement";
}

/** Icône d'un type d'action (non basée uniquement sur la couleur — section 4.5). */
export function actionIcon(type: ActionType): string {
  return type === "introduction" ? "🔬" : "💧";
}

/** Classe CSS associée au type d'action. */
export function actionClass(type: ActionType): string {
  return type === "introduction" ? "action--intro" : "action--prelev";
}

// ---------------------------------------------------------------------------
// Qualité de l'écart temporel (pour coloration)
// ---------------------------------------------------------------------------

/**
 * Classe CSS de qualité de l'écart :
 *   < 5 s  → "deviation--good"
 *   5–15 s → "deviation--warn"
 *   > 15 s → "deviation--bad"
 */
export function deviationClass(ms: number | null): string {
  if (ms === null) return "";
  const absMs = Math.abs(ms);
  if (absMs < 5_000) return "deviation--good";
  if (absMs < 15_000) return "deviation--warn";
  return "deviation--bad";
}
