/** Saisie et consultation des données brutes M4 d'un essai sauvegardé. */

import type { StoredTrial } from "../db/TrialStore";
import { saveScientificData } from "../db/TrialStore";
import { calculateDescriptiveStatistics, correctSuccessiveSampling } from "../engine/science";
import type { DissolutionCorrectionConfig, RawMeasurement } from "../types/science";

export class ScientificDataView {
  private container: HTMLElement | null = null;
  private measurements: RawMeasurement[];
  private correctionConfig: DissolutionCorrectionConfig;

  constructor(private readonly trial: StoredTrial, private readonly onBack: () => void) {
    this.measurements = [...(trial.scientificData?.measurements ?? [])];
    this.correctionConfig = trial.scientificData?.correctionConfig ?? {
      mediumVolumeMl: 900, sampleVolumeMl: 10, replacementMode: "full", referenceAmountMg: 100,
    };
  }

  mount(root: HTMLElement): void {
    this.container = document.createElement("div");
    this.container.className = "results-view";
    root.appendChild(this.container);
    this.render();
  }

  unmount(): void { this.container?.remove(); this.container = null; }

  private render(): void {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="results-header">
        <h1 class="results-header__title">🧬 Données de dissolution</h1>
        <p class="results-header__subtitle">${escapeHtml(this.trial.config.id)} — mesures brutes et calculs exploratoires</p>
      </div>
      <div class="card" style="margin-bottom:var(--s5)">
        <div class="card__title">Paramètres de correction</div>
        <div class="form-grid">
          ${numberInput("medium-volume", "Volume de milieu (mL)", this.correctionConfig.mediumVolumeMl, "0.001")}
          ${numberInput("sample-volume", "Volume prélevé (mL)", this.correctionConfig.sampleVolumeMl, "0.001")}
          ${numberInput("reference-amount", "Quantité de référence (mg)", this.correctionConfig.referenceAmountMg, "0.001")}
          <label class="form-group"><span class="form-label">Remplacement du milieu</span>
            <select id="replacement-mode" class="form-select">
              <option value="full" ${this.correctionConfig.replacementMode === "full" ? "selected" : ""}>Complet</option>
              <option value="none" ${this.correctionConfig.replacementMode === "none" ? "selected" : ""}>Sans remplacement</option>
            </select>
          </label>
        </div>
      </div>
      <div class="card" style="margin-bottom:var(--s5)">
        <div class="card__title">Ajouter une mesure brute</div>
        <form id="measurement-form" class="form-grid">
          ${numberInput("vessel-id", "Cuve", 1, "1")}
          ${numberInput("sampling-time", "Temps théorique (min)", "", "0.001")}
          ${numberInput("measurement-value", "Concentration mesurée", "", "0.000001")}
          <label class="form-group"><span class="form-label">Unité</span><select id="measurement-unit" class="form-select"><option>mg/L</option><option>µg/mL</option></select></label>
          <label class="form-group"><span class="form-label">Méthode</span><select id="measurement-method" class="form-select"><option value="uv-vis">UV-Vis</option><option value="clhp">CLHP</option></select></label>
          ${numberInput("dilution-factor", "Facteur de dilution", 1, "0.000001")}
          <label class="form-group" style="grid-column:1/-1"><span class="form-label">Annotation (facultative)</span><input id="measurement-annotation" class="form-input" type="text" maxlength="500" /></label>
          <div style="grid-column:1/-1"><button class="btn btn--primary" type="submit">＋ Ajouter la mesure</button></div>
        </form>
        <div id="science-message" class="import-result hidden" style="margin-top:var(--s3)"></div>
      </div>
      ${this.renderMeasurements()}
      ${this.renderDerivedResults()}
      <div class="results-actions"><button class="btn btn--ghost" id="science-back">← Résultats</button><button class="btn btn--primary" id="science-save">💾 Enregistrer les données</button></div>
      <p class="storage-note">Les mesures brutes restent distinctes des valeurs corrigées. Les calculs sont exploratoires et ne constituent pas une conclusion réglementaire.</p>
    `;
    this.bindEvents();
  }

  private renderMeasurements(): string {
    if (!this.measurements.length) return `<div class="card" style="margin-bottom:var(--s5)"><p class="text-muted">Aucune mesure saisie.</p></div>`;
    return `<div class="card" style="margin-bottom:var(--s5)"><div class="card__title">Mesures brutes (${this.measurements.length})</div><table class="results-table"><thead><tr><th>Cuve</th><th>Temps</th><th>Valeur</th><th>Dilution</th><th>Méthode</th><th></th></tr></thead><tbody>${this.measurements.map((m) => `<tr><td>${m.vesselId}</td><td>${m.samplingTimeMin} min</td><td>${m.value} ${m.unit}</td><td>×${m.dilutionFactor}</td><td>${m.analyticalMethod === "uv-vis" ? "UV-Vis" : "CLHP"}</td><td><button class="btn btn--danger btn--sm" data-remove="${escapeHtml(m.id)}">Supprimer</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  private renderDerivedResults(): string {
    if (!this.measurements.length) return "";
    try {
      const vessels = [...new Set(this.measurements.map((m) => m.vesselId))].sort((a, b) => a - b);
      const rows = vessels.map((vesselId) => {
        const corrected = correctSuccessiveSampling(this.measurements.filter((m) => m.vesselId === vesselId), this.correctionConfig);
        const latest = corrected.at(-1)!;
        const stats = calculateDescriptiveStatistics(corrected.map((m) => m.dissolvedPercent));
        return `<tr><td>Cuve ${vesselId}</td><td>${latest.raw.samplingTimeMin} min</td><td>${latest.cumulativeAmountMg.toFixed(4)} mg</td><td>${latest.dissolvedPercent.toFixed(2)} %</td><td>${stats.mean.toFixed(2)} %</td></tr>`;
      }).join("");
      return `<div class="card" style="margin-bottom:var(--s5)"><div class="card__title">Résultats corrigés par cuve</div><table class="results-table"><thead><tr><th>Cuve</th><th>Dernier temps</th><th>Quantité cumulée</th><th>% dissous</th><th>Moyenne des temps</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    } catch (error) {
      return `<div class="conflict-item" style="margin-bottom:var(--s5)">⚠ ${escapeHtml(error instanceof Error ? error.message : "Paramètres ou mesures invalides.")}</div>`;
    }
  }

  private bindEvents(): void {
    this.container?.querySelector<HTMLFormElement>("#measurement-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const get = (id: string) => this.container!.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      this.correctionConfig = this.readCorrectionConfig();
      const measure: RawMeasurement = {
        id: crypto.randomUUID(), vesselId: Number(get("vessel-id").value), samplingTimeMin: Number(get("sampling-time").value),
        value: Number(get("measurement-value").value), unit: get("measurement-unit").value as RawMeasurement["unit"],
        analyticalMethod: get("measurement-method").value as RawMeasurement["analyticalMethod"], dilutionFactor: Number(get("dilution-factor").value),
        annotation: get("measurement-annotation").value.trim() || undefined,
      };
      if (!Number.isInteger(measure.vesselId) || measure.vesselId < 1 || !Number.isFinite(measure.samplingTimeMin) || measure.samplingTimeMin <= 0 || !Number.isFinite(measure.value) || measure.value < 0 || !Number.isFinite(measure.dilutionFactor) || measure.dilutionFactor <= 0) {
        this.showMessage("Veuillez renseigner des valeurs numériques valides.", false); return;
      }
      this.measurements.push(measure); this.render();
    });
    this.container?.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((button) => button.addEventListener("click", () => {
      this.measurements = this.measurements.filter((m) => m.id !== button.dataset["remove"]); this.render();
    }));
    this.container?.querySelector("#science-back")?.addEventListener("click", this.onBack);
    this.container?.querySelector("#science-save")?.addEventListener("click", () => void this.save());
  }

  private async save(): Promise<void> {
    this.correctionConfig = this.readCorrectionConfig();
    try {
      // Validation complète incluse dans la sauvegarde ; elle ne touche pas aux événements de l'essai.
      await saveScientificData(this.trial.storageId, { correctionConfig: this.correctionConfig, measurements: this.measurements });
      this.render(); this.showMessage("✓ Données scientifiques enregistrées.", true);
    } catch (error) { this.showMessage(error instanceof Error ? error.message : "Échec de l'enregistrement.", false); }
  }

  private showMessage(message: string, ok: boolean): void {
    const target = this.container?.querySelector<HTMLElement>("#science-message");
    if (!target) return;
    target.textContent = message; target.className = `import-result ${ok ? "import-result--ok" : "import-result--err"}`;
  }

  private readCorrectionConfig(): DissolutionCorrectionConfig {
    const number = (id: string) => Number(this.container?.querySelector<HTMLInputElement>(`#${id}`)?.value);
    return {
      mediumVolumeMl: number("medium-volume"), sampleVolumeMl: number("sample-volume"), referenceAmountMg: number("reference-amount"),
      replacementMode: (this.container?.querySelector<HTMLSelectElement>("#replacement-mode")?.value ?? "full") as DissolutionCorrectionConfig["replacementMode"],
    };
  }
}

function numberInput(id: string, label: string, value: number | string, step: string): string {
  return `<label class="form-group"><span class="form-label">${label}</span><input id="${id}" class="form-input" type="number" min="0" step="${step}" required value="${value}" /></label>`;
}

function escapeHtml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
