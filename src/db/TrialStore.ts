/**
 * db/TrialStore.ts
 * Couche de persistance IndexedDB pour DissoloMaster Pro.
 *
 * Utilise la bibliothèque `idb` pour une API Promise propre.
 * Base de données : "dissolo-master-pro" version 1.
 * Object store : "trials" — clé primaire : storageId (string unique).
 *
 * LIMITES DOCUMENTÉES (section 8 du cahier des charges) :
 * - Le stockage IndexedDB est local, non chiffré et non inviolable.
 * - Le mode navigation privée peut bloquer ou vider la base.
 * - Aucune synchronisation réseau ou sauvegarde automatique hors du navigateur.
 * - Les données doivent être exportées (JSON/CSV) pour toute conservation durable.
 */

import { openDB, type IDBPDatabase } from "idb";
import type { TrialConfig } from "../types/timeline";
import type { ActionEvent } from "../timer/EventRecord";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DB_NAME = "dissolo-master-pro";
const DB_VERSION = 1;
const STORE_TRIALS = "trials";
const APP_VERSION = "0.3.0-M3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Enregistrement complet d'un essai tel que stocké dans IndexedDB.
 * Contient les données brutes (config + records) et les métadonnées
 * pour la reproductibilité (section 8).
 */
export interface StoredTrial {
  /** Clé primaire unique : "{config.id}_{startedAt}" */
  storageId: string;
  /** Configuration de l'essai (immuable, copiée à la sauvegarde). */
  config: TrialConfig;
  /** Enregistrements de toutes les actions avec horodatages. */
  records: ActionEvent[];
  /** Horodatage ISO 8601 du démarrage de l'essai. */
  startedAt: string;
  /** Horodatage ISO 8601 de la fin/sauvegarde de l'essai. */
  completedAt: string;
  /** Version de l'application pour la traçabilité et la reproductibilité. */
  appVersion: string;
}

/** Métadonnées légères pour la liste des essais (sans les records). */
export interface TrialSummary {
  storageId: string;
  trialId: string;
  startedAt: string;
  completedAt: string;
  totalActions: number;
  confirmedActions: number;
  missedActions: number;
  appVersion: string;
}

// ---------------------------------------------------------------------------
// Singleton base de données
// ---------------------------------------------------------------------------

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_TRIALS)) {
          const store = db.createObjectStore(STORE_TRIALS, {
            keyPath: "storageId",
          });
          // Index sur la date pour le tri chronologique
          store.createIndex("startedAt", "startedAt");
          // Index sur l'id d'essai pour filtrage futur
          store.createIndex("trialId", "config.id");
        }
      },
      blocked() {
        console.warn("[TrialStore] La base de données est bloquée par un autre onglet.");
      },
      blocking() {
        dbPromise = null; // Invalider le singleton pour permettre la migration
      },
      terminated() {
        dbPromise = null;
        console.error("[TrialStore] Connexion à la base de données interrompue.");
      },
    });
  }
  return dbPromise;
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Construit un identifiant unique de stockage.
 * Format : "{config.id}_{timestamp ISO compressé}"
 */
function buildStorageId(configId: string, startedAt: string): string {
  // Remplacer les caractères interdits dans les clés IDB par "-"
  const ts = startedAt.replace(/[:.]/g, "-");
  return `${configId}_${ts}`;
}

/**
 * Sauvegarde un essai terminé dans IndexedDB.
 * @returns Le storageId de l'enregistrement créé.
 * @throws TrialStoreError si la base est indisponible ou le quota dépassé.
 */
export async function saveTrial(
  config: TrialConfig,
  records: ActionEvent[],
  startedAt: string
): Promise<string> {
  const completedAt = new Date().toISOString();
  const storageId = buildStorageId(config.id, startedAt);

  const trial: StoredTrial = {
    storageId,
    config,
    records,
    startedAt,
    completedAt,
    appVersion: APP_VERSION,
  };

  try {
    const db = await getDb();
    await db.put(STORE_TRIALS, trial);
    return storageId;
  } catch (err) {
    throw new TrialStoreError("Échec de la sauvegarde de l'essai.", err);
  }
}

/**
 * Retourne la liste résumée de tous les essais, du plus récent au plus ancien.
 */
export async function listTrials(): Promise<TrialSummary[]> {
  try {
    const db = await getDb();
    const all = await db.getAll(STORE_TRIALS) as StoredTrial[];

    return all
      .map(toSummary)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } catch (err) {
    throw new TrialStoreError("Échec de la lecture de la liste des essais.", err);
  }
}

/**
 * Retourne un essai complet par son storageId.
 * @throws TrialStoreError si non trouvé.
 */
export async function getTrial(storageId: string): Promise<StoredTrial> {
  try {
    const db = await getDb();
    const trial = await db.get(STORE_TRIALS, storageId) as StoredTrial | undefined;
    if (!trial) {
      throw new TrialStoreError(`Essai introuvable : ${storageId}`);
    }
    return trial;
  } catch (err) {
    if (err instanceof TrialStoreError) throw err;
    throw new TrialStoreError("Échec de la lecture de l'essai.", err);
  }
}

/**
 * Supprime un essai par son storageId.
 * Si l'essai n'existe pas, l'opération est silencieusement ignorée (idempotent).
 */
export async function deleteTrial(storageId: string): Promise<void> {
  try {
    const db = await getDb();
    await db.delete(STORE_TRIALS, storageId);
  } catch (err) {
    throw new TrialStoreError("Échec de la suppression de l'essai.", err);
  }
}

/**
 * Compte le nombre total d'essais stockés.
 */
export async function countTrials(): Promise<number> {
  try {
    const db = await getDb();
    return await db.count(STORE_TRIALS);
  } catch {
    return 0;
  }
}

/**
 * Vérifie que IndexedDB est disponible dans l'environnement actuel.
 * Retourne false en mode navigation privée sur certains navigateurs.
 */
export async function isStorageAvailable(): Promise<boolean> {
  try {
    await getDb();
    return true;
  } catch {
    return false;
  }
}

/**
 * Importe un essai depuis un objet JSON brut (format ExportPayload de utils/export.ts).
 * Valide la structure minimale avant de sauvegarder.
 * @throws TrialStoreError si le format est invalide.
 */
export async function importTrialFromJSON(raw: unknown): Promise<string> {
  if (!isValidExportPayload(raw)) {
    throw new TrialStoreError(
      "Format JSON invalide — le fichier ne correspond pas à un export DissoloMaster Pro."
    );
  }

  const payload = raw as { config: TrialConfig; events: ActionEvent[]; exportedAt: string };

  // Construire un StoredTrial depuis le payload d'export
  // Les records ont une structure légèrement différente (events → records)
  // On reconstruit des ActionEvent minimaux depuis les events exportés
  const records = rebuildRecordsFromExport(payload.events);

  return saveTrial(payload.config, records, payload.exportedAt);
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function toSummary(t: StoredTrial): TrialSummary {
  const confirmed = t.records.filter((r) => r.status === "confirmed").length;
  const missed = t.records.filter((r) => r.status === "missed").length;
  return {
    storageId: t.storageId,
    trialId: t.config.id,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    totalActions: t.records.length,
    confirmedActions: confirmed,
    missedActions: missed,
    appVersion: t.appVersion,
  };
}

/** Validation structurelle minimale d'un payload d'export JSON. */
function isValidExportPayload(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const obj = raw as Record<string, unknown>;
  if (typeof obj["exportVersion"] !== "string") return false;
  if (!obj["config"] || typeof obj["config"] !== "object") return false;
  if (!Array.isArray(obj["events"])) return false;
  const config = obj["config"] as Record<string, unknown>;
  if (typeof config["id"] !== "string") return false;
  if (typeof config["vesselCount"] !== "number") return false;
  return true;
}

/**
 * Reconstruit des ActionEvent partiels depuis les événements exportés.
 * Les champs de performance (performance.now()) ne peuvent pas être restaurés —
 * ils sont laissés à null. Seul le statut et la déviation sont conservés.
 */
function rebuildRecordsFromExport(events: unknown[]): ActionEvent[] {
  return events.map((e) => {
    const ev = e as Record<string, unknown>;
    return {
      action: {
        id: String(ev["actionId"] ?? ""),
        vesselId: Number(ev["vesselId"] ?? 0),
        type: (ev["type"] === "introduction" ? "introduction" : "prelevement") as "introduction" | "prelevement",
        scheduledOffsetMs: Number(ev["scheduledOffsetMs"] ?? 0),
        status: "pending" as const,
      },
      announcedAtPerf: null,
      deadlineReachedAtPerf: null,
      confirmedAtPerf: null,
      deviationMs: typeof ev["deviationMs"] === "number" ? ev["deviationMs"] : null,
      wallClockConfirmed: typeof ev["wallClockConfirmed"] === "string" ? ev["wallClockConfirmed"] : null,
      status: (ev["status"] as "pending" | "announced" | "confirmed" | "missed" | "cancelled") ?? "pending",
      annotation: typeof ev["annotation"] === "string" ? ev["annotation"] : "",
      preAlertSkipped: Boolean(ev["preAlertSkipped"]),
    } satisfies ActionEvent;
  });
}

// ---------------------------------------------------------------------------
// Classe d'erreur
// ---------------------------------------------------------------------------

export class TrialStoreError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "TrialStoreError";
    this.cause = cause;
  }
}
