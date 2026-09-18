# DarMeuble — Intégration du paiement Djomy

## Hypothèse à vérifier en premier

**Aucun contrat technique Djomy n'a été vérifié pour produire ce
document.** Le cahier des charges lui-même le traite comme une hypothèse
(§12.3 : "Djomy expose une API/des webhooks exploitables pour
l'intégration — à confirmer techniquement en phase de cadrage"). Tout ce
qui suit décrit **le pattern à appliquer**, pas les noms de champs, URLs ou
en-têtes réels de l'API Djomy — à remplacer par les vraies valeurs dès que
la documentation Djomy est disponible, sans changer la structure.

## Le pattern : un provider abstrait, pas un appel Djomy dispersé

Même raisonnement qu'Oumra-hadj-project pour son intégration CinetPay
(`docs/adr/0006-gestion-paiements.md` de ce projet) : développer et tester
le reste de la plateforme sans dépendre d'un compte marchand Djomy actif,
et pouvoir remplacer Djomy si le choix change sans toucher au reste du
code.

```ts
// modules/payments/providers/payment-provider.interface.ts
export const PAYMENT_PROVIDER = 'PAYMENT_PROVIDER';

export interface PaymentInitiationRequest {
  organizationId: string;
  amount: number;
  currency: 'GNF';
  purpose: 'rent' | 'deposit' | 'subscription';
  referenceId: string; // leaseId, paymentId ou subscriptionId selon purpose
}

export interface InitiatedPayment {
  providerReference: string;
  paymentUrl?: string; // si Djomy propose une redirection plutôt qu'un paiement in-app
}

export interface PaymentProvider {
  initiate(request: PaymentInitiationRequest): Promise<InitiatedPayment>;
  /** Réconciliation active — voir §"Le risque que le cahier des charges identifie lui-même". */
  checkStatus(providerReference: string): Promise<'pending' | 'succeeded' | 'failed'>;
}
```

`MockPaymentProvider` (développement, voir Oumra-hadj-project
`mock-payment-provider.service.ts` comme gabarit direct) : simule les
statuts sans jamais appeler Djomy, avec un avertissement explicite "DEV
ONLY" dans les logs. `DjomyPaymentProvider` : implémentation réelle, à
écrire une fois le contrat Djomy vérifié.

## Le risque que le cahier des charges identifie lui-même

> "Échec ou retard des webhooks Djomy → Statut de paiement non mis à jour
> automatiquement" (§12.2), mitigation : "vérification périodique du statut
> des transactions en complément des webhooks".

Deux mécanismes, pas un seul :

1. **Webhook** — chemin rapide, met à jour le statut dès réception.
2. **Réconciliation périodique** (`checkStatus` ci-dessus, appelé par un
   job planifié) — filet de sécurité pour les paiements restés `pending`
   au-delà d'un délai raisonnable (ex. 15 minutes), qui interroge Djomy
   activement plutôt que d'attendre indéfiniment un webhook qui n'arrivera
   peut-être jamais.

**Ne jamais activer un abonnement ou confirmer un loyer payé sur la seule
foi du contenu d'une requête entrante** (webhook ou retour navigateur) —
règle reprise mot pour mot de `docs/coding-rules-backend.md` §"Paiements
(LengoPay)" de smartsms-backend, qui s'applique à l'identique ici : le
webhook déclenche une vérification active du statut auprès de Djomy, il ne
suffit pas à lui seul à créditer quoi que ce soit.

## Écriture financière — jamais un `update` nu

Deuxième règle reprise de smartsms-backend (`require-status-condition-on-write`,
issue #87 chez eux : deux webhooks concurrents lisaient `pending` puis
créditaient deux fois sous `READ COMMITTED`). Toute confirmation de
paiement passe par une mise à jour **gardée par une condition de statut** :

```ts
// Jamais ça :
await this.prisma.payment.update({
  where: { id: paymentId },
  data: { status: 'succeeded' },
});

// Toujours ça :
const result = await this.prisma.payment.updateMany({
  where: { id: paymentId, status: 'pending' }, // la garde
  data: { status: 'succeeded', confirmedAt: new Date() },
});
if (result.count === 0) {
  // déjà confirmé (ou statut inattendu) par un appel concurrent — no-op,
  // pas une erreur : c'est le comportement voulu, pas un cas à traiter.
  return;
}
```

Le même principe s'applique à l'activation d'un abonnement SaaS
(`Subscription.status`) et à tout crédit atomique
(`{ field: { increment } }`) — jamais sans condition de statut/version dans
le `where`. Voir `docs/backend/multi-tenant.md` pour la règle ESLint
équivalente côté isolation tenant ; une deuxième règle du même esprit
(`darmeuble/require-status-condition-on-write`, reprise telle quelle de
smartsms-backend) couvre celle-ci.

## Journalisation — exigée par le cahier des charges lui-même

> "Journalisation de toutes les transactions (succès, échec, en attente)
> pour audit et réconciliation" (§6.3).

Chaque tentative de paiement (pas seulement les succès) crée un
enregistrement `Payment` avec son statut réel — jamais seulement les
paiements réussis. C'est ce qui rend une réconciliation possible : sans
trace des tentatives échouées, impossible de savoir qu'un locataire a
essayé de payer et échoué.

## Paiement manuel — toujours en parallèle, jamais un remplacement provisoire

Le cahier des charges (§5.4, §12.2) exige que l'enregistrement manuel d'un
paiement (espèces, virement) par le gestionnaire reste disponible **en
permanence**, pas comme un repli temporaire en attendant que Djomy soit
prêt. Modéliser `Payment.method: 'djomy' | 'cash' | 'bank_transfer'` dès le
schéma de départ (voir `config-templates/backend/prisma/schema.prisma`) —
ne pas coder en supposant que tout paiement passe par un
`providerReference` Djomy.
