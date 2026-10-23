# DissoloMaster Pro
## Cahier des charges et plan de développement

**Version :** 1.1  
**Statut :** Cadrage initial — à valider progressivement  
**Domaine :** Pharmacie galénique, biopharmacie et recherche universitaire  
**Plateforme cible :** Application Web Progressive (PWA) fonctionnant hors ligne  
**Mode de développement :** Développement personnel assisté par IA, avec validation à chaque jalon

---

## 1. Présentation du projet

DissoloMaster Pro est un outil numérique destiné à préparer, piloter et analyser des essais de dissolution in vitro comparant des formulations pharmaceutiques.

Le projet doit évoluer progressivement, en commençant par un séquenceur temporel fiable, puis en ajoutant la collecte des données, les corrections mathématiques, l'analyse biopharmaceutique et la génération de rapports.

L'application est destinée initialement à la **recherche universitaire et au développement de formulations**. Elle ne doit pas revendiquer une conformité réglementaire GxP ou 21 CFR Part 11.

### 1.1 Objectifs principaux

- Planifier les introductions des unités et les prélèvements.
- Réduire les erreurs de manipulation grâce à des alertes visuelles et sonores.
- Enregistrer les heures théoriques et les heures réelles de confirmation.
- Collecter et conserver les données expérimentales brutes.
- Corriger les résultats en fonction des prélèvements successifs.
- Comparer les profils de dissolution à l'aide de méthodes documentées.
- Générer des graphiques et des rapports reproductibles.
- Permettre un fonctionnement hors ligne et l'exportation des données.

### 1.2 Principes directeurs

1. Développement progressif, avec validation de chaque jalon avant de poursuivre.
2. Séparation entre données brutes, données corrigées, résultats dérivés et conclusions.
3. Aucun changement silencieux des données ou de la chronologie.
4. Calculs scientifiques testables et reproductibles.
5. Hypothèses, unités et limites documentées.
6. Aucun affichage de conformité réglementaire sans justification et validation appropriées.

---

## 2. Périmètre fonctionnel

### Version initiale : séquenceur temporel

- Configuration de l'essai.
- Génération d'une chronologie globale.
- Détection de conflits potentiels.
- Alertes sonores et visuelles.
- Confirmation des actions.
- Enregistrement des écarts temporels.
- Export des événements en JSON ou CSV.

### Versions ultérieures

- Saisie des absorbances UV-Vis ou des concentrations CLHP.
- Gestion des facteurs de dilution et des unités.
- Correction des prélèvements successifs.
- Gestion des réplicats et statistiques descriptives.
- Comparaison des profils et calcul des facteurs f1 et f2.
- Graphiques et rapports PDF.
- Journal des modifications, sauvegarde et restauration.

### Hors périmètre initial

- Revendication de conformité au 21 CFR Part 11.
- Signatures électroniques réglementaires.
- Intégration directe aux appareils de dissolution ou aux systèmes CLHP.
- Gestion multi-utilisateur et synchronisation cloud.

---

## 3. Architecture technique proposée

| Composant | Choix initial | Raison |
|---|---|---|
| Langage | TypeScript | Typage et maintenance |
| Outil de développement | Vite | Serveur local et compilation |
| Tests unitaires | Vitest | Tests rapides du moteur scientifique |
| Interface | HTML/CSS et TypeScript | Application légère |
| Stockage local | IndexedDB | Conservation des essais dans le navigateur |
| Fonctionnement hors ligne | Service Worker et manifeste PWA | Mise en cache des ressources de l'application |
| Alertes sonores | Web Audio API | Génération de sons sans fichiers externes |
| Versionnement | Git | Historique du code et possibilité de retour arrière |
| Export | JSON et CSV au départ | Sauvegarde et analyse des événements |

Cette architecture est une proposition initiale. Toute modification doit être justifiée par un besoin réel, et non par une complexité technique anticipée.

### 3.1 Contraintes de fonctionnement hors ligne

- L'application doit pouvoir être utilisée sans réseau après son chargement initial et son installation.
- Les essais et événements doivent être stockés localement.
- L'application doit fournir des fonctions d'exportation et de restauration.
- Les données du navigateur ne doivent pas être considérées comme une sauvegarde inviolable.
- Les comportements de suspension, de reprise et de mise en veille doivent être testés sur l'ordinateur cible.
- Le son doit être activé par une interaction explicite de l'utilisateur ; une alternative visuelle doit exister.

---

## 4. Spécifications fonctionnelles — Module 1

### 4.1 Configuration d'un essai

L'utilisateur doit pouvoir renseigner :

- Identifiant ou nom de l'essai.
- Nombre de cuves, entier strictement positif.
- Décalage d'introduction entre les cuves.
- Liste des temps de prélèvement.
- Unités explicites pour chaque durée.
- Pré-alerte, fixée à 5 secondes par défaut et configurable.
- Seuil de conflit, fixé à 15 secondes par défaut et configurable.
- Durée opératoire par type d'action, si elle est connue.

Les valeurs invalides doivent être refusées avec un message explicite.

### 4.2 Convention temporelle

Le démarrage global définit T0.

Pour la cuve i, l'introduction théorique est :

`t_intro(i) = (i - 1) × D`

où D est le décalage d'introduction.

**Convention proposée :** chaque temps de prélèvement est relatif à l'introduction de sa cuve.

Pour une cuve i et un temps de prélèvement p exprimé en minutes :

`t_prélèvement(i, p) = (i - 1) × D + 60 × p`

Les calculs internes d'échéance doivent utiliser une unité uniforme, de préférence la milliseconde. L'interface doit toujours afficher les unités.

Cette convention doit être confirmée et testée avant de développer le minuteur réel.

### 4.3 Génération de la chronologie

Le moteur doit :

1. Générer toutes les introductions.
2. Générer tous les prélèvements de toutes les cuves.
3. Donner un identifiant unique à chaque action.
4. Conserver l'identifiant de la cuve, le type d'action et l'échéance théorique.
5. Trier les actions par échéance croissante.
6. Utiliser un ordre secondaire déterministe pour les échéances identiques.
7. Conserver toutes les actions, même si plusieurs actions partagent la même échéance.
8. Séparer la génération de la chronologie de la détection des conflits.

Structure indicative d'une action :

```ts
type ActionType = "introduction" | "prelevement";

type ActionStatus =
  | "pending"
  | "announced"
  | "confirmed"
  | "missed"
  | "cancelled";

interface TimelineAction {
  id: string;
  vesselId: number;
  type: ActionType;
  scheduledOffsetMs: number;
  status: ActionStatus;
}
```

Cette structure peut être adaptée si l'IA identifie une meilleure solution, à condition de préserver les exigences fonctionnelles.

### 4.4 Détection des conflits

Le système doit détecter les actions trop rapprochées avant le lancement et expliquer le conflit.

Il faut distinguer :

- **Collision potentielle :** deux actions sont séparées par un intervalle inférieur au seuil configuré.
- **Conflit opérationnel :** les durées opératoires estimées rendent difficile ou impossible l'exécution correcte des actions.
- **Avertissement :** proximité nécessitant une attention, sans impossibilité démontrée.

Le seuil de 15 secondes est une valeur initiale configurable, pas une règle scientifique ou réglementaire universelle.

Le moteur ne doit jamais supprimer ou déplacer une action pour résoudre un conflit. Il peut proposer des ajustements, mais l'utilisateur doit les accepter explicitement.

### 4.5 Minuteur et alertes

- Utiliser `performance.now()` comme horloge monotone pour calculer le temps écoulé et les échéances relatives.
- Ne pas utiliser un `setInterval()` simple comme source de vérité temporelle.
- Utiliser un mécanisme de réveil qui recalcule le temps restant à partir de l'horloge.
- À T−5 secondes, émettre trois bips courts.
- À l'échéance, émettre un bip long.
- Afficher une alerte visuelle prioritaire avec le type d'action et le numéro de cuve.
- Utiliser des codes visuels distincts pour les introductions et les prélèvements, sans dépendre uniquement de la couleur.
- Permettre un test sonore avant le démarrage.
- Gérer les permissions audio et signaler si le son est indisponible.
- Éviter de rejouer aveuglément des alertes anciennes après une interruption.
- Détecter et signaler les interruptions ou retards de réveil.

**Limite importante :** un navigateur web ne garantit pas une exécution temps réel exacte. La précision effective doit être mesurée dans les conditions réelles d'utilisation. L'application doit enregistrer les retards observés plutôt que prétendre les éliminer.

### 4.6 Confirmation et événements

Chaque action doit distinguer :

- Échéance théorique.
- Heure de notification, si elle a été émise.
- Heure réelle de confirmation.
- Écart signé entre confirmation et échéance.
- Statut de l'action.
- Éventuelle annotation de l'opérateur.

L'écart temporel signé est :

`écart_ms = heure_confirmation_monotone - échéance_monotone`

La conversion en secondes doit être faite pour l'affichage et l'export.

Les horodatages civils peuvent également être enregistrés pour la lisibilité des journaux, mais ils ne doivent pas remplacer l'horloge monotone pour le calcul des durées. Les événements doivent être conservés dans leur ordre et ne pas être effacés silencieusement.

Le journal local du prototype est un mécanisme de traçabilité de recherche, pas un audit trail réglementaire inviolable.

---

## 5. Module ultérieur — Collecte et correction des données

### 5.1 Données brutes

Pour chaque mesure, prévoir :

- Identifiant de l'essai.
- Produit et lot.
- Cuve et réplicat.
- Temps théorique et temps réel du prélèvement.
- Valeur brute et unité.
- Méthode analytique : UV-Vis ou CLHP.
- Facteur de dilution et informations nécessaires à son calcul.
- Volume prélevé et mode de remplacement.
- Annotations et anomalies.

Les données brutes doivent rester distinctes des données corrigées. Toute correction doit être explicable et reproductible.

### 5.2 Correction des prélèvements successifs

Deux modes sont prévus :

1. Prélèvement avec remplacement par du milieu frais.
2. Prélèvement sans remplacement.

Sous l'hypothèse d'un milieu homogène, d'un prélèvement représentatif et d'un remplacement par un milieu exempt de principe actif :

Avec remplacement :

`Q_n = V × C_n + V_s × somme(C_i, i = 1 à n−1)`

Sans remplacement :

`Q_n = [V − (n−1) × V_s] × C_n + V_s × somme(C_i, i = 1 à n−1)`

Où :

- `V` est le volume initial du milieu.
- `V_s` est le volume prélevé à chaque prélèvement.
- `C_n` est la concentration mesurée au temps n.
- `Q_n` est la quantité cumulée dissoute corrigée.

La conversion en pourcentage doit utiliser la quantité de principe actif de référence et des unités compatibles. Les facteurs de dilution analytiques doivent être traités explicitement.

Ces équations doivent être vérifiées par des calculs indépendants avant implémentation. Les cas de remplacement partiel et les protocoles particuliers nécessiteront des règles distinctes.

### 5.3 Statistiques descriptives

Pour chaque produit et chaque temps :

- Nombre de mesures valides.
- Moyenne.
- Écart-type (SD).
- Coefficient de variation (%CV).
- Données individuelles consultables.

Les valeurs aberrantes, manquantes, négatives ou supérieures à 100 % doivent être signalées pour examen, jamais corrigées silencieusement.

---

## 6. Module ultérieur — Comparaison des profils

### 6.1 Facteur de similitude f2

Formule classique :

`f2 = 50 × log10(100 / sqrt(1 + (1/n) × somme((R_t − T_t)^2)))`

où `R_t` et `T_t` sont les pourcentages moyens dissous des produits de référence et d'essai au temps t.

### 6.2 Facteur de différence f1

`f1 = 100 × somme(abs(R_t − T_t)) / somme(R_t)`

### 6.3 Règles d'interprétation

- Les calculs doivent être réalisés uniquement si les conditions de la méthode sélectionnée sont satisfaites.
- Le logiciel doit identifier le référentiel, sa version et les règles appliquées.
- Les critères liés au nombre de points, au seuil de 85 %, à la variabilité et aux unités doivent être configurables selon le contexte réglementaire pertinent.
- Les critères parfois utilisés de CV inférieur à 20 % au premier temps et à 10 % aux temps suivants ne doivent pas être considérés comme universels.
- Le contexte de l'ICH M9 doit être distingué des autres contextes de comparaison des profils.
- Les points exclus du calcul doivent être visibles et justifiés.
- Un résultat numérique ne doit pas, à lui seul, générer une conclusion réglementaire.

Conclusions possibles selon les critères applicables : similitude démontrée, similitude non démontrée ou évaluation non concluante. Les libellés définitifs devront être définis et validés.

---

## 7. Graphiques et rapports ultérieurs

Les graphiques doivent pouvoir présenter :

- Temps en abscisse.
- Pourcentage dissous en ordonnée.
- Profils des produits de référence et d'essai.
- Moyennes et barres d'erreur configurables.
- Données individuelles, si nécessaire.
- Points exclus et raisons de leur exclusion.

Le rapport PDF devra inclure, selon la version :

1. Identifiants de l'essai, produits, lots et opérateur.
2. Conditions expérimentales et méthode analytique.
3. Chronologie théorique et réelle.
4. Données brutes et données corrigées.
5. Statistiques et graphiques.
6. Calculs f1/f2 et contrôles applicables.
7. Référentiel et version des règles appliquées.
8. Anomalies, écarts et modifications documentées.
9. Conclusion et réserves scientifiques.
10. Version du logiciel et des algorithmes.

---

## 8. Traçabilité, sauvegardes et limites réglementaires

Pour le prototype :

- Enregistrer les événements localement.
- Permettre l'export des essais et des événements en JSON ou CSV.
- Documenter les corrections et préserver les valeurs antérieures lorsque c'est applicable.
- Tester la fermeture et la réouverture de l'application.
- Tester la sauvegarde et la restauration.
- Ne pas assimiler le stockage local à une conservation inviolable.

Une future utilisation dans un environnement réglementé nécessiterait une analyse spécifique : exigences formalisées, contrôle des accès, piste d'audit protégée, sauvegardes, validation documentée et évaluation des exigences applicables, notamment le 21 CFR Part 11 si pertinent.

Le terme informel « Part 11 Lite » ne doit pas apparaître comme une revendication de conformité.

---

## 9. Plan de développement

Les durées ci-dessous sont indicatives et ne constituent pas des engagements de livraison.

### Jalon M0 — Fondations

- Initialiser le projet Vite + TypeScript.
- Installer et configurer Vitest.
- Configurer Git.
- Établir les conventions temporelles et les unités.
- Définir les types et les scénarios de test.
- Valider le build et l'exécution des tests.

**Livrable :** projet exécutable, conventions documentées et tests de base.

### Jalon M1 — Moteur temporel

- Implémenter `generateTimeline(config)`.
- Valider les entrées.
- Trier les événements de façon déterministe.
- Préserver les actions à échéances identiques.
- Implémenter la détection des conflits.
- Tester les cas normaux et limites.

**Livrable :** moteur indépendant de l'interface, couvert par des tests.

### Jalon M2 — Interface et alertes

- Configuration de l'essai.
- Aperçu de la chronologie.
- Compte à rebours.
- Alertes sonores et visuelles.
- Confirmation et calcul des écarts.
- Gestion des actions manquées et interruptions.

**Livrable :** prototype fonctionnel testé en simulation.

### Jalon M3 — PWA et persistance

- Manifeste PWA.
- Service Worker.
- Installation et fonctionnement hors ligne.
- Stockage IndexedDB.
- Export JSON/CSV.
- Sauvegarde et restauration.
- Tests de fermeture, reprise et mise en veille.

**Livrable :** application installable avec données persistantes.

### Jalon M4 — Collecte et moteur scientifique

- Saisie des mesures.
- Correction des prélèvements successifs.
- Statistiques descriptives.
- Calculs f1/f2.
- Règles de comparaison versionnées.
- Tests avec données de référence indépendantes.

**Livrable :** module scientifique documenté et validé numériquement.

### Jalon M5 — Rapports et finition

- Graphiques.
- Rapports PDF.
- Journal des modifications.
- Documentation utilisateur.
- Tests de bout en bout et restauration.
- Préparation d'une version de recherche.

**Livrable :** version de recherche documentée, avec limites connues.

---

## 10. Critères généraux d'acceptation

- La chronologie correspond aux échéances de référence.
- Les actions partageant une échéance ne sont jamais perdues.
- Les conflits sont expliqués et ne déplacent pas automatiquement les actions.
- Les alertes et confirmations gèrent les retards et interruptions.
- Le stockage et la restauration sont testés.
- Les formules scientifiques correspondent à des calculs indépendants.
- Les données brutes restent accessibles et distinctes des données corrigées.
- Les résultats sont reproductibles à partir des données et des versions des algorithmes.
- Les rapports reproduisent fidèlement les données et résultats.
- Les limites du navigateur et du statut réglementaire sont documentées.

Tant que les validations nécessaires ne sont pas terminées, les résultats doivent être considérés comme exploratoires et vérifiés indépendamment.

---

## 11. Première tâche à confier à l'IA de programmation

Le développement doit commencer exclusivement par M0 et M1. Ne pas générer l'application complète d'un seul coup.

### Prompt

> Nous développons DissoloMaster Pro, une PWA hors ligne destinée à la recherche universitaire en pharmacie galénique et à l'analyse des essais de dissolution in vitro.
>
> **Stack :** TypeScript, Vite, Vitest. Interface légère, sans framework UI lourd. Développement progressif avec tests à chaque jalon.
>
> **Tâche actuelle :** implémenter uniquement les fondations et le moteur temporel. Ne développe ni l'interface complète, ni les alertes sonores, ni IndexedDB, ni les calculs scientifiques.
>
> 1. Analyse la structure existante avant de modifier les fichiers.
> 2. Propose les types TypeScript pour la configuration, les actions et les erreurs.
> 3. Implémente une fonction pure `generateTimeline(config)`.
> 4. Utilise le décalage d'introduction en secondes, les temps de prélèvement en minutes et les échéances en millisecondes.
> 5. Convention : cuve 1 à T0 ; cuve i à `(i - 1) × décalage` ; prélèvements relatifs à l'introduction de leur cuve.
> 6. Génère toutes les introductions et tous les prélèvements.
> 7. Trie les actions par échéance croissante, avec ordre secondaire déterministe.
> 8. Ne perds aucune action lorsque plusieurs échéances sont identiques.
> 9. Valide les entrées et définis explicitement la règle de traitement des temps dupliqués.
> 10. Implémente une détection de conflits indépendante de la génération de la chronologie. Le seuil est configurable ; aucun événement ne doit être supprimé ou déplacé.
> 11. Écris des tests Vitest pour les cas normaux, les égalités, les entrées invalides, le tri et les conflits.
> 12. Documente les hypothèses et limites.
> 13. Exécute réellement les tests et le build, puis rapporte leurs résultats.
>
> Ne modifie pas les fichiers sans nécessité. N'affirme pas qu'un test a réussi s'il n'a pas été exécuté. N'introduis aucune règle réglementaire non spécifiée. Ne développe pas les étapes suivantes avant validation du jalon.
>
> Commence par présenter les types, l'arborescence proposée et les cas de test. Ensuite, implémente le module et vérifie les résultats.

---

## 12. Scénarios de test initiaux

### Scénario de référence

Configuration :

- Nombre de cuves : 2.
- Décalage : 30 secondes.
- Temps de prélèvement : 1 minute.

Chronologie attendue :

| Échéance | Cuve | Action |
|---:|---|---|
| 0 s | 1 | Introduction |
| 30 s | 2 | Introduction |
| 60 s | 1 | Prélèvement |
| 90 s | 2 | Prélèvement |

### Autres tests obligatoires

1. Décalage nul : plusieurs introductions à T0, sans perte d'action.
2. Temps de prélèvement non triés : chronologie normalisée.
3. Temps dupliqués : comportement explicite et testé.
4. Valeurs négatives, non numériques ou non finies : rejet avec erreur claire.
5. Conflit inférieur au seuil : diagnostic produit sans changement de chronologie.
6. Absence de conflit : aucun avertissement injustifié.
7. Échéances identiques : tri secondaire stable et déterministe.

---

## 13. Règles de collaboration avec l'IA

- Travailler sur un seul jalon à la fois.
- Examiner les fichiers existants avant toute modification.
- Demander une explication des changements et des fichiers touchés.
- Exécuter les tests après chaque modification importante.
- Ne pas passer au jalon suivant tant que les critères d'acceptation ne sont pas remplis.
- Distinguer les tests réellement exécutés des tests simplement proposés.
- Conserver des commits Git correspondant aux jalons validés.
- Ne pas ajouter de dépendance sans expliquer son utilité.
- Toute règle scientifique ou réglementaire doit être associée à une source et à une version identifiables.
- Toute hypothèse non validée doit être signalée comme telle.

## 14. Première action concrète

1. Vérifier que Node.js, npm et Git sont disponibles.
2. Initialiser le projet avec Vite et TypeScript.
3. Installer Vitest.
4. Faire proposer à l'IA les types, l'arborescence et les tests du moteur temporel.
5. Implémenter le moteur.
6. Exécuter les tests et le build.
7. Vérifier manuellement la chronologie de référence.
8. Enregistrer le jalon dans Git avant de poursuivre.

**Priorité absolue :** obtenir un moteur temporel simple, déterministe et vérifiable avant de développer le minuteur réel. C'est la base sur laquelle tous les modules ultérieurs de DissoloMaster Pro devront s'appuyer.
