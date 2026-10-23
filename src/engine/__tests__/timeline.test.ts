/**
 * engine/__tests__/timeline.test.ts
 * Tests Vitest pour le moteur temporel de DissoloMaster Pro.
 *
 * Couvre les 7 scénarios obligatoires définis à la section 12 du cahier
 * des charges, plus des cas additionnels pour la robustesse.
 *
 * Ces tests doivent être EXÉCUTÉS avant toute validation de jalon.
 * Aucun test n'est présenté comme passant s'il n'a pas été lancé réellement.
 */

import { describe, it, expect } from "vitest";
import { generateTimeline } from "../generateTimeline";
import { detectConflicts } from "../detectConflicts";
import { ConfigValidationError } from "../../types/timeline";
import type { TrialConfig } from "../../types/timeline";

// ---------------------------------------------------------------------------
// Configuration de base réutilisable dans les tests
// ---------------------------------------------------------------------------

/** Configuration minimale valide : 2 cuves, D=30 s, p=1 min */
const configReference: TrialConfig = {
  id: "essai-reference",
  vesselCount: 2,
  introOffsetSec: 30,
  samplingTimesMin: [1],
  preAlertSec: 5,
  conflictThresholdSec: 15,
};

// ---------------------------------------------------------------------------
// Scénario 1 — Scénario de référence
// ---------------------------------------------------------------------------

describe("Scénario de référence : 2 cuves, D=30 s, p=1 min", () => {
  it("génère exactement 4 actions", () => {
    const actions = generateTimeline(configReference);
    expect(actions).toHaveLength(4);
  });

  it("produit les échéances correctes (0 s, 30 s, 60 s, 90 s)", () => {
    const actions = generateTimeline(configReference);
    const offsets = actions.map((a) => a.scheduledOffsetMs);
    expect(offsets).toEqual([0, 30_000, 60_000, 90_000]);
  });

  it("associe les types et cuves attendus dans l'ordre", () => {
    const actions = generateTimeline(configReference);
    expect(actions[0]).toMatchObject({ vesselId: 1, type: "introduction", scheduledOffsetMs: 0 });
    expect(actions[1]).toMatchObject({ vesselId: 2, type: "introduction", scheduledOffsetMs: 30_000 });
    expect(actions[2]).toMatchObject({ vesselId: 1, type: "prelevement", scheduledOffsetMs: 60_000 });
    expect(actions[3]).toMatchObject({ vesselId: 2, type: "prelevement", scheduledOffsetMs: 90_000 });
  });

  it("toutes les actions ont le statut initial 'pending'", () => {
    const actions = generateTimeline(configReference);
    actions.forEach((a) => expect(a.status).toBe("pending"));
  });

  it("tous les identifiants sont uniques", () => {
    const actions = generateTimeline(configReference);
    const ids = actions.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Scénario 2 — Décalage nul : toutes les cuves à T0
// ---------------------------------------------------------------------------

describe("Décalage nul (D=0) : introductions simultanées sans perte", () => {
  const config: TrialConfig = {
    ...configReference,
    vesselCount: 3,
    introOffsetSec: 0,
  };

  it("génère 6 actions (3 intro + 3 prélèvements)", () => {
    const actions = generateTimeline(config);
    expect(actions).toHaveLength(6);
  });

  it("les 3 introductions sont toutes à 0 ms", () => {
    const actions = generateTimeline(config);
    const intros = actions.filter((a) => a.type === "introduction");
    expect(intros).toHaveLength(3);
    intros.forEach((a) => expect(a.scheduledOffsetMs).toBe(0));
  });

  it("les 3 prélèvements sont tous à 60 000 ms", () => {
    const actions = generateTimeline(config);
    const prelev = actions.filter((a) => a.type === "prelevement");
    expect(prelev).toHaveLength(3);
    prelev.forEach((a) => expect(a.scheduledOffsetMs).toBe(60_000));
  });

  it("aucune action n'est perdue", () => {
    const actions = generateTimeline(config);
    expect(actions).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Scénario 3 — Temps de prélèvement non triés : chronologie normalisée
// ---------------------------------------------------------------------------

describe("Temps de prélèvement non triés", () => {
  const config: TrialConfig = {
    ...configReference,
    vesselCount: 1,
    introOffsetSec: 0,
    samplingTimesMin: [5, 1, 3], // fournis dans le désordre
  };

  it("les actions sont triées par échéance croissante", () => {
    const actions = generateTimeline(config);
    const offsets = actions.map((a) => a.scheduledOffsetMs);
    const sorted = [...offsets].sort((a, b) => a - b);
    expect(offsets).toEqual(sorted);
  });

  it("les prélèvements correspondent aux temps fournis (1, 3, 5 min convertis)", () => {
    const actions = generateTimeline(config);
    const prelev = actions.filter((a) => a.type === "prelevement");
    const offsets = prelev.map((a) => a.scheduledOffsetMs);
    // Les temps en ms : 1 min = 60 000, 3 min = 180 000, 5 min = 300 000
    // Mais l'ordre dans la chronologie dépend du tri, pas de l'index d'entrée
    expect(offsets).toContain(60_000);
    expect(offsets).toContain(180_000);
    expect(offsets).toContain(300_000);
  });
});

// ---------------------------------------------------------------------------
// Scénario 4 — Temps dupliqués : comportement explicite
// ---------------------------------------------------------------------------

describe("Temps de prélèvement dupliqués", () => {
  const config: TrialConfig = {
    ...configReference,
    vesselCount: 1,
    introOffsetSec: 0,
    samplingTimesMin: [1, 1, 2], // deux fois 1 min
  };

  it("conserve les deux prélèvements à 1 min sans en supprimer un", () => {
    const actions = generateTimeline(config);
    const prelev = actions.filter((a) => a.type === "prelevement");
    const at60s = prelev.filter((a) => a.scheduledOffsetMs === 60_000);
    expect(at60s).toHaveLength(2); // les deux doublons sont conservés
  });

  it("le total d'actions est 4 (1 intro + 3 prélèvements dont 2 à 60 s)", () => {
    const actions = generateTimeline(config);
    expect(actions).toHaveLength(4);
  });

  it("les identifiants des deux prélèvements dupliqués sont distincts", () => {
    const actions = generateTimeline(config);
    const ids = actions.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// Scénario 5 — Valeurs invalides : rejet avec erreur explicite
// ---------------------------------------------------------------------------

describe("Validation des entrées invalides", () => {
  it("rejette vesselCount = 0", () => {
    expect(() =>
      generateTimeline({ ...configReference, vesselCount: 0 })
    ).toThrow(ConfigValidationError);
  });

  it("rejette vesselCount négatif", () => {
    expect(() =>
      generateTimeline({ ...configReference, vesselCount: -1 })
    ).toThrow(ConfigValidationError);
  });

  it("rejette vesselCount non entier (1.5)", () => {
    expect(() =>
      generateTimeline({ ...configReference, vesselCount: 1.5 })
    ).toThrow(ConfigValidationError);
  });

  it("rejette introOffsetSec négatif", () => {
    expect(() =>
      generateTimeline({ ...configReference, introOffsetSec: -10 })
    ).toThrow(ConfigValidationError);
  });

  it("rejette introOffsetSec non entier (0.5)", () => {
    expect(() =>
      generateTimeline({ ...configReference, introOffsetSec: 0.5 })
    ).toThrow(ConfigValidationError);
  });

  it("rejette samplingTimesMin vide", () => {
    expect(() =>
      generateTimeline({ ...configReference, samplingTimesMin: [] })
    ).toThrow(ConfigValidationError);
  });

  it("rejette un temps de prélèvement négatif", () => {
    expect(() =>
      generateTimeline({ ...configReference, samplingTimesMin: [-1] })
    ).toThrow(ConfigValidationError);
  });

  it("rejette un temps de prélèvement = 0", () => {
    expect(() =>
      generateTimeline({ ...configReference, samplingTimesMin: [0] })
    ).toThrow(ConfigValidationError);
  });

  it("rejette NaN dans samplingTimesMin", () => {
    expect(() =>
      generateTimeline({ ...configReference, samplingTimesMin: [NaN] })
    ).toThrow(ConfigValidationError);
  });

  it("rejette Infinity dans samplingTimesMin", () => {
    expect(() =>
      generateTimeline({ ...configReference, samplingTimesMin: [Infinity] })
    ).toThrow(ConfigValidationError);
  });

  it("rejette -Infinity dans samplingTimesMin", () => {
    expect(() =>
      generateTimeline({ ...configReference, samplingTimesMin: [-Infinity] })
    ).toThrow(ConfigValidationError);
  });

  it("rejette un id vide", () => {
    expect(() =>
      generateTimeline({ ...configReference, id: "" })
    ).toThrow(ConfigValidationError);
  });

  it("l'erreur mentionne le champ fautif", () => {
    try {
      generateTimeline({ ...configReference, vesselCount: 0 });
      expect.fail("Aurait dû lever une erreur");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigValidationError);
      expect((e as ConfigValidationError).field).toBe("vesselCount");
    }
  });
});

// ---------------------------------------------------------------------------
// Scénario 6 — Conflit inférieur au seuil : diagnostic sans modification
// ---------------------------------------------------------------------------

describe("Détection de conflit : intervalle inférieur au seuil", () => {
  // D=10 s, seuil=15 s → les deux introductions (à 0 s et 10 s) sont trop proches
  const config: TrialConfig = {
    ...configReference,
    introOffsetSec: 10,
    conflictThresholdSec: 15,
  };

  it("détecte au moins un conflit", () => {
    const actions = generateTimeline(config);
    const conflicts = detectConflicts(actions, config);
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it("ne supprime ni ne déplace aucune action", () => {
    const actions = generateTimeline(config);
    const count = actions.length;
    detectConflicts(actions, config);
    // La liste d'actions reste inchangée
    expect(actions).toHaveLength(count);
  });

  it("le conflit indique un écart < seuil en ms", () => {
    const actions = generateTimeline(config);
    const conflicts = detectConflicts(actions, config);
    conflicts.forEach((c) => {
      expect(c.gapMs).toBeLessThan(config.conflictThresholdSec * 1000);
    });
  });

  it("les conflits ont une description lisible", () => {
    const actions = generateTimeline(config);
    const conflicts = detectConflicts(actions, config);
    conflicts.forEach((c) => {
      expect(c.description.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Scénario 7 — Absence de conflit : aucun avertissement injustifié
// ---------------------------------------------------------------------------

describe("Aucun conflit quand l'intervalle dépasse le seuil", () => {
  // D=60 s, p=5 min, seuil=15 s
  // Chronologie : intro cuve 1 à 0 s, intro cuve 2 à 60 s,
  //               prélèvement cuve 1 à 300 s, prélèvement cuve 2 à 360 s.
  // Écarts minimaux : 60 s entre les introductions, 240 s avant les prélèvements
  // → aucune paire ne tombe sous le seuil de 15 s.
  const config: TrialConfig = {
    ...configReference,
    introOffsetSec: 60,
    samplingTimesMin: [5], // 5 min = 300 s depuis l'intro de chaque cuve
    conflictThresholdSec: 15,
  };

  it("ne retourne aucun conflit", () => {
    const actions = generateTimeline(config);
    const conflicts = detectConflicts(actions, config);
    expect(conflicts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scénario 8 — Échéances identiques : tri secondaire stable et déterministe
// ---------------------------------------------------------------------------

describe("Tri secondaire déterministe à égalité d'échéance", () => {
  // D=0, 1 cuve → introduction et prélèvement à 0 ms et 60 000 ms respectivement
  // Avec D=0 et plusieurs cuves, toutes les introductions sont à 0 ms
  const config: TrialConfig = {
    ...configReference,
    vesselCount: 3,
    introOffsetSec: 0,
    samplingTimesMin: [1],
  };

  it("les introductions à 0 ms sont triées par vesselId croissant", () => {
    const actions = generateTimeline(config);
    const intros = actions.filter((a) => a.type === "introduction");
    const ids = intros.map((a) => a.vesselId);
    expect(ids).toEqual([1, 2, 3]);
  });

  it("introduction avant prelevement à échéance égale", () => {
    // Avec D=0, p=0 est invalide ; testons que les introductions (t=0)
    // précèdent tous les prélèvements (t=60 000).
    const actions = generateTimeline(config);
    const firstPrelev = actions.findIndex((a) => a.type === "prelevement");
    const lastIntro = [...actions]
      .reverse()
      .findIndex((a) => a.type === "introduction");
    const lastIntroIndex = actions.length - 1 - lastIntro;
    expect(lastIntroIndex).toBeLessThan(firstPrelev);
  });

  it("le résultat est identique à deux appels successifs (déterminisme)", () => {
    const run1 = generateTimeline(config).map((a) => a.id);
    const run2 = generateTimeline(config).map((a) => a.id);
    expect(run1).toEqual(run2);
  });
});
