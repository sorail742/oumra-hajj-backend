# Comparatif hébergement & environnements

Document de synthèse pour aider à trancher l'**issue #16** (`docs/roadmap.md`)
et l'[ADR 0012](adr/0012-ci-cd-environnements.md) (statut `proposé`). Ce
n'est **pas** une décision : l'ADR 0012 reste `proposé` tant que l'utilisateur
n'a pas confirmé un choix d'hébergeur (voir `CONTRIBUTING.md` pour la
procédure `proposé` → `accepté`).

**Avertissement** : tarifs et fonctionnalités ci-dessous viennent d'une
recherche web (septembre 2026) et évoluent vite — à revérifier directement
sur les sites des fournisseurs avant tout engagement. Aucun identifiant réel
n'est utilisé dans ce document (voir `docs/secrets-management.md`).

## Rappel important — ce que le service `postgres:` de la CI ne fait pas

Le job `e2e-tests` du pipeline actuel (`.gitlab-ci.yml`) démarre un service
`postgres:16-alpine` **éphémère**, détruit à la fin du job — il sert
uniquement aux tests, pas à un environnement staging/production (voir
[ADR 0013](adr/0013-migration-postgresql-prisma.md), `docs/testing.md`).
Quel que soit l'hébergeur retenu ci-dessous, il faudra **en plus** une
instance PostgreSQL persistante par environnement (staging, production) —
ce n'est pas un point de comparaison entre options, c'est un besoin commun
à toutes.

## 1. PaaS managés (déploiement le plus rapide)

| Fournisseur | Coût indicatif (API + Postgres) | Postgres managé | Déploiement depuis GitLab | Avantages | Inconvénients |
|---|---|---|---|---|---|
| **Railway** | Hobby dès 5 USD/mois + usage à la consommation | Oui, provisionné en un clic (string de connexion générée) | Pas d'intégration GitLab native "one-click" — déploiement via CLI (`railway up`) dans un job `.gitlab-ci.yml` dédié | Mise en route très rapide, excellente expérience développeur, DB incluse | Facturation à l'usage moins prévisible ; pas de datacenter connu en Europe/Afrique à confirmer |
| **Render** | ~7-25 USD/mois (web service) + ~7-20 USD/mois (Postgres managé) = ~20-50 USD/mois pour un setup basique | Oui, managé, facturé séparément | Déploiement Git natif (GitHub/GitLab) ou via "deploy hook" appelé depuis un job CI | Prix fixes prévisibles, workflow simple façon Heroku, région Frankfurt disponible (Europe) | Plus cher que Railway/Fly.io à volume égal ; moins de contrôle infra fin |
| **Fly.io** | Paiement à la seconde, VM partagée dès <2 USD/mois, Postgres auto-hébergé sur leur infra (Fly Postgres) demande plus de configuration | Oui mais configuration manuelle (pas un vrai "managé" clé en main) | CLI (`flyctl deploy`) dans un job GitLab CI, régions multiples dont Paris (`cdg`) | Facturation la plus fine, présence multi-région dont Europe (Paris — pertinent pour la latence vers l'Afrique de l'Ouest, à mesurer) | Plus de configuration manuelle que Railway/Render, plus orienté équipes à l'aise avec l'infra |

## 2. Cloud européen géré (Scaleway, OVHcloud)

| Fournisseur | Coût indicatif | Détail | Avantages | Inconvénients |
|---|---|---|---|---|
| **Scaleway** (Managed PostgreSQL) | DEV-S (1 vCPU/2 Go/10 Go) ~11 €/mois ; PRO2-XXS (2 vCPU/8 Go) ~80 €/mois (non-HA) / ~123 €/mois (HA) | Datacenters Paris, Amsterdam, Varsovie | Facturation en euros, société française, conformité RGPD par défaut, bon candidat pour la latence France/Afrique francophone (à mesurer, pas de datacenter africain confirmé) | Pas de "one-click deploy" comme Railway/Render — nécessite de gérer l'API (instance VM ou conteneur) séparément de la base |
| **OVHcloud** (Managed PostgreSQL) | ~51 USD/mois pour 2 vCPU/4 Go/80 Go | Datacenters France (Gravelines, Roubaix, Strasbourg) et international | Acteur français déjà connu dans la sous-région francophone, support en français, gamme VPS très large en complément | Tarif Managed PostgreSQL plus élevé que Scaleway à specs comparables sur cette recherche — à confirmer par devis |

Ces deux fournisseurs nécessitent d'écrire soi-même le job de déploiement
GitLab CI (ex. build d'une image Docker, push vers un registre, puis
déploiement sur une instance/conteneur via SSH ou API) — plus de travail
initial qu'un PaaS, mais aucun verrou fournisseur fort et un contrôle total
sur l'infrastructure.

## 3. VPS classique (le moins cher, le plus manuel)

Un simple VPS (OVH, Scaleway Instances, ou autre) avec Docker Compose
(API NestJS + PostgreSQL + reverse proxy Nginx/Caddy pour TLS) reste
l'option la moins chère en coût brut (souvent 5-15 €/mois pour une
petite instance), mais reporte entièrement sur l'équipe : mise à jour de
sécurité de l'OS, sauvegardes de la base, monitoring, TLS — tout ce que
`OBSERVABILITY.md` liste déjà comme absent aujourd'hui (pas de health check
réel, pas d'alerting) devient plus critique à couvrir avant la Phase 6
(pilote) si ce choix est retenu. Déploiement via un job GitLab CI qui se
connecte en SSH (clé privée en variable CI masquée, voir
`docs/secrets-management.md`) pour `docker compose pull && up -d`.

## 4. SonarQube — self-hosted vs Cloud

| Option | Coût | Limite |
|---|---|---|
| **SonarQube Community Build** (self-hosted, gratuit) | Gratuit, mais nécessite d'héberger le serveur soi-même (VM ou conteneur en plus) | Pas d'analyse par branche, pas de décoration de Merge Request, fonctionnalités de sécurité avancées absentes |
| **SonarQube Cloud** (ex-SonarCloud) | Gratuit jusqu'à 50k lignes de code, puis ~30 €/mois (plan Team) | Intégration native GitLab CI/CD, aucun serveur à gérer — le plus simple à mettre en route pour la taille actuelle du projet |

Pour la taille actuelle du backend (12 modules, largement sous 50k lignes de
code), **SonarQube Cloud** évite d'ajouter un serveur de plus à
provisionner/maintenir, contrairement au self-hosted qui cumule avec le
choix d'hébergeur ci-dessus. Point à confirmer une fois le volume de code
connu précisément (`sonar-project.properties` existe déjà dans le dépôt).

## 5. Tableau de synthèse

| Critère | Railway/Render/Fly.io (PaaS) | Scaleway/OVH (cloud géré) | VPS classique |
|---|---|---|---|
| Rapidité de mise en route | Très rapide | Moyenne (job CI à écrire) | Lente (tout à configurer) |
| Coût mensuel indicatif (API + DB, petit volume) | ~10-50 USD | ~30-130 € | ~10-20 € |
| Charge opérationnelle | Faible | Moyenne | Élevée (patchs, sauvegardes, monitoring) |
| Intégration GitLab CI existante | Via CLI dans un job dédié | Via Docker + SSH/API dans un job dédié | Via SSH dans un job dédié |
| Pertinence pour un pilote (Phase 6, une agence) | Bonne — coût et effort minimal pour démarrer | Bonne — si préférence pour un acteur français/européen | Risquée sans renforcer d'abord l'observabilité (`OBSERVABILITY.md`) |

## 6. Pour la discussion (non contraignant)

Sans trancher à la place de l'utilisateur : pour la Phase 6 (pilote, une
agence, volumétrie faible), un PaaS managé (Render ou Railway) minimiserait
le temps d'intégration et éviterait d'opérer soi-même Postgres pendant que
l'équipe est encore en train de finir la migration Prisma
([ADR 0013](adr/0013-migration-postgresql-prisma.md)) — le passage à
Scaleway/OVH ou à un VPS resterait possible plus tard si le coût à l'échelle
ou la résidence des données en devient un critère fort. Pour SonarQube,
SonarQube Cloud évite un serveur supplémentaire tant que le volume de code
reste sous le seuil gratuit. Décision finale et passage de l'ADR 0012 à
`accepté` à faire par l'utilisateur, suivant `CONTRIBUTING.md`.

## Sources

- [Railway vs Fly.io (2026) — Render](https://render.com/articles/railway-vs-fly-io)
- [Render vs Railway vs Fly.io: Pricing Compared (2026)](https://dev.to/pavel-hostim/render-vs-railway-vs-flyio-pricing-compared-2026-2e5p)
- [Railway vs Render vs Fly.io: Benchmarks & Pricing (2026)](https://techsy.io/en/blog/railway-vs-render-vs-fly-io)
- [Scaleway Managed PostgreSQL Pricing 2026](https://hoststack.dev/blog/scaleway-postgresql-pricing-2026)
- [Managed PostgreSQL Europe 2026 : buyer's guide](https://hoststack.dev/blog/managed-postgresql-europe-buyers-guide)
- [OVH vs Scaleway: Pricing & Features Compared (2026)](https://getdeploying.com/ovh-vs-scaleway)
- [SonarQube Pricing in 2026 — DEV Community](https://dev.to/rahulxsingh/sonarqube-pricing-in-2026-community-developer-enterprise-and-cloud-costs-explained-bdg)
- [SonarQube vs SonarCloud: Self-Hosted vs Cloud (2026)](https://dev.to/rahulxsingh/sonarqube-vs-sonarcloud-self-hosted-vs-cloud-code-quality-2026-dkj)
- [Railway vs Render vs Your Own Cloud Account — Qovery](https://www.qovery.com/blog/railway-render-or-own-cloud-account-scaleup-decision-guide)
