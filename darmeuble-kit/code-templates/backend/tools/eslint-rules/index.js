'use strict';

// Plugin ESLint local — regroupe les règles personnalisées propres à
// DarMeuble. Chargé depuis `eslint.config.mjs`.
//
// Adapté de `smartsms-backend/tools/eslint-rules/index.js`. Ces règles
// n'encodent pas ce que `typescript-eslint` fait déjà : elles vérifient des
// invariants métier qu'aucun ruleset générique ne peut connaître (isolation
// multi-tenant Prisma, motif finalizeTransaction sur les paiements Djomy).
// Voir docs/backend/multi-tenant.md et docs/backend/paiements-djomy.md.

const requireOrganizationIdFilter = require('./require-organization-id-filter.js');
const requireStatusConditionOnWrite = require('./require-status-condition-on-write.js');

module.exports = {
  meta: {
    name: 'darmeuble',
    version: '0.1.0',
  },
  rules: {
    'require-organization-id-filter': requireOrganizationIdFilter,
    'require-status-condition-on-write': requireStatusConditionOnWrite,
  },
};
