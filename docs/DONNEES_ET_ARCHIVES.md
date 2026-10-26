# Données, stockage et archives

## 1. Stockage local

Les essais sont conservés dans IndexedDB sous la base `dissolo-master-pro`.

IndexedDB est un espace de travail local :

- il n'est pas chiffré par l'application ;
- il n'est pas une archive inviolable ;
- il peut être supprimé ou limité par le navigateur ;
- le mode privé peut modifier son comportement ;
- aucune synchronisation cloud n'est fournie.

## 2. États d'un essai

| État | Signification |
|---|---|
| `in-progress` | essai ou checkpoint non finalisé |
| `completed` | essai finalisé dans IndexedDB |

Chaque checkpoint conserve les événements connus au moment de l'écriture.

## 3. Interruptions

L'application journalise les événements de visibilité et de cycle de page :

- onglet masqué ;
- `pagehide` ;
- retour de visibilité ;
- `pageshow`.

Une interruption peut expliquer un retard, mais ne constitue pas une mesure de temps réel garantie.

## 4. Révisions scientifiques

Chaque sauvegarde scientifique ajoute une révision. Les révisions précédentes sont conservées dans `scientificRevisions`.

Une révision contient notamment :

- paramètres de correction ;
- fiche méthode ;
- configuration analytique ;
- métadonnées de laboratoire ;
- mesures brutes ;
- numéro de révision ;
- date de mise à jour.

## 5. Archive JSON

Une archive de schéma `3` contient :

- manifeste ;
- configuration ;
- événements ;
- interruptions ;
- statut et dates du run ;
- données scientifiques courantes ;
- révisions scientifiques ;
- version de l'application ;
- version du schéma ;
- empreinte SHA-256 facultativement calculée à l'export.

Les exports historiques de schéma `2` restent importables lorsque leur structure minimale est valide.

## 6. Restauration

Lors d'un import :

1. la structure minimale est contrôlée ;
2. le manifeste est vérifié pour les archives de schéma `3` ;
3. l'empreinte SHA-256 est recalculée si présente ;
4. l'enregistrement complet est préparé ;
5. une seule écriture IndexedDB est effectuée.

Une archive invalide ne doit pas créer un essai partiel.

## 7. Procédure recommandée

Après chaque essai :

1. exporter l'archive JSON complète ;
2. conserver le fichier dans l'emplacement documentaire du laboratoire ;
3. ne pas modifier le fichier exporté ;
4. tester périodiquement sa réimportation ;
5. conserver aussi le contexte expérimental externe requis par le protocole.

