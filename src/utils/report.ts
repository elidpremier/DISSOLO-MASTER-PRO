/** Rapport HTML imprimable. Le navigateur permet de l'enregistrer en PDF. */
import type { StoredTrial } from "../db/TrialStore";

export function printScientificReport(trial: StoredTrial): void {
  const data = trial.scientificData;
  if (!data) return;
  const report = window.open("", "_blank", "noopener,noreferrer");
  if (!report) { alert("Autorisez les fenêtres contextuelles pour imprimer le rapport."); return; }
  const rows = data.measurements.map((m) => `<tr><td>${escape(m.formulation ?? "—")}</td><td>${m.vesselId}</td><td>${m.samplingTimeMin}</td><td>${m.value}</td><td>${m.quantificationMethod === "e1-percent" ? `E1% ${m.e1Percent ?? "—"}, l ${m.pathLengthCm ?? 1} cm` : m.unit}</td><td>${m.dilutionFactor}</td></tr>`).join("");
  report.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport - ${escape(trial.config.id)}</title><style>body{font-family:Arial,sans-serif;margin:26mm;color:#172033}h1{color:#174ea6}h2{margin-top:24px;font-size:16px}table{border-collapse:collapse;width:100%;font-size:10pt}th,td{border:1px solid #b9c4d0;padding:7px;text-align:left}th{background:#edf3fb}.note{font-size:9pt;color:#4c5a6a}@page{margin:18mm}</style></head><body><h1>DissoloMaster Pro - Rapport de dissolution</h1><p><b>Essai :</b> ${escape(trial.config.id)}<br><b>Démarré :</b> ${escape(new Date(trial.startedAt).toLocaleString("fr-FR"))}<br><b>Généré :</b> ${escape(new Date().toLocaleString("fr-FR"))}</p><h2>Méthode</h2><table><tr><th>Volume milieu</th><th>Prélèvement</th><th>Remplacement</th><th>Quantification</th></tr><tr><td>${data.correctionConfig.mediumVolumeMl} mL</td><td>${data.correctionConfig.sampleVolumeMl} mL</td><td>${data.correctionConfig.replacementMode === "full" ? "Complet" : "Sans remplacement"}</td><td>${escape(data.methodConfig?.quantificationMethod ?? "concentration")}</td></tr></table><h2>Mesures brutes</h2><table><thead><tr><th>Formulation</th><th>Cuve</th><th>Temps (min)</th><th>Résultat</th><th>Méthode / unité</th><th>Dilution</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Les données brutes et les paramètres de méthode sont présentés pour la reproductibilité. Les calculs sont exploratoires et ne constituent pas une conclusion réglementaire.</p></body></html>`);
  report.document.close(); report.focus(); report.print();
}

function escape(value: string): string { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
