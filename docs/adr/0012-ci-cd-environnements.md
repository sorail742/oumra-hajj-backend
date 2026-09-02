# 0012 — CI/CD et environnements

- **Statut** : proposé
- **Date** : 2026-09-02

## Contexte

Le projet a besoin d'au moins trois environnements (développement, staging pour
l'agence pilote, production) et d'une CI qui empêche de casser `develop`/`main`.

## Décision

- Pipeline CI (GitHub Actions) déclenché sur chaque Pull Request : install,
  lint (ESLint/Prettier), build, tests (unitaires + e2e backend).
- Déploiement automatique de `develop` vers l'environnement **staging** après
  succès de la CI ; déploiement vers **production** manuel/validé depuis `main`
  après tag de version.
- Variables sensibles (clés API paiement, clés FCM, secrets JWT) gérées par
  variables d'environnement / secrets CI, jamais commitées — un fichier
  `.env.example` documente les variables attendues sans valeurs réelles.
- Environnement **staging** utilisé pour la phase pilote avec l'agence test
  (phase 6 du plan de développement) avant bascule en production.

## Conséquences

- Nécessite de choisir un hébergeur (VPS, cloud) — décision à confirmer avant
  la phase 6 ; cet ADR passera alors de `proposé` à `accepté` avec les détails
  d'hébergement précisés.
