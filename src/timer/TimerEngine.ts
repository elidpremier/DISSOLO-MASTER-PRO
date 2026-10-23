/**
 * timer/TimerEngine.ts
 * Moteur de minuterie pour DissoloMaster Pro.
 *
 * Principes (section 4.5 du cahier des charges) :
 * - performance.now() est l'unique source de vérité temporelle.
 * - requestAnimationFrame est le mécanisme de réveil (pas setInterval).
 * - Les retards de réveil > 500 ms sont détectés et signalés.
 * - Les pré-alertes sautées après un réveil tardif sont marquées mais ne rejouent pas.
 * - Le moteur ne rejoue jamais une alerte audio déjà dépassée.
 *
 * Limite documentée : un navigateur ne garantit pas l'exécution temps réel exacte.
 * Les écarts observés sont enregistrés, jamais effacés.
 */

import type { TimelineAction } from "../types/timeline";
import { type ActionEvent, createActionEvent } from "./EventRecord";

// ---------------------------------------------------------------------------
// Types d'événements émis par le moteur
// ---------------------------------------------------------------------------

export type TimerEngineEvent =
  | { type: "preAlert"; record: ActionEvent }
  | { type: "deadline"; record: ActionEvent }
  | { type: "confirmed"; record: ActionEvent }
  | { type: "missed"; record: ActionEvent }
  | { type: "wakeDelay"; delayMs: number }
  | { type: "tick"; elapsedMs: number }
  | { type: "allComplete" }
  | { type: "stopped" };

export type TimerListener = (event: TimerEngineEvent) => void;

// ---------------------------------------------------------------------------
// Constantes internes
// ---------------------------------------------------------------------------

/** Seuil au-delà duquel un intervalle entre deux frames est signalé comme retard. */
const WAKE_DELAY_THRESHOLD_MS = 500;

// ---------------------------------------------------------------------------
// Classe TimerEngine
// ---------------------------------------------------------------------------

export class TimerEngine {
  /** performance.now() au démarrage de l'essai (T0 monotone). */
  private startPerf: number = 0;

  /** performance.now() de la dernière frame RAF. */
  private lastFramePerf: number = 0;

  /** ID de la prochaine frame requestAnimationFrame. null = arrêté. */
  private rafId: number | null = null;

  /** Durée de la pré-alerte en ms. */
  private readonly preAlertMs: number;

  /**
   * Délai après l'échéance sans confirmation → marquage "missed".
   * null = fonctionnalité désactivée.
   */
  private readonly missedThresholdMs: number | null;

  /** Enregistrements de toutes les actions (mutable en cours d'essai). */
  private records: ActionEvent[] = [];

  /** Abonnés aux événements du moteur. */
  private listeners: TimerListener[] = [];

  /** Vrai si l'événement "allComplete" a déjà été émis. */
  private completionEmitted: boolean = false;

  /**
   * @param preAlertSec       Durée de pré-alerte en secondes avant l'échéance.
   * @param missedThresholdSec Délai en secondes après l'échéance sans confirmation
   *                           avant marquage automatique « manquée ».
   *                           null = jamais marquer automatiquement.
   *                           Défaut : 120 s.
   */
  constructor(preAlertSec: number, missedThresholdSec: number | null = 120) {
    this.preAlertMs = preAlertSec * 1000;
    this.missedThresholdMs =
      missedThresholdSec !== null ? missedThresholdSec * 1000 : null;
  }

  // -------------------------------------------------------------------------
  // API publique
  // -------------------------------------------------------------------------

  /**
   * Lance l'essai : enregistre T0 monotone et démarre la boucle RAF.
   */
  start(actions: TimelineAction[]): void {
    if (this.rafId !== null) this.stop();
    this.records = actions.map(createActionEvent);
    this.completionEmitted = false;
    this.startPerf = performance.now();
    this.lastFramePerf = this.startPerf;
    this.rafId = requestAnimationFrame(this.tick);
  }

  /**
   * Arrête proprement le moteur et émet "stopped".
   */
  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.emit({ type: "stopped" });
  }

  /**
   * Confirme une action et calcule l'écart signé depuis l'échéance théorique.
   *   écart_ms = confirmedAtPerf − (startPerf + scheduledOffsetMs)
   *
   * @param actionId  Identifiant de l'action à confirmer.
   * @param annotation Annotation optionnelle de l'opérateur.
   */
  confirm(actionId: string, annotation: string = ""): void {
    const record = this.records.find((r) => r.action.id === actionId);
    if (!record) return;
    if (record.status === "confirmed" || record.status === "cancelled") return;

    const now = performance.now();
    const theoreticalDeadlinePerf =
      this.startPerf + record.action.scheduledOffsetMs;

    record.confirmedAtPerf = now;
    record.deviationMs = now - theoreticalDeadlinePerf;
    record.wallClockConfirmed = new Date().toISOString();
    record.status = "confirmed";
    record.annotation = annotation;

    this.emit({ type: "confirmed", record });
  }

  /**
   * Retourne une copie plate de tous les enregistrements (lecture seule).
   */
  getRecords(): ActionEvent[] {
    return this.records.map((r) => ({ ...r }));
  }

  /**
   * Abonne un écouteur aux événements du moteur.
   * @returns Fonction de désabonnement.
   */
  subscribe(listener: TimerListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Retourne le temps écoulé depuis T0 en ms (0 si non démarré).
   */
  getElapsedMs(): number {
    return this.startPerf === 0 ? 0 : performance.now() - this.startPerf;
  }

  // -------------------------------------------------------------------------
  // Boucle interne
  // -------------------------------------------------------------------------

  private tick = (): void => {
    const now = performance.now();
    const elapsedMs = now - this.startPerf;

    // --- Détection de retard de réveil ---
    const delta = now - this.lastFramePerf;
    if (this.lastFramePerf > 0 && delta > WAKE_DELAY_THRESHOLD_MS) {
      this.emit({ type: "wakeDelay", delayMs: delta });
    }
    this.lastFramePerf = now;

    // --- Traitement des actions ---
    this.processActions(elapsedMs, now);

    // --- Tick global (pour la mise à jour des compteurs visuels) ---
    this.emit({ type: "tick", elapsedMs });

    // --- Planifier la prochaine frame si actif ---
    if (this.rafId !== null) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private processActions(elapsedMs: number, now: number): void {
    let allDone = this.records.length > 0;

    for (const record of this.records) {
      if (record.status === "confirmed" || record.status === "cancelled") {
        continue; // Action terminale : rien à faire
      }

      const schedMs = record.action.scheduledOffsetMs;
      const preAlertMs = schedMs - this.preAlertMs;

      // --- Pré-alerte ---
      if (record.announcedAtPerf === null && elapsedMs >= preAlertMs) {
        record.announcedAtPerf = now;
        // Si l'échéance est déjà dépassée → pré-alerte sautée (réveil tardif)
        record.preAlertSkipped = elapsedMs >= schedMs;
        if (record.status === "pending") record.status = "announced";
        this.emit({ type: "preAlert", record });
      }

      // --- Échéance ---
      if (record.deadlineReachedAtPerf === null && elapsedMs >= schedMs) {
        record.deadlineReachedAtPerf = now;
        // (record.status ne peut être 'confirmed' ici grâce à la garde en tête de boucle)
        record.status = "announced";
        this.emit({ type: "deadline", record });
      }

      // --- Action manquée ---
      if (
        this.missedThresholdMs !== null &&
        record.status !== "missed" &&
        record.deadlineReachedAtPerf !== null &&
        elapsedMs >= schedMs + this.missedThresholdMs
      ) {
        record.status = "missed";
        this.emit({ type: "missed", record });
      }

      // Vérifier si cette action bloque la completion
      // On caste en string pour comparer sans erreur de rétrécissement de type
      const s = record.status as string;
      if (s !== "confirmed" && s !== "missed") {
        allDone = false;
      }
    }

    // --- Fin de l'essai ---
    if (!this.completionEmitted && allDone) {
      this.completionEmitted = true;
      this.emit({ type: "allComplete" });
    }
  }

  private emit(event: TimerEngineEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
