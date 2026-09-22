import { tz } from "@date-fns/tz";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Formatage centralisé. **Aucun `toLocaleString` dans un composant.**
 *
 * Repris de smartsms-frontend pour les parties partagées avec ce projet
 * frère (devise GNF, fuseau Guinée) — voir le détail des écarts ci-dessous.
 */

const FUSEAU = "Africa/Conakry";

/**
 * Montant en francs guinéens : `1 500 000 GNF`.
 *
 * Repris tel quel de smartsms-frontend : `Package.currency` par défaut à
 * `"GNF"` côté backend (`prisma/schema.prisma`) confirme le même contexte
 * régional. `currencyDisplay: "code"` reste le bon choix pour la même
 * raison qu'eux : le contrat et les reçus de paiement parlent en « GNF »,
 * pas dans le symbole local que produirait `Intl` par défaut en `fr-GN`.
 *
 * **À vérifier si un jour un forfait est proposé dans une autre devise**
 * (`Package.currency` est un champ libre côté backend, pas une valeur
 * figée) : cette fonction suppose GNF, elle ne lit pas la devise réelle du
 * montant. Un montant dans une autre devise doit passer par une fonction
 * dédiée, pas par celle-ci avec un libellé faux.
 */
export function formatGNF(montant: number): string {
  return new Intl.NumberFormat("fr-GN", {
    style: "currency",
    currency: "GNF",
    currencyDisplay: "code",
    maximumFractionDigits: 0,
  }).format(montant);
}

export function formatNombre(valeur: number): string {
  return new Intl.NumberFormat("fr-FR").format(valeur);
}

/**
 * Pourcentage, `72,0 %`. Utilisé notamment pour `AgencyTrustScoreShape.completionRate`
 * (ratio 0–1 côté backend — multiplier par 100 avant d'appeler cette
 * fonction, ou adapter l'appelant selon la forme réelle reçue).
 */
export function formatPourcentage(valeur: number, decimales = 1): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valeur / 100);
}

/**
 * Numéro de téléphone lisible.
 *
 * **Différence avec smartsms-frontend** : leur `@IsPhoneNumber('GN')`
 * (implicite dans leur contexte) garantit un numéro guinéen à 9 chiffres.
 * Ici, `class-validator` valide avec `@IsPhoneNumber()` **sans région
 * imposée** (`src/modules/agencies/dto/register-agency.dto.ts` et
 * `src/modules/auth/dto/request-otp.dto.ts` côté backend) : un pèlerin ou
 * une agence peut, en théorie, avoir un numéro hors Guinée.
 *
 * Cette fonction reste optimisée pour le cas `+224` (probablement
 * majoritaire vu le contexte du produit), et **renvoie le numéro tel quel
 * s'il ne correspond pas à ce format** plutôt que de le découper au hasard
 * — même principe de repli que smartsms-frontend, pour la même raison :
 * un découpage faux est pire qu'une absence de mise en forme.
 */
export function formatTelephone(brut: string): string {
  const chiffres = brut.replace(/\D/g, "");
  const national = chiffres.startsWith("224") ? chiffres.slice(3) : chiffres;
  if (national.length !== 9) {
    return brut;
  }
  const groupes = [
    national.slice(0, 3),
    national.slice(3, 5),
    national.slice(5, 7),
    national.slice(7, 9),
  ];
  return `+224 ${groupes.join(" ")}`;
}

function versDate(iso: string | Date): Date {
  return typeof iso === "string" ? parseISO(iso) : iso;
}

/**
 * Fuseau du produit — le backend renvoie de l'ISO (UTC). Sans `in`, `format`
 * rendrait l'heure locale du navigateur de qui consulte, pas celle du
 * contexte métier (heure d'une échéance, d'un rendez-vous de dépôt de
 * document).
 */
const OPTIONS_DATE = {
  locale: fr,
  in: tz(FUSEAU),
} as const;

export function formatDate(iso: string | Date): string {
  return format(versDate(iso), "dd/MM/yyyy", OPTIONS_DATE);
}

export function formatDateHeure(iso: string | Date): string {
  return format(versDate(iso), "dd/MM/yyyy 'à' HH:mm", OPTIONS_DATE);
}

export function formatDateCourte(iso: string | Date): string {
  return format(versDate(iso), "dd/MM", OPTIONS_DATE);
}

/** « il y a 3 jours » — à accompagner d'un `title` portant la date absolue. */
export function formatRelatif(iso: string | Date): string {
  return formatDistanceToNow(versDate(iso), { addSuffix: true, locale: fr });
}

export const FUSEAU_PRODUIT = FUSEAU;
