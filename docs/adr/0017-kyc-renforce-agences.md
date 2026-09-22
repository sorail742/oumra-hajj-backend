# 0017 — Vérification d'identité renforcée (KYC) des agences

- **Statut** : proposé
- **Date** : 2026-09-11

## Contexte

Idée #60 du brainstorm "Cent Fonctionnalités". Aujourd'hui,
`AgenciesService` valide une agence sur la base de documents légaux
uploadés (`AgencyLegalDocument`) et d'une décision manuelle admin
(`validationStatus`) — voir ADR implicite dans `agencies.service.ts`. Un vrai
KYC (Know Your Customer) va plus loin : vérification d'identité du
représentant légal, recoupement avec des bases officielles, détection de
sanctions/listes noires. C'est un nouveau service externe, pas un
renforcement du contrôle déjà en place.

## Décision proposée

- Intégration d'un **prestataire KYC tiers** (à choisir — hors périmètre de
  cet ADR, comme CinetPay l'a été pour l'ADR 0006) déclenchée à l'inscription
  d'une agence, en complément du contrôle documentaire manuel existant, pas
  en remplacement.
- Le résultat du contrôle KYC (score, statut) est une **métadonnée
  supplémentaire** consultée par l'admin avant validation — la décision
  finale reste humaine (`AgenciesService.approve`), jamais une
  automatisation qui validerait ou rejetterait seule une agence.
- Aucune donnée d'identité brute (numéro de pièce, etc.) transmise au
  prestataire ne doit être journalisée en clair côté backend (même principe
  que `docs/secrets-management.md` appliqué aux données personnelles).

## Questions ouvertes

- Le KYC porte-t-il sur l'agence (personne morale) ou sur son représentant
  légal (personne physique), ou les deux ?
- Coût par vérification — modèle à volume (une vérification par nouvelle
  agence, pas récurrent) à confirmer avant de choisir un prestataire.
- Que faire d'une agence déjà validée avant l'introduction du KYC ? Contrôle
  rétroactif ou seulement pour les nouvelles inscriptions ?

## Conséquences

- Débloque #60.
- Renforce indirectement la fiabilité de #56, #59, #61 (conformité
  documentaire, badge qualité) sans les bloquer : ceux-ci fonctionnent déjà
  sans KYC.
