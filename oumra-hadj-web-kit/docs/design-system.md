# Oumra & Hadj — Design system

Contrat visuel et technique des composants d'`oumra-hadj-web`. À lire avant
d'écrire un composant.

Structure et principes de fabrication repris de `smartsms-frontend` (projet
frère) — la méthode (tokens uniques, quatre états outillés, un registre de
statuts) est indépendante du domaine. Les valeurs, la palette et le
catalogue de composants métier sont propres à ce produit.

---

## 1. Direction

Oumra & Hadj n'est pas un site vitrine : c'est un **outil de suivi de
dossier**, consulté par trois publics très différents — un pèlerin anxieux
qui vérifie si son visa est arrivé, un opérateur d'agence qui gère cinquante
dossiers en même temps, un administrateur qui valide une agence. Trois
conséquences :

**La clarté prime sur la densité extrême.** Contrairement à une console
d'envoi de masse consultée toute la journée par un opérateur unique, ce
produit est consulté par intermittence et sous stress (un document refusé,
un paiement en attente). Les tableaux restent denses (`text-sm`, 13 px),
mais chaque écran de suivi de dossier privilégie la lisibilité d'un statut
sur le nombre de lignes visibles.

**La couleur porte la confiance, pas la décoration.** Le vert de marque est
réservé aux actions et à l'état validé/positif. L'or est réservé aux
marqueurs de confiance (badge agence certifiée) et d'attention (document
proche de l'expiration) — jamais décoratif.

**Le chiffre et la référence sont la matière première de la confiance.**
Numéro de téléphone, référence de paiement, identifiant de réservation,
montant en GNF : tout ce qu'un pèlerin ou une agence peut avoir besoin de
relire à voix haute, de recopier, ou de comparer avec un reçu papier est en
**IBM Plex Mono**. Le reste est en **Source Sans 3**.

### Ce qu'on ne fait pas

Pas de dégradés sur les cartes de statut. Pas d'icône décorative à côté de
chaque titre de section. Pas d'illustration générique de « voyage » en fond
d'écran — le produit gagne à ressembler à un dossier administratif fiable,
pas à une brochure touristique.

---

## 2. Tokens

Tout est dans `src/app/globals.css` (voir `config-templates/globals.css` de
ce kit, prêt à copier). Rien ailleurs.

### Couleur

| Groupe | Tokens | Usage |
| --- | --- | --- |
| Surfaces | `background` `card` `popover` `muted` `border` | fonds et séparations |
| Texte | `foreground` `muted-foreground` | primaire / secondaire |
| Marque | `primary` `primary-hover` `primary-subtle` `accent` `accent-foreground` | actions, état actif, focus, marqueurs de confiance |
| États dossier | `state-pending` `state-progress` `state-success` `state-danger` `state-warning` (+ `-bg`) | statut d'une réservation, d'un paiement, d'un document, d'une étape |
| Système | `destructive` `success` `warning` | retour d'action de l'interface elle-même |
| Sidebar | `sidebar` `sidebar-accent` `sidebar-border` | navigation latérale |

**Valeurs de départ** (OKLCH, thème clair) :

```css
--background: oklch(0.985 0.006 95);
--foreground: oklch(0.22 0.02 155);
--primary: oklch(0.42 0.09 155);      /* sage profond */
--primary-hover: oklch(0.36 0.09 155);
--primary-subtle: oklch(0.95 0.03 155);
--accent: oklch(0.78 0.13 85);        /* or */
--accent-foreground: oklch(0.32 0.08 85);
```

Détail complet, thème sombre compris, dans `config-templates/globals.css`.

**Pourquoi un registre à cinq tons plutôt qu'un par enum.** Le contrat API
expose neuf enums porteurs de statut (`BookingStatus`, `PaymentStatus`,
`PilgrimDocumentStatus`, `AgencyValidationStatus`, `PackageStatus`,
`DossierStepStatus`…), chacun avec deux à quatre valeurs. Leur donner un jeu
de couleurs propre par enum — comme le fait smartsms pour son cycle de vie
d'un SMS, qui est un seul enum central — produirait neuf palettes à
maintenir pour un gain nul : les valeurs se regroupent naturellement en cinq
tons sémantiques.

| Ton | Regroupe (exemples) |
| --- | --- |
| `state-pending` | `pending`, `pending_payment`, `open` |
| `state-progress` | `in_progress` |
| `state-success` | `confirmed`, `done`, `succeeded`, `approved`, `validated`, `completed` |
| `state-danger` | `cancelled`, `failed`, `rejected` |
| `state-warning` | `full`, `closed`, `refunded` |

Le mapping enum → ton → libellé français vit dans un seul endroit,
`config/status-registry.ts` — voir §7.

**États dossier et retours système sont deux choses différentes.** Un
document pèlerin rejeté n'est pas une erreur de l'application : il utilise
`state-danger`, pas `destructive`. `destructive` reste réservé aux actions
irréversibles de l'interface elle-même (supprimer un compte, révoquer une
session).

### Typographie

| Rôle | Token | Où |
| --- | --- | --- |
| KPI principal | `text-3xl` (32) | chiffre unique du tableau de bord |
| KPI secondaire | `text-2xl` (24) | cartes de statistiques |
| Titre de page | `text-xl` (20) | `PageHeader` |
| Titre de carte | `text-lg` (17) | en-tête de `Card` |
| Corps, champs | `text-base` (15) | formulaires, paragraphes |
| Tableaux | `text-sm` (13) | densité par défaut des listes |
| Métadonnées | `text-xs` (12) | horodatages, aide de champ |
| Étiquettes | `text-2xs` (11) | en-têtes de colonne, unités |

`font-mono` obligatoire pour : téléphones, références de paiement
(`providerReference`), identifiants de réservation, montants en GNF, jetons
d'URL signée affichés à l'utilisateur (ex. lien d'abonnement calendrier).

### Espacement, rayons, hauteur des contrôles

Mêmes valeurs et même raisonnement que smartsms-frontend — ce sont des
constantes d'ergonomie d'interface, pas des choix liés au domaine SMS :

- `gap-2` (8) entre éléments liés, `gap-4` (16) entre blocs, `gap-6` (24)
  entre sections, `p-6` pour l'intérieur d'une carte.
- Rayons : `rounded-sm` badges · `rounded-md` champs et boutons ·
  `rounded-lg` cartes · `rounded-xl` modales.
- `--size-field: 36px` pour `Input`/`SelectTrigger`/`PhoneInput`/
  `Button size="md"` ; `--size-touch: 44px` pour la zone tactile — deux
  tokens distincts, jamais de hauteur en dur (`h-8`, `h-9`…) sur un champ.

---

## 3. Règles d'usage

**Une seule action primaire par écran.** Sur un écran de dossier, l'action
qui fait avancer le pèlerin (« Payer la tranche », « Téléverser mon
passeport ») est seule en `primary`.

**Tout écran de données a quatre états.** Chargement (squelette aux
dimensions du contenu réel), vide, erreur, nominal — outillés par
`AsyncBoundary`, jamais réimplémentés écran par écran.

**Les nombres et dates sont formatés au même endroit.** `lib/format/`
expose `formatGNF`, `formatTelephone`, `formatDate`, `formatRelatif`.
Aucun `toLocaleString` dans un composant — voir
`code-templates/lib/format/index.ts`, directement réutilisable (devise GNF
et contexte régional partagés avec smartsms-frontend).

**L'espacement vient du parent.** Un composant ne définit pas sa marge
externe.

---

## 4. Comportement

### Toasts

`sonner`. La question n'est pas comment les afficher, mais quand — mêmes
règles que smartsms-frontend, la logique est indépendante du domaine :

| Situation | Réponse |
| --- | --- |
| Action réussie, effet **visible** à l'écran | rien — la ligne a changé de statut, un toast est du bruit |
| Action réussie, effet **invisible** | toast succès, 4 s (« Demande de remboursement envoyée ») |
| Erreur **liée à un champ** | message dans le formulaire, jamais un toast |
| Erreur **globale** | toast persistant + Réessayer |

**Le `<Toaster>` est monté dans `app/providers.tsx`**, pas dans un layout —
pour fonctionner identiquement sur l'espace authentifié et les écrans
publics (OTP, inscription agence).

### Animation

Même échelle que smartsms-frontend, à copier telle quelle dans
`globals.css` :

```css
--motion-instant: 100ms; /* survol, focus            */
--motion-fast: 150ms;    /* tooltip, dropdown         */
--motion-base: 200ms;    /* modale, panneau latéral   */
--motion-slow: 300ms;    /* transition de page        */
```

Une exception à prévoir par analogie avec `QuotaGauge` chez smartsms : la
jauge de progression d'un dossier (étapes complétées) ou d'un décompte
tawaf/sai anime son remplissage hors de cette échelle — c'est une donnée qui
se remplit, pas une transition d'interface.

`prefers-reduced-motion` traité une fois dans `globals.css`, rien à ajouter
par composant.

### Tooltip, Alert, Toast

Même distinction que smartsms-frontend :

| Composant | Sert à | Ne sert pas à |
| --- | --- | --- |
| **Tooltip** | nommer une icône seule | expliquer, avertir, contenir un lien |
| **Alert** | information persistante liée au contexte de l'écran (ex. bandeau « ce document expire dans 5 jours ») | notifier une action |
| **Toast** | retour d'une action ponctuelle | porter une information permanente |

**Cas propre à ce produit : l'indicateur de validation religieuse n'est ni
un tooltip, ni une alerte, ni un toast.** C'est un composant dédié,
`ReligiousContentNotice` (§7), toujours visible tant que le contenu n'est
pas validé — jamais quelque chose que l'utilisateur peut fermer ou manquer.

### Erreurs de soumission

**Un seul point d'entrée : `lib/api/form-errors.ts`.** Même principe que
smartsms-frontend, mais **le contrat d'erreur diffère** (voir
`docs/contrat-api.md`) : pas de `code` métier stable aujourd'hui, l'ordre de
résolution s'arrête plus tôt.

| Ce que porte l'erreur | Ce qui s'affiche |
| --- | --- |
| `message` est un tableau (validation `class-validator`) | chaque entrée désigne un champ quand le nom du champ est reconnaissable dans le texte, sinon bandeau générique listant les messages |
| `message` est une chaîne, statut 4xx | le message du backend, tel quel — souvent déjà en français et précis (ex. « Un compte existe déjà avec cet email ») |
| statut 5xx, ou corps non reconnaissable | message générique de l'écran |

**Ne pas inventer un branchement sur un `code` qui n'existe pas.** Tant que
le backend ne publie aucun code métier stable, un écran qui tenterait de
distinguer par le texte du message casserait à la première reformulation —
préférer un traitement par statut HTTP et, quand c'est possible, par la
route/le contexte de l'écran (ex. un `409` sur `POST /reviews` signifie « un
avis existe déjà pour cette réservation », l'écran le sait).

---

## 5. Surfaces et interaction

Mêmes choix que smartsms-frontend — le raisonnement (perte de contexte,
partage par lien) ne dépend pas du domaine :

| Surface | Quand | Jamais pour |
| --- | --- | --- |
| **Modale** | décision courte, 1 à 3 champs | un formulaire long |
| **Panneau latéral** | détail sans perdre la liste (ex. détail d'un document sans quitter la liste de dossiers) | une action destructive |
| **Page dédiée** | création complexe (ex. créer un forfait, ses étapes) | une confirmation |
| **Popover** | filtre, sélecteur rapide | tout ce qui se valide |
| **`AlertDialog`** | confirmation destructive uniquement | une information |

**Cas à trancher tôt : la demande de remboursement.** Le barème
(`PaymentsService.REFUND_POLICY` backend) varie selon le statut de la
réservation (0 %, 50 % ou 100 % selon le cas). Ce n'est **jamais** une
simple confirmation `AlertDialog` : le pèlerin doit voir le pourcentage et
le montant exacts *avant* de confirmer — page dédiée ou modale `md`, jamais
`sm`.

**Cas à traiter avec prudence : le bouton SOS.** Un déclenchement alerte
immédiatement le guide et le contact d'urgence par SMS
(`GroupsService.triggerSos` backend). Une pression accidentelle a un coût
réel (fausse alerte à un guide sur le terrain). Recommandation à valider
avec le porteur produit avant construction : confirmation courte ou
pression maintenue plutôt qu'un simple tap — ce n'est pas un choix déjà
tranché côté backend, seulement une évidence de sécurité d'interaction à ne
pas escamoter.

### Défilement, responsive, cible tactile

Mêmes règles que smartsms-frontend (une seule zone défile par écran, pas de
défilement infini sur les listes, 360 px comme largeur de test obligatoire,
44×44 px minimum pour une cible tactile). Le raisonnement est indépendant du
domaine — voir leur `docs/design-system.md` §5/§6 pour le détail intégral,
directement transposable.

**`DataTable` en cartes sous `md`** : chaque carte porte l'identifiant (nom
du pèlerin, référence de paiement) en titre, le `StatusBadge`, deux à trois
champs utiles, les actions en menu — même mécanique que smartsms, appliquée
à des dossiers plutôt qu'à des contacts.

---

## 6. Responsive — points de rupture

Identiques à smartsms-frontend, échelle Tailwind par défaut avec un usage
arrêté :

| Rupture | Largeur | Ce qui change |
| --- | --- | --- |
| _(base)_ | < 640 px | une colonne, sidebar en panneau, tableaux en cartes |
| `sm` | ≥ 640 px | deux colonnes sur les grilles de KPI |
| `md` | ≥ 768 px | tableaux réels, filtres dépliés |
| `lg` | ≥ 1024 px | sidebar permanente |
| `xl` | ≥ 1280 px | densité maximale |

**Le pèlerin consulte majoritairement depuis un téléphone** (dossier suivi
en déplacement, document photographié puis téléversé depuis le mobile) —
plus encore que dans le cas de smartsms, où l'usage mobile est décrit comme
secondaire (un responsable de zone). Concevoir mobile-first pour l'espace
pèlerin, desktop-first acceptable pour le back-office agence/admin.

---

## 7. Catalogue des composants

### Lot A — Primitives (`components/ui/`)

Même méthode que smartsms-frontend : générées par shadcn, relues et
ajustées aux tokens, en trois vagues.

**Vague 1** — `button input label form card table badge skeleton`. Écran de
vérité : **liste des forfaits** (`GET /packages`) — liste, filtres, quatre
états, `StatusBadge`, montants en GNF en `font-mono`.

**Vague 2** — `select checkbox switch textarea radio-group dialog
dropdown-menu tooltip tabs separator avatar sonner`.

**Vague 3, au besoin réel** — `sheet popover command calendar progress
alert-dialog scroll-area breadcrumb`.

`PasswordInput` (champ agence/admin) : même spécification que
smartsms-frontend — label toujours visible, œil en `<button type="button">`,
`aria-pressed` porte l'état. Rien à adapter, ce n'est pas un composant lié
au domaine.

### Lot B — Transverses (`components/shared/`)

#### `DataTable<T>`

Même API regroupée par préoccupation que smartsms-frontend (voir leur
`docs/design-system.md` pour la définition complète des props — directement
réutilisable). **Différence à noter** : ici, la pagination est **toujours**
côté client — aucun endpoint ne pagine côté serveur à ce jour (voir
`docs/contrat-api.md`), donc pas de branche « pagination serveur » à
prévoir dans une première version.

#### `Can`

```ts
interface CanProps {
  role: Role | Role[];   // 'pilgrim' | 'agency' | 'guide' | 'admin'
  mode?: "all" | "any";  // sans objet avec un seul rôle requis dans la
                          // majorité des cas — utile si un écran admet
                          // plusieurs rôles
  fallback?: ReactNode;
  children: ReactNode;
}
```

Plus simple que le `<Can do="permission">` de smartsms : pas de matrice de
permissions à interroger, le rôle suffit avec les quatre valeurs actuelles.
**Toujours passer par ce composant plutôt que `user.role === 'agency'` en
dur** — le jour où un rôle se subdivise (ADR 0021 backend), un seul endroit
change.

#### `StatusBadge`

```ts
// config/status-registry.ts — LE seul endroit où un statut reçoit
// une couleur et un libellé français.
export const statusRegistry = {
  booking: {
    pending_payment: { label: "Paiement en attente", tone: "pending" },
    confirmed: { label: "Confirmée", tone: "success" },
    cancelled: { label: "Annulée", tone: "danger" },
    completed: { label: "Terminée", tone: "success" },
  },
  payment: {
    pending: { label: "En attente", tone: "pending" },
    succeeded: { label: "Réussi", tone: "success" },
    failed: { label: "Échoué", tone: "danger" },
    refunded: { label: "Remboursé", tone: "warning" },
  },
  document: { /* pending / validated / rejected */ },
  agency: { /* pending / approved / rejected */ },
  package: { /* open / full / closed */ },
  dossierStep: { /* pending / in_progress / done */ },
} as const;
```

```tsx
<StatusBadge kind="booking" value={booking.status} />
```

Neuf enums aujourd'hui — le principe (un seul registre, jamais un mapping
par écran) s'applique dès le premier, pas seulement au-delà d'un certain
volume.

#### `AsyncBoundary`

Identique dans l'esprit à smartsms-frontend :

```tsx
<AsyncBoundary
  query={bookingsQuery}
  empty={<EmptyState title="Aucune réservation" />}
  skeleton={<TableSkeleton rows={10} />}
>
  {(data) => <DataTable data={data} … />}
</AsyncBoundary>
```

#### `ReligiousContentNotice`

**Absent du catalogue smartsms — propre à ce produit, non négociable.**

```ts
interface ReligiousContentNoticeProps {
  validated: boolean;   // vient du backend, jamais déduit côté client
  className?: string;
}
```

Bandeau fixe, toujours visible tant que `validated` est `false`, posé
au-dessus de toute fiche de rite ou de Dua affichée : « Contenu à valider
par une personne qualifiée ». Ne se ferme pas, ne se réduit pas en icône —
c'est une exigence de conformité (`CLAUDE.md` backend), pas un avertissement
que l'utilisateur peut ignorer une fois lu.

#### Autres transverses

| Composant | Rôle |
| --- | --- |
| `ConfirmDialog` | confirmation d'action destructive |
| `FilterBar` | recherche + filtres synchronisés à l'URL |
| `StatCard` | KPI avec état de chargement |
| `ErrorState` | erreur exploitable + bouton Réessayer |
| `FileDropzone` | dépôt de document pèlerin — validation d'extension/taille avant envoi, jamais de prévisualisation mise en cache au-delà de la session |
| `CopyButton` | copie d'une référence de paiement ou d'un identifiant |
| `Money` | montant en GNF, `font-mono`, `tabular-nums` |
| `RelativeTime` | « il y a 3 jours », `title` avec la date absolue |

**Filtres dans l'URL, pas dans un `useState`** — même règle, même raison
que smartsms-frontend.

### Lot C — Métier (`features/*/components/`)

Propres à Oumra & Hadj, sans équivalent chez smartsms.

#### `BookingStepTracker`

```ts
interface BookingStepTrackerProps {
  steps: Array<{
    key: "payment" | "visa" | "flight" | "vaccination" | "documents";
    status: "pending" | "in_progress" | "done";
    completedAt?: string;
  }>;
}
```

Visualise le dossier comme une checklist ordonnée, pas un tableau — c'est ce
qu'un pèlerin anxieux regarde en premier en ouvrant l'app.

#### `DocumentUploader`

Dépôt d'un document pèlerin (`passport`, `visa`, `flight_ticket`,
`vaccination_certificate`). Affiche le `StatusBadge` (`pending` /
`validated` / `rejected`) et le motif de rejet s'il existe. **Ne
prévisualise jamais depuis un cache local** : la lecture passe par
`GET /documents/:id/access-url`, une URL signée à courte durée de vie — un
composant qui garderait l'image en mémoire au-delà de l'affichage
contournerait la raison d'être de cette URL (ADR 0008 backend).

#### `RefundRequestFlow`

Affiche le barème applicable **avant** la demande — jamais un bouton
« Annuler » nu qui déclenche un remboursement dont le montant surprend
l'utilisateur après coup.

#### `TrustScoreBadge` / `AgencyTrustCard`

Consomme `GET /reviews/agency/:id/trust-score`. **N'invente jamais de
valeur** : `score`, `reviewAverage` et `completionRate` peuvent être
`undefined` (agence neuve) — l'afficher comme « nouveau » plutôt que comme
un zéro, qui laisserait croire à une mauvaise note.

#### `RiteProgressChecklist`

Compteurs tawaf/sai, rites complétés — **toujours accompagné de
`ReligiousContentNotice`** tant que la fiche source n'est pas validée.

#### `TripSummaryBooklet`

Vue du livret souvenir (`GET /trip-summary/:bookingId`). **N'affiche que ce
que le backend renvoie réellement** : pas d'album photo, pas de suivi
individuel des Duas — ces idées du brainstorm n'ont pas de support backend
aujourd'hui (voir le commentaire de `TripSummaryShape` côté backend). Un
écran qui les simulerait tromperait l'utilisateur sur ce qui est
effectivement enregistré.

#### `LegalDocumentComplianceList`

Documents légaux d'une agence avec alerte d'expiration
(`GET /agencies/me/legal-documents/alerts`) — distingue visuellement
`expired` (`state-danger`) de `expiring_soon` (`state-warning`).

#### `CalendarSubscriptionCard`

Affiche l'URL d'abonnement ICS (`GET /agencies/me/calendar-subscription`)
avec `CopyButton`, et l'action « Régénérer le lien » — **avertir clairement**
que régénérer invalide l'ancien lien dans tout calendrier déjà abonné
(Google/Outlook), avant de le faire.

#### `SosButton`

Voir la mise en garde d'interaction en §5. Toujours visible dans l'espace
pèlerin authentifié, jamais dans un menu secondaire.

---

## 8. Modèles d'écran

Mêmes trois formes que smartsms-frontend :

**Liste** — `PageHeader` (titre + action primaire) · `FilterBar` ·
`DataTable` · pagination client. Filtres dans l'URL.

**Détail** — `PageHeader` avec fil d'Ariane · résumé en `StatCard` ·
`Tabs` pour les sections (ex. un dossier : Étapes / Documents / Paiements /
Avis) · actions destructives regroupées en bas.

**Formulaire** — une colonne, largeur maximale 640 px. Validation au
`blur`. Barre d'actions collée en bas sur mobile.

---

## 9. Écriture

Mêmes principes que smartsms-frontend : français, tutoiement exclu, un
bouton dit ce qui se passe et survit à l'action, les erreurs ne s'excusent
pas et ne sont jamais vagues, les écrans vides proposent l'étape suivante.

> ✗ « Une erreur est survenue. »
> ✓ « Votre document a été refusé : la photo du passeport est illisible.
> Reprenez-la avec un meilleur éclairage. »

> ✗ « Aucune donnée. »
> ✓ « Aucun document déposé pour le moment. Téléversez votre passeport pour
> démarrer votre dossier. » + le bouton.

Tous les textes dans `messages/fr.json`. Aucune chaîne en dur, y compris les
messages d'erreur.
