# DissoloMaster Pro - Guide utilisateur

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

Chaque enregistrement scientifique crée une nouvelle révision et conserve les révisions précédentes dans l'essai. Une modification doit être traitée comme une nouvelle saisie documentée, jamais comme une correction silencieuse.

## Organisation des paramètres

- **Méthode** : volume de milieu, volume de prélèvement, remplacement, UV-Vis/CLHP, E1%, trajet optique.
- **Formulation** : nom et teneur en principe actif par unité (dénominateur du pourcentage dissous).
- **Mesure** : cuve, temps, absorbance ou concentration, dilution, annotation.

## Quantification E1%

En mode E1%, saisissez une absorbance corrigée du blanc, l'E1% applicable et le trajet optique. L'application utilise `C (mg/L) = A × 10 000 / (E1% × l)`, puis applique le facteur de dilution et la correction des prélèvements. Vérifiez l'applicabilité, la linéarité et les interférences de la méthode avant usage.

## Reproductibilité

Les mesures brutes ne sont jamais remplacées par les résultats corrigés. Les résultats f1/f2 sont numériques et exploratoires : l'application ne produit pas de conclusion réglementaire automatique.

## Sauvegarde et récupération

L'IndexedDB locale n'est pas une archive inviolable. Exportez le JSON complet après chaque essai et conservez-le dans l'emplacement de sauvegarde prévu par le laboratoire. Vérifiez périodiquement qu'un export peut être réimporté sur un autre navigateur. Ne placez jamais de résultats confidentiels dans le dépôt GitHub ou dans les fichiers publiés par GitHub Pages.
