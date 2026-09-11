# 0018 — Canal SMS/USSD (mode dégradé sans smartphone)

- **Statut** : proposé
- **Date** : 2026-09-11

## Contexte

Idée #92 du brainstorm "Cent Fonctionnalités" — et rappel direct du cahier
des charges §1.2 : une partie significative des familles restées au pays
n'a "aucun moyen fiable de suivre leur proche". Toute l'architecture
actuelle (REST + Socket.IO pour la messagerie, ADR 0014) suppose un
smartphone avec application installée. Un canal SMS/USSD est un mode
d'interaction fondamentalement différent, pas une adaptation d'écran mobile.

## Décision proposée

- Périmètre volontairement minimal : **pas** le guide des rites, la
  messagerie ou le coffre-fort documents par USSD — uniquement consultation
  de statut (`GET /bookings/:id` simplifié) et notifications critiques
  entrantes (confirmation de paiement, alerte SOS) par SMS, dans les deux
  sens pour un menu USSD basique (consultation, pas de saisie complexe).
- Réutilise le fournisseur SMS déjà retenu (Africa's Talking, ADR 0006)
  plutôt que d'en ajouter un deuxième — Africa's Talking propose aussi un
  service USSD, à vérifier lors du devis déjà recommandé pour l'OTP/SMS de
  secours.
- Nouveau module `ussd` dédié côté backend, avec sa propre couche de
  session courte (un menu USSD est stateless entre chaque requête opérateur,
  contrainte technique différente du REST classique) — ne doit pas
  complexifier les modules existants (`bookings`, `notifications`) pour
  s'adapter à cette contrainte.
- Authentification USSD nécessairement différente de l'OTP app (pas d'écran
  pour afficher un code à copier) — probablement le numéro de téléphone
  suffit comme identifiant si l'opérateur garantit l'authenticité de
  l'appelant (courant en USSD), à confirmer avec le fournisseur retenu.

## Questions ouvertes

- Coût par session USSD (souvent facturé différemment du SMS simple) — à
  chiffrer avant tout engagement.
- Le menu USSD est-il pensé pour le pèlerin (avant/pendant le voyage, sans
  smartphone) ou pour la famille au pays (cas d'usage le plus probable
  d'après le cahier des charges) ? Les deux changent le contenu du menu.

## Conséquences

- Débloque #92, et indirectement renforce #28/#29/#30 (suivi famille) pour
  les foyers sans smartphone.
- Premier canal d'entrée non-HTTP du backend — impact sur l'architecture
  modulaire (ADR 0002) à documenter une fois le fournisseur/protocole exact
  connu.
