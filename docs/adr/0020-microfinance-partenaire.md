# 0020 — Microfinance / crédit pèlerin partenaire

- **Statut** : proposé
- **Date** : 2026-09-11

## Contexte

Idée #98 du brainstorm "Cent Fonctionnalités" : proposer un crédit encadré
plutôt que de laisser un pèlerin s'endetter de façon informelle pour
financer son voyage. C'est le point du brainstorm au risque le plus élevé :
le crédit à la consommation est une activité très réglementée, et une
mauvaise mise en œuvre peut directement nuire aux pèlerins qu'elle est
censée aider (surendettement facilité au lieu d'évité).

## Décision proposée

- La plateforme **ne devient pas prêteur** : simple mise en relation avec un
  établissement de microfinance déjà agréé, jamais d'octroi de crédit "par"
  cette application.
- Le rôle du backend se limite à : afficher l'offre du partenaire dans le
  simulateur de budget (idée #02), transmettre une demande de mise en
  relation avec le consentement explicite du pèlerin — jamais transmettre
  automatiquement des données financières du pèlerin (paiements déjà
  effectués, échéancier) sans action explicite de sa part à chaque fois.
- Message obligatoire et visible avant toute mise en relation : rappel que
  le crédit engage le pèlerin indépendamment de la plateforme, dans l'esprit
  du principe "sobriété et confiance" déjà retenu pour tout le produit.

## Questions ouvertes

- Partenaire microfinance à identifier — nécessite très probablement un avis
  juridique avant tout engagement, plus encore que pour l'assurance
  (ADR 0019).
- Certains encadrements interdisent purement et simplement ce type de mise
  en relation pour du crédit à la consommation lié à un usage non
  productif — à vérifier avant de considérer cette idée comme réalisable en
  l'état.

## Conséquences

- Idée à considérer comme la moins prioritaire du brainstorm tant qu'un avis
  juridique n'a pas confirmé la faisabilité même du principe — contrairement
  aux autres ADR de ce lot, l'obstacle n'est pas seulement technique.
