# ADR-0005 — Provider de paiement abstrait pour Djomy

## Statut

Proposé

## Contexte

Le cahier des charges impose Djomy comme moyen de paiement (page de garde,
§6.3) pour deux flux distincts : le paiement de loyer par un locataire, et
le paiement d'abonnement SaaS par une organisation cliente. Aucun contrat
technique Djomy (API, format de webhook) n'a été vérifié au moment de la
rédaction de cet ADR — le cahier des charges le formule lui-même comme une
hypothèse à confirmer (§12.3).

`Oumra-hadj-project` a résolu un problème structurellement identique pour
CinetPay : développer et tester le reste de la plateforme sans dépendre
d'un compte marchand actif, via une interface `PaymentProvider` implémentée
d'abord par un provider de développement, puis par le fournisseur réel une
fois son contrat confirmé (voir son ADR 0006).

## Décision

**Une interface `PaymentProvider`**, sans dépendance à Djomy dans le reste
du code :

```ts
export interface PaymentProvider {
  initiate(request: PaymentInitiationRequest): Promise<InitiatedPayment>;
  checkStatus(providerReference: string): Promise<'pending' | 'succeeded' | 'failed'>;
}
```

`MockPaymentProvider` en développement (simule les statuts, avertissement
"DEV ONLY" explicite dans les logs). `DjomyPaymentProvider` : implémentation
réelle, écrite une fois le contrat Djomy vérifié — sans changer l'interface
ni le reste du code qui la consomme.

Voir `docs/backend/paiements-djomy.md` pour le détail complet (garde-fous
financiers, réconciliation périodique, paiement manuel toujours disponible
en parallèle).

## Justification

**Découplage du reste du système vis-à-vis d'un fournisseur non encore
vérifié.** Le cahier des charges lui-même identifie le risque
("Disponibilité et fiabilité de l'API/du service Djomy", §12.1) — une
interface abstraite permet à toute l'équipe (Phases 2 à 5) d'avancer sans
attendre la confirmation technique Djomy, qui dépend d'un tiers externe.

**Réutilisation directe d'un pattern déjà éprouvé.** Le même problème a
déjà été résolu une fois (Oumra-hadj/CinetPay) — reproduire la solution
plutôt que d'en inventer une nouvelle réduit le risque d'oublier une des
leçons déjà apprises (ex. ne jamais confirmer un paiement sur la seule foi
d'un webhook, voir `docs/backend/paiements-djomy.md`).

## Conséquences

- Deux flux distincts consomment la même interface :
  `payments.service.ts` (loyers) et `subscriptions.service.ts`
  (abonnements SaaS) — chacun avec son propre `PaymentInitiationRequest.purpose`,
  pas deux intégrations Djomy séparées.
- Le `providerReference` retourné par `initiate()` est la seule donnée
  Djomy stockée en base à long terme — jamais de détail de carte ou de
  compte mobile money.
- Une tâche planifiée de réconciliation (`checkStatus`) doit exister dès
  la Phase 3 (paiements), pas différée — c'est la mitigation que le cahier
  des charges prescrit lui-même pour le risque qu'il identifie.

## Alternatives écartées

**Appeler l'API Djomy directement depuis `PaymentsService`/`SubscriptionsService`.**
Écarté : couplerait deux modules métier distincts à un même fournisseur
externe non encore vérifié, et empêcherait tout développement du reste du
système avant la confirmation du contrat Djomy.
