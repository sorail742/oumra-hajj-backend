# Configuration de l'authentification (environnement local)

Guide pratique pour faire tourner et tester l'auth en développement. Pour la
logique des flux, voir `auth-flow.md`.

## Variables d'environnement requises

Copier `.env.example` vers `.env` et renseigner au minimum :

```
JWT_ACCESS_SECRET=...       # secret fort, distinct par environnement
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=...      # différent du secret access
JWT_REFRESH_EXPIRES_IN=30d
OTP_TTL_SECONDS=300
OTP_CODE_LENGTH=6
```

Ne jamais réutiliser les mêmes secrets entre dev/staging/production — voir
`secrets-management.md`.

## Tester le flux OTP en local

Aucun fournisseur SMS n'est intégré (voir ADR 0006/0009, non tranchés).
`ConsoleOtpSender` (`src/modules/auth/otp/console-otp-sender.service.ts`)
journalise le code au lieu de l'envoyer :

```
[OTP DEV ONLY] Code 482913 pour +224620000000 — provider SMS réel non configuré (voir ADR 0006/0009).
```

1. `POST /api/v1/auth/otp/request { "phone": "+224620000000" }`
2. Lire le code dans les logs du serveur (`npm run start:dev`)
3. `POST /api/v1/auth/otp/verify { "phone": "+224620000000", "code": "482913" }`

## Tester le flux agence en local

1. `POST /api/v1/agencies/register` avec `contactEmail`, `password`, etc. —
   crée un utilisateur `role=agency` et une fiche agence en `pending`.
2. L'agence ne peut pas encore créer de forfait (`assertApproved` bloque) —
   il faut un compte `admin` pour l'approuver : `PATCH /api/v1/agencies/:id/approve`.
3. `POST /api/v1/auth/agency/login` avec les mêmes identifiants.

## Créer un compte admin en local

Aucun endpoint public ne crée de compte `admin` (volontaire — voir
`RolesGuard`). En développement, l'insérer directement en base :

```js
// mongosh (avant migration) — voir prisma/seed.ts après migration Prisma
db.users.insertOne({
  fullName: "Admin Dev",
  email: "admin@dev.local",
  passwordHash: "<bcrypt hash>",
  role: "admin",
  preferredLanguage: "fr",
  isActive: true,
});
```

## Remplacer un secret compromis

Si un secret JWT ou un token a fuité (ex. collé par erreur dans un outil,
un chat, un log) : le régénérer immédiatement (`JWT_ACCESS_SECRET`/
`JWT_REFRESH_SECRET`), ce qui invalide tous les tokens en circulation — les
utilisateurs devront se reconnecter. Voir `secrets-management.md`.
