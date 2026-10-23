/** Saisie et consultation des données brutes M4 d'un essai sauvegardé. */

import type { StoredTrial } from "../db/TrialStore";
import { saveScientificData } from "../db/TrialStore";
import { calculateDescriptiveStatistics, compareProfiles, correctSuccessiveSampling } from "../engine/science";
import type { AnalyticalMethodConfig, DissolutionCorrectionConfig, RawMeasurement } from "../types/science";
import { printScientificReport } from "../utils/report";

export class ScientificDataView {
  private container: HTMLElement | null = null;
  private measurements: RawMeasurement[];
  private correctionConfig: DissolutionCorrectionConfig;
  private quantificationMethod: RawMeasurement["quantificationMethod"];
  private e1Percent: number | undefined;
  private pathLengthCm: number;
  private analyticalMethod: RawMeasurement["analyticalMethod"];
  private concentrationUnit: RawMeasurement["unit"];

  constructor(private readonly trial: StoredTrial, private readonly onBack: () => void) {
    this.measurements = [...(trial.scientificData?.measurements ?? [])];
    this.correctionConfig = trial.scientificData?.correctionConfig ?? {
      mediumVolumeMl: 900, sampleVolumeMl: 10, replacementMode: "full", referenceAmountMg: 100,
    };
    const methodConfig = trial.scientificData?.methodConfig;
    const firstMeasurement = this.measurements[0];
    this.quantificationMethod = methodConfig?.quantificationMethod ?? firstMeasurement?.quantificationMethod ?? "concentration";
    this.e1Percent = methodConfig?.e1Percent ?? firstMeasurement?.e1Percent;
    this.pathLengthCm = methodConfig?.pathLengthCm ?? firstMeasurement?.pathLengthCm ?? 1;
    this.analyticalMethod = methodConfig?.analyticalMethod ?? firstMeasurement?.analyticalMethod ?? "uv-vis";
    this.concentrationUnit = methodConfig?.concentrationUnit ?? firstMeasurement?.unit ?? "mg/L";
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
        <div class="card__title">Méthode — définie une fois pour la série</div>
        <div class="form-grid">
          ${numberInput("medium-volume", "Volume de milieu (mL)", this.correctionConfig.mediumVolumeMl, "0.001")}
          ${numberInput("sample-volume", "Volume prélevé (mL)", this.correctionConfig.sampleVolumeMl, "0.001")}
          <label class="form-group"><span class="form-label">Remplacement du milieu</span>
            <select id="replacement-mode" class="form-select">
              <option value="full" ${this.correctionConfig.replacementMode === "full" ? "selected" : ""}>Complet</option>
              <option value="none" ${this.correctionConfig.replacementMode === "none" ? "selected" : ""}>Sans remplacement</option>
            </select>
          </label>
          <label class="form-group"><span class="form-label">Technique analytique</span><select id="method-analytical" class="form-select"><option value="uv-vis" ${this.analyticalMethod === "uv-vis" ? "selected" : ""}>UV-Vis</option><option value="clhp" ${this.analyticalMethod === "clhp" ? "selected" : ""}>CLHP</option></select></label>
          <label class="form-group"><span class="form-label">Mode de quantification</span><select id="quantification-method" class="form-select"><option value="concentration" ${this.quantificationMethod === "concentration" ? "selected" : ""}>Concentration saisie</option><option value="e1-percent" ${this.quantificationMethod === "e1-percent" ? "selected" : ""}>Spectro E1% (sans standard)</option></select></label>
          <label class="form-group"><span class="form-label">Unité de concentration</span><select id="method-unit" class="form-select"><option ${this.concentrationUnit === "mg/L" ? "selected" : ""}>mg/L</option><option ${this.concentrationUnit === "µg/mL" ? "selected" : ""}>µg/mL</option></select></label>
          ${numberInput("e1-percent", "E1% spécifique (si spectro)", this.e1Percent ?? "", "0.000001", false)}
          ${numberInput("path-length", "Trajet optique (cm, si spectro)", this.pathLengthCm, "0.001")}
        </div>
        <p class="storage-note">E1% et trajet optique sont des paramètres analytiques. Ils sont copiés dans chaque mesure lors de sa saisie pour conserver le calcul reproductible.</p>
      </div>
      <div class="card" style="margin-bottom:var(--s5)">
        <div class="card__title">Ajouter une mesure brute</div>
        <form id="measurement-form" class="form-grid">
          ${numberInput("vessel-id", "Cuve", 1, "1")}
          ${numberInput("sampling-time", "Temps théorique (min)", "", "0.001")}
          ${numberInput("measurement-value", "Résultat : concentration ou absorbance", "", "0.000001")}
          ${numberInput("dilution-factor", "Facteur de dilution", 1, "0.000001")}
          <label class="form-group"><span class="form-label">Formulation / groupe</span><input id="measurement-formulation" class="form-input" type="text" maxlength="100" required placeholder="Référence ou Essai" /></label>
          ${numberInput("reference-amount", "Teneur en PA par unité (mg)", "", "0.000001")}
          <label class="form-group" style="grid-column:1/-1"><span class="form-label">Annotation (facultative)</span><input id="measurement-annotation" class="form-input" type="text" maxlength="500" /></label>
          <div style="grid-column:1/-1"><button class="btn btn--primary" type="submit">＋ Ajouter la mesure</button></div>
        </form>
        <div id="science-message" class="import-result hidden" style="margin-top:var(--s3)"></div>
      </div>
      ${this.renderMeasurements()}
      ${this.renderDerivedResults()}
      <div class="results-actions"><button class="btn btn--ghost" id="science-back">← Résultats</button><div style="display:flex;gap:var(--s3);flex-wrap:wrap"><button class="btn btn--ghost" id="science-report">🖨 Rapport / PDF</button><button class="btn btn--primary" id="science-save">💾 Enregistrer les données</button></div></div>
      <p class="storage-note">Les mesures brutes restent distinctes des valeurs corrigées. Les calculs sont exploratoires et ne constituent pas une conclusion réglementaire.</p>
    `;
    this.bindEvents();
  }

  private renderMeasurements(): string {
    if (!this.measurements.length) return `<div class="card" style="margin-bottom:var(--s5)"><p class="text-muted">Aucune mesure saisie.</p></div>`;
    return `<div class="card" style="margin-bottom:var(--s5)"><div class="card__title">Mesures brutes (${this.measurements.length})</div><table class="results-table"><thead><tr><th>Cuve</th><th>Temps</th><th>Valeur</th><th>Quantification</th><th>Dilution</th><th></th></tr></thead><tbody>${this.measurements.map((m) => `<tr><td>${m.vesselId}</td><td>${m.samplingTimeMin} min</td><td>${m.value} ${m.quantificationMethod === "e1-percent" ? "A" : m.unit}</td><td>${m.quantificationMethod === "e1-percent" ? `E1% ${m.e1Percent}, l ${m.pathLengthCm ?? 1} cm` : "Concentration"}</td><td>×${m.dilutionFactor}</td><td><button class="btn btn--danger btn--sm" data-remove="${escapeHtml(m.id)}">Supprimer</button></td></tr>`).join("")}</tbody></table></div>`;
  }

  private renderDerivedResults(): string {
    if (!this.measurements.length) return "";
    try {
      const vessels = [...new Set(this.measurements.map((m) => m.vesselId))].sort((a, b) => a - b);
      const rows = vessels.map((vesselId) => {
        const corrected = this.correctVessel(vesselId);
        const latest = corrected.at(-1)!;
        const stats = calculateDescriptiveStatistics(corrected.map((m) => m.dissolvedPercent));
        return `<tr><td>Cuve ${vesselId}</td><td>${latest.raw.samplingTimeMin} min</td><td>${latest.cumulativeAmountMg.toFixed(4)} mg</td><td>${latest.dissolvedPercent.toFixed(2)} %</td><td>${stats.mean.toFixed(2)} %</td></tr>`;
      }).join("");
      return `<div class="card" style="margin-bottom:var(--s5)"><div class="card__title">Résultats corrigés par cuve</div><table class="results-table"><thead><tr><th>Cuve</th><th>Dernier temps</th><th>Quantité cumulée</th><th>% dissous</th><th>Moyenne des temps</th></tr></thead><tbody>${rows}</tbody></table></div>${this.renderProfileAnalysis()}`;
    } catch (error) {
      return `<div class="conflict-item" style="margin-bottom:var(--s5)">⚠ ${escapeHtml(error instanceof Error ? error.message : "Paramètres ou mesures invalides.")}</div>`;
    }
  }

  private renderProfileAnalysis(): string {
    const perVessel = new Map<number, ReturnType<typeof correctSuccessiveSampling>>();
    for (const vesselId of new Set(this.measurements.map((m) => m.vesselId))) {
      perVessel.set(vesselId, this.correctVessel(vesselId));
    }
    const grouped = new Map<string, Map<number, number[]>>();
    for (const corrected of perVessel.values()) for (const point of corrected) {
      const formulation = point.raw.formulation?.trim() || "Non renseignée";
      const byTime = grouped.get(formulation) ?? new Map<number, number[]>();
      const values = byTime.get(point.raw.samplingTimeMin) ?? [];
      values.push(point.dissolvedPercent); byTime.set(point.raw.samplingTimeMin, values); grouped.set(formulation, byTime);
    }
    const aggregateRows: string[] = [];
    const profiles = new Map<string, { timeMin: number; dissolvedPercent: number }[]>();
    for (const [formulation, byTime] of grouped) {
      const profile: { timeMin: number; dissolvedPercent: number }[] = [];
      for (const [timeMin, values] of [...byTime.entries()].sort(([a], [b]) => a - b)) {
        const stats = calculateDescriptiveStatistics(values);
        profile.push({ timeMin, dissolvedPercent: stats.mean });
        aggregateRows.push(`<tr><td>${escapeHtml(formulation)}</td><td>${timeMin} min</td><td>${stats.count}</td><td>${stats.mean.toFixed(2)} %</td><td>${stats.sampleStandardDeviation === null ? "—" : stats.sampleStandardDeviation.toFixed(2)}</td><td>${stats.coefficientOfVariationPercent === null ? "—" : `${stats.coefficientOfVariationPercent.toFixed(2)} %`}</td></tr>`);
      }
      profiles.set(formulation, profile);
    }
    const summary = `<div class="card" style="margin-bottom:var(--s5)"><div class="card__title">Statistiques descriptives par formulation et temps</div><table class="results-table"><thead><tr><th>Formulation</th><th>Temps</th><th>n</th><th>Moyenne</th><th>SD</th><th>%CV</th></tr></thead><tbody>${aggregateRows.join("")}</tbody></table></div>`;
    const chart = renderProfileChart(profiles);
    if (profiles.size !== 2) return `${summary}${chart}<div class="card" style="margin-bottom:var(--s5)"><p class="text-muted">La comparaison f1/f2 requiert exactement deux formulations renseignées.</p></div>`;
    const [referenceName, testName] = [...profiles.keys()];
    const result = compareProfiles(profiles.get(referenceName)!, profiles.get(testName)!, { id: "research-f1-f2", version: "1.0.0", minimumPoints: 3 });
    const resultHtml = result.notEvaluableReasons.length
      ? `<p class="text-muted">Non évaluable : ${result.notEvaluableReasons.map(escapeHtml).join(" ")}</p>`
      : `<div class="results-stats"><div class="stat-card"><div class="stat-card__value">${result.f1!.toFixed(2)}</div><div class="stat-card__label">f1</div></div><div class="stat-card"><div class="stat-card__value">${result.f2!.toFixed(2)}</div><div class="stat-card__label">f2</div></div></div><p class="text-muted" style="margin-top:var(--s3)">Résultat numérique exploratoire entre « ${escapeHtml(referenceName)} » et « ${escapeHtml(testName)} » ; aucune conclusion réglementaire n’est déduite automatiquement.</p>`;
    return `${summary}${chart}<div class="card" style="margin-bottom:var(--s5)"><div class="card__title">Comparaison des profils (f1 / f2)</div>${resultHtml}</div>`;
  }

  private bindEvents(): void {
    this.container?.querySelector<HTMLFormElement>("#measurement-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const get = (id: string) => this.container!.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;
      this.correctionConfig = this.readCorrectionConfig();
      this.readMethodConfig();
      const measure: RawMeasurement = {
        id: crypto.randomUUID(), vesselId: Number(get("vessel-id").value), samplingTimeMin: Number(get("sampling-time").value),
        value: Number(get("measurement-value").value), unit: this.concentrationUnit,
        analyticalMethod: this.analyticalMethod, quantificationMethod: this.quantificationMethod,
        e1Percent: this.e1Percent, pathLengthCm: this.pathLengthCm, dilutionFactor: Number(get("dilution-factor").value),
        formulation: get("measurement-formulation").value.trim(), referenceAmountMg: Number(get("reference-amount").value), annotation: get("measurement-annotation").value.trim() || undefined,
      };
      if (!Number.isInteger(measure.vesselId) || measure.vesselId < 1 || !Number.isFinite(measure.samplingTimeMin) || measure.samplingTimeMin <= 0 || !Number.isFinite(measure.value) || measure.value < 0 || !Number.isFinite(measure.dilutionFactor) || measure.dilutionFactor <= 0 || !measure.formulation || !Number.isFinite(measure.referenceAmountMg) || measure.referenceAmountMg! <= 0) {
        this.showMessage("Veuillez renseigner des valeurs numériques valides.", false); return;
      }
      if (measure.quantificationMethod === "e1-percent" && (!Number.isFinite(measure.e1Percent) || measure.e1Percent! <= 0 || !Number.isFinite(measure.pathLengthCm) || measure.pathLengthCm! <= 0)) {
        this.showMessage("La méthode E1% requiert une E1% et un trajet optique strictement positifs.", false); return;
      }
      const existingFormulation = this.measurements.find((item) => item.vesselId === measure.vesselId)?.formulation?.trim();
      if (existingFormulation && existingFormulation !== measure.formulation) {
        this.showMessage(`La cuve ${measure.vesselId} est déjà associée à « ${existingFormulation} » .`, false); return;
      }
      const existingAmount = this.measurements.find((item) => item.formulation?.trim() === measure.formulation)?.referenceAmountMg;
      if (existingAmount !== undefined && existingAmount !== measure.referenceAmountMg) {
        this.showMessage(`La formulation « ${measure.formulation} » a déjà une teneur de ${existingAmount} mg/unité.`, false); return;
      }
      this.measurements.push(measure); this.render();
    });
    this.container?.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((button) => button.addEventListener("click", () => {
      this.measurements = this.measurements.filter((m) => m.id !== button.dataset["remove"]); this.render();
    }));
    this.container?.querySelector("#science-back")?.addEventListener("click", this.onBack);
    this.container?.querySelector("#science-report")?.addEventListener("click", () => this.printReport());
    this.container?.querySelector("#science-save")?.addEventListener("click", () => void this.save());
  }

  private async save(): Promise<void> {
    this.correctionConfig = this.readCorrectionConfig(); this.readMethodConfig();
    try {
      // Validation complète incluse dans la sauvegarde ; elle ne touche pas aux événements de l'essai.
      await saveScientificData(this.trial.storageId, { correctionConfig: this.correctionConfig, methodConfig: this.currentMethodConfig(), measurements: this.measurements });
      this.render(); this.showMessage("✓ Données scientifiques enregistrées.", true);
    } catch (error) { this.showMessage(error instanceof Error ? error.message : "Échec de l'enregistrement.", false); }
  }

  private printReport(): void {
    this.correctionConfig = this.readCorrectionConfig(); this.readMethodConfig();
    printScientificReport({ ...this.trial, scientificData: { correctionConfig: this.correctionConfig, methodConfig: this.currentMethodConfig(), measurements: this.measurements, updatedAt: new Date().toISOString() } });
  }

  private showMessage(message: string, ok: boolean): void {
    const target = this.container?.querySelector<HTMLElement>("#science-message");
    if (!target) return;
    target.textContent = message; target.className = `import-result ${ok ? "import-result--ok" : "import-result--err"}`;
  }

  private readCorrectionConfig(): DissolutionCorrectionConfig {
    const number = (id: string) => Number(this.container?.querySelector<HTMLInputElement>(`#${id}`)?.value);
    return {
      mediumVolumeMl: number("medium-volume"), sampleVolumeMl: number("sample-volume"), referenceAmountMg: this.correctionConfig.referenceAmountMg,
      replacementMode: (this.container?.querySelector<HTMLSelectElement>("#replacement-mode")?.value ?? "full") as DissolutionCorrectionConfig["replacementMode"],
    };
  }

  private readMethodConfig(): void {
    const query = <T extends HTMLElement>(id: string) => this.container?.querySelector<T>(`#${id}`);
    this.quantificationMethod = (query<HTMLSelectElement>("quantification-method")?.value ?? "concentration") as RawMeasurement["quantificationMethod"];
    this.e1Percent = query<HTMLInputElement>("e1-percent")?.value ? Number(query<HTMLInputElement>("e1-percent")!.value) : undefined;
    this.pathLengthCm = Number(query<HTMLInputElement>("path-length")?.value);
    this.analyticalMethod = (query<HTMLSelectElement>("method-analytical")?.value ?? "uv-vis") as RawMeasurement["analyticalMethod"];
    this.concentrationUnit = (query<HTMLSelectElement>("method-unit")?.value ?? "mg/L") as RawMeasurement["unit"];
  }

  private currentMethodConfig(): AnalyticalMethodConfig {
    return {
      analyticalMethod: this.analyticalMethod,
      quantificationMethod: this.quantificationMethod ?? "concentration",
      concentrationUnit: this.concentrationUnit,
      ...(this.e1Percent !== undefined ? { e1Percent: this.e1Percent } : {}),
      ...(this.pathLengthCm ? { pathLengthCm: this.pathLengthCm } : {}),
    };
  }

  private correctVessel(vesselId: number) {
    const measurements = this.measurements.filter((m) => m.vesselId === vesselId);
    const referenceAmountMg = measurements[0]?.referenceAmountMg ?? this.correctionConfig.referenceAmountMg;
    return correctSuccessiveSampling(measurements, { ...this.correctionConfig, referenceAmountMg });
  }
}

function numberInput(id: string, label: string, value: number | string, step: string, required = true): string {
  return `<label class="form-group"><span class="form-label">${label}</span><input id="${id}" class="form-input" type="number" min="0" step="${step}" ${required ? "required" : ""} value="${value}" /></label>`;
}

function escapeHtml(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function renderProfileChart(profiles: Map<string, { timeMin: number; dissolvedPercent: number }[]>): string {
  if (!profiles.size) return "";
  const points = [...profiles.values()].flat();
  const maxTime = Math.max(...points.map((point) => point.timeMin));
  const maxPercent = Math.max(100, ...points.map((point) => point.dissolvedPercent));
  const width = 720, height = 300, left = 54, right = 18, top = 20, bottom = 42;
  const x = (value: number) => left + (value / maxTime) * (width - left - right);
  const y = (value: number) => top + (1 - value / maxPercent) * (height - top - bottom);
  const colors = ["#60a5fa", "#a78bfa", "#34d399", "#fbbf24"];
  const grid = [0, 25, 50, 75, 100].filter((value) => value <= maxPercent).map((value) => `<g><line x1="${left}" x2="${width - right}" y1="${y(value)}" y2="${y(value)}" stroke="rgba(148,163,184,.25)"/><text x="${left - 8}" y="${y(value) + 4}" text-anchor="end" fill="#94a3b8" font-size="11">${value}</text></g>`).join("");
  const lines = [...profiles.entries()].map(([name, profile], index) => {
    const color = colors[index % colors.length];
    const path = profile.map((point, pointIndex) => `${pointIndex ? "L" : "M"}${x(point.timeMin).toFixed(1)},${y(point.dissolvedPercent).toFixed(1)}`).join(" ");
    const dots = profile.map((point) => `<circle cx="${x(point.timeMin)}" cy="${y(point.dissolvedPercent)}" r="4" fill="${color}"/>`).join("");
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="3"/>${dots}<text x="${left + index * 155}" y="${height - 10}" fill="${color}" font-size="12">● ${escapeHtml(name)}</text>`;
  }).join("");
  const ticks = [...new Set(points.map((point) => point.timeMin))].sort((a, b) => a - b).map((time) => `<text x="${x(time)}" y="${height - 27}" text-anchor="middle" fill="#94a3b8" font-size="11">${time}</text>`).join("");
  return `<div class="card" style="margin-bottom:var(--s5)"><div class="card__title">Profils moyens de dissolution</div><div style="overflow-x:auto"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Profils moyens de dissolution" style="width:100%;min-width:560px;display:block">${grid}<line x1="${left}" x2="${width - right}" y1="${height - bottom}" y2="${height - bottom}" stroke="#94a3b8"/>${ticks}${lines}<text x="${left}" y="12" fill="#94a3b8" font-size="11">% dissous</text><text x="${width - right}" y="${height - 27}" text-anchor="end" fill="#94a3b8" font-size="11">Temps (min)</text></svg></div></div>`;
}
