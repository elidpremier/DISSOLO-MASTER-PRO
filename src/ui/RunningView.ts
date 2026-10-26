/**
 * ui/RunningView.ts
 * Vue principale de l'essai en cours.
 *
 * Gère : alerte prioritaire, compte à rebours, confirmation des actions,
 * détection de réveil tardif, actions manquées. Conforme aux sections
 * 4.5 et 4.6 du cahier des charges.
 */

import type { TimelineAction, TrialConfig } from "../types/timeline";
import type { AudioManager } from "../audio/AudioManager";
import type { ActionEvent } from "../timer/EventRecord";
import type { TimerEngineEvent } from "../timer/TimerEngine";
import type { TrialInterruption } from "../timer/Lifecycle";
import { TimerEngine } from "../timer/TimerEngine";
import {
  formatOffsetMs,
  formatCountdown,
  formatDeviation,
  actionLabel,
  actionIcon,
  actionClass,
  deviationClass,
} from "../utils/format";

type AlertPhase = "idle" | "pre-alert" | "deadline";

export class RunningView {
  private container: HTMLElement | null = null;
  private engine: TimerEngine;
  private unsubscribe: (() => void) | null = null;
  private interruptions: TrialInterruption[] = [];

  /** Action actuellement affichée dans la zone d'alerte. */
  private alertActionId: string | null = null;
  private alertPhase: AlertPhase = "idle";

  constructor(
    config: TrialConfig,
    private readonly actions: TimelineAction[],
    private readonly audio: AudioManager,
    private readonly onComplete: (records: ActionEvent[]) => void,
    private readonly onCheckpoint?: (records: ActionEvent[], interruptions: TrialInterruption[]) => void,
  ) {
    // config.preAlertSec est transmis au moteur
    // config.missedThresholdSec : undefined → défaut moteur 120 s, null → désactivé
    this.engine = new TimerEngine(
      config.preAlertSec,
      config.missedThresholdSec !== undefined ? config.missedThresholdSec : 120
    );
  }

  mount(root: HTMLElement): void {
    this.container = document.createElement("div");
    this.container.className = "running-view";
    this.container.innerHTML = this.renderHTML();
    root.appendChild(this.container);
    this.bindStaticEvents();
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    window.addEventListener("pagehide", this.handlePageHide);
    window.addEventListener("pageshow", this.handlePageShow);

    // Démarrage du moteur et abonnement aux événements
    this.unsubscribe = this.engine.subscribe(this.onTimerEvent);
    this.engine.start(this.actions);
  }

  unmount(): void {
    this.engine.stop();
    this.unsubscribe?.();
    this.unsubscribe = null;
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    window.removeEventListener("pagehide", this.handlePageHide);
    window.removeEventListener("pageshow", this.handlePageShow);
    this.container?.remove();
    this.container = null;
  }

  // -------------------------------------------------------------------------
  // Rendu HTML initial
  // -------------------------------------------------------------------------

  private renderHTML(): string {
    return `
      <!-- Bannière retard de réveil (cachée initialement) -->
      <div id="wake-banner" class="wake-alert hidden">
        ⚠ Retard de réveil détecté — des alertes peuvent avoir été retardées.
        Les écarts réels sont enregistrés.
      </div>

      <!-- Zone d'alerte prioritaire -->
      <div id="alert-zone" class="alert-zone alert-zone--idle">
        ${this.renderIdleZone()}
      </div>

      <!-- Progression -->
      <div>
        <div class="progress-header">
          <span class="section-title">Chronologie</span>
          <span class="progress-header__count" id="progress-count">
            0 / ${this.actions.length} confirmées
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill" id="progress-fill" style="width:0%"></div>
        </div>

        <!-- Liste des actions -->
        <div class="action-list" id="action-list">
          ${this.actions.map((a) => this.renderActionRow(a)).join("")}
        </div>
      </div>

      <!-- Footer -->
      <div class="running-view__footer">
        <button class="btn btn--danger btn--sm" id="btn-stop">
          ■ Terminer l'essai
        </button>
      </div>
    `;
  }

  private renderIdleZone(): string {
    const next = this.actions[0];
    if (!next) {
      return `<div class="alert-zone__idle-content"><p>Aucune action planifiée.</p></div>`;
    }
    return `
      <div class="alert-zone__idle-content">
        <div class="alert-zone__idle-next">PROCHAINE ACTION</div>
        <div class="alert-zone__idle-countdown" id="idle-countdown">--:--</div>
        <div class="alert-zone__idle-label">
          ${actionIcon(next.type)} ${actionLabel(next.type)} — Cuve ${next.vesselId}
          &nbsp;·&nbsp; T + ${formatOffsetMs(next.scheduledOffsetMs)}
        </div>
      </div>
    `;
  }

  private renderActionRow(a: TimelineAction): string {
    const badgeCls =
      actionClass(a.type) === "action--intro"
        ? "action-badge--intro"
        : "action-badge--prelev";

    return `
      <div class="action-row" id="row-${a.id}" data-id="${a.id}" data-status="pending">
        <div class="status-dot status-dot--pending" id="dot-${a.id}"></div>
        <span class="action-badge ${badgeCls} action-row__badge">
          ${actionIcon(a.type)} ${actionLabel(a.type)}
        </span>
        <div class="action-row__info">
          <div class="action-row__vessel">Cuve ${a.vesselId}</div>
          <div class="action-row__time">T + ${formatOffsetMs(a.scheduledOffsetMs)}</div>
        </div>
        <span class="action-row__deviation" id="dev-${a.id}">—</span>
        <button
          class="btn btn--ghost btn--sm action-row__confirm-btn hidden"
          id="confirm-${a.id}"
          data-id="${a.id}"
        >
          ✓ Confirmer
        </button>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Événements statiques (bouton Stop)
  // -------------------------------------------------------------------------

  private bindStaticEvents(): void {
    this.container
      ?.querySelector("#btn-stop")
      ?.addEventListener("click", () => this.handleStop());
  }

  private handleStop(): void {
    this.engine.stop();
    this.onComplete(this.engine.getRecords());
  }

  // -------------------------------------------------------------------------
  // Gestionnaire d'événements du moteur
  // -------------------------------------------------------------------------

  private onTimerEvent = (event: TimerEngineEvent): void => {
    switch (event.type) {
      case "tick":
        this.onTick(event.elapsedMs);
        break;
      case "preAlert":
        this.onPreAlert(event.record);
        break;
      case "deadline":
        this.onDeadline(event.record);
        break;
      case "confirmed":
        this.onConfirmed(event.record);
        break;
      case "missed":
        this.onMissed(event.record);
        break;
      case "wakeDelay":
        this.onWakeDelay();
        break;
      case "allComplete":
        setTimeout(() => this.onComplete(this.engine.getRecords()), 1200);
        break;
      case "stopped":
        break;
    }
  };

  // --- Tick : mise à jour du compte à rebours ---
  private onTick(elapsedMs: number): void {
    if (!this.container) return;

    // Compte à rebours de l'action en alerte active
    if (this.alertPhase !== "idle" && this.alertActionId) {
      const record = this.engine
        .getRecords()
        .find((r) => r.action.id === this.alertActionId);
      if (record) {
        const remaining =
          record.action.scheduledOffsetMs - elapsedMs;
        const timerEl = this.container.querySelector<HTMLElement>(
          "#alert-timer"
        );
        if (timerEl) {
          timerEl.textContent = formatCountdown(remaining);
        }
      }
    }

    // Compte à rebours "idle" (prochaine action)
    if (this.alertPhase === "idle") {
      const next = this.engine
        .getRecords()
        .find((r) => r.status === "pending" || r.status === "announced");
      if (next) {
        const remaining = next.action.scheduledOffsetMs - elapsedMs;
        const cdEl = this.container.querySelector<HTMLElement>("#idle-countdown");
        if (cdEl) cdEl.textContent = formatCountdown(remaining);
      }
    }
  }

  // --- Pré-alerte ---
  private onPreAlert(record: ActionEvent): void {
    // Jouer le son uniquement si la pré-alerte n'a pas été sautée
    if (!record.preAlertSkipped) {
      this.audio.playPreAlert();
    }
    this.setAlertPhase("pre-alert", record);
    this.showRowConfirmButton(record.action.id);
    this.updateRowStatus(record.action.id, "announced");
  }

  // --- Échéance ---
  private onDeadline(record: ActionEvent): void {
    this.audio.playDeadline();
    this.setAlertPhase("deadline", record);
    this.showRowConfirmButton(record.action.id);
    this.updateRowStatus(record.action.id, "announced");
  }

  // --- Confirmation ---
  private onConfirmed(record: ActionEvent): void {
    this.onCheckpoint?.(this.engine.getRecords(), this.interruptions);
    this.updateRowStatus(record.action.id, "confirmed");
    this.hideRowConfirmButton(record.action.id);
    const devEl = this.container?.querySelector<HTMLElement>(
      `#dev-${record.action.id}`
    );
    if (devEl) {
      devEl.textContent = formatDeviation(record.deviationMs);
      devEl.className = `action-row__deviation ${deviationClass(record.deviationMs)}`;
    }

    // Si c'était l'action en alerte, retour idle
    if (this.alertActionId === record.action.id) {
      this.clearAlertZone();
    }
    this.updateProgress();
  }

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === "hidden") {
      this.beginInterruption("hidden");
    } else {
      this.endInterruption();
    }
  };

  private handlePageHide = (): void => {
    this.beginInterruption("pagehide");
  };

  private handlePageShow = (): void => {
    this.endInterruption();
  };

  private beginInterruption(reason: TrialInterruption["reason"]): void {
    const current = this.interruptions.at(-1);
    if (current && current.endedAt === null) return;
    this.interruptions.push({
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `interruption-${Date.now()}`,
      reason,
      startedAt: new Date().toISOString(),
      endedAt: null,
    });
    this.onCheckpoint?.(this.engine.getRecords(), this.interruptions);
  }

  private endInterruption(): void {
    const current = this.interruptions.at(-1);
    if (!current || current.endedAt !== null) return;
    current.endedAt = new Date().toISOString();
    this.onCheckpoint?.(this.engine.getRecords(), this.interruptions);
  }

  // --- Action manquée ---
  private onMissed(record: ActionEvent): void {
    this.updateRowStatus(record.action.id, "missed");
    this.hideRowConfirmButton(record.action.id);
    const devEl = this.container?.querySelector<HTMLElement>(
      `#dev-${record.action.id}`
    );
    if (devEl) {
      devEl.textContent = "MANQUÉE";
      devEl.className = "action-row__deviation deviation--bad";
    }
    if (this.alertActionId === record.action.id) {
      this.clearAlertZone();
    }
    this.updateProgress();
  }

  // --- Retard de réveil ---
  private onWakeDelay(): void {
    this.container
      ?.querySelector("#wake-banner")
      ?.classList.remove("hidden");
  }

  // -------------------------------------------------------------------------
  // Zone d'alerte
  // -------------------------------------------------------------------------

  private setAlertPhase(phase: "pre-alert" | "deadline", record: ActionEvent): void {
    this.alertActionId = record.action.id;
    this.alertPhase = phase;
    if (!this.container) return;

    const zoneEl = this.container.querySelector<HTMLElement>("#alert-zone");
    if (!zoneEl) return;

    zoneEl.className = `alert-zone alert-zone--${phase}`;

    const phaseLabel =
      phase === "pre-alert" ? "⏰ Pré-alerte" : "🔔 ÉCHÉANCE";
    const icon = actionIcon(record.action.type);
    const label = actionLabel(record.action.type);
    const remaining =
      record.action.scheduledOffsetMs - this.engine.getElapsedMs();

    zoneEl.innerHTML = `
      <div class="alert-zone__active-content">
        <div class="alert-zone__phase-label">${phaseLabel}</div>
        <div class="alert-zone__action-type">
          <span class="alert-zone__icon">${icon}</span>
          <div class="alert-zone__action-details">
            <div class="alert-zone__action-name">${label}</div>
            <div class="alert-zone__vessel">Cuve ${record.action.vesselId} &nbsp;·&nbsp; T + ${formatOffsetMs(record.action.scheduledOffsetMs)}</div>
          </div>
        </div>
        <div class="alert-zone__timer" id="alert-timer">${formatCountdown(remaining)}</div>
        <div class="alert-zone__confirm-area">
          <button class="btn btn--success btn--lg" id="alert-confirm-btn">
            ✓ Confirmer
          </button>
          <input
            class="alert-zone__annotation"
            id="alert-annotation"
            type="text"
            placeholder="Annotation optionnelle…"
          />
        </div>
      </div>
    `;

    // Rebind confirm button
    zoneEl
      .querySelector<HTMLButtonElement>("#alert-confirm-btn")
      ?.addEventListener("click", () => {
        if (!this.alertActionId) return;
        const annotation =
          zoneEl.querySelector<HTMLInputElement>("#alert-annotation")?.value ?? "";
        this.engine.confirm(this.alertActionId, annotation);
      });
  }

  private clearAlertZone(): void {
    this.alertActionId = null;
    this.alertPhase = "idle";
    if (!this.container) return;
    const zoneEl = this.container.querySelector<HTMLElement>("#alert-zone");
    if (!zoneEl) return;
    zoneEl.className = "alert-zone alert-zone--idle";
    zoneEl.innerHTML = this.renderIdleZone();
  }

  // -------------------------------------------------------------------------
  // Helpers DOM
  // -------------------------------------------------------------------------

  private updateRowStatus(
    actionId: string,
    status: "announced" | "confirmed" | "missed"
  ): void {
    const row = this.container?.querySelector<HTMLElement>(`#row-${actionId}`);
    if (row) {
      row.className = `action-row action-row--${status}`;
      row.dataset["status"] = status;
    }
    const dot = this.container?.querySelector<HTMLElement>(`#dot-${actionId}`);
    if (dot) {
      dot.className = `status-dot status-dot--${status}`;
    }
  }

  private showRowConfirmButton(actionId: string): void {
    this.container
      ?.querySelector<HTMLButtonElement>(`#confirm-${actionId}`)
      ?.classList.remove("hidden");
    // Bind si pas déjà fait
    const btn = this.container?.querySelector<HTMLButtonElement>(
      `#confirm-${actionId}`
    );
    if (btn && !btn.dataset["bound"]) {
      btn.dataset["bound"] = "1";
      btn.addEventListener("click", () => {
        this.engine.confirm(actionId);
      });
    }
  }

  private hideRowConfirmButton(actionId: string): void {
    this.container
      ?.querySelector<HTMLButtonElement>(`#confirm-${actionId}`)
      ?.classList.add("hidden");
  }

  private updateProgress(): void {
    const records = this.engine.getRecords();
    const done = records.filter(
      (r) => r.status === "confirmed" || r.status === "missed"
    ).length;
    const total = records.length;
    const pct = total > 0 ? (done / total) * 100 : 0;

    const countEl = this.container?.querySelector<HTMLElement>("#progress-count");
    if (countEl) {
      countEl.textContent = `${done} / ${total} terminées`;
    }
    const fillEl = this.container?.querySelector<HTMLElement>("#progress-fill");
    if (fillEl) {
      fillEl.style.width = `${pct.toFixed(1)}%`;
    }
  }
}
