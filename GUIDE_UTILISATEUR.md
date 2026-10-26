# DissoloMaster Pro — Guide utilisateur

**Version documentée :** `0.5.0-research`
**Public :** chercheurs, étudiants et analystes en recherche non libératoire
**Dernière mise à jour :** 2026-10-26

Voir aussi :

- [README](./README.md)
- [Modèle scientifique](./docs/MODELE_SCIENTIFIQUE.md)
- [Données et archives](./docs/DONNEES_ET_ARCHIVES.md)

## Statut et limites

DissoloMaster Pro est un outil hors ligne pour la recherche universitaire. Il ne revendique pas de conformité GxP ni 21 CFR Part 11. Exportez régulièrement les essais : les données IndexedDB restent propres au navigateur.

**Positionnement obligatoire :** l'application est une aide de recherche et de référence. Elle ne remplace pas la monographie officielle, le SOP, un LIMS, un cahier de laboratoire approuvé ou un système GMP validé. Les calculs et rapports sont exploratoires et ne constituent pas une décision réglementaire.

## Workflow

1. Créez un essai, définissez les cuves, décalages et prélèvements.
2. Vérifiez les conflits dans l'aperçu, testez le son, puis démarrez.
3. Confirmez chaque action. Le journal conserve l'heure et l'écart observé.
4. Depuis l'historique, ouvrez l'essai puis **Données de dissolution**.
5. Définissez la méthode une fois : volumes, remplacement, technique et quantification.
6. Saisissez une mesure par cuve et temps, puis enregistrez. Exportez JSON/CSV et, si besoin, **Rapport / PDF** (boîte d'impression du navigateur).
7. Renseignez le contexte de recherche (opérateur, produit, lot, méthode, appareil et instrument) avant l'enregistrement.
8. Complétez la **fiche méthode versionnée** : appareil, géométrie, pH, température, dégazage, filtration et position de prélèvement.

Chaque enregistrement scientifique crée une nouvelle révision et conserve les révisions précédentes dans l'essai. Une modification doit être traitée comme une nouvelle saisie documentée, jamais comme une correction silencieuse.

## Fiche méthode

La fiche méthode accompagne chaque révision scientifique. Les champs obligatoires sont l'identifiant, la version, le type d'appareil, la géométrie, le dégazage, la filtration et la position de prélèvement. Les champs numériques doivent correspondre aux observations ou aux objectifs du protocole réellement appliqué.

## Installation sur téléphone

L'installation PWA demande une version de production publiée en **HTTPS**. Une adresse locale telle que `http://192.168.x.x:5173` peut afficher l'application sur le téléphone, mais Chrome et Safari refuseront souvent de l'installer car elle n'est pas sécurisée.

- **Android / Chrome** : ouvrez l'URL HTTPS, puis menu ⋮ → **Installer l'application** ou **Ajouter à l'écran d'accueil**.
- **iPhone / iPad** : ouvrez l'URL HTTPS dans **Safari**, puis Partager → **Sur l'écran d'accueil**. Safari n'affiche généralement pas de bouton Installer.

Après une nouvelle publication, supprimez au besoin l'ancienne icône et rechargez l'URL une fois : le navigateur doit récupérer le manifeste et le service worker mis à jour avant de proposer l'installation.

## Organisation des paramètres

- **Méthode** : volume de milieu, volume de prélèvement, remplacement, UV-Vis/CLHP, E1%, trajet optique.
- **Formulation** : nom et teneur en principe actif par unité (dénominateur du pourcentage dissous).
- **Mesure** : cuve, temps, absorbance ou concentration, dilution, annotation.

## Quantification E1%

En mode E1%, saisissez une absorbance corrigée du blanc, l'E1% applicable et le trajet optique. L'application utilise `C (mg/L) = A × 10 000 / (E1% × l)`, puis applique le facteur de dilution et la correction des prélèvements. Vérifiez l'applicabilité, la linéarité et les interférences de la méthode avant usage.

L'exemple de méthode comparative ne renseigne que des paramètres opérationnels à vérifier. La longueur d'onde, le blanc, l'E1%, la dilution et les conditions propres au produit doivent toujours être définis pour la méthode réellement appliquée.

## Comparaison f1/f2

L'écran affiche séparément les contrôles d'éligibilité : temps alignés, nombre de points, nombre d'unités, CV et référence exploitable. Un contrôle absent ou non configuré apparaît comme **Non évalué**. Un f1/f2 numérique reste exploratoire et ne constitue pas automatiquement une conclusion de similitude.

## Reproductibilité

Les mesures brutes ne sont jamais remplacées par les résultats corrigés. Les résultats f1/f2 sont numériques et exploratoires : l'application ne produit pas de conclusion réglementaire automatique.

## Sauvegarde, checkpoints et récupération

Un checkpoint est enregistré pendant l'essai, après les confirmations et lors des interruptions de visibilité. Un essai peut apparaître comme **En cours — reprise possible** dans l'historique. Une interruption de page peut toutefois empêcher une alerte en temps réel ; les actions dépassées doivent être revues par l'opérateur.

L'IndexedDB locale n'est pas une archive inviolable. Exportez l'archive JSON complète après chaque essai et conservez-la dans l'emplacement de sauvegarde prévu par le laboratoire. L'archive contient un manifeste, les interruptions, les révisions scientifiques et une empreinte SHA-256 lorsque l'export est réalisé depuis l'historique. Vérifiez périodiquement qu'elle peut être réimportée.

Ne placez jamais de résultats confidentiels dans le dépôt GitHub ou dans les fichiers publiés par GitHub Pages.
