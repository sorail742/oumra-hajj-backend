# Brouillon — Politique de dépréciation de l'API

**Statut de ce document : proposition, pas une décision.** Répond au point
ouvert de `docs/roadmap.md` ("Politique de dépréciation API — non encore
formalisée") et au point que l'[ADR 0005](adr/0005-versionnement-api.md)
(accepté) anticipait déjà lui-même dans ses conséquences : "impose une
politique de dépréciation claire [...] à documenter [...] ou un futur ADR
dédié si la politique se précise."

Ce document **ne modifie pas** l'ADR 0005 — un ADR accepté n'est jamais
réécrit (voir `docs/adr/README.md`, ADR 0011). Si cette proposition est
validée par l'utilisateur, la suite logique est un **nouvel ADR proposé**
(ex. `0014-politique-depreciation-api.md`) qui complète l'ADR 0005 sans le
remplacer — ce document ne crée pas cet ADR, c'est une matière première pour
l'utilisateur, à formaliser lui-même une fois tranché (voir
`CONTRIBUTING.md`).

À trancher avant que l'app mobile Flutter (Phase 3, voir `docs/roadmap.md`)
ne dépende de l'API en production — une fois publiée en boutique, une
version mobile ne se met pas à jour au rythme du backend.

## Pourquoi ce point est plus sensible ici qu'ailleurs

Contrairement à une API interne classique, deux contraintes du cahier des
charges pèsent directement sur la durée de support à choisir :

- **Connectivité faible** (§5.1) : un pèlerin peut ne pas avoir l'occasion
  de mettre à jour l'application avant ou pendant son voyage.
- **Usage saisonnier** (§1.1) : la Oumra se pratique toute l'année mais le
  Hadj est concentré sur une période annuelle précise — un pèlerin peut
  installer l'application des mois avant son départ et ne plus la rouvrir
  (donc ne pas la mettre à jour) jusqu'au voyage lui-même.

Une politique calquée sur un cycle de dépréciation SaaS classique (quelques
semaines à 2-3 mois) risquerait de couper l'accès à des pèlerins en plein
voyage. La proposition ci-dessous part de ce constat.

## 1. Durée de support minimale proposée

**Proposition : 12 mois minimum entre la publication d'une nouvelle version
(`/api/v{N+1}`) et le retrait effectif de la version précédente**, avec deux
garde-fous supplémentaires plutôt qu'une durée fixe seule :

- Ne jamais retirer une version pendant la période de haute activité du Hadj
  (quelques semaines autour du pèlerinage annuel) ni dans le mois qui suit,
  même si les 12 mois sont écoulés — décaler le retrait à une période
  creuse.
- Le retrait effectif suppose aussi une vérification qu'il n'y a plus (ou
  quasi plus) de trafic mesuré sur l'ancienne version — **actuellement
  impossible à vérifier** : il n'existe aucune métrique d'usage par version
  d'API (voir `OBSERVABILITY.md`, section Métriques). Tant que ce point n'est
  pas comblé, le retrait devrait rester une décision manuelle prudente plutôt
  qu'automatisée sur la seule base d'une date.

12 mois est un point de départ pour la discussion, pas un chiffre validé —
à ajuster selon le rythme réel de mise à jour observé une fois l'app mobile
en production.

## 2. Format de communication d'une dépréciation

Combiner plusieurs canaux, du plus technique au plus humain :

| Canal | Usage proposé |
|---|---|
| **En-têtes HTTP de réponse** | Sur chaque réponse de l'endpoint/version dépréciée : `Deprecation: <date ISO 8601 depuis laquelle c'est déprécié>` et `Sunset: <date ISO 8601 de retrait prévu>` (`Sunset` est un en-tête HTTP standard, RFC 8594 ; `Deprecation` reprend une convention déjà répandue côté API — ex. GitHub, Stripe — même si pas encore un RFC finalisé à vérifier). Un `Link: <docs/api-versioning.md>; rel="deprecation"` peut pointer vers la doc de migration. |
| **Swagger/OpenAPI** | Marquer l'endpoint `deprecated: true` (`@ApiOperation({ deprecated: true })`, supporté nativement par `@nestjs/swagger`, déjà utilisé dans le projet) — visible directement dans `/api/docs`. |
| **`CHANGELOG.md`** | Nouvelle entrée sous une section `### Déprécié`, avec la version concernée, la date de dépréciation et la date de retrait prévue — voir `CHANGELOG.md` (déjà en place dans ce dépôt). |
| **`docs/api-versioning.md`** | Tenir une table des versions actives/dépréciées avec leurs dates, en complément du contenu déjà présent sur "quand créer une v2". |
| **Notification directe aux équipes consommatrices** | Tant que web et mobile sont développés par des équipes internes (pas de partenaire tiers consommant l'API à ce stade), un message direct (canal à définir par l'utilisateur — ticket GitLab dédié a minima) reste plus fiable qu'un simple header HTTP pour déclencher le travail de migration côté mobile/web. |

## 3. Ce qui compte comme "breaking change" (précision de l'ADR 0005 / `api-versioning.md`)

`docs/api-versioning.md` liste déjà : suppression/renommage d'un champ de
réponse, changement de type/sémantique d'un champ, paramètre optionnel
devenu obligatoire, changement de code de statut HTTP attendu. Deux cas non
couverts explicitement aujourd'hui, à ajouter à cette liste :

- **Suppression complète d'un endpoint** — évident mais absent de la liste
  actuelle, à formaliser explicitement.
- **Changement de comportement métier sans changement de forme** — ex. une
  règle de validation qui devient plus stricte et fait échouer des requêtes
  qui passaient avant, sans qu'aucun champ n'ait changé de nom ou de type.
  C'est un breaking change au sens fonctionnel même si `docs/api-versioning.md`
  ne le couvre aujourd'hui que sous l'angle du contrat de champs.
- **Changement transverse au format d'erreur global** (`HttpExceptionFilter`,
  voir `docs/error-codes.md`) — un changement de ce format toucherait tous
  les endpoints à la fois, pas un seul ; ce cas mériterait sa propre règle de
  compatibilité plutôt que d'être traité comme un breaking change "par
  endpoint" comme le reste — point à trancher séparément si le format
  d'erreur doit un jour évoluer.

## 4. Processus proposé, étape par étape

1. La dépréciation d'un endpoint ou d'une version est décidée et documentée
   dans la Merge Request qui introduit son remplacement (`/api/v{N+1}`) —
   pas besoin d'un ADR par dépréciation individuelle, l'ADR 0005 (complété
   par le futur ADR dédié évoqué plus haut) couvre déjà la stratégie
   générale.
2. Marquage technique immédiat : `deprecated: true` (Swagger) + en-têtes
   `Deprecation`/`Sunset` sur les réponses concernées.
3. Entrée `CHANGELOG.md` + mise à jour de la table de versions dans
   `docs/api-versioning.md`.
4. Notification explicite aux équipes mobile et web (canal à définir).
5. Décompte de la durée minimale (12 mois proposés, avec les garde-fous de
   la section 1).
6. Retrait effectif seulement après ce délai, hors période de forte activité
   Hadj, et après vérification manuelle qu'il n'y a plus de trafic notable
   sur l'ancienne version (en l'absence de métrique automatisée à ce jour).

## Suite proposée (pas exécutée ici)

Si cette proposition convient : formaliser un nouvel ADR proposé (ex.
`0014-politique-depreciation-api.md`) reprenant ces points, à faire valider
par l'utilisateur avant de passer à `accepté` — non créé par cette session,
volontairement laissé à l'utilisateur pour éviter tout conflit de
numérotation avec un autre travail en cours sur le dépôt.
