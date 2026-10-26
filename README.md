# DissoloMaster Pro

PWA hors ligne pour préparer, chronométrer et documenter des essais de dissolution in vitro dans un contexte de recherche universitaire et de développement de formulation.

> **Positionnement** — DissoloMaster Pro est un outil de recherche et de référence. Il ne revendique pas de conformité GxP, 21 CFR Part 11 ou de validation réglementaire. Il ne remplace ni une monographie, ni un SOP, ni un LIMS, ni un cahier de laboratoire approuvé.

## Fonctionnalités

- configuration d'une chronologie d'introductions et de prélèvements ;
- détection des actions rapprochées avant le lancement ;
- alertes visuelles et sonores ;
- confirmation des actions et enregistrement des écarts ;
- checkpoints IndexedDB pendant un essai ;
- journalisation des interruptions de visibilité et de navigation ;
- saisie de mesures UV-Vis ou CLHP ;
- facteur de dilution multiplicatif `>= 1` ;
- correction exploratoire des prélèvements successifs ;
- statistiques descriptives par formulation et par temps ;
- contrôles conditionnels f1/f2 avec états `pass`, `fail` et `not-evaluated` ;
- fiche méthode versionnée ;
- historique local des essais ;
- export JSON/CSV et archive JSON complète avec empreinte SHA-256 ;
- fonctionnement PWA hors ligne après chargement initial.

## Prérequis

- Node.js compatible avec Vite 6 ;
- npm ;
- navigateur récent avec IndexedDB, Web Audio API et Service Worker.

## Installation et développement

```bash
npm ci
npm run dev
```

Le serveur de développement est généralement disponible à `http://localhost:5173`.

## Commandes

| Commande | Usage |
|---|---|
| `npm run dev` | serveur de développement Vite |
| `npm run build` | vérification TypeScript et build PWA |
| `npm run preview` | prévisualisation du build |
| `npm test` | tests du moteur |
| `npm run test:db` | tests IndexedDB |
| `npm run test:all` | ensemble des tests |

## Documentation

- [Guide utilisateur](./GUIDE_UTILISATEUR.md)
- [Architecture technique](./docs/ARCHITECTURE.md)
- [Modèle scientifique et hypothèses](./docs/MODELE_SCIENTIFIQUE.md)
- [Données, exports et restauration](./docs/DONNEES_ET_ARCHIVES.md)
- [Déploiement et PWA](./docs/DEPLOIEMENT.md)
- [Validation et stratégie de tests](./docs/VALIDATION.md)
- [Cahier des charges](./DissoloMaster_Pro_Cahier_des_charges.md)
- [Diagnostic approfondi](./DissoloMaster-Pro-recherche-approfondie.md)

## Limites importantes

IndexedDB est un espace de travail local. Le navigateur peut supprimer ou limiter ce stockage. Une interruption de page peut retarder une alerte ; elle ne doit pas être interprétée comme une garantie de temps réel. Les données doivent être exportées vers le stockage prévu par le laboratoire.

Les calculs scientifiques sont exploratoires. Les hypothèses, unités, paramètres de méthode et contrôles doivent être vérifiés par un pharmacien, un analyste ou le responsable scientifique du protocole.

## Version

Version applicative actuelle : `0.5.0-research`.

