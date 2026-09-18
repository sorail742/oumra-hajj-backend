/**
 * Fabrique centrale des clés TanStack Query. Interdit d'écrire un tableau
 * de clé en dur dans un composant — voir docs/frontend/socle-frontend.md.
 *
 * Domaines calqués sur les modules backend (docs/backend/socle-backend.md
 * §3) — à compléter au fur et à mesure des écrans.
 */

type Filtres = Record<string, unknown>;

export const keys = {
  organizations: {
    all: ['organizations'] as const,
    me: () => [...keys.organizations.all, 'me'] as const,
    detail: (id: string) => [...keys.organizations.all, 'detail', id] as const,
  },

  buildings: {
    all: ['buildings'] as const,
    list: (f: Filtres) => [...keys.buildings.all, 'list', f] as const,
    detail: (id: string) => [...keys.buildings.all, 'detail', id] as const,
    occupancyPlan: (id: string) =>
      [...keys.buildings.all, 'occupancy-plan', id] as const,
  },

  units: {
    all: ['units'] as const,
    byBuilding: (buildingId: string) =>
      [...keys.units.all, 'building', buildingId] as const,
    detail: (id: string) => [...keys.units.all, 'detail', id] as const,
  },

  tenants: {
    all: ['tenants'] as const,
    list: (f: Filtres) => [...keys.tenants.all, 'list', f] as const,
    detail: (id: string) => [...keys.tenants.all, 'detail', id] as const,
    history: (id: string) => [...keys.tenants.all, 'history', id] as const,
  },

  leases: {
    all: ['leases'] as const,
    list: (f: Filtres) => [...keys.leases.all, 'list', f] as const,
    detail: (id: string) => [...keys.leases.all, 'detail', id] as const,
    mine: () => [...keys.leases.all, 'mine'] as const, // espace locataire
  },

  rentSchedules: {
    all: ['rent-schedules'] as const,
    byLease: (leaseId: string) =>
      [...keys.rentSchedules.all, 'lease', leaseId] as const,
    overdue: (f: Filtres) =>
      [...keys.rentSchedules.all, 'overdue', f] as const,
  },

  payments: {
    all: ['payments'] as const,
    byLease: (leaseId: string) =>
      [...keys.payments.all, 'lease', leaseId] as const,
    verify: (providerReference: string) =>
      [...keys.payments.all, 'verify', providerReference] as const,
  },

  expenses: {
    all: ['expenses'] as const,
    byBuilding: (buildingId: string, f: Filtres) =>
      [...keys.expenses.all, 'building', buildingId, f] as const,
  },

  maintenanceRequests: {
    all: ['maintenance-requests'] as const,
    list: (f: Filtres) => [...keys.maintenanceRequests.all, 'list', f] as const,
    mine: () => [...keys.maintenanceRequests.all, 'mine'] as const,
  },

  documents: {
    all: ['documents'] as const,
    byLease: (leaseId: string) =>
      [...keys.documents.all, 'lease', leaseId] as const,
  },

  subscriptions: {
    all: ['subscriptions'] as const,
    current: () => [...keys.subscriptions.all, 'current'] as const,
    plans: () => [...keys.subscriptions.all, 'plans'] as const,
  },

  notifications: {
    all: ['notifications'] as const,
    mine: () => [...keys.notifications.all, 'mine'] as const,
  },

  auth: {
    all: ['auth'] as const,
    me: () => [...keys.auth.all, 'me'] as const,
  },
} as const;
