/**
 * vitest.db.config.ts
 * Configuration Vitest pour les tests de la couche IndexedDB.
 *
 * Utilise happy-dom qui fournit une implémentation partielle d'IndexedDB
 * suffisante pour les tests unitaires de TrialStore.
 *
 * Exécution : npx vitest run --config vitest.db.config.ts
 * Ou via le script npm : npm run test:db
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/db/__tests__/**/*.test.ts"],
    environment: "happy-dom",
    // Timeout plus long pour les opérations IDB async
    testTimeout: 10_000,
  },
});
