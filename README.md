# PepitoStream

Addon tout-en-un compatible Stremio et Nuvio.

> Projet en démarrage : ce dépôt contient le socle de développement. Il ne fournit pas encore de catalogue ni de flux vidéo. Les sources devront être autorisées et leur intégration documentée.

## État

- [x] Serveur Node.js/TypeScript et endpoint de santé
- [x] Manifest et routes Stremio de démonstration (`catalog`, `meta`, `stream`)
- [x] Schéma de préférences et utilitaire de jeton de profil signé
- [ ] Vérifier et implémenter l’adaptateur Nuvio à partir de sa spécification officielle
- [ ] Interface de configuration et stockage persistant des profils
- [ ] Catalogues et fournisseurs de contenus autorisés

## Prérequis

Node.js 20 ou supérieur.

## Développement

```sh
cp .env.example .env
# Remplacez PROFILE_TOKEN_SECRET par une valeur aléatoire d'au moins 32 caractères
npm install
npm run dev
```

- Santé : `http://localhost:7000/health`
- Manifest Stremio : `http://localhost:7000/stremio/manifest.json`

Les routes de catalogue et de flux renvoient volontairement des résultats vides tant qu’aucune source n’est intégrée.

## Tests et compilation

```sh
npm test
npm run build
```

## Nuvio

La compatibilité Nuvio n’est pas encore déclarée comme fonctionnelle. Avant d’écrire l’adaptateur, il faut confirmer le format attendu par la version ciblée de Nuvio et le tester dans l’application. Le cœur métier pourra ensuite être partagé, avec des adaptateurs distincts si les protocoles diffèrent.

## Sécurité

Ne mettez pas de clés secrètes dans le navigateur ou dans une URL. Le jeton de profil est signé, mais ce prototype n’inclut pas encore de base de données ni de chiffrement des paramètres sensibles. Utilisez uniquement des sources et contenus que vous êtes autorisé à distribuer ou référencer.
