# DevOps — CI/CD et environnements

Référence : [ADR 0012](adr/0012-ci-cd-environnements.md) (proposé — voir
point ouvert plus bas).

## Pipeline GitLab CI (`.gitlab-ci.yml`)

Déclenché sur chaque Merge Request et sur les push vers `develop`/`main`.

| Stage | Job | Rôle |
|---|---|---|
| `quality` | `lint` | ESLint strict (`--max-warnings=0`), pas d'auto-fix en CI |
| `test` | `unit-tests` | Jest, couverture (lcov + cobertura) |
| `test` | `e2e-tests` | Jest e2e — voir `testing.md` |
| `build` | `build` | `nest build`, vérifie que le build de prod passe |
| `sonarqube` | `sonarqube-check` | Analyse qualité — non bloquant tant que `SONAR_HOST_URL`/`SONAR_TOKEN` ne sont pas configurés |

Image `node:20`+ (pas `-alpine`) : nécessaire pour le module natif `bcrypt`
(outils de compilation absents des images Alpine).

Le job `e2e-tests` a un service `postgres:` (voir ADR 0013) : `prisma
migrate deploy` applique le schéma avant `npm run test:e2e`.

## Branches protégées

`develop` est protégée sur GitLab : aucun push direct (même Maintainer),
seules les Merge Requests fusionnées par un Maintainer la modifient — voir
`workflow.md`.

## Environnements (ADR 0012, statut `proposé`)

- **Développement** : local, base de données locale (voir `auth-setup.md`,
  `testing.md`).
- **Staging** : déploiement automatique depuis `develop` après CI verte
  (job de déploiement à écrire une fois l'hébergeur choisi).
- **Production** : déploiement manuel/validé depuis `main`, après tag de
  version.

## Points ouverts (voir issues GitLab)

- Choisir l'hébergeur (VPS/cloud) et écrire les jobs de déploiement
  staging/production.
- Provisionner un serveur SonarQube (ou SonarCloud) et renseigner
  `SONAR_HOST_URL`/`SONAR_TOKEN` dans les paramètres CI/CD du projet.
- Confirmer l'ADR 0012 (`proposé` → `accepté`) une fois ces deux points
  tranchés.

## Variables CI/CD

Voir `secrets-management.md` — aucune variable sensible n'est commitée,
tout passe par les paramètres CI/CD GitLab (Settings → CI/CD → Variables),
masquées et protégées.
