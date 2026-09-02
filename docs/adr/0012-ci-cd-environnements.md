# 0012 — CI/CD et environnements

- **Statut** : proposé
- **Date** : 2026-09-02

## Contexte

Le projet a besoin d'au moins trois environnements (développement, staging pour
l'agence pilote, production) et d'une CI qui empêche de casser `develop`/`main`.
Le dépôt backend est hébergé sur GitLab
(`git@gitlab.com:oumra-hadj-group/oumra-hadj-backend.git`), ce qui remplace le
choix initial « GitHub Actions » de cet ADR par **GitLab CI/CD**, natif à cet
hébergeur. Le projet veut aussi une analyse de qualité de code continue.

## Décision

- Pipeline **GitLab CI/CD** (`.gitlab-ci.yml`) déclenché sur chaque Merge
  Request et sur les push vers `develop`/`main` : install, lint
  (ESLint/Prettier), build, tests unitaires, tests e2e backend (voir ADR
  0010). Chaque étape doit passer avant qu'une Merge Request soit fusionnable.
- Analyse de qualité **SonarQube** (scan `sonar-scanner` avec rapport de
  couverture Jest/lcov) exécutée dans le pipeline, en plus des tests — voir
  `sonar-project.properties`. Le job reste non-bloquant (`allow_failure:
  true`) tant que les variables CI `SONAR_HOST_URL`/`SONAR_TOKEN` ne sont pas
  configurées côté GitLab ; à rendre bloquant une fois le serveur SonarQube et
  le quality gate en place.
- Convention de branches inchangée (voir ADR 0011) : une branche
  `feature/<issue>-<titre>` ou `fix/<issue>-<titre>` par fonctionnalité,
  fusionnée dans `develop` via Merge Request après CI verte, puis `develop`
  fusionné dans `main` pour une mise en production.
- Déploiement automatique de `develop` vers l'environnement **staging** après
  succès de la CI ; déploiement vers **production** manuel/validé depuis `main`
  après tag de version (l'automatisation du déploiement lui-même — job GitLab
  CI de déploiement — reste à préciser une fois l'hébergeur choisi, voir
  Conséquences).
- Variables sensibles (clés API paiement, clés FCM, secrets JWT, token
  SonarQube) gérées par variables d'environnement / secrets CI GitLab, jamais
  commitées — un fichier `.env.example` documente les variables attendues
  sans valeurs réelles.
- Environnement **staging** utilisé pour la phase pilote avec l'agence test
  (phase 6 du plan de développement) avant bascule en production.

## Conséquences

- Nécessite de choisir un hébergeur (VPS, cloud) et d'écrire les jobs de
  déploiement GitLab CI correspondants — décision à confirmer avant la phase
  6 ; cet ADR passera alors de `proposé` à `accepté` avec les détails
  d'hébergement précisés.
- Nécessite de provisionner un serveur SonarQube (ou SonarCloud) et de
  configurer `SONAR_HOST_URL`/`SONAR_TOKEN` dans les paramètres CI/CD du
  projet GitLab pour que l'analyse qualité soit effective.
