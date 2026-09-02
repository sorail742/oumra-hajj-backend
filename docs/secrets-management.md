# Gestion des secrets

## Règle absolue

Aucun secret réel (mot de passe, clé API, token, chaîne de connexion avec
identifiants) ne doit jamais apparaître dans : un commit, un message de
commit, un fichier du dépôt, un exemple de code, un log applicatif, une
conversation avec un outil externe (voir `CLAUDE.md`).

## Où vivent les secrets

| Environnement | Où |
|---|---|
| Local (développement) | `.env` (jamais commité — voir `.gitignore`), copié depuis `.env.example` qui ne contient que des placeholders |
| CI (GitLab) | Settings → CI/CD → Variables, marquées **masquées** et **protégées** (visibles seulement sur les branches/tags protégés) |
| Staging/Production | Variables d'environnement de l'hébergeur (à préciser une fois choisi — voir `devops.md`) |

## Secrets actuellement utilisés

| Secret | Variable | Rotation en cas de fuite |
|---|---|---|
| Secret JWT access | `JWT_ACCESS_SECRET` | Régénérer immédiatement — invalide tous les access tokens en circulation (courte durée de vie, impact limité) |
| Secret JWT refresh | `JWT_REFRESH_SECRET` | Régénérer immédiatement — invalide toutes les sessions actives, tous les utilisateurs doivent se reconnecter |
| Identifiants base de données | `DATABASE_URL` (Prisma) | Régénérer le mot de passe côté PostgreSQL, mettre à jour partout |
| Token SonarQube | `SONAR_TOKEN` (variable CI) | Révoquer et régénérer côté SonarQube/SonarCloud |
| Token GitLab (Personal Access Token) | — (jamais dans le dépôt) | Révoquer immédiatement dans GitLab → Edit profile → Access Tokens dès qu'il n'est plus nécessaire, **surtout s'il a été partagé en clair** (ex. collé dans un chat, un outil, un ticket) |

## Si un secret a fuité

1. Le révoquer/régénérer immédiatement à la source (ne pas attendre).
2. Si le secret était un token d'accès (GitLab, provider tiers), vérifier
   l'historique d'activité du compte pour toute action non désirée.
3. Ne **jamais** essayer de "nettoyer" un secret déjà poussé en le
   supprimant dans un commit suivant — il reste dans l'historique Git. La
   seule remédiation fiable est la rotation du secret lui-même.
4. Documenter l'incident brièvement (sans reproduire le secret) si ça a un
   impact sur d'autres personnes de l'équipe.

## Fournisseurs tiers (à venir)

Les clés des futurs fournisseurs (Mobile Money, SMS/OTP, FCM — voir ADR 0006
et 0009, non tranchés) suivront la même règle : jamais commitées, toujours
via variables d'environnement/CI, une valeur par environnement.
