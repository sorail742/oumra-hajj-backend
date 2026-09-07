# État applicatif et mémoire (hors base de données principale)

Ce document recense tout ce que l'API garde en état **en dehors** du modèle
de données métier principal (Prisma, voir ADR 0013) : ce qui expire, ce qui
est reconstruit, ce qui n'est volontairement pas persisté.
Utile pour raisonner sur la montée en charge multi-instance et sur ce qui
serait perdu en cas de redémarrage.

## État persistant à courte durée de vie (en base)

| Donnée | Table/collection | TTL / cycle de vie |
|---|---|---|
| Code OTP | `Otp` | 5 min par défaut (`OTP_TTL_SECONDS`), purgé à la vérification ; expiration vérifiée en application (`expiresAt`), pas de TTL natif côté Postgres |
| Refresh token | `RefreshToken` | Durée configurable (`JWT_REFRESH_EXPIRES_IN`, 30 j par défaut), révoqué à la rotation/déconnexion |

Ces deux tables sont volontairement **en base**, pas en cache mémoire
process, pour survivre à un redémarrage et fonctionner correctement avec
plusieurs instances de l'API derrière un load balancer.

## État en mémoire process (non partagé entre instances)

| Mécanisme | Où | Implication multi-instance |
|---|---|---|
| Rate limiting (`@nestjs/throttler`) | Guard global (`ThrottlerGuard`) | Compteur en mémoire par instance — avec plusieurs instances derrière un load balancer, la limite réelle est `limite × nombre d'instances`. À revoir (store Redis partagé) si le trafic le justifie — **nouvelle dépendance, nécessiterait un ADR** avant introduction (voir `CLAUDE.md`). |
| Notifications push/SMS | `NotificationsService.send()` | Envoi "best-effort" en `Promise` non attendue (`void Promise.all(...)`) — pas de file d'attente persistante. Une notification en cours d'envoi au moment d'un redémarrage peut être perdue. Voir ADR 0009 (mentionne explicitement une file d'attente à prévoir avant production). |

## Ce qui n'est délibérément PAS mis en mémoire/cache

- Les mots de passe en clair (jamais, même temporairement).
- Le contenu des documents sensibles (`documents`, voir ADR 0008) — seule la
  référence de stockage externe est manipulée par l'API.
- Les tokens JWT eux-mêmes ne sont pas stockés (seul le refresh token l'est,
  hashé) — un access token révoqué reste valide jusqu'à son expiration
  naturelle (courte, 15 min par défaut) : c'est un compromis assumé
  performance/révocation immédiate, voir ADR 0003.

## Pour un futur agent IA travaillant sur ce dépôt

Ce fichier documente la mémoire **applicative** (runtime). La mémoire propre
à l'assistant IA (préférences de l'utilisateur, historique de décisions
prises en conversation) est un mécanisme séparé, propre à l'outil utilisé
(ex. `CLAUDE.md`/`AGENTS.md` pour les règles persistantes du dépôt) — ne pas
confondre les deux dans ce fichier.
