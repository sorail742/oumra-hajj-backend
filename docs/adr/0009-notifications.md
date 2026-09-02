# 0009 — Notifications (push et SMS de secours)

- **Statut** : accepté
- **Date** : 2026-09-02

## Contexte

Les pèlerins doivent être alertés d'étapes de dossier, de rappels de rites, et
surtout d'alertes critiques (SOS, changement d'horaire). La connectivité étant
parfois faible, une notification push seule n'est pas toujours fiable.

## Décision

- Notifications push via Firebase Cloud Messaging (FCM) pour l'app mobile.
- Pour les alertes classées "critiques" (SOS reçu par le guide, dossier
  bloqué, changement de dernière minute), un SMS de secours est envoyé en
  parallèle si le push n'est pas confirmé délivré dans un court délai.
- Un module `notifications` centralise l'envoi, avec une file d'attente
  (queue) pour ne pas bloquer les requêtes API le temps de l'envoi effectif.

## Conséquences

- Nécessite un provider SMS (à mutualiser si possible avec le provider OTP de
  l'ADR 0003, pour limiter le nombre d'intégrations tierces).
- Le coût SMS doit être suivi (budget) car il s'agit d'un canal de secours,
  pas du canal principal.
