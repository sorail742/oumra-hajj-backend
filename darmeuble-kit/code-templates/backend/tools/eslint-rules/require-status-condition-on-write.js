'use strict';

// Règle ESLint personnalisée — verrou en base sur les écritures financières.
//
// Adaptée telle quelle de
// `smartsms-backend/tools/eslint-rules/require-status-condition-on-write.js`
// — la logique AST ne dépend d'aucun nom de champ précis, seule la
// configuration passée depuis `eslint.config.mjs` (option `models`,
// `quotaFields`) change d'un projet à l'autre. Voir
// docs/backend/paiements-djomy.md pour le motif `finalizeTransaction` que
// cette règle impose.
//
// Impose le motif « `updateMany` conditionné sur `status` » sur les tables
// où une lecture-puis-écriture non atomique produit un double-crédit ou
// une double-activation sous webhook Djomy concurrent :
//
//     await tx.payment.updateMany({
//       where: { id, status: { notIn: ['succeeded'] } },
//       data: { status: 'succeeded', confirmedAt: new Date() },
//     });
//
// Le `where` porte la garde de statut : c'est l'`UPDATE` lui-même qui
// tranche, sous le verrou de ligne PostgreSQL. Deux webhooks concurrents ne
// peuvent donc pas passer tous les deux.
//
// Trois situations sont signalées :
//   (A) `payment.update(...)` ou `subscription.update(...)` — la forme
//       `.update()` seule ne permet pas de porter la garde de statut dans
//       le `WHERE` (elle lève quand rien ne correspond).
//   (B) `.updateMany(...)` sur ces mêmes tables sans clef `status` dans
//       `where`.
//   (C) Toute écriture `{ <champ>: { increment | decrement } }` sans clef
//       `status` (ni `version`) dans `where` — motif de crédit atomique
//       (ex. compteur d'unités occupées d'un immeuble).

const TARGET_METHODS = new Set(['update', 'updateMany', 'upsert']);

function keyName(node) {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'Literal') return String(node.value);
  return null;
}

function findProperty(objectExpression, name) {
  if (!objectExpression || objectExpression.type !== 'ObjectExpression') {
    return null;
  }
  return (
    objectExpression.properties.find(
      (p) => p.type === 'Property' && !p.computed && keyName(p.key) === name,
    ) ?? null
  );
}

function collectWhereKeys(node) {
  const keys = new Set();
  if (!node || node.type !== 'ObjectExpression') return keys;
  for (const prop of node.properties) {
    if (prop.type !== 'Property' || prop.computed) continue;
    const name = keyName(prop.key);
    if (!name) continue;
    if (name === 'AND' || name === 'OR' || name === 'NOT') {
      if (prop.value.type === 'ArrayExpression') {
        for (const el of prop.value.elements) {
          if (el) for (const k of collectWhereKeys(el)) keys.add(k);
        }
      } else if (prop.value.type === 'ObjectExpression') {
        for (const k of collectWhereKeys(prop.value)) keys.add(k);
      }
      continue;
    }
    keys.add(name);
  }
  return keys;
}

/**
 * Cherche dans `data` (ObjectExpression) une écriture atomique
 * `{ <field>: { increment | decrement: ... } }` sur un des champs
 * configurés. Renvoie le nom du champ concerné, ou null.
 */
function findQuotaCounterWrite(dataNode, quotaFields) {
  if (!dataNode || dataNode.type !== 'ObjectExpression') return null;
  for (const prop of dataNode.properties) {
    if (prop.type !== 'Property' || prop.computed) continue;
    const fieldName = keyName(prop.key);
    if (!fieldName || !quotaFields.includes(fieldName)) continue;
    if (prop.value.type !== 'ObjectExpression') continue;
    const hasIncrement = prop.value.properties.some(
      (p) =>
        p.type === 'Property' &&
        !p.computed &&
        (keyName(p.key) === 'increment' || keyName(p.key) === 'decrement'),
    );
    if (hasIncrement) return fieldName;
  }
  return null;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Impose le motif `updateMany` conditionné sur `status` pour les écritures financières sensibles (Payment, Subscription, compteurs atomiques) — évite le double-crédit sous webhook Djomy concurrent.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          models: {
            type: 'object',
            additionalProperties: {
              type: 'object',
              properties: {
                statusFields: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 1,
                },
              },
              additionalProperties: false,
            },
          },
          quotaFields: {
            type: 'array',
            items: { type: 'string' },
          },
          quotaGuardKeys: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      plainUpdateForbidden:
        '`{{model}}.{{method}}(...)` : utilise `updateMany({ where: { id, {{statusField}}: { notIn: [...] } }, data })` puis contrôle `count` (motif finalizeTransaction, docs/backend/paiements-djomy.md). La forme `update()` ne porte pas la garde de statut dans le `WHERE`.',
      updateManyMissingStatus:
        '`{{model}}.updateMany(...)` sans clef `{{statusField}}` dans `where` : ajoute la condition de statut pour poser le verrou de ligne.',
      quotaIncrementMissingGuard:
        'Crédit atomique (`{{field}}` via `{{op}}`) sans garde `{{guards}}` dans `where` : deux webhooks concurrents créditent deux fois. Suivre le motif finalizeTransaction.',
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const models = options.models ?? {};
    const quotaFields = options.quotaFields ?? [];
    const quotaGuardKeys = options.quotaGuardKeys ?? [
      'status',
      'statut',
      'version',
    ];

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type !== 'MemberExpression' ||
          callee.computed ||
          callee.property.type !== 'Identifier'
        ) {
          return;
        }
        const methodName = callee.property.name;
        if (!TARGET_METHODS.has(methodName)) return;

        const modelAccess = callee.object;
        if (
          modelAccess.type !== 'MemberExpression' ||
          modelAccess.computed ||
          modelAccess.property.type !== 'Identifier'
        ) {
          return;
        }
        const modelName = modelAccess.property.name;

        const arg = node.arguments[0];
        const argIsObject = arg && arg.type === 'ObjectExpression';
        const whereProp = argIsObject ? findProperty(arg, 'where') : null;
        const dataProp = argIsObject ? findProperty(arg, 'data') : null;
        const whereKeys =
          whereProp && whereProp.value.type === 'ObjectExpression'
            ? collectWhereKeys(whereProp.value)
            : new Set();

        // (A/B) Modèle explicitement classé sensible
        const modelConfig = models[modelName];
        if (modelConfig) {
          const statusFields = modelConfig.statusFields ?? ['status'];
          const primaryStatusField = statusFields[0];
          if (methodName === 'update' || methodName === 'upsert') {
            context.report({
              node,
              messageId: 'plainUpdateForbidden',
              data: {
                model: modelName,
                method: methodName,
                statusField: primaryStatusField,
              },
            });
            return;
          }
          if (methodName === 'updateMany') {
            const hasStatus = statusFields.some((s) => whereKeys.has(s));
            if (!hasStatus) {
              context.report({
                node,
                messageId: 'updateManyMissingStatus',
                data: { model: modelName, statusField: primaryStatusField },
              });
              // Pas de `return` : on laisse aussi (C) signaler un crédit
              // non gardé — deux violations distinctes sur le même appel
              // doivent produire deux messages.
            }
          }
        }

        // (C) Crédit atomique via increment/decrement — quel que soit le modèle
        if (quotaFields.length > 0 && dataProp) {
          const field = findQuotaCounterWrite(dataProp.value, quotaFields);
          if (field) {
            const hasGuard = quotaGuardKeys.some((k) => whereKeys.has(k));
            if (!hasGuard) {
              context.report({
                node,
                messageId: 'quotaIncrementMissingGuard',
                data: {
                  field,
                  op: methodName,
                  guards: quotaGuardKeys.join(' | '),
                },
              });
            }
          }
        }
      },
    };
  },
};

module.exports = rule;
