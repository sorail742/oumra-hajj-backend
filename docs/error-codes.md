# Codes d'erreur et format de réponse

## Format standard

Toute erreur passe par `HttpExceptionFilter`
(`src/common/filters/http-exception.filter.ts`) et répond au format :

```json
{
  "statusCode": 404,
  "timestamp": "2026-09-03T10:00:00.000Z",
  "path": "/api/v1/bookings/abc123",
  "message": "Réservation introuvable"
}
```

`message` peut être une chaîne (erreur unique) ou un tableau de chaînes
(erreurs de validation DTO, une par champ invalide).

## Codes HTTP utilisés

| Code | Exception NestJS | Quand |
|---|---|---|
| 400 | `BadRequestException` | DTO invalide, ou règle métier violée sans notion de conflit d'état (ex. rôle incorrect pour une assignation) |
| 401 | `UnauthorizedException` | JWT absent/invalide/expiré, OTP invalide/expiré, identifiants agence incorrects, compte suspendu |
| 403 | `ForbiddenException` | Utilisateur authentifié mais pas autorisé sur **cette** ressource précise (ownership) — voir `auth-flow.md` |
| 404 | `NotFoundException` | Ressource inexistante (`findByIdOrFail` et équivalents) |
| 409 | `ConflictException` | État incompatible avec l'action demandée (forfait complet, agence non validée, avis déjà déposé) |
| 500 | (non intentionnel) | Erreur non prévue — journalisée par le filtre, jamais de détail exposé au client |

## Catalogue des situations métier

| Situation | Module | Exception |
|---|---|---|
| Code OTP invalide/expiré, ou tentatives épuisées | `auth` | `UnauthorizedException` |
| Compte suspendu (`isActive: false`) | `auth`, `users` | `UnauthorizedException` |
| Email déjà utilisé à l'inscription agence | `agencies` | `ConflictException` |
| Agence pas encore validée par l'admin | `agencies`, `packages` | `ConflictException` (`assertApproved`) |
| Forfait complet ou fermé | `packages`, `bookings` | `ConflictException` |
| Réservation/paiement/document/groupe hors périmètre de l'appelant | `bookings`, `payments`, `documents`, `groups` | `ForbiddenException` |
| Callback paiement sur référence inconnue | `payments` | `NotFoundException` |
| Avis déjà déposé pour une réservation | `reviews` | `ConflictException` |
| Réservation non éligible à un avis (statut) | `reviews` | `BadRequestException` |
| Utilisateur désigné guide sans le rôle `guide` | `groups` | `BadRequestException` |
| SOS déclenché hors groupe | `groups` | `ForbiddenException` |

## Règle de conception

Un service qui détecte une situation d'erreur métier lève l'exception NestJS
adaptée directement — il ne retourne jamais `null`/`undefined` silencieusement
pour signaler une erreur (sauf cas explicitement documenté, ex. recherche
optionnelle). Voir `coding-rules-backend.md`.
