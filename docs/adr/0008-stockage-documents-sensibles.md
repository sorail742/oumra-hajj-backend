# 0008 — Stockage et sécurité des documents sensibles

- **Statut** : accepté
- **Date** : 2026-09-02

## Contexte

Passeports, visas, billets et certificats de vaccination sont des documents
sensibles. Une fuite ou un accès non autorisé aurait un impact grave sur la
confiance des utilisateurs et des agences.

## Décision

- Les fichiers ne sont jamais stockés dans MongoDB directement : un service de
  stockage objet (ex. Firebase Storage ou équivalent compatible S3) conserve les
  fichiers, MongoDB ne garde que la métadonnée (type, statut, référence de
  stockage, propriétaire).
- Chiffrement au repos côté provider de stockage, et URLs d'accès signées à
  durée de vie courte (jamais d'URL publique permanente vers un document
  pèlerin).
- Contrôle d'accès strict par rôle : une agence ne peut lister/consulter que les
  documents des pèlerins inscrits à ses propres forfaits.
- Journalisation (log applicatif) de tout accès en lecture à un document
  sensible : qui, quand, quel document — utile en cas de litige.

## Conséquences

- Ajoute une dépendance à un provider de stockage externe, à choisir/valider
  avant la phase 3 (app mobile pèlerin).
- Impose une revue de sécurité spécifique avant mise en production (accès,
  logs, purge des documents en cas de suppression de compte).

## Note (2026-09-10)

Provider de stockage objet confirmé par Sory KEITA : **Firebase Storage**,
parmi les options évoquées dans la décision initiale ci-dessus. En attendant
l'intégration réelle (projet Firebase et identifiants de service à créer),
`LocalDiskStorageProvider` (`src/modules/documents/storage/`) sert
d'implémentation de développement — jamais utilisable en production (aucun
chiffrement au repos, aucune haute disponibilité), voir son commentaire de
code. Le chiffrement au repos et les URLs signées à durée de vie courte,
déjà exigés ci-dessus, restent à vérifier explicitement une fois
l'intégration Firebase Storage réelle branchée.
