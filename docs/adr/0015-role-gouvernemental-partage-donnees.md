# 0015 — Rôle gouvernemental et partage de données publiques

- **Statut** : proposé
- **Date** : 2026-09-11

## Contexte

Le brainstorm "Cent Fonctionnalités" identifie une vingtaine d'idées côté
État/régulation (registre des agences, statistiques nationales, quota Hadj,
reporting sanitaire agrégé, coordination consulaire, escalade SOS vers
l'ambassade, validation religieuse centralisée...). Toutes partagent le même
préalable non tranché : le système n'a aujourd'hui que 4 rôles (`pilgrim`,
`agency`, `guide`, `admin` — voir `src/common/enums/role.enum.ts`), aucun
n'étant pensé pour un acteur étatique/régulateur.

Contrairement aux ADR 0006/0012/0014 tranchés cette nuit, ceci n'est **pas**
une simple confirmation de fournisseur : c'est l'ouverture d'une nouvelle
catégorie d'acteur avec accès à des données sensibles (santé agrégée,
mouvements financiers agrégés, données de pèlerins en cas de crise), ce qui
touche directement à la protection des données personnelles, pas seulement à
l'architecture technique.

## Décision proposée

- Nouveau rôle `Role.GOVERNMENT`, distinct d'`admin` (l'admin gère la
  plateforme elle-même ; le rôle gouvernemental consulte des données
  produites par la plateforme, avec un périmètre plus restreint et plus
  encadré).
- **Deux niveaux d'accès distincts, jamais mélangés** :
  1. Données **agrégées/anonymisées** (statistiques nationales, reporting
     sanitaire, impact économique, quotas restants) — accessibles sans
     déroger à la vie privée des pèlerins.
  2. Données **nominatives** (registre consulaire en cas de crise,
     coordination SOS) — accès exceptionnel, restreint, journalisé, à
     n'activer que dans un cadre précis (état de crise déclaré, pas un accès
     permanent de consultation).
- Toute consultation de niveau 2 doit être **journalisée de façon
  inaltérable** (qui, quand, quelle donnée, quel motif) — traçabilité
  renforcée par rapport au log applicatif standard déjà en place pour les
  documents (ADR 0008).
- La validation religieuse centralisée (idée #89) est un pouvoir
  supplémentaire de ce rôle, pas un module séparé : il vient s'ajouter au
  mécanisme `RiteSheet.isValidated`/`validatedById` déjà existant, sans le
  remplacer — une agence/admin qualifié reste una alternative tant que
  l'État ne s'en empare pas explicitement pays par pays.

## Questions ouvertes (à trancher avant tout code)

- **Base légale** : quel texte/accord autorise le partage de ces données
  avec l'État ? Sans réponse claire, aucune donnée nominative ne doit être
  exposée, quelle que soit la fonctionnalité demandée.
- **Portée géographique** : un seul "gouvernement" (Guinée) ou plusieurs
  (pays d'origine du pèlerin ET Arabie saoudite pour le quota Hadj) ? Ce
  n'est pas le même périmètre d'accès.
- **Qui provisionne ce rôle ?** Un admin plateforme, ou un processus
  d'agrément distinct (comme la validation d'agence) ?
- **Rétention** : les données nominatives consultées en mode "crise"
  doivent-elles être purgées après un délai, comme la messagerie (ADR 0014) ?

## Conséquences

- Débloque, une fois accepté : #71, #72, #73, #74, #75, #76, #77, #78, #79,
  #80, #81, #82, #83, #84, #85, #86, #87, #88, #90 du brainstorm "Cent
  Fonctionnalités", et la composante centralisation de #89.
- Nécessite très probablement un avis juridique externe avant la phase
  d'implémentation (protection des données personnelles) — pas seulement une
  décision technique interne comme les ADR précédents.
- Nouveau module `government` (ou extension encadrée du module `admin`
  existant) à concevoir une fois les questions ouvertes tranchées.
