import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/DISSOLO-MASTER-PRO/",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // Le SW est généré uniquement au build (pas en dev — comportement normal Workbox)
      devOptions: {
        enabled: false,
      },
      includeAssets: ["icons/icon.svg"],
      manifest: false, // On utilise notre propre public/manifest.webmanifest
      workbox: {
        // Stratégie CacheFirst pour tous les assets statiques
        globPatterns: ["**/*.{js,css,html,svg,webmanifest}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Injection du <link rel="manifest"> dans index.html
      injectRegister: "auto",
    }),
  ],
  test: {
    // Tests M1 : environnement Node (sans DOM, sans IndexedDB)
    include: ["src/**/__tests__/**/*.test.ts"],
    exclude: ["src/db/__tests__/**"],
    environment: "node",
  },
});
