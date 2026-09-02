# 0002 — Architecture modulaire du backend NestJS

- **Statut** : accepté
- **Date** : 2026-09-02

## Contexte

Le backend doit couvrir des domaines métier distincts (utilisateurs, agences,
forfaits, réservations, paiements, documents, rites, notifications, groupes/guides).
Il faut une organisation qui reste lisible à mesure que le projet grossit et qui
facilite le travail à plusieurs développeurs.

## Décision

Un module NestJS par domaine métier, sous `src/modules/<domaine>/`, chacun avec :

```
src/modules/<domaine>/
  <domaine>.module.ts
  <domaine>.controller.ts
  <domaine>.service.ts
  dto/
  schemas/        (schémas Mongoose)
  <domaine>.controller.spec.ts
  <domaine>.service.spec.ts
```

Modules prévus dès le départ : `auth`, `users`, `agencies`, `packages`,
`bookings`, `payments`, `documents`, `rites`, `groups`, `notifications`,
`reviews`, `admin`.

Un module `common/` (ou `shared/`) centralise : guards, interceptors, décorateurs
custom, pipes de validation, filtres d'exception globaux.

Un module `health/` expose l'endpoint de santé (cohérent avec la convention déjà
utilisée sur SmartSMS).

## Conséquences

- Chaque module est testable et remplaçable indépendamment.
- Les imports circulaires entre modules doivent être évités — toute dépendance
  transverse passe par un service exporté explicitement dans le `module.ts`.
- Un nouveau domaine métier = un nouveau module, jamais un contrôleur ajouté à un
  module existant qui ne le concerne pas.
