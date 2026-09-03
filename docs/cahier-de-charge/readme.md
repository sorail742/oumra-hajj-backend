
CAHIER DES CHARGES
Plateforme Numérique de Gestion de la Oumra et du Hadj
(Nom de projet à définir — ex. « Rihla », « Safar », « Al-Amine »)
Accompagner chaque pèlerin, du premier paiement jusqu'au retour à la maison.

Préparé par : Sory KEITA
Version 1.0 — Document de cadrage

Sommaire
1. Présentation générale du projet
2. Utilisateurs et rôles
3. Fonctionnalités détaillées
4. Parcours utilisateur (UX)
5. Spécifications UX / UI
6. Architecture technique
7. Modèle de données
8. Sécurité et conformité
9. Modèle économique
10. Plan de développement (phases)
11. Risques et défis identifiés
12. Livrables attendus

1. Présentation générale du projet
1.1 Contexte
Chaque année, des millions de musulmans effectuent la Oumra (pèlerinage mineur, possible toute l'année) ou le Hadj (pèlerinage majeur, obligatoire une fois dans la vie pour tout musulman qui en a les moyens). Ce voyage implique une logistique lourde : visa religieux, billets d'avion, hébergement à La Mecque et Médine, transport local, apprentissage des rites, suivi de groupe, et budget souvent constitué sur plusieurs mois.
En Afrique de l'Ouest, notamment en Guinée, une grande partie de cette organisation passe encore par des agences locales peu digitalisées, avec un suivi manuel (papier, WhatsApp, appels téléphoniques), ce qui entraîne des pertes d'information, des retards de dossier, et un manque de confiance des familles qui restent au pays pendant que le pèlerin est absent.
1.2 Problématique
    • Les agences de voyage Oumra/Hadj n'ont pas d'outil centralisé pour gérer leurs pèlerins, paiements échelonnés et documents.
    • Le pèlerin (souvent une personne âgée ou peu familière avec le numérique) n'a pas de suivi clair de son dossier ni de guide simple pour les rites.
    • Les familles restées au pays n'ont aucun moyen fiable de suivre leur proche une fois sur place (santé, position, sécurité).
    • Les rites (Oumra et Hadj) sont complexes à mémoriser (Ihram, Tawaf, Sa'i, Rami, stations à Mina/Arafat/Muzdalifah) et les supports existants sont soit en arabe non traduit, soit non adaptés au contexte local.
1.3 Objectifs du projet
    1. Digitaliser la gestion des dossiers pèlerins pour les agences locales (Guinée / Afrique de l'Ouest).
    2. Offrir au pèlerin un compagnon numérique simple, multilingue, utilisable même avec une connexion faible.
    3. Rassurer les familles grâce à un suivi de position et des notifications d'étapes clés.
    4. Fournir un guide pas-à-pas des rites de la Oumra et du Hadj, avec rappels et compteurs (Tawaf, Sa'i).
    5. Créer une source de revenus pour la structure (commission sur réservations, options premium).
1.4 Vision du produit
Une plateforme composée d'une application mobile (pèlerins) et d'un espace web/back-office (agences et administrateurs), pensée comme un compagnon de confiance : sobre, respectueuse du caractère spirituel du voyage, fiable en connectivité limitée, et simple d'usage pour un public de tout âge.
2. Utilisateurs et rôles
La plateforme s'organise autour de quatre profils d'utilisateurs, chacun avec un espace dédié.
Rôle
Description
Pèlerin
Particulier inscrit à une Oumra ou un Hadj via une agence partenaire ou en autonomie. Suit son dossier, paie, se prépare, est guidé sur place.
Agence / Organisateur
Structure qui vend des forfaits Oumra/Hadj, gère les groupes, les paiements et la logistique (visa, hôtel, transport).
Guide / Mutawif (accompagnateur)
Personne présente sur place qui encadre un groupe de pèlerins : présence, sécurité, orientation.
Administrateur plateforme
Équipe technique/produit : valide les agences, supervise les paiements, gère le contenu religieux et les statistiques globales.

3. Fonctionnalités détaillées
3.1 Espace Pèlerin (application mobile)
Fonctionnalité
Description
Inscription & profil
Création de compte par numéro de téléphone + OTP, profil (identité, passeport, contact d'urgence, groupe sanguin, allergies).
Catalogue de forfaits
Parcourir les offres Oumra/Hadj publiées par les agences partenaires : dates, prix, hôtel, distance à la Mosquée, avis.
Réservation & paiement échelonné
Réserver une place, payer en plusieurs tranches via Mobile Money (Orange Money, MTN Money) ou carte bancaire, avec échéancier visible.
Suivi de dossier
Barre de progression claire : paiement, visa, billet d'avion, vaccination, documents validés — statut à jour en temps réel.
Coffre-fort documents
Stockage sécurisé du passeport, visa, billets, certificat de vaccination (fièvre jaune/méningite), accessible hors-ligne.
Guide des rites pas-à-pas
Fiches illustrées et audio (FR/langues locales/arabe) pour l'Ihram, le Tawaf, le Sa'i, le Rami, les stations du Hadj — avec rappel du sens spirituel de chaque étape.
Compteur Tawaf / Sa'i
Compteur simple à utiliser sur place pour ne pas perdre le compte des tours autour de la Kaaba ou entre Safa et Marwa.
Boussole Qibla & horaires de prière
Orientation vers la Qibla et horaires de prière locaux automatiques (utile aussi avant le départ).
Duas et rappels audio
Bibliothèque d'invocations classées par étape du voyage, écoute hors-ligne.
Localisation & sécurité famille
Partage de position GPS (opt-in) avec la famille et le guide de groupe ; bouton SOS en cas de problème (perdu, malaise).
Notifications d'étapes
Alertes push : dossier validé, départ imminent, changement d'hôtel/horaire, rappel de rite du jour.
Messagerie / support agence
Chat direct avec l'agence ou le guide pour toute question avant/pendant le voyage.
Retour d'expérience
Avis et note sur l'agence et l'hébergement après le voyage, utile pour les futurs pèlerins.
3.2 Espace Agence / Organisateur (application ou back-office web)
Fonctionnalité
Description
Gestion des forfaits
Créer, modifier, publier des offres Oumra/Hadj (dates, prix, capacité, hôtel, inclusions).
Gestion des pèlerins
Liste des inscrits par forfait, statut de dossier, documents reçus/manquants.
Suivi des paiements
Vue des échéanciers, relances automatiques, historique des transactions, export comptable.
Gestion des groupes & guides
Constituer les groupes, assigner un guide/Mutawif, générer les listes de présence.
Communication de masse
Envoyer une notification ou un message à tout un groupe (changement d'horaire, consignes).
Statistiques
Taux de remplissage, chiffre d'affaires, taux de satisfaction, historique des saisons précédentes.
3.3 Espace Guide / Mutawif
Fonctionnalité
Description
Liste de groupe en temps réel
Voir tous les pèlerins de son groupe, leur statut de présence, et leur position si le partage est activé.
Alertes SOS
Recevoir immédiatement les alertes d'urgence envoyées par un pèlerin de son groupe.
Émargement
Pointage de présence aux étapes clés (arrivée hôtel, départ pour Mina/Arafat, retour bus).
3.4 Back-office Administrateur (plateforme)
Fonctionnalité
Description
Validation des agences
Vérifier les documents légaux d'une agence avant de l'autoriser à publier des offres.
Modération de contenu
Valider le contenu religieux (fiches de rites, Duas) avant publication, avec relecture par une personne qualifiée.
Supervision des paiements
Vue globale des transactions, gestion des commissions prélevées par forfait vendu.
Statistiques globales
Nombre de pèlerins actifs, volume par agence, saisonnalité Oumra vs Hadj.
Gestion des utilisateurs
Suspension de compte, support niveau 2, gestion des litiges agence/pèlerin.

4. Parcours utilisateur (UX)
4.1 Parcours d'inscription et de réservation (avant le départ)
    6. Le pèlerin télécharge l'application, s'inscrit par numéro de téléphone (OTP).
    7. Il consulte les forfaits disponibles, filtre par budget, dates, agence de confiance.
    8. Il sélectionne un forfait et démarre le paiement échelonné (1ère tranche).
    9. Il complète son profil et téléverse ses documents (passeport, photo, certificat de vaccination).
    10. Il suit sa progression sur un tableau de bord simple (icônes : payé, visa en cours, billet confirmé).
    11. Il reçoit des rappels pour compléter les tranches restantes et se préparer (guide des rites en amont).
4.2 Parcours pendant le voyage (sur place)
    12. À l'arrivée, le pèlerin retrouve son groupe et son guide dans l'application.
    13. Il active le partage de position pour rassurer sa famille.
    14. Avant chaque étape (Tawaf, Sa'i, Mina, Arafat, Muzdalifah, Rami), l'application affiche automatiquement la fiche du rite du jour avec rappel audio.
    15. Il utilise le compteur de tours pendant le Tawaf/Sa'i, sans avoir à réfléchir en pleine adoration.
    16. En cas de problème, un bouton SOS unique alerte immédiatement le guide et un contact famille.
4.3 Parcours après le retour
    17. Le pèlerin reçoit une notification de clôture de dossier et peut télécharger un récapitulatif (attestation de voyage).
    18. Il est invité à laisser un avis sur l'agence et l'hébergement.
    19. Ses documents restent accessibles dans le coffre-fort pour un futur voyage.

5. Spécifications UX / UI
5.1 Principes directeurs
    • Sobriété et confiance
    • Accessibilité
    • Multilingue
    • Faible connectivité
    • Un geste = une action
5.2 Écrans principaux
Fonctionnalité
Description
Onboarding
3 écrans d'introduction + choix de la langue + création de compte par téléphone.
Accueil pèlerin
Carte de progression du dossier, prochaine échéance de paiement, accès rapide au guide des rites.
Détail forfait
Photos hôtel, distance Mosquée, prix, dates, inclusions, avis d'anciens pèlerins.
Paiement
Échéancier visuel (tranches payées/à venir), choix du mode de paiement, reçu généré automatiquement.
Coffre-fort documents
Liste des documents avec statut (manquant / en attente / validé), scan via appareil photo.
Guide des rites
Fiches par étape, illustration + texte court + bouton audio, progression cochée au fur et à mesure.
Compteur Tawaf/Sa'i
Grand chiffre central, un seul bouton pour incrémenter, vibration de confirmation, réinitialisation manuelle.
Qibla & horaires
Boussole plein écran, horaires de prière du jour selon la position GPS.
Carte groupe & SOS
Position des membres du groupe (si partagée), bouton SOS rouge fixe en bas d'écran.
Espace agence (web)
Tableau de bord : forfaits actifs, pèlerins par statut, paiements du jour, alertes en attente.
5.3 Charte graphique suggérée
    • Couleurs principales
    • Typographie
    • Iconographie

6. Architecture technique
6.1 Stack technique proposée
Fonctionnalité
Description
Application mobile (pèlerin, guide)
Flutter / Dart — un seul code pour Android et iOS, mode hors-ligne facilité par le stockage local (Hive / SQLite).
Back-office web (agence, admin)
Application web (React ou Flutter Web) consommant la même API backend.
Backend / API
Node.js + Express, architecture REST (ou GraphQL si besoin de requêtes complexes côté back-office).
Base de données
MongoDB avec Mongoose (schémas : utilisateurs, forfaits, réservations, paiements, groupes, documents).
Authentification
Numéro de téléphone + OTP (SMS), tokens JWT, rôles (pèlerin / agence / guide / admin).
Paiement
Intégration Mobile Money (Orange Money, MTN Mobile Money) + passerelle carte bancaire pour la diaspora.
Notifications
Firebase Cloud Messaging pour les push, SMS de secours pour les alertes critiques (SOS, paiement).
Stockage documents
Stockage cloud sécurisé (ex. Firebase Storage ou équivalent) avec chiffrement des documents sensibles.
Géolocalisation
API de cartographie avec cache hors-ligne des cartes de La Mecque / Médine.
6.2 Architecture globale (vue logique)
App mobile Pèlerin/Guide (Flutter) et Back-office Agence/Admin (Web) communiquent avec une API centrale Node.js/Express, laquelle interagit avec MongoDB (données métier), un service de paiement (Mobile Money / carte), un service de notifications push, et un service de stockage de documents. Un module de synchronisation hors-ligne permet à l'application mobile de continuer à fonctionner (guide des rites, compteur, documents) sans réseau, puis de se resynchroniser automatiquement.
6.3 Intégrations tierces à prévoir
    • Passerelles Mobile Money locales (Orange Money, MTN Money) et carte bancaire internationale.
    • Service SMS/OTP pour l'authentification et les alertes critiques.
    • API de calcul des horaires de prière et de la Qibla selon la position GPS.
    • Cartes hors-ligne de La Mecque et Médine (zones du Haram, hôtels, points d'eau, secours).
    • À terme : veille sur les exigences de la plateforme officielle saoudienne Nusuk, qui centralise désormais permis, visas et hébergement — le produit doit être pensé comme complémentaire (préparation, suivi famille, guide des rites) plutôt qu'en concurrence frontale sur les démarches officielles.

7. Modèle de données (collections principales)
Collection
Champs principaux
User
identité, téléphone, rôle (pèlerin/agence/guide/admin), langue préférée, contact d'urgence, groupe sanguin.
Agency
raison sociale, documents légaux, statut de validation, liste des forfaits, coordonnées bancaires.
Package (forfait)
type (Oumra/Hadj), dates, prix, capacité, hôtel, inclusions, agence propriétaire, statut (ouvert/complet/clos).
Booking (réservation)
pèlerin, forfait, statut global, groupe assigné, historique des étapes du dossier.
Payment
réservation, montant, tranche, mode (Mobile Money/carte), statut, date, reçu.
Document
réservation, type (passeport/visa/billet/vaccination), fichier, statut de validation.
Group
forfait, guide assigné, liste des membres, itinéraire prévisionnel.
RiteProgress
pèlerin, étape du guide des rites, complétée ou non, compteur Tawaf/Sa'i courant.
Notification
destinataire(s), type, contenu, statut de lecture.
Review
pèlerin, agence, note, commentaire, date.

8. Sécurité et conformité
    • Données sensibles
    • Authentification
    • Traçabilité
    • Contenu religieux
    • Conformité paiement
9. Modèle économique
    • Commission agence
    • Offre Premium pèlerin
    • Abonnement agence
    • Partenariats

10. Plan de développement (phases)
Découpage proposé en 6 phases, cohérent avec la méthode déjà utilisée sur les autres projets (ex. Abeilly).
Phase
Contenu & durée estimée
Phase 1 — Cadrage & UX
Ateliers de cadrage, personas, maquettes basse puis haute fidélité (Figma), validation du cadrage. ~2 semaines
Phase 2 — Backend & données
Modélisation MongoDB/Mongoose, API Node.js/Express (auth, forfaits, réservations), documentation API. ~3 semaines
Phase 3 — App mobile pèlerin
Développement Flutter : inscription, catalogue, paiement, coffre-fort documents, guide des rites, compteur, Qibla. ~4 semaines
Phase 4 — Espace agence & admin
Back-office web : gestion forfaits, pèlerins, paiements, validation agences, statistiques. ~3 semaines
Phase 5 — Intégrations & tests
Paiement Mobile Money, notifications push, géolocalisation/SOS, tests fonctionnels et de charge. ~2 semaines
Phase 6 — Pilote & déploiement
Test avec une agence pilote et un petit groupe réel, corrections, formation des agences, mise en production. ~2 semaines
11. Risques et défis identifiés
    • Connectivité
    • Confiance religieuse
    • Cadre réglementaire saoudien
    • Confiance des agences locales
    • Sensibilité des données
12. Livrables attendus
    • Application mobile Flutter (Android/iOS) — espace pèlerin et guide.
    • Back-office web — espace agence et administrateur.
    • API backend Node.js/MongoDB documentée.
    • Maquettes UX/UI validées (Figma).
    • Documentation technique et guide d'utilisation pour les agences.
    • Présentation de synthèse pour validation finale.

Ce document est une base de cadrage : il doit être discuté et validé avant le démarrage du développement, notamment sur le choix du nom du produit, le périmètre de la première version (MVP) et la ou les agences pilotes.