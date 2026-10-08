/**
 * Cellule CSV : guillemets doublés, et neutralisation des formules — un
 * texte saisi par un utilisateur commençant par = @ + - serait sinon
 * interprété par un tableur à l'ouverture. Exception : un numéro
 * (« +224 620… », « -5 ») reste intact, sinon chaque téléphone
 * international de la liste serait altéré.
 */
const DEBUT_DE_FORMULE = /^[=@\t\r]|^[+-](?![\d\s]+$)/;

export function celluleCsv(valeur: string | undefined): string {
  const texte = valeur ?? '';
  const neutralise = DEBUT_DE_FORMULE.test(texte) ? `'${texte}` : texte;
  return `"${neutralise.replace(/"/g, '""')}"`;
}

/** BOM UTF-8 : Excel affiche alors correctement les accents. */
export const BOM_UTF8 = '\uFEFF';
