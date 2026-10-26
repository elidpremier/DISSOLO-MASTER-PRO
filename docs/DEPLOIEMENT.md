# Déploiement et fonctionnement PWA

## 1. Build de production

```bash
npm ci
npm run build
```

Le répertoire `dist/` contient le build à publier.

## 2. Exigences de publication

Pour l'installation PWA sur téléphone :

- publier en HTTPS ;
- servir `manifest.webmanifest` ;
- servir le Service Worker à la portée de l'application ;
- conserver les chemins générés par Vite ;
- vérifier les icônes 192 px et 512 px.

`localhost` est généralement accepté par les navigateurs pour le développement. Une adresse IP locale en HTTP n'est pas une solution fiable d'installation mobile.

## 3. Vérifications après publication

1. ouvrir l'application en navigation normale ;
2. vérifier l'absence d'erreurs console ;
3. lancer un essai de démonstration ;
4. couper le réseau après le chargement ;
5. vérifier l'accès à l'historique ;
6. exporter une archive ;
7. réimporter l'archive ;
8. tester la visibilité de l'onglet et le retour après veille ;
9. vérifier que le manifeste et le Service Worker sont actifs.

## 4. Mise à jour

Une publication peut nécessiter un rechargement après récupération du nouveau Service Worker. Pour un appareil de test :

- recharger l'application ;
- vérifier la version affichée dans l'historique ;
- refaire un essai court ;
- ne pas supprimer les données locales avant d'avoir exporté les archives.

## 5. Sécurité opérationnelle

Ne pas publier de résultats confidentiels dans le dépôt, dans `public/`, dans `dist/` ou sur un hébergement public. IndexedDB ne doit pas être utilisée comme mécanisme d'authentification, d'autorisation ou de confidentialité.

