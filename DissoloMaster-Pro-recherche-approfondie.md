# Recherche approfondie — DissoloMaster Pro

## Diagnostic de maturité

DissoloMaster Pro est déjà un prototype de recherche intégré substantiel : chronologie déterministe, détection de conflits, minuteur, confirmation des actions, saisie de données scientifiques, correction de prélèvements successifs, statistiques, comparaison f1/f2, IndexedDB, révisions et exports.

La vérification du dépôt connecté `elidpremier/DISSOLO-MASTER-PRO` est positive : les tests passent et le build PWA réussit. La suite couvre actuellement 46 tests du moteur et 19 tests IndexedDB. Cela prouve une base logicielle fonctionnelle dans les scénarios couverts. Cela ne prouve toutefois ni la validité scientifique pour tous les protocoles, ni la synchronisation avec un appareil, ni la fiabilité en veille mobile, ni l’accessibilité, ni la conservation durable, ni une conformité GxP ou 21 CFR Part 11.

Le positionnement « recherche uniquement » est un actif à préserver. Les références FDA sur l’intégrité des données et Part 11 sont des repères de conception, pas une base de revendication de conformité [1] [2] [3]. Le principal risque produit est qu’un nombre plausible, une alerte apparemment active ou un essai présent dans IndexedDB soit interprété comme plus fiable, reproductible ou réglementaire qu’il ne l’est réellement.

## Ce que le produit fait déjà bien

Le moteur temporel sépare correctement la génération de la chronologie, la détection des conflits et l’exécution. Il utilise `performance.now()`, conserve les actions simultanées, effectue un tri déterministe et enregistre les retards observés. Cette architecture est cohérente avec la limite reconnue dans le cahier des charges : un navigateur ne garantit pas une exécution temps réel exacte.

La séparation entre données brutes et données dérivées est également un bon socle. Les mesures brutes restent conservées, les résultats corrigés sont calculés séparément et les révisions scientifiques sont empilées dans IndexedDB. La documentation indique explicitement que les calculs sont exploratoires et que le stockage local n’est pas une archive inviolable.

La différenciation la plus défendable n’est pas de concurrencer un LIMS ou une suite de contrôle instrumenté. Elle est de proposer une préparation et une orchestration hors ligne, portable, légère et pédagogique, reliée à une analyse exploratoire reproductible.

## Constats critiques par domaine

### 1. Fiabilité temporelle et fonctionnement terrain

L’utilisation de `performance.now()` et du recalcul des échéances est pertinente. Toutefois `requestAnimationFrame()` est généralement suspendu dans les onglets masqués, tandis que les minuteries d’arrière-plan peuvent être ralenties [4] [5]. Le logiciel peut donc détecter un retard au retour, mais il ne peut pas garantir que l’opérateur recevra l’alerte au moment prévu lorsque le téléphone est verrouillé, que l’onglet est masqué ou que l’application est suspendue.

Le minuteur devrait écouter `visibilitychange`, `pagehide` et `pageshow`, consigner le début et la fin des interruptions, puis présenter un écran de rattrapage. Les échéances dépassées ne doivent pas être rejouées aveuglément. Elles doivent être marquées comme retardées, sautées ou à revoir selon une règle métier validée.

L’API Screen Wake Lock peut réduire l’extinction de l’écran, mais elle dépend de la visibilité, de la batterie et de la plateforme. Elle ne transforme pas un navigateur en horloge temps réel garantie [6]. Le son doit également vérifier l’état réel de `AudioContext`, notamment `resume()` et `statechange`, plutôt que déduire sa disponibilité de l’absence d’un état `closed` [7].

### 2. Modèle scientifique et correction des prélèvements

La correction actuelle couvre le remplacement complet ou l’absence de remplacement, avec volume constant. Elle suppose un milieu homogène, un prélèvement représentatif et une conservation du modèle de volume. Elle ne couvre pas le remplacement partiel, les volumes variables, les protocoles particuliers, la position de prélèvement, la température au prélèvement ou la filtration.

Ces hypothèses doivent être visibles dans l’interface et enregistrées dans le dataset. Si un mode n’est pas implémenté, il vaut mieux le refuser explicitement que le représenter silencieusement par `full` ou `none`. Les bonnes pratiques USP mettent notamment en avant le remplacement approprié, la zone de prélèvement et la filtration dans les essais multipoints [8].

Deux incohérences du dépôt sont particulièrement urgentes :

1. L’interface de saisie demande une teneur en principe actif par mesure, mais le moteur utilise la teneur de la configuration globale. Une valeur saisie au niveau mesure peut donc être ignorée sans avertissement.
2. Le facteur de dilution est documenté comme multiplicatif et supérieur ou égal à 1, mais une valeur inférieure à 1 est actuellement acceptée. Il faut choisir une convention unique, la documenter et valider les volumes ou étapes de dilution.

Pour l’UV-Vis, l’absorbance brute, la correction du blanc, l’absorbance corrigée et les paramètres d’étalonnage devraient être séparés. La relation E1% peut être calculée, mais l’application ne réalise pas à elle seule une validation de méthode portant sur blanc, linéarité, spécificité, récupération ou stabilité. L’ICH M9 demande une description et une validation appropriées des méthodes analytiques dans le contexte concerné [9].

### 3. f1/f2 : calcul numérique versus évaluation interprétable

Le moteur calcule f1 et f2 sur des profils moyens alignés. La formule est donc utile comme calcul exploratoire. Toutefois `minimumPoints` ne suffit pas à décrire un référentiel ou à déterminer si une comparaison est interprétable.

Les contrôles importants doivent devenir explicites : nombre d’unités par formulation et par temps, mêmes temps de prélèvement, temps zéro, données manquantes, variabilité par temps, nombre de moyennes supérieures à 85 %, dissolution très rapide, exclusions et conditions expérimentales identiques. Les recommandations FDA et EMA décrivent des précautions et seuils associés à ce type de comparaison, dont les repères généraux f1 de 0 à 15 et f2 de 50 à 100, ainsi que des règles de variabilité et de nombre d’unités [10] [11].

L’interface devrait retourner des contrôles séparés avec les états `pass`, `fail` ou `not evaluated`. Un f2 numérique ne doit jamais être présenté comme une preuve automatique de similitude. Lorsque les données individuelles ou les contrôles nécessaires manquent, le résultat devrait être explicitement « non évaluable » avec les raisons précises.

### 4. Méthode, métadonnées et concurrents

Les métadonnées actuelles — opérateur, produit, lot, méthode, appareil, instrument, milieu, température et vitesse — sont une bonne base, mais les champs sont largement libres et plusieurs paramètres restent facultatifs.

Une fiche méthode versionnée devrait couvrir, selon le contexte : type et géométrie de l’appareil, volume, composition et pH du milieu, température cible et observée, vitesse, dégazage, filtration, position de prélèvement, volume prélevé et remplacé, longueur d’onde ou méthode CLHP, étalonnage, standard et identifiants matériels. Les recommandations USP sur la qualification et la performance des appareils mettent en avant les dimensions, la vitesse, la température, le volume, le pH, les positions et les numéros de série [12].

SOTAX, Agilent et Distek annoncent des fonctions davantage orientées vers le pilotage matériel, la collecte en temps réel, la centralisation, l’intégration et les contrôles d’intégrité [13] [14] [15]. DissoloMaster Pro ne devrait donc pas chercher à les imiter directement. Sa voie réaliste est l’import de données et de conditions depuis un appareil, puis la génération d’un rapport reproductible hors ligne.

### 5. Données, sauvegarde et sécurité

IndexedDB doit être présentée comme un espace de travail local, non comme une archive. Le stockage web peut être supprimé ou évincé sous pression, et le mode privé peut supprimer les données à la fermeture [16]. La sauvegarde automatique intervient aujourd’hui surtout à la fin de l’essai. Une fermeture forcée ou un crash avant l’écran de résultats peut donc faire perdre un run.

Les révisions scientifiques conservent des snapshots, mais il manque l’auteur, la raison, l’action effectuée, l’horodatage détaillé, le diff et une empreinte du contenu. L’export ne conserve pas nécessairement toutes les révisions. Les versions sont incohérentes entre les différents modules. L’import reconstruit partiellement les événements et les temps monotones ne peuvent pas être restaurés tels quels.

Il faut une archive complète, versionnée, validée, hashée et importée de façon atomique. Elle devrait contenir les événements, toutes les révisions, les données brutes, les données dérivées, les métadonnées, la version du logiciel, la version du moteur et le référentiel utilisé. Le NIST insiste sur le retour à un point antérieur et sur le test régulier des restaurations [17].

L’accès au profil navigateur ou une faille XSS peut permettre de lire ou modifier IndexedDB. OWASP déconseille de traiter le stockage client comme un mécanisme d’authentification, d’autorisation ou de confidentialité [18]. La documentation actuelle a raison de déconseiller le stockage de résultats confidentiels dans GitHub ou GitHub Pages.

### 6. UX et accessibilité

Le parcours nominal est court : configuration, aperçu, test sonore, lancement, confirmations, résultats. Les libellés de nombreux champs et les unités sont visibles. En revanche, les alertes et erreurs dynamiques ne sont pas systématiquement exposées par des régions live, un focus explicite, `aria-describedby` et `aria-invalid`.

Les échéances, retards, sauvegardes et erreurs devraient être annoncés par des régions accessibles. Les erreurs de formulaire devraient identifier le champ fautif et focaliser le premier contrôle invalide. Ces recommandations s’appuient sur les critères W3C relatifs aux libellés, messages de statut et identification des erreurs [19] [20] [21] [22].

La saisie scientifique est dense sur mobile. Un mode séquentiel par cuve et par temps, avec bouton « saisir la prochaine mesure », réduirait la charge cognitive. Les états ne doivent pas reposer uniquement sur la couleur, le son ou de petits points. Les actions « voir », « exporter » et « supprimer » de l’historique doivent être plus grandes, plus explicites et mieux contextualisées.

## Les améliorations prioritaires

| # | Amélioration | Valeur utilisateur | Effort | Dépendance ou risque | Priorité |
|---:|---|---|:---:|---|:---:|
| 1 | Journaliser visibilité, `pagehide/pageshow` et interruptions | Rend les retards interprétables | M | Modèle d’événements et tests mobiles | P0 |
| 2 | Ajouter un écran de rattrapage sans rejouer aveuglément les alertes | Réduit les prélèvements oubliés | M | Décision métier sur les statuts retardés | P0 |
| 3 | Écrire un checkpoint IndexedDB après chaque confirmation | Évite la perte d’un run en cours | M | Quota et transactions IDB | P0 |
| 4 | Afficher un statut de sauvegarde persistant et un export de secours | Rend l’enregistrement vérifiable | S | Confirmation de commit IDB | P0 |
| 5 | Remplacer la clé déterministe par un UUID ou refuser les collisions | Évite les écrasements silencieux | S | Migration du schéma | P0 |
| 6 | Unifier version application, schéma, moteur et référentiel | Rend les résultats reproductibles | S | Formats et migrations | P0 |
| 7 | Livrer une archive JSON complète avec manifeste et SHA-256 | Permet de vérifier un export | L | Validation et compatibilité | P0 |
| 8 | Importer par staging atomique avec validation stricte | Évite les restaurations partielles | L | Refonte du stockage | P0 |
| 9 | Définir la priorité entre teneur globale et teneur par mesure | Supprime un risque de calcul faux | S | Décision scientifique | P0 |
| 10 | Clarifier le facteur de dilution et valider les volumes | Évite les ambiguïtés d’unité | S | UI, moteur et migration | P0 |
| 11 | Conserver les observations individuelles et calculer n, moyenne, SD, CV | Rend l’analyse interprétable | L | Refonte des types | P0 |
| 12 | Versionner les règles f1/f2 et leurs contrôles | Empêche l’évaluation hors conditions | L | Validation pharmacien/analyste | P0 |
| 13 | Retourner `pass/fail/not evaluated` avec raisons | Empêche la lecture implicite de similitude | M | Dépend des règles | P0 |
| 14 | Créer une fiche méthode immuable par essai | Rend chaque mesure reconstructible | L | Dictionnaire métier | P1 |
| 15 | Modéliser les volumes par temps et le remplacement partiel | Évite les formules hors hypothèses | L | Validation indépendante des équations | P1 |
| 16 | Séparer brut, blanc, corrigé et calibration | Réduit le risque analytique | M | Méthode retenue | P1 |
| 17 | Ajouter live regions, focus, états textuels et dialogues accessibles | Rend l’outil utilisable au clavier et avec assistance | M | Tests d’assistance | P0 |
| 18 | Transformer la saisie en étapes avec « prochaine mesure » | Réduit les erreurs de cuve et de temps | M | Modèle individuel | P1 |
| 19 | Vérifier `AudioContext.resume()` et `statechange` | Rend le canal sonore vérifiable | S | Politiques mobiles | P0 |
| 20 | Ajouter Wake Lock facultatif et réacquisition | Réduit l’extinction de l’écran | M | API et batterie | P1 |
| 21 | Afficher quota, persistance, dernier export et test de restauration | Rend la fragilité du stockage visible | M | Support navigateur | P1 |
| 22 | Passer aux révisions append-only avec auteur et raison | Améliore la traçabilité de recherche | L | Migration et UX | P1 |
| 23 | Tester PWA hors ligne, veille, quota et mise à jour du service worker | Vérifie le produit installé | L | HTTPS et appareils cibles | P1 |
| 24 | Ajouter l’import CSV depuis des appareils | Différencie sans piloter le matériel | M | Formats fournisseurs | P2 |
| 25 | Produire un rapport exploratoire complet et un assistant pédagogique | Augmente la valeur en enseignement et R&D | M | Stabilisation du socle | P2 |

## Socle indispensable versus différenciation

Le socle indispensable comprend la reprise fiable du minuteur, les checkpoints, l’archive vérifiable, la cohérence des teneurs et dilutions, la gestion des anomalies, les données individuelles, les contrôles f1/f2 conditionnels, la méthode versionnée, la restauration complète et l’accessibilité.

Les différenciateurs à développer ensuite sont l’assistant de conception de protocole, la saisie séquentielle par cuve et par temps, le rapport explicatif brut → concentration → correction → pourcentage dissous, l’import CSV d’appareils, le diagnostic hors ligne, l’import de conditions et le mode pédagogique.

## Feuille de route

### 0 à 30 jours : sécuriser le socle

Corriger la teneur par mesure et le facteur de dilution. Unifier les versions. Ajouter UUID, détection de collisions, checkpoints après confirmation, gestion des erreurs de quota et statut de sauvegarde. Instrumenter la visibilité et les reprises du minuteur. Ajouter les live regions, le focus d’erreur, les états textuels et la vérification audio.

Ajouter des tests couvrant la page masquée, la reprise après veille, les actions simultanées, les données manquantes, les unités incompatibles, les doublons, les formulations avec nombre de cuves différent et les collisions d’import.

### 30 à 90 jours : rendre l’analyse explicable

Refondre les types pour conserver les observations individuelles par formulation, cuve et temps. Implémenter les contrôles f1/f2 versionnés et les sorties `not evaluated`. Créer la fiche méthode structurée et immuable. Ajouter les anomalies non destructives, les exclusions et leurs justifications.

Livrer une archive complète avec manifeste, hash, validation stricte, staging et test de restauration. Ajouter le diagnostic de stockage, la demande de persistance opportuniste et une suite de tests clavier, lecteur d’écran, zoom, contraste, mobile et veille.

### 3 à 6 mois : différencier sans sur-promettre

Étendre la correction aux volumes variables et au remplacement partiel uniquement après validation par un pharmacien ou un analyste. Ajouter l’import CSV d’appareils et de conditions. Produire un rapport exploratoire complet avec données brutes, résultats dérivés, contrôles, points exclus, hypothèses, version du logiciel et limites.

Ajouter l’assistant pédagogique, le diagnostic hors ligne et le mode de saisie rapide. Tester installation, coupure réseau, mise à jour du service worker, quota, reprise et restauration sur les appareils réellement visés.

## Questions à valider avec un pharmacien ou un analyste

1. Le produit vise-t-il l’enseignement, le développement de formulation, la recherche non libératoire ou un contexte de biowaiver ?
2. Quel référentiel et quelle version doivent être sélectionnables par essai ?
3. Dispose-t-on de données individuelles par cuve et par temps ?
4. Quelles règles de nombre d’unités, de temps, de variabilité et de dissolution rapide s’appliquent au contexte choisi ?
5. La teneur est-elle globale, par unité, ou les deux avec une règle de rapprochement ?
6. Le facteur de dilution est-il multiplicatif, inverse ou doit-il être décomposé en volumes et étapes ?
7. Quels champs de blanc, calibration, linéarité, spécificité, récupération et stabilité sont nécessaires ?
8. Quels protocoles de remplacement et de volumes variables doivent être supportés ?
9. Quelles métadonnées de l’appareil, du milieu, du pH, de la température, de la filtration et de la position sont obligatoires ?
10. Quelles données sont déclarées par l’opérateur et lesquelles sont importées ?
11. Que doit décider l’utilisateur après une alerte retardée ou manquée ?
12. Quelle fréquence d’export, quel stockage externe et quel test de restauration sont acceptables ?
13. La suppression doit-elle être logique et réversible, avec auteur et raison ?
14. Quels appareils, navigateurs, lecteurs d’écran et formats CSV sont dans le périmètre réel ?

## Conclusion

La priorité n’est pas d’ajouter rapidement davantage de méthodes statistiques. Il faut d’abord rendre le temps, les données, la restauration et l’éligibilité scientifique explicables.

DissoloMaster Pro peut devenir un outil de recherche portable et différenciant par son orchestration hors ligne, ses rapports reproductibles et son rôle pédagogique. Il ne doit pas chercher à devenir un LIMS, un système de contrôle instrumenté ou un logiciel réglementaire, et il doit éviter les termes « validé », « conforme » ou « Part 11 Lite » lorsqu’ils ne sont pas justifiés.

## Références

[1]: https://www.fda.gov/media/119267/download "FDA — Data Integrity and Compliance With Drug CGMP"
[2]: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/part-11-electronic-records-electronic-signatures-scope-and-application "FDA — Part 11, Electronic Records; Electronic Signatures"
[3]: https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11/subpart-B/section-11.10 "eCFR — 21 CFR 11.10"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame "MDN — Window.requestAnimationFrame()"
[5]: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API "MDN — Page Visibility API"
[6]: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API "MDN — Screen Wake Lock API"
[7]: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume "MDN — AudioContext.resume()"
[8]: https://www.usp.org/sites/default/files/usp/document/harmonization/gen-method/stage_6_monograph_25_feb_2011.pdf "USP — General Chapter <711> Dissolution"
[9]: https://database.ich.org/sites/default/files/M9_Guideline_Step4_2019_1116.pdf "ICH — M9 Biopharmaceutics Classification System-Based Biowaivers"
[10]: https://www.fda.gov/media/70936/download "FDA — Dissolution Testing of Immediate Release Solid Oral Dosage Forms"
[11]: https://www.ema.europa.eu/en/documents/scientific-guideline/guideline-investigation-bioequivalence-rev1_en.pdf "EMA — Guideline on the Investigation of Bioequivalence"
[12]: https://www.usp.org/sites/default/files/usp/document/events-training/2025-03-18-Qualification-of-Dissolution-Apparatus-and-PVT-Best-Practices.pdf "USP — Qualification of Dissolution Apparatus and PVT Best Practices"
[13]: https://www.sotax.com/data_management/dissolution_software_winsotaxrplus_1 "SOTAX — WinSOTAXplus Dissolution Software"
[14]: https://www.agilent.com/en/product/dissolution-testing/dissolution-software "Agilent — Dissolution Software"
[15]: https://www.distekinc.com/products/pharmaceutical/dissolution-control-software/ "Distek — Dissolution Control Software"
[16]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria "MDN — Storage quotas and eviction criteria"
[17]: https://www.nccoe.nist.gov/publication/1800-11/VolB/ "NIST — Data Integrity: Recovering from Ransomware and Other Destructive Events"
[18]: https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html "OWASP — HTML5 Security Cheat Sheet"
[19]: https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html "W3C WAI — Labels or Instructions"
[20]: https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html "W3C WAI — Status Messages"
[21]: https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html "W3C WAI — Error Identification"
[22]: https://www.w3.org/WAI/tutorials/forms/notifications/ "W3C WAI — Form Notifications"
