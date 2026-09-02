# 0006 — Gestion des paiements (Mobile Money & carte)

- **Statut** : proposé
- **Date** : 2026-09-02

## Contexte

Les pèlerins paient leur forfait en plusieurs tranches, via Mobile Money (Orange
Money, MTN Money) principalement, et via carte bancaire pour la diaspora. Les
paiements doivent être fiables (traçabilité, réconciliation agence) et sécurisés
(aucune donnée de carte en clair côté serveur).

## Décision

- Module `payments` dédié, indépendant du module `bookings` (une réservation a
  plusieurs paiements, mais le module paiement ne connaît pas la logique métier
  du dossier pèlerin).
- Intégration via des providers externes (agrégateur Mobile Money local +
  passerelle carte type Stripe/PayPal ou équivalent régional) déclenchée par
  webhook : le statut d'un paiement n'est jamais mis à jour uniquement côté
  client, toujours confirmé par un callback serveur-à-serveur.
- Aucune donnée de carte bancaire n'est stockée en base ; seule la référence de
  transaction du prestataire est conservée.
- Chaque paiement génère un reçu (PDF ou enregistrement structuré) horodaté.

## Conséquences

- Nécessite un compte marchand / API key par provider Mobile Money, à obtenir
  avant la phase 5 du plan de développement (intégrations & tests).
- Le choix précis du ou des agrégateurs Mobile Money reste à confirmer — ce
  point devra être re-statué (ADR passant de "proposé" à "accepté") une fois le
  ou les partenaires choisis.
