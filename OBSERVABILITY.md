# Observabilité

État réel de ce qui permet de savoir ce que fait l'API en fonctionnement —
logs, métriques, health checks, alerting. Document honnête sur l'existant :
la plateforme est encore en Phase 2 (backend, voir `docs/roadmap.md`), aucun
outil d'observabilité dédié n'a été introduit à ce stade au-delà de ce que
NestJS fournit nativement.

## Ce qui existe aujourd'hui

| Besoin | Mécanisme actuel | Où |
|---|---|---|
| Logs applicatifs | `Logger` NestJS (console, non structuré) | Partout, voir ci-dessous |
| Erreurs 5xx | Loguées avec stack trace | `HttpExceptionFilter` (`src/common/filters/http-exception.filter.ts`) |
| Erreurs 4xx (métier) | Non loguées (attendues, voir `docs/error-codes.md`) | idem |
| Accès aux documents sensibles | Logué (qui, quand, quel document) | `DocumentsService`, logger `DocumentAccess` — voir [ADR 0008](docs/adr/0008-stockage-documents-sensibles.md) |
| Envoi OTP/notifications en dev | Logué au lieu d'envoyé réellement | `ConsoleOtpSender`, `ConsolePushSender`, `ConsoleSmsSender` — voir `integrations.md` |
| Disponibilité du service | `GET /api/v1/health` (public) | `src/modules/health/health.controller.ts` |
| Documentation vivante de l'API | Swagger/OpenAPI, hors production | `/api/docs`, voir `docs/api-versioning.md` |

Il n'y a **aucun** outil tiers d'observabilité intégré (pas d'APM, pas de
tracing distribué, pas d'agrégateur de logs, pas d'alerting) : en ajouter un
est une nouvelle dépendance structurante et nécessite un ADR au préalable
(voir `CLAUDE.md`, `CONTRIBUTING.md`).

## Logs

- Un seul canal : `@nestjs/common` `Logger`, sortie console (stdout/stderr),
  pas de format JSON structuré, pas de niveau configurable par variable
  d'environnement à ce jour.
- Pas d'identifiant de corrélation (request ID / trace ID) propagé entre les
  logs d'une même requête — pour l'instant chaque ligne est indépendante,
  identifiée seulement par le contexte du logger (`Bootstrap`,
  `HttpExceptionFilter`, `DocumentAccess`, `ConsoleOtpSender`, ...).
- Aucune donnée sensible ne doit apparaître dans un log (mot de passe, JWT,
  code OTP en clair côté prod, contenu de document, donnée de paiement) —
  règle absolue, voir `CLAUDE.md` et `docs/secrets-management.md`. Le seul
  cas où un code OTP est logué est le stub `ConsoleOtpSender`, explicitement
  réservé au développement (voir `integrations.md`).
- Pas d'agrégation centralisée (pas d'ELK/Loki/CloudWatch) : en local et en
  CI, les logs vivent dans la sortie du process. À trancher avec le choix
  d'hébergeur ([ADR 0012](docs/adr/0012-ci-cd-environnements.md), proposé —
  voir issue #16 dans `docs/roadmap.md`).

## Health check

`GET /api/v1/health` retourne `{ status: 'ok', timestamp }` — vérifie
uniquement que le process NestJS répond, **pas** que PostgreSQL ou MongoDB
sont joignables. Pas de séparation liveness/readiness. À enrichir (ping
`PrismaService`, éventuellement Mongo tant qu'il coexiste — voir ADR 0013)
avant de s'appuyer dessus pour un déploiement automatisé staging/production.

## Métriques

Aucune métrique applicative exposée aujourd'hui (pas de `/metrics`
Prometheus, pas d'OpenTelemetry). Deux compteurs internes existent mais ne
sont pas exportés :

- Rate limiting (`@nestjs/throttler`, `ThrottlerGuard` global) : compteur en
  mémoire par instance, non partagé — voir `docs/memory-system.md` pour
  l'implication multi-instance (limite réelle = `limite × nombre
  d'instances` tant qu'aucun store partagé, ex. Redis, n'est introduit — ce
  serait une nouvelle dépendance, donc un ADR).
- Couverture de tests (`npm run test:cov`, rapport `cobertura`) : qualité du
  code, pas une métrique runtime — publiée dans les Merge Requests GitLab
  (voir `docs/devops.md`).

## Qualité de code (CI)

`sonarqube-check` tourne à chaque pipeline mais est **non bloquant** tant que
`SONAR_HOST_URL`/`SONAR_TOKEN` ne sont pas renseignés (voir
`docs/devops.md`, issue #16). Pas un outil d'observabilité runtime, mais la
seule forme actuelle de suivi qualité continu du projet.

## Alerting

Aucun canal d'alerte configuré (pas d'intégration Slack/email/PagerDuty sur
erreur ou incident). Une erreur 5xx en production n'est visible aujourd'hui
que dans les logs du process — voir point ouvert ci-dessous.

## Fiabilité de l'envoi asynchrone (notifications)

`NotificationsService.send()` envoie en best-effort (`Promise` non
attendue), sans file d'attente persistante — un envoi en cours au moment
d'un redémarrage peut être silencieusement perdu, sans log d'échec associé
côté observabilité. Voir [ADR 0009](docs/adr/0009-notifications.md), qui
mentionne explicitement qu'une file d'attente doit être prévue avant la mise
en production, et `docs/memory-system.md`.

## Points ouverts

- Choisir un format de log structuré (JSON) et un identifiant de corrélation
  par requête avant la mise en production — nécessaire pour exploiter des
  logs multi-instances une fois un hébergeur choisi (issue #16).
- Décider si un APM/tracing (ex. OpenTelemetry) est nécessaire avant la
  Phase 6 (pilote) — pas de décision prise, pas d'ADR à ce jour.
- Enrichir `GET /api/v1/health` avec une vérification réelle des dépendances
  (Postgres, et Mongo tant qu'il coexiste).
- Définir un canal d'alerte minimal (au moins pour les erreurs 5xx et les
  échecs de paiement) avant la Phase 6 — voir `docs/roadmap.md`, issue #16.
- Confirmer l'[ADR 0012](docs/adr/0012-ci-cd-environnements.md) (CI/CD et
  environnements, `proposé`), qui conditionne une partie de ces choix
  (staging avec logs accessibles, etc.).
