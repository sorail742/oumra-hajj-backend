# 0001 — Choix de la stack technique globale

- **Statut** : accepté
- **Date** : 2026-09-02
- **Décideurs** : Sory KEITA (dev)

## Contexte

Le projet "Plateforme Oumra & Hadj" nécessite : un back-office web (agences, admin),
une API centrale, et une application mobile pèlerin/guide capable de fonctionner
hors-ligne (rites, compteur Tawaf/Sa'i, documents) dans des zones à connectivité
faible ou saturée (La Mecque en période d'affluence).

## Décision

- **Backend** : NestJS (TypeScript) — architecture modulaire, DI native, écosystème
  mature pour REST + validation + guards d'authentification.
- **Frontend web** (agence / admin) : React + TypeScript (Vite), cohérent avec les
  autres projets de la structure (Abeilly, BCA Connect, Projekta).
- **Application mobile** (pèlerin, guide) : conservée en Flutter/Dart, car le besoin
  de fonctionnement hors-ligne robuste et de performance sur bas de gamme Android
  reste mieux couvert par Flutter que par une stack web embarquée. Elle communique
  avec la même API NestJS.
- **Base de données** : MongoDB + Mongoose, cohérent avec la stack habituelle
  (Node.js/Mongoose/MongoDB) et adapté à des documents hétérogènes (dossiers
  pèlerins, contenu religieux versionné).
- **Langage unique côté serveur/web** : TypeScript strict sur backend et frontend
  web, pour partager les types (DTO, interfaces) via un package partagé si besoin.

## Conséquences

- Deux langages au total sur le projet (TypeScript pour backend+web, Dart pour le
  mobile) au lieu d'un seul — accepté car le mobile a des contraintes hors-ligne
  spécifiques que Flutter couvre mieux.
- Nécessite de maintenir une définition de contrat d'API claire (DTO NestJS +
  documentation OpenAPI) pour que le mobile Flutter et le web React restent
  synchronisés avec le backend.
- Toute évolution majeure de ce choix (ex. passage à Postgres/Prisma, à Next.js,
  ou à React Native) doit faire l'objet d'un nouvel ADR qui remplace celui-ci.

## Note (2026-09-03)

Le volet base de données de ce choix (MongoDB/Mongoose) a été remplacé par
[0013 — Migration vers PostgreSQL/Prisma](0013-migration-postgresql-prisma.md).
Les autres éléments de cette décision (NestJS, React/Vite, Flutter,
TypeScript strict partagé) restent en vigueur — voir [0004](0004-base-de-donnees-orm.md),
marqué `remplacé`, pour le détail historique du choix initial.
