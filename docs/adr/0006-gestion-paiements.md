# 0006 — Gestion des paiements (Mobile Money & carte)

- **Statut** : accepté
- **Date** : 2026-09-02
- **Décideurs** : Sory KEITA

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

- Nécessite un compte marchand / API key par provider, à obtenir avant la
  phase 5 du plan de développement (intégrations & tests).

## Validation

Confirmé le 2026-09-09 par Sory KEITA :

- **Mobile Money** : CinetPay (agrégateur) — une seule intégration pour
  Orange Money, MTN et carte, plutôt que deux intégrations directes séparées.
  Présence confirmée en Guinée. Commission d'agrégateur acceptée en échange
  d'une seule API à maintenir.
- **SMS/OTP + SMS de secours** (mutualisés, voir [ADR 0009](0009-notifications.md)) :
  Africa's Talking — acteur focalisé Afrique, Guinée listée parmi les marchés
  couverts. Tarif exact non confirmé par la recherche initiale
  (`docs/fournisseurs-paiement-notifications.md`) : à obtenir par devis direct
  avant intégration, sans remettre en cause le choix de fournisseur.
- Notifications push : FCM déjà accepté sans changement (ADR 0009).
- Implémentation à suivre comme étape à part entière de `docs/roadmap.md`
  (module `payments` déjà écrit pour ce modèle quel que soit le fournisseur —
  reste à brancher les clés réelles via variables d'environnement, jamais
  commitées, voir `docs/secrets-management.md`).
