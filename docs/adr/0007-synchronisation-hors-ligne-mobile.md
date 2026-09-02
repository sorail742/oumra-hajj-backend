# 0007 — Synchronisation hors-ligne de l'application mobile

- **Statut** : accepté
- **Date** : 2026-09-02

## Contexte

Le guide des rites, le compteur Tawaf/Sa'i, les Duas et les documents doivent
rester utilisables sans réseau, notamment à La Mecque en période de forte
affluence où le réseau mobile est souvent saturé.

## Décision

- Stockage local sur l'app Flutter (Hive ou SQLite) pour : contenu du guide des
  rites, Duas, documents déjà téléchargés, état courant du compteur Tawaf/Sa'i.
- Le contenu "statique" (guide des rites, Duas, cartes) est téléchargé en cache
  dès l'inscription/premier lancement, avant le départ, pas pendant le voyage.
- Les actions faites hors-ligne (incrément du compteur, cochage d'une étape du
  guide) sont mises en file locale et synchronisées dès que le réseau revient
  (stratégie "local-first, sync-later"), avec horodatage côté client pour
  résoudre les conflits simples.
- Le partage de position GPS et le bouton SOS nécessitent une connexion — en
  cas d'absence de réseau, le SOS déclenche un SMS de secours si disponible.

## Conséquences

- L'API backend doit exposer des endpoints de synchronisation par lot (batch)
  plutôt qu'un appel par action, pour limiter les échanges quand le réseau
  revient de façon intermittente.
- Le contenu religieux mis en cache doit être versionné (voir gestion de
  contenu côté `rites`) pour permettre une mise à jour propre sans perdre la
  progression du pèlerin.
