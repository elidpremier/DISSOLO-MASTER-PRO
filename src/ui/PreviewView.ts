/**
 * ui/PreviewView.ts
 * Aperçu de la chronologie théorique avant le lancement de l'essai.
 *
 * Affiche : toutes les actions triées, avertissements de conflit,
 * activation et test du son, bouton de lancement.
 * Conforme aux sections 4.3, 4.4 et 4.5 du cahier des charges.
 */

import type { TimelineAction, TrialConfig } from "../types/timeline";
import type { ConflictDiagnostic } from "../types/timeline";
import type { AudioManager } from "../audio/AudioManager";
import { formatOffsetMs, actionLabel, actionIcon, actionClass } from "../utils/format";

export class PreviewView {
  private container: HTMLElement | null = null;

  constructor(
    private readonly config: TrialConfig,
    private readonly actions: TimelineAction[],
    private readonly conflicts: ConflictDiagnostic[],
    private readonly audio: AudioManager,
    private readonly onStart: () => void,
    private readonly onBack: () => void
  ) {}

  mount(root: HTMLElement): void {
    this.container = document.createElement("div");
    this.container.className = "preview-view";
    this.container.innerHTML = this.renderHTML();
    root.appendChild(this.container);
    this.bindEvents();
    this.updateSoundStatus();
  }

  unmount(): void {
    this.container?.remove();
    this.container = null;
  }

  // -------------------------------------------------------------------------

  private renderHTML(): string {
    const totalActions = this.actions.length;
    const conflictCount = this.conflicts.length;

    return `
      <div class="preview-view__head">
        <h2 class="preview-view__title">
          Chronologie — <span style="color:var(--text-400);font-weight:400">${this.config.id}</span>
        </h2>
        <span class="badge-count">${totalActions} actions</span>
      </div>

      <!-- Tableau des actions -->
      <div class="card" style="margin-bottom:var(--s5)">
        <table class="timeline-table">
          <thead>
            <tr>
              <th>Échéance T+</th>
              <th>Type</th>
              <th>Cuve</th>
            </tr>
          </thead>
          <tbody>
            ${this.actions.map((a) => this.renderActionRow(a)).join("")}
          </tbody>
        </table>
      </div>

      <!-- Conflits -->
      ${conflictCount > 0 ? this.renderConflicts() : this.renderNoConflict()}

      <!-- Son -->
      <div class="card" style="margin-bottom:var(--s5)">
        <div class="card__title">Son</div>
        <div class="sound-panel">
          <button class="btn btn--ghost btn--sm" id="btn-activate-sound">
            🔊 Activer le son
          </button>
          <button class="btn btn--ghost btn--sm" id="btn-test-sound" disabled>
            ▶ Tester
          </button>
          <div class="sound-panel__status" id="sound-status">
            <span>⚠</span><span>Son non activé</span>
          </div>
        </div>
        <p class="text-muted" style="margin-top:var(--s3);font-size:0.78rem">
          Le son est requis pour les alertes. Une alerte visuelle est toujours affichée
          même si le son est indisponible.
        </p>
      </div>

      <!-- Actions -->
      <div class="preview-view__actions">
        <button class="btn btn--ghost" id="btn-back">
          ← Modifier la configuration
        </button>
        <button class="btn btn--primary btn--lg" id="btn-launch">
          🚀 Lancer l'essai
        </button>
      </div>
    `;
  }

  private renderActionRow(a: TimelineAction): string {
    const cls = actionClass(a.type);
    const icon = actionIcon(a.type);
    const label = actionLabel(a.type);
    return `
      <tr>
        <td class="offset">T + ${formatOffsetMs(a.scheduledOffsetMs)}</td>
        <td>
          <span class="action-badge ${cls === "action--intro" ? "action-badge--intro" : "action-badge--prelev"}">
            ${icon} ${label}
          </span>
        </td>
        <td class="vessel">Cuve ${a.vesselId}</td>
      </tr>
    `;
  }

  private renderConflicts(): string {
    return `
      <div class="card" style="margin-bottom:var(--s5);border-color:var(--warning-border)">
        <div class="card__title" style="color:var(--warning-400)">
          ⚠ ${this.conflicts.length} conflit${this.conflicts.length > 1 ? "s" : ""} détecté${this.conflicts.length > 1 ? "s" : ""}
        </div>
        <p class="text-muted" style="margin-bottom:var(--s3);font-size:0.8rem">
          Ces actions sont séparées par moins de ${this.config.conflictThresholdSec} s (seuil configuré).
          Aucune action n'a été supprimée ou déplacée.
        </p>
        <div class="conflict-list">
          ${this.conflicts
            .map(
              (c) => `
            <div class="conflict-item">
              <span class="conflict-item__icon">⚡</span>
              <span>${c.description}</span>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;
  }

  private renderNoConflict(): string {
    return `
      <div class="card" style="margin-bottom:var(--s5);border-color:var(--success-border);background:var(--success-subtle)">
        <div style="display:flex;align-items:center;gap:var(--s3);color:var(--success-400);font-size:0.87rem">
          <span>✅</span>
          <span>Aucun conflit détecté — tous les intervalles dépassent ${this.config.conflictThresholdSec} s.</span>
        </div>
      </div>
    `;
  }

  private bindEvents(): void {
    const c = this.container;
    if (!c) return;

    c.querySelector("#btn-back")?.addEventListener("click", () => this.onBack());
    c.querySelector("#btn-launch")?.addEventListener("click", () => this.onStart());

    c.querySelector("#btn-activate-sound")?.addEventListener("click", () => {
      const activated = this.audio.activate();
      if (activated) {
        this.updateSoundStatus();
        (c.querySelector<HTMLButtonElement>("#btn-test-sound"))!.disabled = false;
      } else {
        this.showSoundUnavailable();
      }
    });

    c.querySelector("#btn-test-sound")?.addEventListener("click", () => {
      this.audio.playTest();
    });
  }

  private updateSoundStatus(): void {
    const statusEl = this.container?.querySelector<HTMLElement>("#sound-status");
    if (!statusEl) return;
    if (this.audio.isActive()) {
      statusEl.className = "sound-panel__status sound-panel__status--active";
      statusEl.innerHTML = `<span>✅</span><span>Son activé</span>`;
      const activateBtn = this.container?.querySelector<HTMLButtonElement>(
        "#btn-activate-sound"
      );
      if (activateBtn) {
        activateBtn.textContent = "🔊 Son actif";
        activateBtn.disabled = true;
      }
    }
  }

  private showSoundUnavailable(): void {
    const statusEl = this.container?.querySelector<HTMLElement>("#sound-status");
    if (!statusEl) return;
    statusEl.innerHTML = `<span>❌</span><span>Son indisponible — alerte visuelle uniquement</span>`;
  }
}
