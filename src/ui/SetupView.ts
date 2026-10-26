/**
 * ui/SetupView.ts
 * Formulaire de configuration d'un essai de dissolution.
 *
 * Chaque paramètre dispose d'une infobulle accessible au survol et au focus
 * (icône ⓘ à côté du label). Conforme à la section 4.1 du cahier des charges.
 *
 * Champ "missedThresholdSec" : délai configurable avant marquage automatique
 * "manquée", avec option de désactivation totale.
 */

import type { TrialConfig } from "../types/timeline";
import { ConfigValidationError } from "../types/timeline";
import { generateTimeline } from "../engine/generateTimeline";

// ---------------------------------------------------------------------------
// Textes des infobulles
// ---------------------------------------------------------------------------

const TIPS: Record<string, string> = {
  id: "Identifiant unique de l'essai. Utilisé comme nom de base dans les exports JSON et CSV.",
  vesselCount:
    "Nombre de cuves (flacons) de dissolution. Entier ≥ 1. Chaque cuve reçoit sa propre séquence introduction → prélèvements.",
  introOffsetSec:
    "Décalage en secondes entre l'introduction de deux cuves consécutives. 0 = toutes introduites simultanément. Doit être un entier (Q3).",
  samplingTimesMin:
    "Temps de prélèvement en minutes, relatifs à l'introduction de chaque cuve. Séparés par des virgules. Exemple : 5, 15, 30, 45, 60.",
  preAlertSec:
    "Durée en secondes avant l'échéance à laquelle la pré-alerte est déclenchée (3 bips + alerte visuelle). Exemple : 5 s.",
  conflictThresholdSec:
    "Seuil configurable : deux actions séparées par moins de ce délai sont signalées comme conflit potentiel. Valeur non réglementaire.",
  missedThresholdSec:
    "Délai en secondes après l'échéance sans confirmation au-delà duquel l'action est automatiquement marquée « manquée ». Désactivez pour ne jamais marquer automatiquement (vous devrez gérer manuellement les oublis).",
};

// ---------------------------------------------------------------------------
// Helpers HTML
// ---------------------------------------------------------------------------

/**
 * Génère le HTML d'une icône d'infobulle (ⓘ).
 * @param key   Clé dans TIPS.
 * @param below Vrai si la bulle doit s'ouvrir vers le bas (champs en haut de page).
 */
function tip(key: string, below = false): string {
  const text = TIPS[key] ?? "";
  const cls = below ? "tooltip-trigger tooltip-trigger--below" : "tooltip-trigger";
  return `<span class="${cls}" data-tooltip="${text}" tabindex="0" role="note" aria-label="${text}">i</span>`;
}

// ---------------------------------------------------------------------------
// SetupView
// ---------------------------------------------------------------------------

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
          Survolez l'icône <strong style="color:var(--text-300)">ⓘ</strong>
          à côté de chaque champ pour obtenir une explication.
        </p>
      </div>

      <div class="card protocol-preset" style="margin-bottom:var(--s5)">
        <div>
          <div class="card__title">Raccourci de protocole</div>
          <p class="text-muted">Pré-remplit un exemple de séquence comparative : 6 cuves, 35 s, prélèvements à 5, 10, 15, 20, 30, 45 et 60 min. Vérifiez et adaptez chaque valeur à votre méthode.</p>
        </div>
        <button type="button" class="btn btn--ghost" id="btn-comparative-preset">Appliquer l'exemple</button>
      </div>

      <div class="card card--elevated">
        <form class="setup-view__form" id="setup-form" novalidate>

          <!-- Identifiant -->
          <div class="form-group">
            <label class="form-label" for="field-id">
              Identifiant de l'essai
              ${tip("id", true)}
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

          <!-- Cuves + décalage -->
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="field-vessels">
                Nombre de cuves
                ${tip("vesselCount", true)}
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
                ${tip("introOffsetSec", true)}
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

          <!-- Temps de prélèvement -->
          <div class="form-group">
            <label class="form-label" for="field-times">
              Temps de prélèvement
              <span class="form-label__unit">minutes — séparés par des virgules</span>
              ${tip("samplingTimesMin")}
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
              Relatifs à l'introduction de chaque cuve.
            </span>
          </div>

          <!-- Pré-alerte + seuil de conflit -->
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="field-prealert">
                Pré-alerte
                <span class="form-label__unit">secondes avant l'échéance</span>
                ${tip("preAlertSec")}
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
                ${tip("conflictThresholdSec")}
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
            </div>
          </div>

          <!-- Délai "manquée" -->
          <div class="form-group">
            <label class="form-label" for="field-missed">
              Délai avant marquage « manquée »
              <span class="form-label__unit">secondes après l'échéance</span>
              ${tip("missedThresholdSec")}
            </label>
            <div class="inline-field-row">
              <input
                class="form-input"
                type="number"
                id="field-missed"
                name="missedThresholdSec"
                min="10"
                step="10"
                value="120"
              />
              <label class="disable-toggle" for="cb-disable-missed">
                <input type="checkbox" id="cb-disable-missed" />
                Désactiver
              </label>
            </div>
            <span class="form-hint" id="missed-hint">
              Une action non confirmée 120 s après son échéance sera marquée automatiquement.
            </span>
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

    // --- Toggle "Désactiver le délai manquée" ---
    const cbDisable = form.querySelector<HTMLInputElement>("#cb-disable-missed");
    const inputMissed = form.querySelector<HTMLInputElement>("#field-missed");
    const hintMissed = form.querySelector<HTMLElement>("#missed-hint");

    cbDisable?.addEventListener("change", () => {
      const disabled = cbDisable.checked;
      if (inputMissed) inputMissed.disabled = disabled;
      if (hintMissed) {
        hintMissed.textContent = disabled
          ? "Le marquage automatique est désactivé — les actions non confirmées restent en attente."
          : `Une action non confirmée ${inputMissed?.value ?? "120"} s après son échéance sera marquée automatiquement.`;
      }
    });

    // Mise à jour du hint quand la valeur change
    inputMissed?.addEventListener("input", () => {
      if (hintMissed && !cbDisable?.checked) {
        hintMissed.textContent = `Une action non confirmée ${inputMissed.value} s après son échéance sera marquée automatiquement.`;
      }
    });

    form.querySelector("#btn-comparative-preset")?.addEventListener("click", () => {
      const field = <T extends HTMLInputElement>(id: string): T | null => form.querySelector<T>(`#${id}`);
      const id = field("field-id");
      if (id && !id.value) id.value = `dissolution-comparative-${new Date().toISOString().slice(0, 10)}`;
      const vessels = field("field-vessels"); if (vessels) vessels.value = "6";
      const offset = field("field-offset"); if (offset) offset.value = "35";
      const times = field("field-times"); if (times) times.value = "5, 10, 15, 20, 30, 45, 60";
      const prealert = field("field-prealert"); if (prealert) prealert.value = "5";
      const conflict = field("field-conflict"); if (conflict) conflict.value = "15";
      this.clearError();
    });
  }

  private handleSubmit(form: HTMLFormElement): void {
    const config = this.parseForm(form);
    if (!config) return;

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

    // --- missedThresholdSec ---
    const cbDisable = form.querySelector<HTMLInputElement>("#cb-disable-missed");
    let missedThresholdSec: number | null;

    if (cbDisable?.checked) {
      missedThresholdSec = null; // désactivé
    } else {
      const rawMissed = parseInt(data.get("missedThresholdSec") as string, 10);
      if (!Number.isFinite(rawMissed) || rawMissed <= 0) {
        this.showError(
          "Le délai avant « manquée » doit être un entier > 0 secondes, ou désactivé."
        );
        return null;
      }
      missedThresholdSec = rawMissed;
    }

    return {
      id,
      vesselCount: vesselCountRaw,
      introOffsetSec,
      samplingTimesMin,
      preAlertSec,
      conflictThresholdSec,
      missedThresholdSec,
    };
  }

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
    this.container?.querySelector<HTMLElement>("#setup-error")?.classList.add("hidden");
  }
}
