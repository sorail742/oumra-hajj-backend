/**
 * Fabrique centrale des clés TanStack Query.
 *
 * **Interdit d'écrire un tableau de clé en dur dans un composant.** C'est la
 * première cause de cache qui ne s'invalide pas.
 *
 * La hiérarchie permet d'invalider par niveau : `keys.bookings.all` invalide
 * listes et détails d'un coup.
 *
 * Domaines calqués sur les modules réels du backend
 * (`Oumra-hadj-project/src/modules/`) — à compléter au fur et à mesure des
 * écrans, pas à remplir par anticipation d'un endpoint qui n'existe pas
 * encore.
 */

type Filtres = Record<string, unknown>;

export const keys = {
  agencies: {
    all: ["agencies"] as const,
    me: () => [...keys.agencies.all, "me"] as const,
    list: (f: Filtres) => [...keys.agencies.all, "list", f] as const,
    detail: (id: string) => [...keys.agencies.all, "detail", id] as const,
    legalDocuments: () => [...keys.agencies.all, "legal-documents"] as const,
    complianceAlerts: () =>
      [...keys.agencies.all, "compliance-alerts"] as const,
    calendarSubscription: () =>
      [...keys.agencies.all, "calendar-subscription"] as const,
  },

  packages: {
    all: ["packages"] as const,
    list: (f: Filtres) => [...keys.packages.all, "list", f] as const,
    mine: () => [...keys.packages.all, "mine"] as const,
    detail: (id: string) => [...keys.packages.all, "detail", id] as const,
  },

  bookings: {
    all: ["bookings"] as const,
    list: (f: Filtres) => [...keys.bookings.all, "list", f] as const,
    detail: (id: string) => [...keys.bookings.all, "detail", id] as const,
    tripSummary: (id: string) =>
      [...keys.bookings.all, "trip-summary", id] as const,
  },

  documents: {
    all: ["documents"] as const,
    mine: () => [...keys.documents.all, "mine"] as const,
    byBooking: (bookingId: string) =>
      [...keys.documents.all, "booking", bookingId] as const,
    accessUrl: (id: string) =>
      [...keys.documents.all, "access-url", id] as const,
  },

  payments: {
    all: ["payments"] as const,
    byBooking: (bookingId: string) =>
      [...keys.payments.all, "booking", bookingId] as const,
  },

  reviews: {
    all: ["reviews"] as const,
    mine: () => [...keys.reviews.all, "mine"] as const,
    byAgency: (agencyId: string) =>
      [...keys.reviews.all, "agency", agencyId] as const,
    trustScore: (agencyId: string) =>
      [...keys.reviews.all, "trust-score", agencyId] as const,
    satisfactionReport: () =>
      [...keys.reviews.all, "satisfaction-report"] as const,
  },

  rites: {
    all: ["rites"] as const,
    sheets: () => [...keys.rites.all, "sheets"] as const,
    myProgress: () => [...keys.rites.all, "my-progress"] as const,
  },

  groups: {
    all: ["groups"] as const,
    detail: (id: string) => [...keys.groups.all, "detail", id] as const,
  },

  messaging: {
    all: ["messaging"] as const,
    byBooking: (bookingId: string) =>
      [...keys.messaging.all, "booking", bookingId] as const,
  },

  auth: {
    all: ["auth"] as const,
    /**
     * Rôle et identité de l'utilisateur courant. **Aucune route `/me`
     * équivalente n'a été repérée dans le backend actuel** — le rôle vit
     * dans le payload du JWT. Cette clé sert le jour où un Route Handler
     * dédié l'expose côté serveur pour `<Can>` ; à retirer si ce choix
     * change (lecture directe du payload décodé côté client, par exemple).
     */
    me: () => [...keys.auth.all, "me"] as const,
  },
} as const;
