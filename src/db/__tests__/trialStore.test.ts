/**
 * db/__tests__/trialStore.test.ts
 * Tests de la couche de persistance TrialStore.
 *
 * Stratégie : mock complet d'IndexedDB via `fake-indexeddb`
 * (implémentation en mémoire, sans DOM, compatible Node/Vitest).
 * Exécution : npm run test:db
 */

import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  saveTrial,
  listTrials,
  getTrial,
  deleteTrial,
  countTrials,
  importTrialFromJSON,
  saveScientificData,
  TrialStoreError,
} from "../TrialStore";
import type { TrialConfig } from "../../types/timeline";
import type { ActionEvent } from "../../timer/EventRecord";
import type { DissolutionCorrectionConfig, RawMeasurement } from "../../types/science";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const configRef: TrialConfig = {
  id: "essai-test-001",
  vesselCount: 2,
  introOffsetSec: 30,
  samplingTimesMin: [5, 10],
  preAlertSec: 5,
  conflictThresholdSec: 15,
  missedThresholdSec: 120,
};

function makeRecord(id: string, vesselId: number): ActionEvent {
  return {
    action: {
      id,
      vesselId,
      type: "prelevement",
      scheduledOffsetMs: 300_000,
      status: "pending",
    },
    announcedAtPerf: null,
    deadlineReachedAtPerf: null,
    confirmedAtPerf: 310_000,
    deviationMs: 10_000,
    wallClockConfirmed: "2026-10-23T10:05:10.000Z",
    status: "confirmed",
    annotation: "RAS",
    preAlertSkipped: false,
  };
}

const recordsRef: ActionEvent[] = [
  makeRecord("prelevement-v1-0", 1),
  makeRecord("prelevement-v2-0", 2),
];

const startedAt = "2026-10-23T10:00:00.000Z";
const correctionRef: DissolutionCorrectionConfig = {
  mediumVolumeMl: 900, sampleVolumeMl: 10, replacementMode: "full", referenceAmountMg: 100,
};
const measurementsRef: RawMeasurement[] = [{
  id: "m-1", vesselId: 1, samplingTimeMin: 5, value: 12.5, unit: "mg/L",
  analyticalMethod: "uv-vis", dilutionFactor: 2,
}];

// ---------------------------------------------------------------------------
// Reset DB entre les suites (réinitialise le singleton)
// ---------------------------------------------------------------------------
// Chaque beforeEach vide le store en supprimant tous les essais existants.

async function clearStore(): Promise<void> {
  const list = await listTrials();
  for (const s of list) await deleteTrial(s.storageId);
}

// ---------------------------------------------------------------------------
// Scénario 1 — Sauvegarde et récupération
// ---------------------------------------------------------------------------

describe("Sauvegarde et récupération d'un essai", () => {
  beforeEach(clearStore);

  it("saveTrial retourne un storageId non vide", async () => {
    const id = await saveTrial(configRef, recordsRef, startedAt);
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("getTrial retourne l'essai sauvegardé avec la config intacte", async () => {
    const storageId = await saveTrial(configRef, recordsRef, startedAt);
    const trial = await getTrial(storageId);
    expect(trial.config.id).toBe(configRef.id);
    expect(trial.config.vesselCount).toBe(configRef.vesselCount);
    expect(trial.records).toHaveLength(recordsRef.length);
  });

  it("getTrial préserve les déviations et annotations", async () => {
    const storageId = await saveTrial(configRef, recordsRef, startedAt);
    const trial = await getTrial(storageId);
    expect(trial.records[0].deviationMs).toBe(10_000);
    expect(trial.records[0].annotation).toBe("RAS");
    expect(trial.records[0].status).toBe("confirmed");
  });

  it("getTrial stocke l'appVersion", async () => {
    const storageId = await saveTrial(configRef, recordsRef, startedAt);
    const trial = await getTrial(storageId);
    expect(trial.appVersion).toMatch(/M4/);
  });

  it("getTrial lève TrialStoreError si le storageId est inconnu", async () => {
    await expect(getTrial("id-inexistant")).rejects.toBeInstanceOf(TrialStoreError);
  });
});

// ---------------------------------------------------------------------------
// Scénario 2 — Listing
// ---------------------------------------------------------------------------

describe("Listing des essais", () => {
  beforeEach(clearStore);

  it("listTrials retourne une liste vide si aucun essai", async () => {
    const list = await listTrials();
    expect(list).toHaveLength(0);
  });

  it("listTrials reflète les essais sauvegardés", async () => {
    await saveTrial(configRef, recordsRef, startedAt);
    const list = await listTrials();
    expect(list).toHaveLength(1);
    expect(list[0].trialId).toBe(configRef.id);
  });

  it("listTrials expose le nombre d'actions confirmées", async () => {
    await saveTrial(configRef, recordsRef, startedAt);
    const list = await listTrials();
    expect(list[0].confirmedActions).toBe(2);
    expect(list[0].missedActions).toBe(0);
  });

  it("listTrials retourne les essais du plus récent au plus ancien", async () => {
    const start1 = "2026-10-20T10:00:00.000Z";
    const start2 = "2026-10-22T10:00:00.000Z";
    const cfg2 = { ...configRef, id: "essai-test-002" };
    await saveTrial(configRef, recordsRef, start1);
    await saveTrial(cfg2, recordsRef, start2);
    const list = await listTrials();
    expect(list[0].startedAt >= list[1].startedAt).toBe(true);
  });

  it("countTrials retourne le bon nombre d'essais", async () => {
    expect(await countTrials()).toBe(0);
    await saveTrial(configRef, recordsRef, startedAt);
    expect(await countTrials()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Scénario 3 — Suppression
// ---------------------------------------------------------------------------

describe("Suppression d'un essai", () => {
  beforeEach(clearStore);

  it("deleteTrial supprime l'essai de la base", async () => {
    const storageId = await saveTrial(configRef, recordsRef, startedAt);
    await deleteTrial(storageId);
    const list = await listTrials();
    expect(list.find((s) => s.storageId === storageId)).toBeUndefined();
  });

  it("deleteTrial est idempotent sur un id inexistant", async () => {
    await expect(deleteTrial("id-inexistant")).resolves.toBeUndefined();
  });
});

describe("Données scientifiques M4", () => {
  beforeEach(clearStore);

  it("conserve les mesures brutes séparément des événements", async () => {
    const storageId = await saveTrial(configRef, recordsRef, startedAt);
    await saveScientificData(storageId, { correctionConfig: correctionRef, methodConfig: { analyticalMethod: "uv-vis", quantificationMethod: "e1-percent", concentrationUnit: "mg/L", e1Percent: 250, pathLengthCm: 1 }, measurements: measurementsRef });
    const trial = await getTrial(storageId);
    expect(trial.records).toEqual(recordsRef);
    expect(trial.scientificData?.measurements).toEqual(measurementsRef);
    expect(trial.scientificData?.methodConfig?.e1Percent).toBe(250);
    expect(trial.scientificData?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("rejette une mesure brute invalide", async () => {
    const storageId = await saveTrial(configRef, recordsRef, startedAt);
    await expect(saveScientificData(storageId, {
      correctionConfig: correctionRef,
      measurements: [{ ...measurementsRef[0], dilutionFactor: 0 }],
    })).rejects.toBeInstanceOf(TrialStoreError);
  });

  it("conserve les révisions scientifiques précédentes", async () => {
    const storageId = await saveTrial(configRef, recordsRef, startedAt);
    await saveScientificData(storageId, { correctionConfig: correctionRef, measurements: measurementsRef });
    await saveScientificData(storageId, { correctionConfig: correctionRef, measurements: [{ ...measurementsRef[0], value: 13.5 }] });
    const trial = await getTrial(storageId);
    expect(trial.scientificData?.revision).toBe(2);
    expect(trial.scientificRevisions).toHaveLength(2);
    expect(trial.scientificRevisions?.[0]?.measurements[0]?.value).toBe(12.5);
    expect(trial.scientificRevisions?.[1]?.measurements[0]?.value).toBe(13.5);
  });
});

// ---------------------------------------------------------------------------
// Scénario 4 — Import JSON
// ---------------------------------------------------------------------------

describe("Import d'un essai depuis un JSON exporté", () => {
  beforeEach(clearStore);

  const validPayload = {
    exportVersion: "0.2.0-M2",
    schemaVersion: 2,
    intendedUse: "research-reference-only",
    exportedAt: "2026-10-21T08:00:00.000Z",
    config: configRef,
    events: [
      {
        actionId: "prelevement-v1-0",
        vesselId: 1,
        type: "prelevement",
        scheduledOffsetMs: 300_000,
        scheduledOffsetFormatted: "05:00",
        status: "confirmed",
        announcedAtMs: null,
        deadlineReachedAtMs: null,
        confirmedAtMs: 310_000,
        deviationMs: 10_000,
        deviationFormatted: "+10.0 s",
        wallClockConfirmed: "2026-10-21T08:05:10.000Z",
        annotation: "test",
        preAlertSkipped: false,
      },
    ],
  };

  it("importe un payload valide et le retrouve dans la liste", async () => {
    const storageId = await importTrialFromJSON(validPayload);
    expect(storageId).toBeTruthy();
    const list = await listTrials();
    expect(list.some((s) => s.storageId === storageId)).toBe(true);
  });

  it("lève TrialStoreError si le payload est invalide", async () => {
    await expect(importTrialFromJSON({ foo: "bar" })).rejects.toBeInstanceOf(TrialStoreError);
    await expect(importTrialFromJSON(null)).rejects.toBeInstanceOf(TrialStoreError);
    await expect(importTrialFromJSON("texte brut")).rejects.toBeInstanceOf(TrialStoreError);
  });

  it("lève TrialStoreError si config.id est manquant", async () => {
    const bad = { ...validPayload, config: { ...configRef, id: undefined as unknown as string } };
    await expect(importTrialFromJSON(bad)).rejects.toBeInstanceOf(TrialStoreError);
  });

  it("l'essai importé préserve la déviation et le statut", async () => {
    const storageId = await importTrialFromJSON(validPayload);
    const trial = await getTrial(storageId);
    expect(trial.records[0].deviationMs).toBe(10_000);
    expect(trial.records[0].status).toBe("confirmed");
  });
});
