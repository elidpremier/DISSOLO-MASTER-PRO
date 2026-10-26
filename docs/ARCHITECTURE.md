# Architecture technique

## 1. Objet

Ce document décrit l'architecture de DissoloMaster Pro, ses frontières et les règles à respecter lors des évolutions.

## 2. Vue d'ensemble

L'application est une PWA monopage compilée par Vite.

```text
Interface HTML/CSS
        |
        v
Machine d'états App
        |
  +-----+-----------+----------------+
  |                 |                |
TimerEngine     Moteur scientifique  TrialStore
  |                 |                |
AudioManager    Types science     IndexedDB
        \         |                /
             Exports / rapports
```

## 3. Modules

| Répertoire | Responsabilité |
|---|---|
| `src/main.ts` | phases de l'application et navigation |
| `src/ui/` | vues et interactions DOM |
| `src/timer/` | événements d'action, minuteur et interruptions |
| `src/engine/` | chronologie, conflits et calculs purs |
| `src/types/` | contrats TypeScript |
| `src/db/` | persistance IndexedDB et restauration |
| `src/audio/` | sons synthétisés via Web Audio API |
| `src/utils/` | formatage, exports et rapports |
| `public/` | manifeste et icônes PWA |

## 4. Flux d'un essai

1. `SetupView` valide la configuration.
2. `generateTimeline` construit les actions.
3. `detectConflicts` produit les avertissements.
4. `RunningView` démarre `TimerEngine`.
5. Chaque confirmation et interruption déclenche un checkpoint.
6. `ResultsView` affiche le journal.
7. `TrialStore` finalise le même enregistrement.
8. `ScientificDataView` ajoute des révisions scientifiques append-only.

## 5. Règles d'architecture

- Le moteur temporel et le moteur scientifique restent indépendants du DOM.
- Les données brutes ne sont jamais remplacées par une valeur dérivée.
- Une action planifiée ne doit pas être supprimée ou déplacée automatiquement.
- Toute conversion doit déclarer son unité et ses hypothèses.
- Toute erreur de stockage doit être visible ; aucun échec ne doit être transformé en succès.
- Les écritures de restauration doivent être atomiques.
- Les horodatages `performance.now()` sont utiles pendant une session mais ne sont pas restaurables comme horloge monotone après fermeture.

## 6. Versionnement

Les versions à distinguer sont :

- version de l'application : `package.json` ;
- version du schéma IndexedDB : `STORAGE_SCHEMA_VERSION` ;
- version du format d'archive : `schemaVersion` ;
- version de la fiche méthode ;
- version des règles scientifiques f1/f2.

Une évolution de schéma doit prévoir une migration ou une compatibilité explicite.

