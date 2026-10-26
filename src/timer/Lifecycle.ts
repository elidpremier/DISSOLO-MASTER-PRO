/** Interruption du document pendant un essai (veille, onglet masqué ou navigation). */
export interface TrialInterruption {
  id: string;
  reason: "hidden" | "pagehide";
  startedAt: string;
  endedAt: string | null;
}
