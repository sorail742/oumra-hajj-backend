# Cahier des charges — DarMeuble

Plateforme SaaS de gestion locative d'immeubles — version 1.0, 17 septembre
2026. Rédigé pour Sory KEITA & Jean Michel HABA.

Copie intégrale du document fourni par l'utilisateur, conservée telle
quelle comme source de vérité fonctionnelle pour ce kit — toute décision
technique documentée ailleurs dans `darmeuble-kit/` doit s'y référer plutôt
que la contredire silencieusement.

| Élément | Détail |
| --- | --- |
| Nom du projet | DarMeuble |
| Type | Plateforme SaaS multi-locataire (multi-tenant) |
| Domaine | Gestion locative immobilière (immeubles, appartements, baux, paiements) |
| Frontend | Next.js |
| Backend | NestJS |
| Base de données | PostgreSQL |
| ORM | Prisma |
| Dépôt de code | GitLab |
| Moyen de paiement | Djomy |

## 1. Présentation générale du projet

DarMeuble est une plateforme SaaS (Software as a Service) destinée à la
gestion locative d'immeubles, du début à la fin du cycle de location :
recherche et enregistrement des biens, gestion des baux, encaissement des
loyers, suivi des charges, maintenance, communication avec les locataires
et pilotage global par les propriétaires et gestionnaires.

Le produit s'adresse aux propriétaires individuels, aux gestionnaires
immobiliers (agences) et aux structures qui administrent plusieurs
immeubles ou résidences, en Guinée et dans des contextes similaires où une
bonne partie de la gestion locative est encore faite manuellement (carnets,
appels téléphoniques, transferts d'argent informels).

### 1.1 Nom et positionnement

| Élément | Description |
| --- | --- |
| Nom du projet | DarMeuble |
| Positionnement | Solution SaaS tout-en-un pour digitaliser la gestion locative : immeubles, appartements/unités, locataires, baux, paiements de loyers, charges, maintenance et notifications. |
| Modèle économique | Abonnement SaaS (par immeuble, par unité ou par palier de nombre d'unités gérées — à valider), avec paiement des abonnements et des loyers via Djomy. |

## 2. Contexte et objectifs

### 2.1 Contexte

La gestion locative reste largement manuelle : suivi des loyers sur papier
ou par messages, absence de rappels automatiques, difficulté à retrouver
l'historique des paiements, pertes de recettes liées aux oublis ou aux
erreurs de suivi, et manque de visibilité pour les propriétaires ayant
plusieurs biens ou plusieurs gestionnaires. Il n'existe pas d'outil simple,
localisé et adapté au contexte guinéen (paiement mobile via Djomy,
connexion parfois limitée, usages en français) pour couvrir l'ensemble du
cycle locatif.

### 2.2 Objectifs du projet

1. Digitaliser l'ensemble du cycle de gestion locative, de la création
   d'un immeuble jusqu'à la clôture d'un bail.
2. Centraliser la gestion des paiements de loyers et des charges, avec
   intégration du moyen de paiement Djomy.
3. Automatiser les notifications et rappels (échéances de loyer, retards,
   fin de bail, interventions de maintenance).
4. Offrir aux propriétaires/gestionnaires un tableau de bord clair sur
   l'état d'occupation, les recettes, les impayés et les charges.
5. Donner aux locataires un espace simple pour consulter leur bail, payer
   leur loyer et suivre leurs échanges avec le gestionnaire.
6. Construire une plateforme SaaS multi-tenant, scalable, sécurisée et
   facturable par abonnement.

### 2.3 Bénéfices attendus

- Réduction des impayés et des oublis grâce aux rappels automatiques.
- Traçabilité complète des paiements et des documents (quittances,
  contrats, états des lieux).
- Gain de temps pour les gestionnaires multi-immeubles grâce à une vue
  consolidée.
- Meilleure expérience locataire (transparence, paiement mobile,
  historique accessible).
- Nouvelle source de revenus récurrents pour l'équipe porteuse du projet,
  via les abonnements SaaS.

## 3. Périmètre du projet et modules fonctionnels

| # | Module | Résumé |
| --- | --- | --- |
| 1 | Immeubles & unités locatives | Enregistrement des immeubles, bâtiments, appartements/chambres/boutiques, caractéristiques et statut d'occupation. |
| 2 | Locataires | Fiches locataires, pièces d'identité, historique de location. |
| 3 | Baux / contrats de location | Création, renouvellement, résiliation des contrats, conditions, durée, dépôt de garantie. |
| 4 | Paiements & loyers | Encaissement des loyers via Djomy, échéancier, historique, relances. |
| 5 | Facturation & quittances | Génération automatique de quittances et reçus PDF. |
| 6 | Charges & dépenses | Suivi des charges d'immeuble (eau, électricité, gardiennage, réparations) et répartition. |
| 7 | Maintenance & interventions | Demandes d'intervention des locataires, suivi des réparations, prestataires. |
| 8 | Notifications | SMS, email, notifications in-app pour échéances, retards, annonces. |
| 9 | Tableaux de bord & rapports | Statistiques d'occupation, recettes, impayés, exports. |
| 10 | Gestion documentaire | Stockage des contrats, pièces d'identité, états des lieux, photos. |
| 11 | Abonnement SaaS & facturation plateforme | Plans d'abonnement, facturation des clients de la plateforme, gestion des essais gratuits. |
| 12 | Administration & paramètres | Gestion des utilisateurs, rôles, permissions, paramètres d'organisation. |

### 3.1 Hors périmètre (version 1)

- Signature électronique juridiquement qualifiée des contrats (une simple
  validation/acceptation en ligne est prévue, sans valeur de signature
  électronique certifiée).
- Comptabilité générale complète (le module Charges & dépenses reste un
  suivi simplifié, pas un logiciel comptable).
- Marketplace publique de biens à louer (recherche publique
  d'appartements) — pourra faire l'objet d'une version future.

## 4. Acteurs et rôles utilisateurs

| Rôle | Description | Accès principaux |
| --- | --- | --- |
| Super Administrateur (équipe DarMeuble) | Administrateur de la plateforme SaaS elle-même. | Gestion des organisations clientes, des plans d'abonnement, supervision globale, support. |
| Propriétaire / Gérant d'organisation | Compte principal d'une organisation (propriétaire d'un ou plusieurs immeubles, ou agence de gestion). | Gestion complète de ses immeubles, locataires, baux, paiements, équipe et abonnement. |
| Gestionnaire délégué (agent) | Employé ou collaborateur d'une organisation, avec droits limités selon les immeubles ou tâches qui lui sont assignés. | Gestion des immeubles/unités qui lui sont attribués, enregistrement des paiements, suivi de la maintenance. |
| Comptable (optionnel) | Rôle à accès en lecture/gestion financière uniquement. | Consultation des paiements, charges, génération de rapports financiers. |
| Locataire | Personne louant une unité au sein d'un immeuble géré sur la plateforme. | Consultation de son bail, paiement du loyer, historique, demandes de maintenance, notifications. |

Le système est multi-tenant : chaque organisation (propriétaire ou agence)
dispose d'un espace cloisonné, avec ses propres immeubles, utilisateurs et
données, invisibles des autres organisations. Le Super Administrateur a une
vue transverse pour l'exploitation de la plateforme.

## 5. Spécifications fonctionnelles détaillées

### 5.1 Immeubles & unités locatives

- Création d'un immeuble : nom, adresse, ville/quartier, nombre d'étages,
  photos, propriétaire associé.
- Découpage de l'immeuble en unités locatives (appartement, chambre,
  studio, boutique, entrepôt) avec numéro/repère, surface, nombre de
  pièces, équipements.
- Statut de chaque unité : libre, occupée, en travaux, réservée.
- Fixation du loyer de base par unité (montant, devise GNF, périodicité :
  mensuel, trimestriel, annuel).
- Association d'un ou plusieurs gestionnaires délégués à un immeuble.
- Vue "plan de l'immeuble" listant toutes les unités et leur statut
  d'occupation.

### 5.2 Locataires

- Fiche locataire : identité, contact (téléphone, email), pièce d'identité,
  photo, contact d'urgence.
- Historique complet des locations d'un locataire au sein de la plateforme
  (unités occupées, périodes, paiements).
- Possibilité pour le locataire de créer/activer son propre compte pour
  accéder à son espace (invitation par SMS/email).
- Liste noire / signalement interne d'un locataire (impayés répétés,
  litiges) visible uniquement par l'organisation concernée.

### 5.3 Baux / contrats de location

- Création d'un bail : locataire, unité, date de début, durée, montant du
  loyer, périodicité, dépôt de garantie, avance éventuelle.
- Génération automatique d'un contrat de location au format PDF à partir
  d'un modèle personnalisable.
- Acceptation en ligne du bail par le locataire (validation simple,
  horodatée — sans valeur de signature électronique certifiée).
- Renouvellement, révision de loyer, et résiliation de bail avec motif et
  date de sortie.
- État des lieux d'entrée et de sortie (formulaire + photos).
- Alerte automatique avant l'échéance d'un bail (renouvellement à
  anticiper).

### 5.4 Paiements & loyers (intégration Djomy)

- Génération automatique de l'échéancier de loyers à partir du bail
  (mensuel, trimestriel, annuel).
- Paiement du loyer par le locataire via Djomy directement depuis son
  espace, ou enregistrement manuel d'un paiement (espèces, virement) par
  le gestionnaire.
- Suivi du statut de chaque échéance : à venir, en attente, payée, en
  retard, partiellement payée.
- Calcul automatique des pénalités de retard si configuré par
  l'organisation.
- Historique de paiement consultable par immeuble, par unité, par
  locataire ou par période.
- Réception des webhooks Djomy pour confirmer/mettre à jour
  automatiquement le statut d'un paiement.
- Tableau des impayés avec relances automatiques (notification) et relance
  manuelle possible.

### 5.5 Facturation & quittances

- Génération automatique d'une quittance de loyer (PDF) à chaque paiement
  validé.
- Génération de reçus pour les paiements de dépôt de garantie ou
  d'avance.
- Historique téléchargeable des quittances par locataire et par
  organisation.

### 5.6 Charges & dépenses

- Enregistrement des charges liées à un immeuble : eau, électricité,
  gardiennage, entretien, taxes.
- Répartition des charges communes entre unités (au prorata de la surface
  ou à parts égales, selon paramétrage).
- Vue consolidée des dépenses par immeuble et par période, en complément
  des recettes de loyers.

### 5.7 Maintenance & interventions

- Le locataire peut soumettre une demande d'intervention (panne,
  réparation) avec description et photos.
- Le gestionnaire assigne la demande à un prestataire/technicien et suit
  son statut (nouvelle, en cours, résolue, annulée).
- Historique des interventions par unité, utile pour l'entretien et la
  valorisation du bien.
- Notification automatique au locataire lors des changements de statut de
  sa demande.

### 5.8 Notifications

- Canaux : notifications in-app, SMS et email (le choix du canal par
  défaut est paramétrable par organisation).
- Rappel automatique avant échéance de loyer (ex. J-5, J-1).
- Alerte de retard de paiement au locataire et au gestionnaire.
- Notification de fin de bail approchante.
- Notification de changement de statut d'une demande de maintenance.
- Annonces générales d'un gestionnaire à l'ensemble des locataires d'un
  immeuble.

### 5.9 Tableaux de bord & rapports

- Tableau de bord propriétaire/gestionnaire : taux d'occupation, recettes
  du mois, impayés en cours, prochaines échéances.
- Tableau de bord par immeuble : recettes vs charges, taux de
  recouvrement.
- Export des données (paiements, locataires, baux) en PDF/Excel pour usage
  externe.
- Tableau de bord Super Administrateur : nombre d'organisations actives,
  revenus d'abonnement, usage global de la plateforme.

### 5.10 Gestion documentaire

- Stockage centralisé des documents : contrats de bail, pièces d'identité,
  états des lieux, photos des unités, justificatifs de paiement.
- Organisation des documents par immeuble, unité, locataire ou bail.
- Contrôle d'accès aux documents selon le rôle.

### 5.11 Abonnement SaaS & facturation plateforme

- Définition de plans d'abonnement (ex. par nombre d'unités gérées, ou par
  immeuble) par le Super Administrateur.
- Période d'essai gratuit configurable pour les nouvelles organisations.
- Paiement de l'abonnement par l'organisation cliente via Djomy.
- Suspension automatique ou limitation des fonctionnalités en cas
  d'abonnement expiré/impayé.
- Historique de facturation SaaS consultable par l'organisation cliente.

### 5.12 Administration & paramètres

- Gestion des utilisateurs d'une organisation et de leurs rôles/permissions.
- Paramétrage des devises, périodicités de loyer, modèles de contrat,
  modèles de notification.
- Journal d'activité (qui a fait quoi, quand) pour la traçabilité.

## 6. Spécifications techniques

### 6.1 Stack technique

| Composant | Technologie | Remarques |
| --- | --- | --- |
| Frontend | Next.js (React, TypeScript) | Rendu hybride SSR/CSR, interfaces Propriétaire, Locataire et Super Admin. |
| Backend | NestJS (TypeScript) | API REST (évolutif vers GraphQL si besoin), architecture modulaire par domaine métier. |
| Base de données | PostgreSQL | Base relationnelle, adaptée au modèle multi-tenant et aux relations complexes (immeubles/unités/baux/paiements). |
| ORM | Prisma | Migrations versionnées, typage fort partagé avec le backend NestJS. |
| Dépôt de code | GitLab | Un ou plusieurs dépôts (backend, frontend), branches par fonctionnalité, revue de code, CI/CD. |
| Paiement | Djomy | Paiement des loyers par les locataires et des abonnements par les organisations, via API/webhooks Djomy. |
| Notifications | SMS + Email (+ notifications in-app) | Fournisseur SMS local à définir ; email via un service transactionnel (ex. SMTP/API dédiée). |
| Stockage fichiers | Service de stockage objet (ex. S3-compatible) ou disque serveur | Pour contrats PDF, photos, pièces d'identité, quittances. |
| Authentification | JWT + rôles (RBAC) | Gestion des sessions par token, permissions par rôle et par organisation. |

### 6.2 Architecture générale

L'architecture est organisée en trois grands ensembles : (1) le frontend
Next.js, qui expose des espaces distincts pour le Super Administrateur, les
organisations (propriétaires/gestionnaires) et les locataires ; (2) l'API
backend NestJS, découpée en modules métier (immeubles, unités, baux,
paiements, notifications, abonnements, utilisateurs) communiquant avec la
base PostgreSQL via Prisma ; (3) les services externes intégrés par
API/webhooks : Djomy pour les paiements, un fournisseur SMS et un service
d'email pour les notifications.

Le modèle multi-tenant est assuré au niveau applicatif : chaque
enregistrement métier (immeuble, unité, bail, paiement, utilisateur) est
rattaché à une organisation (tenant), avec un contrôle systématique de
l'appartenance au tenant dans les requêtes et les autorisations.

### 6.3 Intégration du paiement Djomy

- Initialisation d'un paiement (loyer ou abonnement) depuis la
  plateforme, redirection ou paiement in-app selon le mode proposé par
  Djomy.
- Réception et vérification des webhooks Djomy pour confirmer le paiement
  et mettre à jour automatiquement le statut de l'échéance ou de
  l'abonnement.
- Journalisation de toutes les transactions (succès, échec, en attente)
  pour audit et réconciliation.
- Gestion des cas d'échec de paiement et relance du locataire ou de
  l'organisation.

### 6.4 Sécurité

- Authentification sécurisée (mot de passe hashé, JWT, éventuellement OTP
  par SMS pour les locataires).
- Contrôle d'accès basé sur les rôles (RBAC) et sur l'organisation
  (isolation stricte des données entre tenants).
- Chiffrement des données sensibles au repos et en transit (HTTPS
  obligatoire).
- Journal d'audit des actions sensibles (paiements, suppression de
  données, changement de rôle).
- Sauvegardes régulières de la base de données et des documents stockés.

### 6.5 Gestion du code source et méthodologie

- Hébergement du code sur GitLab (dépôt backend NestJS + dépôt frontend
  Next.js, ou monorepo selon préférence de l'équipe).
- Une branche par fonctionnalité/issue (ex. `feature/12-gestion-baux`),
  fusion vers une branche `develop` puis `main`.
- Pipeline CI/CD GitLab : lint, tests, build, déploiement automatisé sur
  les environnements de recette/production.
- Documentation des décisions techniques importantes via des ADR
  (Architecture Decision Records), comme pratiqué sur les autres projets
  de l'équipe.

## 7. Modèle de données (entités principales)

| Entité | Champs clés (indicatif) | Relations principales |
| --- | --- | --- |
| Organization (tenant) | id, nom, plan_abonnement, statut, date_creation | 1—N Buildings, 1—N Users |
| User | id, nom, email, telephone, mot_de_passe, role | N—1 Organization ; N—N Buildings (gestionnaires délégués) |
| Building (immeuble) | id, nom, adresse, ville, nb_etages, photos | N—1 Organization ; 1—N Units |
| Unit (unité locative) | id, reference, type, surface, loyer_base, statut | N—1 Building ; 1—N Leases |
| Tenant (locataire) | id, nom, telephone, email, piece_identite | 1—N Leases |
| Lease (bail) | id, date_debut, date_fin, loyer, periodicite, depot_garantie, statut | N—1 Unit ; N—1 Tenant ; 1—N Payments |
| Payment (paiement) | id, montant, date, type (loyer/abonnement/depot), statut, reference_djomy | N—1 Lease (ou N—1 Organization pour abonnement) |
| Expense (charge) | id, montant, categorie, date, description | N—1 Building |
| MaintenanceRequest | id, description, statut, date_creation, date_resolution | N—1 Unit ; N—1 Tenant |
| Notification | id, type, canal, contenu, statut_envoi, date | N—1 User ou N—1 Tenant |
| SubscriptionPlan | id, nom, prix, periodicite, limites (nb unités) | 1—N Organization |
| Document | id, type, url, entite_liee | Polymorphe : Lease, Unit, Tenant, Building |

Ce modèle sera affiné lors de la phase de conception détaillée (schéma
Prisma définitif, contraintes d'unicité, index, migrations) — voir
`config-templates/backend/prisma/schema.prisma` pour une première
traduction concrète.

## 8. Exigences non fonctionnelles

| Catégorie | Exigence |
| --- | --- |
| Performance | Temps de réponse API cible < 500 ms pour les opérations courantes ; pagination sur toutes les listes volumineuses. |
| Disponibilité | Objectif de disponibilité en production ≥ 99 % ; sauvegardes automatiques quotidiennes de la base de données. |
| Scalabilité | Architecture multi-tenant capable de supporter un nombre croissant d'organisations, d'immeubles et d'unités sans refonte majeure. |
| Compatibilité | Interfaces responsives (mobile, tablette, desktop) ; compatibilité navigateurs modernes. |
| Localisation | Interface en français, montants en Franc Guinéen (GNF), formats de date locaux. |
| Connectivité | Prise en compte de connexions internet parfois limitées (chargement optimisé, retours utilisateur clairs en cas d'échec réseau). |
| Sécurité des données | Isolation stricte des données entre organisations ; conformité aux bonnes pratiques de protection des données personnelles. |
| Maintenabilité | Code structuré par modules métier, conventions de branches/ADR, tests automatisés sur les fonctionnalités critiques (paiements, baux). |

## 9. Parcours utilisateurs clés (UX)

### 9.1 Parcours "Gestionnaire — encaisser un loyer"

1. Connexion à l'espace organisation.
2. Sélection de l'immeuble puis de l'unité concernée.
3. Consultation de l'échéancier du bail et de l'échéance en attente.
4. Enregistrement du paiement (via Djomy en ligne, ou saisie manuelle si
   paiement en espèces).
5. Génération automatique de la quittance et notification au locataire.

### 9.2 Parcours "Locataire — payer son loyer"

1. Connexion à l'espace locataire (invité par SMS/email lors de la
   création du bail).
2. Réception d'une notification de rappel d'échéance.
3. Consultation du montant dû et de l'historique de paiement.
4. Paiement en ligne via Djomy.
5. Téléchargement de la quittance générée automatiquement.

### 9.3 Parcours "Locataire — signaler une panne"

1. Ouverture de l'espace locataire, section Maintenance.
2. Création d'une demande avec description et photo.
3. Suivi du statut de la demande (nouvelle → en cours → résolue).
4. Notification automatique à chaque changement de statut.

## 10. Plan de réalisation par phases

| Phase | Contenu | Livrable |
| --- | --- | --- |
| Phase 0 — Cadrage | Validation du cahier des charges, maquettes UI/UX, schéma de données Prisma définitif, mise en place GitLab/CI-CD. | Spécifications validées, maquettes, dépôts initialisés |
| Phase 1 — Socle | Authentification, gestion des organisations (tenants), gestion des utilisateurs et rôles, structure multi-tenant. | Backend/Frontend socle fonctionnel |
| Phase 2 — Immeubles & baux | Modules Immeubles, Unités, Locataires, Baux (création, renouvellement, résiliation), états des lieux. | Gestion locative de base opérationnelle |
| Phase 3 — Paiements | Échéancier de loyers, intégration Djomy (paiement + webhooks), quittances PDF, suivi des impayés. | Module de paiement complet |
| Phase 4 — Charges & maintenance | Suivi des charges/dépenses, module de demandes de maintenance et interventions. | Modules charges et maintenance |
| Phase 5 — Notifications & tableaux de bord | Notifications SMS/email/in-app, tableaux de bord propriétaire/gestionnaire, exports. | Notifications et reporting opérationnels |
| Phase 6 — Abonnement SaaS | Plans d'abonnement, facturation des organisations clientes via Djomy, espace Super Administrateur. | Plateforme SaaS facturable |
| Phase 7 — Tests, recette et lancement | Tests end-to-end, corrections, documentation, déploiement en production, formation des premiers utilisateurs pilotes. | Version 1.0 en production |

L'ordre et le contenu détaillé de chaque phase pourront être ajustés en
sprints, selon la méthodologie de travail retenue par l'équipe (ADR et
suivi d'issues comme sur les autres projets).

## 11. Livrables attendus

- Cahier des charges validé (le présent document).
- Maquettes UI/UX des principaux écrans (Propriétaire, Gestionnaire,
  Locataire, Super Admin).
- Schéma de base de données Prisma (`schema.prisma`) et migrations.
- API backend NestJS documentée (endpoints, authentification, webhooks
  Djomy).
- Application frontend Next.js pour les trois espaces (organisation,
  locataire, super administrateur).
- Intégration fonctionnelle du paiement Djomy (loyers et abonnements).
- Système de notifications (SMS, email, in-app).
- Documentation technique (README, ADR, guide de déploiement) et dépôts
  GitLab organisés.
- Environnement de production déployé et fonctionnel (version 1.0).

## 12. Contraintes, risques et hypothèses

### 12.1 Contraintes

- Disponibilité et fiabilité de l'API/du service Djomy pour les paiements
  et les webhooks.
- Qualité variable de la connexion internet des utilisateurs finaux
  (locataires notamment).
- Nécessité d'une interface simple, accessible à des utilisateurs peu
  familiers du numérique.

### 12.2 Risques identifiés

| Risque | Impact | Mitigation envisagée |
| --- | --- | --- |
| Échec ou retard des webhooks Djomy | Statut de paiement non mis à jour automatiquement | Vérification périodique du statut des transactions en complément des webhooks (mécanisme de réconciliation) |
| Adoption lente par les locataires (paiement en ligne) | Persistance des paiements manuels/espèces | Permettre l'enregistrement manuel des paiements par le gestionnaire en parallèle du paiement en ligne |
| Complexité du multi-tenant sous-estimée | Risque de fuite de données entre organisations | Tests dédiés à l'isolation des données dès la phase socle (Phase 1) |

### 12.3 Hypothèses

- Djomy expose une API/des webhooks exploitables pour l'intégration (à
  confirmer techniquement en phase de cadrage).
- Un fournisseur de SMS local sera choisi et intégré pour les
  notifications SMS.
- Les modèles de contrat de location seront fournis ou validés par
  l'équipe métier avant la Phase 2.

## 13. Glossaire

| Terme | Définition |
| --- | --- |
| SaaS | Software as a Service — logiciel accessible par abonnement, hébergé et maintenu par l'éditeur. |
| Tenant / Organisation | Espace cloisonné d'un client de la plateforme (propriétaire ou agence) avec ses propres données. |
| Bail / Lease | Contrat de location liant un locataire à une unité pour une durée et un loyer donnés. |
| Unité locative | Bien loué au sein d'un immeuble : appartement, chambre, studio, boutique, etc. |
| Échéancier | Calendrier des paiements de loyer attendus sur la durée du bail. |
| Quittance | Document attestant qu'un paiement de loyer a été effectué. |
| Djomy | Solution de paiement mobile utilisée pour encaisser les loyers et les abonnements. |
| RBAC | Role-Based Access Control — contrôle d'accès basé sur les rôles des utilisateurs. |
| ADR | Architecture Decision Record — document qui trace une décision technique importante. |
| Webhook | Notification automatique envoyée par un service externe (ex. Djomy) vers l'API DarMeuble lors d'un événement (paiement confirmé, par exemple). |

Fin du document — Cahier des charges DarMeuble v1.0.
