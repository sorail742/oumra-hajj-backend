# 0019 — Assurance voyage intégrée au tunnel de réservation

- **Statut** : proposé
- **Date** : 2026-09-11

## Contexte

Idée #09 du brainstorm "Cent Fonctionnalités". Proposer une assurance
(santé, bagages, annulation) au moment de la réservation implique de vendre
— ou de faire vendre par un tiers via la plateforme — un produit
réglementé. Ce n'est pas comparable à un fournisseur de paiement ou de SMS :
l'assurance est une activité encadrée légalement dans la plupart des
juridictions.

## Décision proposée

- La plateforme **ne devient pas assureur** : elle intègre un partenaire
  assureur existant (courtier ou compagnie déjà agréée), via un flux de
  souscription qui redirige ou embarque son propre parcours réglementaire —
  jamais une police "maison" fabriquée par ce backend.
- Le paiement de la prime suit le même modèle que le forfait (Mobile
  Money/carte via `PaymentProvider`, ADR 0006) mais reste une transaction
  **séparée**, avec sa propre `providerReference` — ne jamais mélanger le
  montant de l'assurance dans le prix du forfait (traçabilité comptable,
  et l'assurance peut être annulée indépendamment du forfait).
- Aucune donnée médicale du pèlerin liée à l'assurance n'est stockée dans ce
  backend au-delà de ce qui est déjà prévu (voir ADR 0008 pour le principe
  général) — le dossier médical de souscription reste chez l'assureur.

## Questions ouvertes

- Partenaire assureur à identifier (marché guinéen/régional) — hors périmètre
  technique de cet ADR.
- Simple lien d'affiliation (commission à la vente, zéro intégration
  technique) ou véritable API de souscription in-app ? Le premier est
  livrable rapidement sans nouveau module ; le second justifie un module
  `insurance` dédié.

## Conséquences

- Débloque #09.
- Si le partenaire propose une vraie API : nouveau module `insurance` avec
  son propre `InsuranceProvider` (même pattern que `PaymentProvider`,
  `StorageProvider`) — sinon, simple lien externe depuis l'écran de
  paiement, sans module backend supplémentaire.
