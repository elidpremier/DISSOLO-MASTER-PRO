# Modèle scientifique et hypothèses

## 1. Portée

Les calculs de DissoloMaster Pro sont des calculs exploratoires destinés à la recherche et à l'enseignement. Ils ne constituent pas une validation de méthode analytique ni une conclusion réglementaire.

## 2. Données brutes

Une mesure conserve au minimum :

- identifiant ;
- cuve ;
- temps de prélèvement ;
- valeur brute ;
- unité ;
- méthode analytique ;
- facteur de dilution ;
- formulation ;
- teneur par unité ;
- annotations éventuelles.

Les absorbances répétées restent disponibles séparément ; la valeur utilisée peut être leur moyenne.

## 3. Teneur par unité

La teneur par unité est le dénominateur du pourcentage dissous.

Règle actuelle :

- la première teneur renseignée pour une cuve devient sa référence ;
- les mesures suivantes de cette cuve doivent avoir la même teneur ;
- une divergence est refusée ;
- si aucune teneur par mesure n'est fournie, la configuration globale est utilisée comme repli.

## 4. Dilution

La convention actuelle est multiplicative :

```text
concentration corrigée = concentration mesurée × facteur de dilution
```

Le facteur doit être supérieur ou égal à `1`. Les volumes et étapes détaillés de dilution ne sont pas encore modélisés.

## 5. Quantification E1%

Lorsque le mode E1% est sélectionné :

```text
C (mg/L) = A × 10 000 / (E1% × l)
```

avec :

- `A` : absorbance corrigée du blanc ;
- `E1%` : absorbance spécifique déclarée ;
- `l` : trajet optique en cm.

Cette relation suppose une réponse linéaire et l'applicabilité de la méthode. L'application ne valide pas le blanc, la linéarité, la spécificité, la récupération ou la stabilité.

## 6. Correction des prélèvements

Les modes actuels sont :

- `full` : remplacement complet ;
- `none` : absence de remplacement.

Hypothèses communes :

- milieu homogène ;
- prélèvement représentatif ;
- volume constant ;
- ordre chronologique strict pour une même cuve.

Le remplacement partiel et les volumes variables ne sont pas encore pris en charge.

## 7. Statistiques

Pour une série valide, l'application calcule :

- `n` ;
- moyenne ;
- écart-type d'échantillon ;
- coefficient de variation.

Une seule observation ne produit pas d'écart-type ni de CV.

## 8. f1/f2

Le moteur calcule f1 et f2 sur des profils moyens alignés. L'évaluation est séparée du calcul numérique.

Contrôles disponibles :

- temps identiques ;
- nombre minimal de points ;
- nombre minimal d'unités par formulation ;
- CV maximal par temps ;
- référence non nulle.

Chaque contrôle possède l'état :

- `pass` ;
- `fail` ;
- `not-evaluated`.

Un résultat numérique ne doit pas être présenté comme une preuve automatique de similitude.

