# ADR-0001 — Stack NestJS + Prisma + PostgreSQL

## Statut

Accepté — imposé par le cahier des charges (§6.1), pas un choix de cet ADR.

## Contexte

Le cahier des charges DarMeuble fixe explicitement la stack backend :
NestJS (TypeScript), PostgreSQL, Prisma, GitLab, sans alternative laissée
ouverte. Cet ADR existe pour documenter la décision et sa cohérence avec
l'écosystème de l'équipe (deux projets frères, `smartsms-backend` et
`Oumra-hadj-project`, utilisent déjà exactement cette combinaison), pas
pour la trancher.

## Décision

NestJS, TypeScript strict, PostgreSQL, Prisma. Versions épinglées sans `^`
dès l'installation (voir `docs/backend/socle-backend.md` §2 pour la raison :
avec plusieurs contributeurs, une version qui glisse produit un bug qui ne
se reproduit que sur un poste).

## Justification

**Alignement avec l'écosystème existant.** Les deux projets frères
partagent cette stack — un développeur qui passe de l'un à l'autre retrouve
les mêmes conventions de base (structure de dossiers, migrations Prisma,
tests Jest).

**API REST plutôt que GraphQL.** Le cahier des charges laisse la porte
ouverte ("évolutif vers GraphQL si besoin", §6.1) mais ne le demande pas.
Commencer en REST, cohérent avec les deux projets frères et suffisant pour
les parcours décrits (§9) — reconsidérer seulement si un besoin réel de
requêtes composites apparaît côté frontend.

## Conséquences

- `docs/backend/socle-backend.md` détaille la stack complète (versions,
  arborescence).
- Le pattern d'accès aux données (repository/port-adapter, voir ADR-0003)
  et l'isolation multi-tenant (ADR-0002) sont des décisions **distinctes**
  de cet ADR, bien que dans le même écosystème technique.

## Alternatives écartées

Aucune — la stack est imposée par le cahier des charges, pas choisie par
cet ADR.
