# 0023 — Hébergement : Neon (PostgreSQL), Render (API), Vercel (web)

- **Statut** : accepté
- **Date** : 2026-10-01
- **Décideurs** : Sory KEITA
- **Impacte** : [0012 — CI/CD et environnements](0012-ci-cd-environnements.md) (accepté), qui prévoyait Render **y compris** pour l'instance PostgreSQL persistante

## Contexte

L'ADR 0012 retient Render comme hébergeur, avec « Postgres managé inclus ».
Pour mettre en ligne un premier environnement de démonstration, le porteur
du projet a demandé explicitement (2026-10-01) la combinaison Neon + Render
+ Vercel, déjà utilisée sur ses autres projets (comptes existants).

## Décision

| Brique | Hébergeur | Détail |
|---|---|---|
| PostgreSQL | **Neon** (remplace « Postgres managé Render » de l'ADR 0012) | projet `oumra-hadj`, région `aws-eu-central-1` (Francfort), offre gratuite |
| API NestJS | **Render** (inchangé, ADR 0012) | service web `oumra-hadj-api`, région Francfort, offre gratuite |
| Web Next.js (`oumra-hadj-web`) | **Vercel** | fonctions en `fra1` ; `BACKEND_URL` variable serveur (ADR-0002 du dépôt web) |

- Les trois briques sont dans la même région (Francfort) pour limiter la
  latence base ↔ API ↔ web.
- Les migrations Prisma sont appliquées au build Render
  (`npx prisma migrate deploy`) : l'offre gratuite de Render n'a pas de
  commande de pré-déploiement.
- Secrets (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`)
  uniquement dans les variables d'environnement des hébergeurs, jamais dans
  le dépôt.

## Conséquences

- **Environnement de démonstration, pas de production.** Tant que les
  intégrations réelles ne sont pas branchées, l'API tourne avec :
  `MockPaymentProvider` (aucun paiement réel), envoi OTP/SMS/push par
  journalisation (codes OTP visibles dans les logs Render),
  `LocalDiskStorageProvider` (le disque d'une instance Render gratuite est
  éphémère : **les documents déposés sont perdus à chaque redéploiement**).
  Aucune donnée réelle de pèlerin ne doit y être saisie.
- Offres gratuites : l'API Render s'endort après inactivité (premier appel
  lent), Neon suspend le calcul au repos.
- Le passage en production demandera : stockage objet chiffré (ADR 0008),
  fournisseurs réels (ADR 0006/0009), offres payantes ou équivalent, et un
  ADR de suivi si l'un de ces choix change.
