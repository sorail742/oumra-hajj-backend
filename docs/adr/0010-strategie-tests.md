# 0010 — Stratégie de tests

- **Statut** : accepté
- **Date** : 2026-09-02

## Contexte

Le projet touche à des données sensibles (documents, paiements) et à des
fonctionnalités critiques (SOS, compteur de rites) : les régressions doivent
être détectées tôt.

## Décision

- **Backend (NestJS)** : Jest pour les tests unitaires (`*.service.spec.ts`) et
  tests d'intégration (`*.controller.spec.ts`), + tests e2e (`test/*.e2e-spec.ts`)
  sur les parcours critiques (inscription, paiement, réservation).
- **Frontend web (React)** : Vitest + React Testing Library pour les composants
  et hooks critiques (formulaires de paiement, tableaux de bord agence).
- **Mobile (Flutter)** : tests unitaires Dart sur la logique du compteur
  Tawaf/Sa'i et de la synchronisation hors-ligne (ADR 0007), qui sont les
  zones à plus haut risque de bug silencieux.
- Un seuil de couverture minimal (à définir précisément en phase 2, ex. 70 %
  sur les modules `payments`, `bookings`, `documents`) est vérifié en CI.
- Toute correction de bug critique (paiement, sécurité, données pèlerin)
  s'accompagne d'un test de non-régression avant merge.

## Conséquences

- Ralentit légèrement le rythme de livraison à court terme, mais réduit le
  risque sur les zones sensibles (argent, documents d'identité, sécurité
  physique via le SOS).
