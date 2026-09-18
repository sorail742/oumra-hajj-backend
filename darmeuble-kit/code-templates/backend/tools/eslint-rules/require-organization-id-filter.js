'use strict';

// Règle ESLint personnalisée — isolation multi-tenant.
//
// Adaptée de `smartsms-backend/tools/eslint-rules/require-client-id-filter.js`
// (clientId -> organizationId) — voir docs/backend/multi-tenant.md. La
// logique AST est générique (elle inspecte la forme d'un appel Prisma, pas
// un nom de champ précis), seule la configuration passée depuis
// `eslint.config.mjs` (option `models`) change d'un projet à l'autre.
//
// Impose la présence d'une clef de scoping (`organizationId`, ou une
// relation parente équivalente) dans le `where` d'une requête Prisma sur
// une table métier tenant-scopée.
//
// Portée d'application : à câbler dans `eslint.config.mjs` uniquement sur
// `**/*.repository.ts` (l'ADR-0003 impose que seuls les repositories
// touchent Prisma).
//
// La liste des modèles à contrôler est passée en option — ce plugin ne
// connaît pas le schéma Prisma réel. Un modèle absent de la config est
// ignoré : c'est ainsi qu'on exclut les tables globales (SubscriptionPlan)
// ou techniques (RefreshToken, OtpCode). Chaque valeur est un tableau des
// clefs `where` acceptées pour ce modèle — permet d'accepter aussi bien
// `organizationId` direct qu'une relation parente (ex. `unit` acceptera
// `organizationId` ou `buildingId` si l'appartenance passe par `Building`).

const DEFAULT_METHODS = [
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
];

/**
 * Collecte les noms de propriétés présents au premier niveau d'un
 * ObjectExpression, en descendant récursivement dans AND / OR / NOT.
 *
 * Approximation volontaire : sur un OR, on accepte qu'UNE branche
 * contienne la clef — imposer TOUTES les branches produit trop de faux
 * positifs à l'usage.
 */
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

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "Impose la présence d'un filtre `organizationId` (ou d'une relation parente équivalente) dans le `where` d'une requête Prisma sur une table métier tenant-scopée.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          models: {
            type: 'object',
            additionalProperties: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
          },
          methods: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingScope:
        'Requête Prisma sur `{{model}}.{{method}}` sans filtre tenant dans `where` : ajoute une des clefs `{{expected}}`. Isolation multi-tenant (docs/backend/multi-tenant.md).',
      missingWhere:
        'Requête Prisma sur `{{model}}.{{method}}` sans clause `where` : impose un filtre tenant explicite (`{{expected}}`).',
    },
  },

  create(context) {
    const options = context.options[0] ?? {};
    const models = options.models ?? {};
    const methods = new Set(options.methods ?? DEFAULT_METHODS);

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
        if (!methods.has(methodName)) return;

        const modelAccess = callee.object;
        if (
          modelAccess.type !== 'MemberExpression' ||
          modelAccess.computed ||
          modelAccess.property.type !== 'Identifier'
        ) {
          return;
        }
        const modelName = modelAccess.property.name;
        const acceptedKeys = models[modelName];
        if (!acceptedKeys) return;

        const expected = acceptedKeys.join(' | ');
        const arg = node.arguments[0];
        const whereProp = findProperty(
          arg && arg.type === 'ObjectExpression' ? arg : null,
          'where',
        );

        if (!whereProp || whereProp.value.type !== 'ObjectExpression') {
          context.report({
            node,
            messageId: 'missingWhere',
            data: { model: modelName, method: methodName, expected },
          });
          return;
        }

        const keys = collectWhereKeys(whereProp.value);
        const ok = acceptedKeys.some((k) => keys.has(k));
        if (!ok) {
          context.report({
            node,
            messageId: 'missingScope',
            data: { model: modelName, method: methodName, expected },
          });
        }
      },
    };
  },
};

module.exports = rule;
