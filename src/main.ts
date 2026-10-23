// Point d'entrée minimal — DissoloMaster Pro
// L'interface utilisateur sera développée au jalon M2.
// Ce fichier importe le moteur temporel pour valider son intégration.

import { generateTimeline } from "./engine/generateTimeline";
import { detectConflicts } from "./engine/detectConflicts";

// Scénario de référence (section 12 du cahier des charges)
const config = {
  id: "essai-reference",
  vesselCount: 2,
  introOffsetSec: 30,
  samplingTimesMin: [1],
  preAlertSec: 5,
  conflictThresholdSec: 15,
};

const actions = generateTimeline(config);
const conflicts = detectConflicts(actions, config);

console.log("=== Chronologie de référence ===");
actions.forEach((a) => {
  console.log(
    `  ${(a.scheduledOffsetMs / 1000).toFixed(0).padStart(4)} s` +
      ` | Cuve ${a.vesselId} | ${a.type}`
  );
});

console.log(`\n=== Conflits détectés : ${conflicts.length} ===`);
conflicts.forEach((c) => {
  console.log(
    `  ${c.actionIdA} ↔ ${c.actionIdB} : écart ${c.gapMs} ms [${c.severity}]`
  );
});
