/**
 * utils/export.ts
 * Fonctions d'export des données d'essai en JSON et CSV.
 *
 * Les données brutes sont préservées distinctes des données dérivées (section 8).
 * L'export inclut les métadonnées de version pour la reproductibilité.
 */

import type { TrialConfig } from "../types/timeline";
import type { ActionEvent } from "../timer/EventRecord";
import type { ScientificDataset } from "../types/science";
import { formatDeviation, formatOffsetMs, actionLabel } from "./format";

const APP_VERSION = "0.5.0-research";
const EXPORT_SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Export JSON
// ---------------------------------------------------------------------------

export interface ExportPayload {
  exportVersion: string;
  schemaVersion: number;
  intendedUse: "research-reference-only";
  exportedAt: string;
  config: TrialConfig;
  events: ActionEventExport[];
  scientificData?: ScientificDataset;
}

export interface ActionEventExport {
  actionId: string;
  vesselId: number;
  type: string;
  scheduledOffsetMs: number;
  scheduledOffsetFormatted: string;
  status: string;
  announcedAtMs: number | null;
  deadlineReachedAtMs: number | null;
  confirmedAtMs: number | null;
  deviationMs: number | null;
  deviationFormatted: string;
  wallClockConfirmed: string | null;
  annotation: string;
  preAlertSkipped: boolean;
}

/**
 * Construit la charge utile d'export à partir de la config et des enregistrements.
 */
export function buildExportPayload(
  config: TrialConfig,
  records: ActionEvent[],
  scientificData?: ScientificDataset,
): ExportPayload {
  return {
    exportVersion: APP_VERSION,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    intendedUse: "research-reference-only",
    exportedAt: new Date().toISOString(),
    config,
    events: records.map((r) => ({
      actionId: r.action.id,
      vesselId: r.action.vesselId,
      type: r.action.type,
      scheduledOffsetMs: r.action.scheduledOffsetMs,
      scheduledOffsetFormatted: formatOffsetMs(r.action.scheduledOffsetMs),
      status: r.status,
      announcedAtMs: r.announcedAtPerf,
      deadlineReachedAtMs: r.deadlineReachedAtPerf,
      confirmedAtMs: r.confirmedAtPerf,
      deviationMs: r.deviationMs,
      deviationFormatted: formatDeviation(r.deviationMs),
      wallClockConfirmed: r.wallClockConfirmed,
      annotation: r.annotation,
      preAlertSkipped: r.preAlertSkipped,
    })),
    ...(scientificData ? { scientificData } : {}),
  };
}

/**
 * Déclenche le téléchargement d'un fichier JSON.
 */
export function downloadJSON(config: TrialConfig, records: ActionEvent[], scientificData?: ScientificDataset): void {
  const payload = buildExportPayload(config, records, scientificData);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  triggerDownload(blob, `${config.id}_dissolution_${dateTag()}.json`);
}

// ---------------------------------------------------------------------------
// Export CSV
// ---------------------------------------------------------------------------

/**
 * Déclenche le téléchargement d'un fichier CSV.
 */
export function downloadCSV(config: TrialConfig, records: ActionEvent[]): void {
  const headers = [
    "Action ID",
    "Cuve",
    "Type",
    "Échéance théorique (ms)",
    "Échéance (MM:SS)",
    "Statut",
    "Déviation (ms)",
    "Déviation (s)",
    "Heure confirmation (ISO)",
    "Pré-alerte sautée",
    "Annotation",
  ];

  const rows = records.map((r) => [
    r.action.id,
    String(r.action.vesselId),
    actionLabel(r.action.type),
    String(r.action.scheduledOffsetMs),
    formatOffsetMs(r.action.scheduledOffsetMs),
    r.status,
    r.deviationMs !== null ? String(r.deviationMs) : "",
    r.deviationMs !== null ? (r.deviationMs / 1000).toFixed(3) : "",
    r.wallClockConfirmed ?? "",
    r.preAlertSkipped ? "oui" : "non",
    r.annotation,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map(csvEscape).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${config.id}_dissolution_${dateTag()}.csv`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function dateTag(): string {
  return new Date().toISOString().slice(0, 10);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
