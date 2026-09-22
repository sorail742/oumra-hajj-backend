# 0022 — Dons / sadaqa vérifiés vers associations caritatives

- **Statut** : proposé
- **Date** : 2026-09-13

## Contexte

Idée #26 du brainstorm "Cent Fonctionnalités". Aujourd'hui, `PaymentProvider`
et `PaymentsService` ne connaissent qu'un seul flux financier : le paiement
d'un forfait par un pèlerin, toujours rattaché à une `Booking`
(`PaymentInitiationRequest.bookingId` est obligatoire) et destiné, in fine, à
l'agence organisatrice (moins commission plateforme). L'idée #26 propose un
second flux : un don ponctuel du pèlerin vers une association caritative
locale **vérifiée**, indépendant de toute réservation.

Cela introduit deux choses structurantes, pas seulement un nouveau module :

1. Un nouveau **destinataire** des fonds (une association, pas l'agence),
   avec un besoin de vérification/curation analogue à la validation des
   agences (`AgenciesService.approve`) — qui vérifie une association, sur
   quels critères, qui peut en ajouter ?
2. Une question de **mouvement de fonds** : le don atterrit-il sur le compte
   marchand de la plateforme puis un virement manuel/périodique est effectué
   vers l'association (aucune licence ou obligation réglementaire
   supplémentaire, mais délai et processus manuel à définir), ou la
   plateforme agit-elle comme un simple intermédiaire technique qui répartit
   le paiement en temps réel vers un sous-compte de l'association (modèle
   "marketplace" côté agrégateur, à confirmer que CinetPay le permette) ?
   Cette deuxième option a des implications réglementaires (traitement de
   fonds pour compte de tiers) qui dépassent le cadre déjà tranché par
   l'ADR 0006 (accepté), lequel ne couvre que les paiements de forfait.

Conformément à `CLAUDE.md` ("ne pas changer... de fournisseur de
paiement/SMS sans ADR validé" et proposer un ADR avant tout nouveau flux
structurant), ces deux points doivent être tranchés avant implémentation
plutôt que décidés silencieusement dans le code.

## Décision proposée (à valider)

- Nouveau modèle `Charity` (nom, description, référence légale, statut de
  vérification) avec une validation admin explicite, sur le même principe
  que `AgenciesService.approve`/`reject` — jamais de don accepté vers une
  association non vérifiée.
- Nouveau modèle `Donation` (pèlerinId, charityId, montant, devise,
  référence prestataire, statut) — **distinct** de `Payment`
  (`Payment.bookingId` reste obligatoire, on ne le rend pas optionnel pour
  ne pas mélanger deux domaines dans le même modèle).
- Réutilise `PaymentProvider` pour l'encaissement initial (même mécanisme de
  confirmation par callback serveur-à-serveur que l'ADR 0006 — jamais de
  statut de don confirmé uniquement côté client), mais le versement effectif
  vers l'association est **hors périmètre du backend dans une première
  version** (viré manuellement par l'équipe plateforme, `Donation.status`
  passe à `transferred` par une action admin explicite) — évite de trancher
  la question du modèle "marketplace" avant d'avoir confirmé ce que
  l'agrégateur permet réellement.

## Questions ouvertes

- Qui vérifie une association candidate, et sur quelles pièces (statuts,
  agrément, références) ? Processus proche du KYC agence (ADR 0017,
  toujours proposé) — à mutualiser ou à traiter séparément ?
- Le virement vers l'association reste-t-il manuel indéfiniment, ou une
  intégration "marketplace"/split payment est-elle envisagée à terme si
  CinetPay le permet ? Impacte fortement la complexité et peut nécessiter
  un statut réglementaire différent (traitement de fonds pour compte de
  tiers).
- Un reçu fiscal/justificatif de don est-il requis (utile pour le pèlerin,
  variable selon le pays) ?
- Plafond ou limite anti-blanchiment sur le montant d'un don ponctuel ?

## Conséquences

- Débloque #26.
- N'étend ni ne modifie l'ADR 0006 (accepté) : `Payment`/`PaymentProvider`
  restent scopés aux forfaits, `Donation` est un domaine voisin qui
  réutilise le même prestataire d'encaissement sans partager son modèle de
  données.
