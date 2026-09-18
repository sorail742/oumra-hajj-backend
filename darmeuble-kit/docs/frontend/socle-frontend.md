# DarMeuble — Socle Frontend

Document de référence pour la mise en place du frontend Next.js de
DarMeuble. À lire avec `docs/cahier-des-charges.md` et
`docs/backend/socle-backend.md` (le contrat API en dépend directement).

Repris pour l'essentiel d'`oumra-hadj-web-kit` (même méthode : proxy BFF,
tokens outillés, quatre états, registre de statuts) — ce document ne répète
pas les principes génériques déjà détaillés là-bas, il documente ce qui est
propre à DarMeuble.

---

## 0. Décisions actées

| Sujet | Décision |
| --- | --- |
| Framework | Next.js App Router, TypeScript strict, épinglé sans `^` |
| Trois espaces distincts | `(organization)` — propriétaire/gestionnaire/comptable ; `(tenant)` — locataire ; `(super-admin)` — équipe DarMeuble (cahier des charges §6.2) |
| Auth | Cookie `httpOnly` pour l'access token (posé par le proxy Next), cookie `httpOnly` pour le refresh token (posé **directement par le backend**, voir `docs/backend/adr/0004-*.md`) |
| Contrat de réponse API | `{success,data,meta}` / `{success:false,error}` — enveloppe à déballer dans `lib/api/client.ts`, contrairement à `oumra-hadj-web` qui consomme une réponse brute |
| Design | Identité visuelle propre à DarMeuble (immobilier, confiance, sérieux administratif) — voir `docs/frontend/design-system.md` §1 |
| Devise | GNF exclusivement (cahier des charges §8) |
| Langue | Français exclusivement en v1 |

### Différence structurante avec `oumra-hadj-web` : l'enveloppe de réponse

**Ne pas réutiliser tel quel `lib/api/client.ts` d'`oumra-hadj-web-kit`.**
Ce projet frère consomme une réponse brute (pas d'enveloppe) parce que son
backend n'en a pas. Le backend DarMeuble, lui, applique `ResponseInterceptor`/
`AllExceptionsFilter` comme smartsms-backend — le client HTTP doit donc
déballer `data`/`meta` sur le succès et lire `error.message`/`error.code`
sur l'échec, sur le modèle du client `smartsms-frontend` (voir
`docs/frontend/contrat-api.md`).

---

## 1. Arborescence

```
src/
├── app/
│   ├── (public)/                 # login, otp (locataire), mot-de-passe-oublie
│   ├── (organization)/           # propriétaire / gestionnaire / comptable
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── buildings/            # module 1
│   │   ├── tenants/               # module 2
│   │   ├── leases/                # module 3
│   │   ├── payments/              # module 4
│   │   ├── invoices/              # module 5
│   │   ├── expenses/              # module 6
│   │   ├── maintenance/           # module 7
│   │   ├── documents/             # module 10
│   │   ├── subscription/          # module 11 (vue organisation cliente)
│   │   └── settings/              # module 12
│   ├── (tenant)/                  # espace locataire
│   │   ├── layout.tsx
│   │   ├── my-lease/
│   │   ├── payments/
│   │   └── maintenance/
│   ├── (super-admin)/             # équipe DarMeuble
│   │   ├── organizations/
│   │   └── subscription-plans/
│   ├── api/                       # Route Handlers — proxy BFF
│   ├── layout.tsx
│   └── providers.tsx
├── components/{ui,shared,layout}/
├── features/<domaine>/{api,components,hooks,schemas.ts,types.ts}
├── lib/{api,auth,format}/
├── config/                        # status-registry, navigation par rôle
└── stores/
```

**Trois espaces, pas un layout unique avec des conditions de rôle
partout.** Le cahier des charges (§6.2) décrit trois interfaces
distinctes ("espaces distincts pour le Super Administrateur, les
organisations... et les locataires") — les traiter comme trois groupes de
routes Next.js séparés, chacun avec son propre layout et sa propre
navigation, plutôt qu'un `AppShell` unique qui masque/affiche des sections
selon le rôle. Un locataire n'a jamais besoin de voir la structure de
navigation d'un gestionnaire, même vide.

**`buildings` porte les unités (`units`) comme sous-domaine**, miroir de
la décision backend (`docs/backend/socle-backend.md` §3) — pas un domaine
frontend séparé tant que sa complexité propre ne le justifie pas.

---

## 2. Rôles et navigation

Cinq rôles à plat (voir `docs/backend/socle-backend.md` §6) :

```
super_admin · owner · manager · accountant · tenant
```

`<Can role={[...]}>` teste le rôle, comme dans `oumra-hadj-web-kit`. **Deux
nuances propres à DarMeuble** :

- Un `owner`/`accountant` voit tous les immeubles de son organisation ; un
  `manager` ne voit que ceux qui lui sont assignés (cahier des charges §4)
  — ce n'est pas qu'une garde de rendu, `<Can>` ne suffit pas seule : la
  liste des immeubles retournée par l'API est déjà filtrée côté serveur
  (voir `docs/backend/multi-tenant.md` §"Portée intra-organisation"), le
  frontend n'a pas à reproduire ce filtre, seulement à ne pas supposer
  qu'un `manager` voit "tout".
- Le `super_admin` navigue dans un espace **complètement séparé**
  (`(super-admin)/`), pas une bascule de contexte dans l'espace
  organisation — il n'appartient à aucune organisation (§4).

---

## 3. Authentification

Deux parcours, comme au backend (`docs/backend/adr/0004-*.md`) :

- **Locataire** : téléphone + OTP SMS.
- **Propriétaire / gestionnaire / comptable / super admin** : email + mot
  de passe.

**Le refresh token est posé par le backend, pas par le proxy Next** — voir
`docs/backend/adr/0004-*.md` §Justification. Conséquence concrète pour le
proxy : il relaie le `Set-Cookie` du backend tel quel sur les routes d'auth
(`/api/auth/login`, `/api/auth/otp/verify`, `/api/auth/refresh`) plutôt que
de le reconstruire lui-même — différence à ne pas manquer en copiant le
proxy d'`oumra-hadj-web-kit`, qui pose les deux cookies lui-même parce que
son backend renvoie les deux jetons en JSON.

---

## 4. Ce qui reste à trancher avant la Phase 2 (frontend)

Voir `docs/backend/socle-backend.md` §0bis — les mêmes inconnues côté
backend bloquent des écrans frontend précis :

| Inconnue backend | Écran frontend bloqué |
| --- | --- |
| Contrat réel Djomy | `PaymentFlow` (paiement de loyer, §9.2) |
| Modèle de tarification des plans | Écran de choix de plan, page de facturation organisation |
| Modèles de contrat PDF | Aperçu de bail avant acceptation (§5.3, §9.1) |

Ne pas construire ces écrans en supposant une réponse — coder d'abord
l'écran qui affiche l'échéancier et l'historique (données déjà bien
définies par le cahier des charges), qui ne dépend d'aucune de ces
inconnues.
