/**
 * ui/HistoryView.ts
 * Vue de l'historique des essais persistés dans IndexedDB.
 *
 * Fonctionnalités :
 * - Liste des essais (plus récent en premier)
 * - Consultation d'un essai dans ResultsView (lecture seule)
 * - Export JSON/CSV par essai depuis la liste
 * - Suppression d'un essai
 * - Import d'un fichier JSON (drag-and-drop + input file)
 * Conforme à la section 8 du cahier des charges (traçabilité et restauration).
 */

import {
  listTrials,
  getTrial,
  deleteTrial,
  importTrialFromJSON,
  TrialStoreError,
  type TrialSummary,
  type StoredTrial,
} from "../db/TrialStore";
import { downloadJSON, downloadCSV } from "../utils/export";

export class HistoryView {
  private container: HTMLElement | null = null;

  constructor(
    private readonly onOpenTrial: (trial: StoredTrial) => void,
    private readonly onBack: () => void
  ) {}

  mount(root: HTMLElement): void {
    this.container = document.createElement("div");
    this.container.className = "history-view";
    this.container.innerHTML = this.renderShell();
    root.appendChild(this.container);
    this.bindEvents();
    this.loadTrials();
  }

  unmount(): void {
    this.container?.remove();
    this.container = null;
  }

  // -------------------------------------------------------------------------
  // Rendu initial (shell sans données)
  // -------------------------------------------------------------------------

  private renderShell(): string {
    return `
      <div class="history-view__head">
        <h2 class="history-view__title">📂 Historique des essais</h2>
        <div class="history-view__actions">
          <button class="btn btn--ghost btn--sm" id="btn-history-back">
            ← Retour
          </button>
        </div>
      </div>

      <!-- Liste des essais (injectée dynamiquement) -->
      <div id="history-list">
        <div class="history-empty">
          <span class="history-empty__icon">⏳</span>
          <p class="history-empty__text">Chargement…</p>
        </div>
      </div>

      <!-- Zone d'import -->
      <div class="card" style="margin-top:var(--s5)">
        <div class="card__title">Importer un essai</div>
        <div
          class="import-zone"
          id="import-zone"
          role="button"
          tabindex="0"
          aria-label="Zone d'import de fichier JSON"
        >
          <span class="import-zone__icon">📥</span>
          Glissez-déposez un fichier JSON exporté ici<br/>
          <span style="font-size:0.78rem;opacity:0.7">ou cliquez pour choisir un fichier</span>
          <input type="file" id="import-file" accept=".json,application/json"
                 style="display:none" />
        </div>
        <div id="import-result" class="import-result hidden"></div>

        <p class="storage-note">
          ⚠ Le stockage IndexedDB est local, non chiffré et non inviolable.
          Les données peuvent être perdues en mode navigation privée ou si le
          stockage du navigateur est effacé. Exportez régulièrement en JSON ou CSV
          pour toute conservation durable (section 8 du cahier des charges).
        </p>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Chargement et rendu de la liste
  // -------------------------------------------------------------------------

  private async loadTrials(): Promise<void> {
    const listEl = this.container?.querySelector<HTMLElement>("#history-list");
    if (!listEl) return;

    try {
      const trials = await listTrials();
      listEl.innerHTML = trials.length > 0
        ? this.renderTrialList(trials)
        : this.renderEmpty();
      this.bindTrialButtons(trials);
    } catch {
      listEl.innerHTML = `
        <div class="history-empty">
          <span class="history-empty__icon">❌</span>
          <p class="history-empty__text">Impossible de charger l'historique.</p>
          <p class="history-empty__hint">IndexedDB indisponible (navigation privée ?).</p>
        </div>
      `;
    }
  }

  private renderTrialList(trials: TrialSummary[]): string {
    return `
      <div class="history-grid">
        ${trials.map((t) => this.renderTrialCard(t)).join("")}
      </div>
    `;
  }

  private renderTrialCard(t: TrialSummary): string {
    const date = new Date(t.startedAt).toLocaleString("fr-FR");
    const missClass = t.missedActions > 0 ? "history-card__stat--miss" : "history-card__stat--ok";

    return `
      <div class="history-card" data-id="${t.storageId}">
        <div class="history-card__info">
          <div class="history-card__id">${escapeHtml(t.trialId)}</div>
          <div class="history-card__meta">
            <span>${date}</span>
            <span class="history-card__meta-dot"></span>
            <div class="history-card__stats">
              <span class="history-card__stat history-card__stat--total">${t.totalActions} actions</span>
              <span class="history-card__stat history-card__stat--ok">✓ ${t.confirmedActions}</span>
              ${t.missedActions > 0
                ? `<span class="history-card__stat ${missClass}">✗ ${t.missedActions}</span>`
                : ""}
            </div>
            <span class="history-card__meta-dot"></span>
            <span style="font-family:monospace;font-size:0.7rem;opacity:0.5">v${t.appVersion}</span>
            <span class="history-status">${t.status === "in-progress" ? "En cours — reprise possible" : "Terminé"}</span>
          </div>
        </div>
        <div class="history-card__btns">
          <button class="btn btn--ghost btn--sm" data-action="view" data-id="${t.storageId}"
                  title="Consulter les résultats">👁</button>
          <button class="btn btn--ghost btn--sm" data-action="export-json" data-id="${t.storageId}"
                  title="Exporter en JSON">↓ JSON</button>
          <button class="btn btn--ghost btn--sm" data-action="export-csv" data-id="${t.storageId}"
                  title="Exporter en CSV">↓ CSV</button>
          <button class="btn btn--danger btn--sm" data-action="delete" data-id="${t.storageId}"
                  title="Supprimer cet essai">🗑</button>
        </div>
      </div>
    `;
  }

  private renderEmpty(): string {
    return `
      <div class="history-empty">
        <span class="history-empty__icon">📋</span>
        <p class="history-empty__text">Aucun essai enregistré pour l'instant.</p>
        <p class="history-empty__hint">
          Les essais sont automatiquement sauvegardés à la fin de chaque session.
        </p>
      </div>
    `;
  }

  // -------------------------------------------------------------------------
  // Liaison des événements
  // -------------------------------------------------------------------------

  private bindEvents(): void {
    const c = this.container;
    if (!c) return;

    // Retour
    c.querySelector("#btn-history-back")?.addEventListener("click", () => this.onBack());

    // Import — clic sur la zone
    const importZone = c.querySelector<HTMLElement>("#import-zone");
    const importFile = c.querySelector<HTMLInputElement>("#import-file");

    importZone?.addEventListener("click", () => importFile?.click());
    importZone?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") importFile?.click();
    });

    // Import — drag-and-drop
    importZone?.addEventListener("dragover", (e) => {
      e.preventDefault();
      importZone.classList.add("import-zone--dragover");
    });
    importZone?.addEventListener("dragleave", () => {
      importZone.classList.remove("import-zone--dragover");
    });
    importZone?.addEventListener("drop", (e) => {
      e.preventDefault();
      importZone.classList.remove("import-zone--dragover");
      const file = (e as DragEvent).dataTransfer?.files[0];
      if (file) this.handleImport(file);
    });

    // Import — sélection de fichier
    importFile?.addEventListener("change", () => {
      const file = importFile.files?.[0];
      if (file) this.handleImport(file);
      importFile.value = ""; // réinitialiser pour permettre de re-sélectionner le même fichier
    });
  }

  private bindTrialButtons(trials: TrialSummary[]): void {
    const c = this.container;
    if (!c) return;

    c.querySelectorAll<HTMLButtonElement>("[data-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.dataset["action"];
        const storageId = btn.dataset["id"] ?? "";

        switch (action) {
          case "view":
            await this.handleView(storageId);
            break;
          case "export-json":
            await this.handleExport(storageId, "json");
            break;
          case "export-csv":
            await this.handleExport(storageId, "csv");
            break;
          case "delete":
            await this.handleDelete(storageId, trials);
            break;
        }
      });
    });
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  private async handleView(storageId: string): Promise<void> {
    try {
      const trial = await getTrial(storageId);
      this.onOpenTrial(trial);
    } catch {
      this.showImportResult("❌ Impossible de charger cet essai.", false);
    }
  }

  private async handleExport(storageId: string, format: "json" | "csv"): Promise<void> {
    try {
      const trial = await getTrial(storageId);
      if (format === "json") {
        downloadJSON(trial.config, trial.records, trial.scientificData);
      } else {
        downloadCSV(trial.config, trial.records);
      }
    } catch {
      // Export silencieux si l'essai est introuvable
    }
  }

  private async handleDelete(storageId: string, trials: TrialSummary[]): Promise<void> {
    const trial = trials.find((t) => t.storageId === storageId);
    if (!trial) return;

    const ok = window.confirm(
      `Supprimer l'essai « ${trial.trialId} » du ${new Date(trial.startedAt).toLocaleString("fr-FR")} ?\n\nCette action est irréversible.`
    );
    if (!ok) return;

    try {
      await deleteTrial(storageId);
      // Retirer la carte du DOM immédiatement
      this.container
        ?.querySelector<HTMLElement>(`.history-card[data-id="${storageId}"]`)
        ?.remove();
      // Si la liste est vide, afficher l'état vide
      const remaining = this.container?.querySelectorAll(".history-card");
      if (!remaining || remaining.length === 0) {
        const listEl = this.container?.querySelector<HTMLElement>("#history-list");
        if (listEl) listEl.innerHTML = this.renderEmpty();
      }
    } catch {
      alert("Impossible de supprimer l'essai. Réessayez.");
    }
  }

  private async handleImport(file: File): Promise<void> {
    try {
      const text = await file.text();
      const json: unknown = JSON.parse(text);
      await importTrialFromJSON(json);
      this.showImportResult(`✅ Essai importé depuis « ${file.name} ».`, true);
      // Recharger la liste
      await this.loadTrials();
    } catch (err) {
      if (err instanceof SyntaxError) {
        this.showImportResult("❌ Fichier JSON invalide.", false);
      } else if (err instanceof TrialStoreError) {
        this.showImportResult(`❌ ${err.message}`, false);
      } else {
        this.showImportResult("❌ Erreur inattendue lors de l'import.", false);
      }
    }
  }

  private showImportResult(msg: string, ok: boolean): void {
    const el = this.container?.querySelector<HTMLElement>("#import-result");
    if (!el) return;
    el.textContent = msg;
    el.className = `import-result ${ok ? "import-result--ok" : "import-result--err"}`;
    el.classList.remove("hidden");
    // Masquer après 5 s
    setTimeout(() => el.classList.add("hidden"), 5000);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
