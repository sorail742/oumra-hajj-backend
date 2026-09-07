# Comparatif fournisseurs — Mobile Money, SMS/OTP, Push

Document de synthèse pour aider à trancher l'**issue #18** (`docs/roadmap.md`)
et l'[ADR 0006](adr/0006-gestion-paiements.md) (statut `proposé`). Ce n'est
**pas** une décision : l'ADR 0006 reste `proposé` et [ADR 0009](adr/0009-notifications.md)
reste `accepté` tel quel tant que l'utilisateur (Sory KEITA) n'a pas
confirmé un choix — voir `CONTRIBUTING.md` pour la procédure de passage
`proposé` → `accepté`.

**Avertissement** : tarifs, couverture et conditions commerciales ci-dessous
viennent d'une recherche web (septembre 2026) et évoluent vite sur ces
marchés — à revérifier directement auprès de chaque fournisseur avant toute
signature ou intégration réelle. Aucune clé API, aucun identifiant réel
n'est utilisé dans ce document (voir `CLAUDE.md`, `docs/secrets-management.md`).
Marché cible : Guinée / Afrique de l'Ouest francophone (voir
`docs/cahier-de-charge/readme.md`, §1.1).

## 1. Paiement Mobile Money & carte (ADR 0006)

Deux approches possibles, pas mutuellement exclusives :

### Approche directe par opérateur

| Fournisseur | Couverture | Intégration | Avantages | Inconvénients |
|---|---|---|---|---|
| **Orange Money Web Payment API** (Orange Developer) | Guinée Conakry listée officiellement (avec Mali, Sénégal, Côte d'Ivoire, Sierra Leone, Libéria...) | API REST officielle, OTP USSD généré par le client pour valider le paiement côté Orange | Pas d'intermédiaire, pas de commission d'agrégateur, relation contractuelle directe avec Orange Guinée | Conformité KYA (Know Your API) à négocier avec l'opérateur local ; ne couvre que Orange Money — il faut une deuxième intégration pour MTN |
| **MTN MoMo API** (MTN Developer) | MTN Mobile Money présent en Guinée (un des trois opérateurs dominants avec Orange et Cellcom) | API REST officielle MTN, portail développeur dédié | Même logique que Orange : pas d'intermédiaire | Deuxième contrat/API distincte à maintenir en parallèle d'Orange ; conditions d'accès marchand à vérifier pays par pays |

### Approche agrégateur (une API, plusieurs opérateurs)

| Fournisseur | Couverture Guinée | Avantages | Inconvénients |
|---|---|---|---|
| **CinetPay** | Présence confirmée en Guinée-Conakry, ~9 pays francophones (Côte d'Ivoire, Sénégal, Mali, Togo, Bénin, Burkina Faso, Guinée, Niger, Cameroun, RDC) | Une seule intégration pour Orange Money, MTN, Wave, carte Visa/Mastercard ; sandbox documentée ; fintech francophone déjà utilisée dans la sous-région | Commission d'agrégateur en plus du coût opérateur ; dépendance à un tiers pour la réconciliation |
| **Semoa** | Présence confirmée en Guinée (avec Bénin, Côte d'Ivoire, Togo) | Deux produits distincts : CashPay (encaissement), Semoa Pro (paiement sortant) — utile si l'agence a aussi besoin de reverser de l'argent (remboursements) | Empreinte géographique plus restreinte que CinetPay |
| **InTouch Group** | Agréé Établissement de Transfert d'Argent par la Banque Centrale de la République de Guinée (BCRG) | Fintech pan-africaine (11 pays), conformité réglementaire déjà obtenue localement | Historiquement plus orientée Afrique de l'Ouest UEMOA (Guinée hors zone UEMOA — à vérifier si l'offre locale est aussi mature) |
| **Wave** | Lancé en Guinée en 2025 (licence BCRG obtenue mai 2025), en phase de déploiement à Conakry | Frais de transaction très bas, expérience utilisateur simple, bonne pénétration récente | Encore récent sur ce marché précis ; à vérifier si Wave propose une API marchand backend (webhook serveur-à-serveur) ou seulement un flux QR/app grand public — point à clarifier directement avec Wave avant de compter dessus |
| **PawaPay** | Agrégateur pan-africain (20+ marchés) — présence explicite en Guinée **non confirmée** par cette recherche | API unique pensée pour les paiements Mobile Money entrants/sortants | Couverture Guinée à vérifier directement avant d'aller plus loin |

### Point d'architecture (rappel ADR 0006)

Quel que soit le choix, l'ADR 0006 impose déjà : aucune donnée de carte en
clair côté serveur, statut de paiement confirmé uniquement par callback
serveur-à-serveur (jamais côté client), reçu horodaté par paiement — voir
`src/modules/payments/payments.service.ts` (`handleWebhook`), déjà écrit
pour ce modèle quel que soit le fournisseur retenu.

## 2. SMS/OTP — connexion pèlerin/guide (ADR 0003, ADR 0006)

Le module `auth` génère et hache déjà le code OTP côté serveur
(`crypto.randomInt`, bcrypt — voir `docs/auth-flow.md`) : il faut seulement
un canal d'**envoi SMS brut**, pas un produit hébergé de type "Verify" qui
facturerait une génération de code redondante avec ce qui existe déjà.

| Fournisseur | Tarif indicatif Guinée (par SMS) | Couverture | Remarque |
|---|---|---|---|
| **Twilio** | ~0,15 USD | Mondiale, Guinée via routage agrégateur (pas de réseau direct) | Référence du marché, documentation mature, mais un des tarifs les plus élevés pour la Guinée |
| **Plivo** | ~0,12 USD | Idem Twilio (routage agrégateur) | Moins cher que Twilio sur ce couloir, alternative directe |
| **Vonage** | Comparable à Twilio | Idem | Produit "Verify" disponible si on préfère déléguer la génération OTP (non nécessaire ici) |
| **Infobip** | ~0,22 USD | Idem (routage agrégateur) | Le plus cher des trois sur la Guinée d'après cette recherche |
| **Africa's Talking** | Non chiffré précisément pour la Guinée dans cette recherche | Guinée listée parmi les marchés couverts, plus de 300M d'abonnés adressables sur le continent | Acteur focalisé Afrique, à confirmer sur devis réel — vaut la peine d'un devis direct avant Twilio/Infobip |
| **Orange SMS API** (Orange Developer) | Non trouvé dans cette recherche | Potentiellement mutualisable si Orange Money est aussi retenu pour le paiement | À vérifier directement — mutualiser opérateur paiement + SMS réduirait le nombre d'intégrations tierces (objectif explicite de l'ADR 0009) |

## 3. SMS de secours — alertes critiques (ADR 0009)

Mêmes fournisseurs que ci-dessus. L'ADR 0009 recommande explicitement de
mutualiser avec le provider OTP pour limiter le nombre d'intégrations
tierces — pertinent ici : choisir un seul fournisseur SMS pour OTP **et**
alertes critiques (SOS, changement de dernière minute) plutôt que deux
contrats distincts.

## 4. Notifications push (ADR 0009 — déjà accepté, FCM)

Rien à trancher ici en principe : Firebase Cloud Messaging est déjà retenu
par l'ADR 0009 (`accepté`). Vérification faite pour ce comparatif : FCM
reste gratuit et illimité (pas de facturation au message, sur Android/iOS/web)
en 2026 — la décision reste valide, aucun élément ne justifie de la
rééxaminer. Seul point pratique restant : créer le projet Firebase et
obtenir les identifiants de service (voir `integrations.md`, `PushSender`) —
ce n'est plus un choix de fournisseur, juste une mise en œuvre.

## 5. Tableau de synthèse

| Besoin | Options réalistes | Ce qui reste à vérifier avant décision |
|---|---|---|
| Paiement Mobile Money | Agrégateur (CinetPay ou Semoa, présence confirmée en Guinée) **ou** intégration directe Orange + MTN | Commission agrégateur exacte, délai de réconciliation, support en cas d'incident — demander un devis à CinetPay et Semoa en parallèle |
| SMS/OTP + SMS de secours | Africa's Talking (à chiffrer) vs Plivo (~0,12 USD/SMS) vs Twilio (~0,15 USD/SMS) | Devis réel sur volume estimé (nombre de pèlerins actifs), fiabilité de délivrance mesurée sur le réseau Guinée spécifiquement |
| Notifications push | FCM (déjà accepté, ADR 0009) | Rien côté choix — juste la création du projet Firebase |

## 6. Pour la discussion (non contraignant)

Sans trancher à la place de l'utilisateur : commencer par demander un devis
à **CinetPay** et **Semoa** (les deux agrégateurs dont la présence en Guinée
est la mieux confirmée) plutôt que de négocier Orange et MTN séparément,
et à **Africa's Talking** en plus de Twilio/Plivo pour le SMS, avant
d'arbitrer sur le coût réel et la fiabilité mesurée. Décision finale à
prendre par l'utilisateur — passage de l'ADR 0006 à `accepté` une fois le
choix fait, suivant la procédure de `CONTRIBUTING.md`.

## Sources

- [Top 5 des agrégateurs de paiement en Afrique de l'Ouest](https://lavoixdigitale.com/top-5-des-agregateurs-de-paiement-en-afrique-de-louest/)
- [Zoom sur CinetPay — Togo First](https://www.togofirst.com/fr/tic/2910-8826-zoom-sur-cinetpay-la-fintech-qui-veut-devenir-leader-de-solutions-d-e-paiement-en-afrique-francophone)
- [InTouch — agréments UEMOA](https://www.agenceecofin.com/actualites/2805-128753-le-groupe-senegalais-intouch-obtient-des-agrements-cles-pour-operer-comme-acteur-reglemente-du-paiement-dans-l-uemoa)
- [InTouch Group](https://www.intouchgroup.net/en)
- [PawaPay — Mobile Money Payments API for Africa](https://www.pawapay.io/)
- [Wave entre sur le marché guinéen](https://trustmag.net/article/RfWuzWhvkG)
- [Wave débarque en Guinée — Vision Guinée](https://www.visionguinee.info/wave-debarque-bientot-en-guinee-pour-fournir-des-services-de-paiement-mobile/)
- [Guinea SMS Pricing — Sent](https://www.sent.dm/en/resources/sms-pricing/guinea-sms-pricing)
- [OTP API Provider Comparison 2026 — Arkesel](https://arkesel.com/otp-api-providers-comparison-2026/)
- [Africa's Talking — marchés couverts](https://help.africastalking.com/en/articles/2727792-which-countries-are-africa-s-talking-products-in)
- [Orange Money Web Payment API — Orange Developer](https://developer.orange.com/apis/om-webpay)
- [Firebase Cloud Messaging — tarification](https://www.pushengage.com/firebase-push-notification-pricing/)
