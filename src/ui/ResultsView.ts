/**
 * ui/ResultsView.ts
 * Journal post-essai avec récapitulatif, écarts, export JSON/CSV.
 *
 * Les données brutes (enregistrements ActionEvent) sont affichées telles quelles,
 * sans correction silencieuse. Conforme aux sections 4.6 et 8 du cahier des charges.
 */

import type { TrialConfig } from "../types/timeline";
import type { ActionEvent } from "../timer/EventRecord";
import {
  formatOffsetMs,
  formatDeviation,
  actionLabel,
  actionIcon,
  actionClass,
  deviationClass,
} from "../utils/format";
import { downloadJSON, downloadCSV } from "../utils/export";

export class ResultsView {
  private container: HTMLElement | null = null;

  /**
   * @param config       Configuration de l'essai.
   * @param records      Enregistrements des actions.
   * @param onNewTrial   Callback retour à Setup (null = mode lecture seule).
   * @param onHistory    Callback vers l'historique (optionnel).
   */
  constructor(
    private readonly config: TrialConfig,
    private readonly records: ActionEvent[],
    private readonly onNewTrial: (() => void) | null,
    private readonly onHistory?: () => void,
    private readonly onScientificData?: () => void,
  ) {}

  mount(root: HTMLElement): void {
    this.container = document.createElement("div");
    this.container.className = "results-view";
    this.container.innerHTML = this.renderHTML();
    root.appendChild(this.container);
    this.bindEvents();
  }

  unmount(): void {
    this.container?.remove();
    this.container = null;
  }

  // -------------------------------------------------------------------------

  private renderHTML(): string {
    const total = this.records.length;
    const confirmed = this.records.filter((r) => r.status === "confirmed").length;
    const missed = this.records.filter((r) => r.status === "missed").length;
    const pending = this.records.filter(
      (r) => r.status !== "confirmed" && r.status !== "missed"
    ).length;

    // Écart moyen sur les actions confirmées
    const devs = this.records
      .filter((r) => r.deviationMs !== null)
      .map((r) => r.deviationMs as number);
    const avgDev =
      devs.length > 0
        ? devs.reduce((a, b) => a + b, 0) / devs.length
        : null;

    return `
      <div class="results-header">
        <h1 class="results-header__title">📋 Résultats de l'essai</h1>
        <p class="results-header__subtitle">
          ${this.config.id} — ${new Date().toLocaleString("fr-FR")}
        </p>
      </div>

      <!-- Statistiques synthétiques -->
      <div class="results-stats">
        <div class="stat-card">
          <div class="stat-card__value">${total}</div>
          <div class="stat-card__label">Actions totales</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value stat-card__value--success">${confirmed}</div>
          <div class="stat-card__label">Confirmées</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value stat-card__value--danger">${missed}</div>
          <div class="stat-card__label">Manquées</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${avgDev !== null ? formatDeviation(avgDev) : "—"}</div>
          <div class="stat-card__label">Écart moyen</div>
        </div>
      </div>

      ${pending > 0 ? this.renderPendingWarning(pending) : ""}

      <!-- Tableau complet -->
      <div class="card" style="margin-bottom:var(--s5)">
        <div class="card__title">Journal des actions</div>
        <table class="results-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Cuve</th>
              <th>Échéance T+</th>
              <th>Statut</th>
              <th>Écart</th>
              <th>Annotation</th>
            </tr>
          </thead>
          <tbody>
            ${this.records.map((r) => this.renderRow(r)).join("")}
          </tbody>
        </table>
      </div>

      <!-- Note sur les limites -->
      <div class="card" style="margin-bottom:var(--s5);border-color:var(--neutral-border)">
        <p class="text-muted" style="font-size:0.78rem;line-height:1.7">
          <strong style="color:var(--text-300)">Note :</strong>
          Ce journal est un enregistrement de traçabilité de recherche, non un audit trail
          réglementaire inviolable. Les écarts sont calculés par rapport aux échéances
          théoriques (horloge monotone <code>performance.now()</code>).
          La précision réelle dépend des conditions d'exécution du navigateur.
        </p>
      </div>

      <!-- Actions -->
      <div class="results-actions">
        <div style="display:flex;gap:var(--s3);flex-wrap:wrap">
          ${this.onNewTrial
            ? `<button class="btn btn--primary btn--lg" id="btn-new-trial">
                ＋ Nouvel essai
               </button>`
            : ""}
          ${this.onHistory
            ? `<button class="btn btn--ghost" id="btn-history">
                ← Historique
               </button>`
            : ""}
          ${this.onScientificData
            ? `<button class="btn btn--ghost" id="btn-scientific-data">🧬 Données de dissolution</button>`
            : ""}
        </div>
        <div class="results-actions__export">
          <button class="btn btn--ghost" id="btn-export-json">
            ↓ Exporter JSON
          </button>
          <button class="btn btn--ghost" id="btn-export-csv">
            ↓ Exporter CSV
          </button>
        </div>
      </div>
    `;
  }

  private renderRow(r: ActionEvent): string {
    const badgeCls =
      actionClass(r.action.type) === "action--intro"
        ? "action-badge--intro"
        : "action-badge--prelev";

    const statusCell = this.renderStatusCell(r);
    const devCls = deviationClass(r.deviationMs);

    return `
      <tr>
        <td>
          <span class="action-badge ${badgeCls}">
            ${actionIcon(r.action.type)} ${actionLabel(r.action.type)}
          </span>
        </td>
        <td>Cuve ${r.action.vesselId}</td>
        <td class="mono">T + ${formatOffsetMs(r.action.scheduledOffsetMs)}</td>
        <td>${statusCell}</td>
        <td class="mono ${devCls}">${formatDeviation(r.deviationMs)}</td>
        <td style="color:var(--text-400);font-size:0.8rem">
          ${r.annotation || "—"}
        </td>
      </tr>
    `;
  }

  private renderStatusCell(r: ActionEvent): string {
    switch (r.status) {
      case "confirmed":
        return `<span style="color:var(--success-400);font-size:0.82rem;font-weight:600">✅ Confirmée</span>`;
      case "missed":
        return `<span style="color:var(--danger-400);font-size:0.82rem;font-weight:600">❌ Manquée</span>`;
      case "pending":
        return `<span style="color:var(--text-500);font-size:0.82rem">⏳ Non effectuée</span>`;
      default:
        return `<span style="color:var(--text-500);font-size:0.82rem">${r.status}</span>`;
    }
  }

  private renderPendingWarning(count: number): string {
    return `
      <div class="conflict-item" style="margin-bottom:var(--s5)">
        <span class="conflict-item__icon">⚠</span>
        <span>
          ${count} action${count > 1 ? "s" : ""} non effectuée${count > 1 ? "s" : ""}
          (essai arrêté avant la fin).
        </span>
      </div>
    `;
  }

  private bindEvents(): void {
    if (this.onNewTrial) {
      this.container
        ?.querySelector("#btn-new-trial")
        ?.addEventListener("click", () => this.onNewTrial!());
    }

    if (this.onHistory) {
      this.container
        ?.querySelector("#btn-history")
        ?.addEventListener("click", () => this.onHistory!());
    }
    if (this.onScientificData) {
      this.container?.querySelector("#btn-scientific-data")?.addEventListener("click", () => this.onScientificData!());
    }

    this.container
      ?.querySelector("#btn-export-json")
      ?.addEventListener("click", () => downloadJSON(this.config, this.records));

    this.container
      ?.querySelector("#btn-export-csv")
      ?.addEventListener("click", () => downloadCSV(this.config, this.records));
  }
}
