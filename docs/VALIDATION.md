# Validation et stratégie de tests

## 1. Positionnement

La suite automatisée vérifie le comportement logiciel couvert par les scénarios. Elle ne constitue pas à elle seule une validation réglementaire, une qualification d'appareil ou une validation de méthode analytique.

## 2. Commandes

```bash
npm test
npm run test:db
npm run test:all
npm run build
```

## 3. Couverture fonctionnelle actuelle

### Moteur temporel

- génération des actions ;
- ordre déterministe ;
- échéances simultanées ;
- conflits ;
- statuts ;
- écarts temporels.

### Moteur scientifique

- conversion d'unités ;
- quantification E1% ;
- facteur de dilution ;
- teneur par cuve ;
- correction avec ou sans remplacement ;
- volumes invalides ;
- statistiques ;
- profils f1/f2 ;
- contrôles d'éligibilité.

### Persistance

- sauvegarde et lecture ;
- UUID et absence d'écrasement ;
- checkpoints ;
- finalisation ;
- révisions scientifiques ;
- fiche méthode ;
- imports historiques ;
- intégrité d'archive ;
- restauration des interruptions.

## 4. Validation manuelle recommandée

Avant une utilisation terrain, vérifier sur les appareils réellement ciblés :

- clavier et focus ;
- zoom 200 % ;
- lecteur d'écran ;
- contraste ;
- téléphone et tablette ;
- verrouillage de l'écran ;
- changement d'onglet ;
- perte réseau ;
- quota et mode privé ;
- installation et mise à jour PWA ;
- export puis restauration.

## 5. Critères d'acceptation d'une version

Une version est acceptable pour la recherche uniquement si :

- `npm run test:all` passe ;
- `npm run build` passe ;
- les changements de schéma sont documentés ;
- un essai court est exécuté manuellement ;
- une archive est exportée puis réimportée ;
- les limites sont visibles dans l'interface et la documentation ;
- aucune fonction nouvelle ne suggère une conformité réglementaire non démontrée.

## 6. Traçabilité de version

Les rapports et archives doivent conserver la version de l'application, la version du schéma et la version de la fiche méthode lorsque ces données sont disponibles.

