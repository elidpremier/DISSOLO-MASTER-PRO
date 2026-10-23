/**
 * ui/SetupView.ts
 * Formulaire de configuration d'un essai de dissolution.
 *
 * Valide les entrées via generateTimeline (moteur M1) avant la transition.
 * Affiche les messages d'erreur explicites (section 4.1).
 */

import type { TrialConfig } from "../types/timeline";
import { ConfigValidationError } from "../types/timeline";
import { generateTimeline } from "../engine/generateTimeline";

export class SetupView {
  private container: HTMLElement | null = null;

  constructor(private readonly onComplete: (config: TrialConfig) => void) {}

  mount(root: HTMLElement): void {
    this.container = document.createElement("div");
    this.container.className = "setup-view";
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
    return `
      <div class="setup-view__header">
        <h1 class="setup-view__title">🧪 Nouvel essai</h1>
        <p class="setup-view__subtitle">
          Configurez les paramètres de l'essai de dissolution.
          Les unités sont indiquées à côté de chaque champ.
        </p>
      </div>

      <div class="card card--elevated">
        <form class="setup-view__form" id="setup-form" novalidate>

          <div class="form-group">
            <label class="form-label" for="field-id">
              Identifiant de l'essai
            </label>
            <input
              class="form-input"
              type="text"
              id="field-id"
              name="id"
              placeholder="ex. dissolution-ibuprofene-2026-10"
              autocomplete="off"
              required
            />
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="field-vessels">
                Nombre de cuves
              </label>
              <input
                class="form-input"
                type="number"
                id="field-vessels"
                name="vesselCount"
                min="1"
                step="1"
                value="6"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="field-offset">
                Décalage d'introduction
                <span class="form-label__unit">secondes entières</span>
              </label>
              <input
                class="form-input"
                type="number"
                id="field-offset"
                name="introOffsetSec"
                min="0"
                step="1"
                value="30"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="field-times">
              Temps de prélèvement
              <span class="form-label__unit">minutes — séparés par des virgules</span>
            </label>
            <input
              class="form-input"
              type="text"
              id="field-times"
              name="samplingTimesMin"
              placeholder="ex. 5, 10, 15, 30, 45, 60"
              value="5, 10, 15, 30, 45, 60"
            />
            <span class="form-hint">
              Les temps sont relatifs à l'introduction de chaque cuve.
            </span>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="field-prealert">
                Pré-alerte
                <span class="form-label__unit">secondes avant l'échéance</span>
              </label>
              <input
                class="form-input"
                type="number"
                id="field-prealert"
                name="preAlertSec"
                min="0"
                step="1"
                value="5"
              />
            </div>
            <div class="form-group">
              <label class="form-label" for="field-conflict">
                Seuil de conflit
                <span class="form-label__unit">secondes</span>
              </label>
              <input
                class="form-input"
                type="number"
                id="field-conflict"
                name="conflictThresholdSec"
                min="1"
                step="1"
                value="15"
              />
              <span class="form-hint">
                Valeur configurable — pas une règle réglementaire universelle.
              </span>
            </div>
          </div>

          <div id="setup-error" class="form-error hidden"></div>

          <div class="setup-view__actions">
            <button type="submit" class="btn btn--primary btn--lg" id="btn-generate">
              Générer la chronologie →
            </button>
          </div>

        </form>
      </div>
    `;
  }

  private bindEvents(): void {
    const form = this.container?.querySelector<HTMLFormElement>("#setup-form");
    if (!form) return;

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleSubmit(form);
    });

    // Validation inline à la perte de focus
    form.querySelectorAll<HTMLInputElement>(".form-input").forEach((input) => {
      input.addEventListener("blur", () => this.clearFieldError(input));
    });
  }

  private handleSubmit(form: HTMLFormElement): void {
    const config = this.parseForm(form);
    if (!config) return;

    // Valider via le moteur M1 (lève ConfigValidationError si invalide)
    try {
      generateTimeline(config);
    } catch (err) {
      if (err instanceof ConfigValidationError) {
        this.showError(err.message);
        return;
      }
      throw err;
    }

    this.onComplete(config);
  }

  private parseForm(form: HTMLFormElement): TrialConfig | null {
    this.clearError();
    const data = new FormData(form);

    // --- id ---
    const id = (data.get("id") as string).trim();
    if (!id) {
      this.showError("L'identifiant de l'essai est obligatoire.");
      return null;
    }

    // --- vesselCount ---
    const vesselCountRaw = parseInt(data.get("vesselCount") as string, 10);
    if (!Number.isFinite(vesselCountRaw) || vesselCountRaw < 1) {
      this.showError("Le nombre de cuves doit être un entier ≥ 1.");
      return null;
    }

    // --- introOffsetSec ---
    const introOffsetSec = parseInt(data.get("introOffsetSec") as string, 10);
    if (!Number.isFinite(introOffsetSec) || introOffsetSec < 0) {
      this.showError("Le décalage doit être un entier de secondes ≥ 0.");
      return null;
    }

    // --- samplingTimesMin ---
    const rawTimes = (data.get("samplingTimesMin") as string).trim();
    const samplingTimesMin = this.parseSamplingTimes(rawTimes);
    if (samplingTimesMin === null) {
      this.showError(
        "Les temps de prélèvement doivent être des nombres positifs séparés par des virgules."
      );
      return null;
    }

    // --- preAlertSec ---
    const preAlertSec = parseInt(data.get("preAlertSec") as string, 10);
    if (!Number.isFinite(preAlertSec) || preAlertSec < 0) {
      this.showError("La pré-alerte doit être un entier ≥ 0 secondes.");
      return null;
    }

    // --- conflictThresholdSec ---
    const conflictThresholdSec = parseInt(
      data.get("conflictThresholdSec") as string,
      10
    );
    if (!Number.isFinite(conflictThresholdSec) || conflictThresholdSec <= 0) {
      this.showError("Le seuil de conflit doit être un entier > 0 secondes.");
      return null;
    }

    return {
      id,
      vesselCount: vesselCountRaw,
      introOffsetSec,
      samplingTimesMin,
      preAlertSec,
      conflictThresholdSec,
    };
  }

  /**
   * Parse une chaîne de temps séparés par virgules/espaces.
   * Retourne null si un élément est invalide.
   */
  private parseSamplingTimes(raw: string): number[] | null {
    const parts = raw.split(/[,\s;]+/).filter((s) => s.trim() !== "");
    if (parts.length === 0) return null;
    const times: number[] = [];
    for (const part of parts) {
      const n = parseFloat(part);
      if (!Number.isFinite(n) || n <= 0) return null;
      times.push(n);
    }
    return times;
  }

  private showError(msg: string): void {
    const el = this.container?.querySelector<HTMLElement>("#setup-error");
    if (!el) return;
    el.textContent = "⚠ " + msg;
    el.classList.remove("hidden");
  }

  private clearError(): void {
    const el = this.container?.querySelector<HTMLElement>("#setup-error");
    el?.classList.add("hidden");
  }

  private clearFieldError(input: HTMLInputElement): void {
    input.classList.remove("form-input--error");
  }
}
