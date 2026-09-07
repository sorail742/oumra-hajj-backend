/**
 * Bannière affichée au démarrage de l'application.
 *
 * Volontairement écrite sur `process.stdout` et non via le Logger Nest :
 * elle est décorative, ne doit pas être sérialisée dans les logs de
 * production, et s'affiche avant même que le logger applicatif soit prêt.
 * Même convention que sur smartsms-backend (voir docs/adr/0011-*).
 */

const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const LOGO = String.raw`
   ___  _   _ __  __ ____      _
  / _ \| | | |  \/  |  _ \    / \
 | | | | | | | |\/| | |_) |  / _ \
 | |_| | |_| | |  | |  _ <  / ___ \
  \___/ \___/|_|  |_|_| \_\/_/   \_\

  _   _    _    ____      _
 | | | |  / \  |  _ \    | |
 | |_| | / _ \ | | | |_  | |
 |  _  |/ ___ \| |_| | |_| |
 |_| |_/_/   \_\____/ \___/
`;

export interface BannerInfo {
  port: string;
  environment: string;
  version: string;
}

export function buildBanner({
  port,
  environment,
  version,
}: BannerInfo): string {
  const lines = [
    `${GREEN}${BOLD}${LOGO}${RESET}`,
    `${GREEN}  Plateforme Oumra & Hadj — pèlerins, agences, réservations${RESET}`,
    '',
    `${DIM}  version${RESET}      ${version}`,
    `${DIM}  env${RESET}          ${environment}`,
    `${DIM}  port${RESET}         ${port}`,
    `${DIM}  docs${RESET}         /api/docs`,
    `${DIM}  health${RESET}       /api/v1/health`,
    '',
  ];

  return lines.join('\n');
}

/**
 * Les séquences ANSI ne sont interprétées que par un vrai terminal. En
 * production (logs collectés, pas de TTY) elles pollueraient la sortie, donc
 * la bannière n'est affichée que quand stdout est un terminal.
 */
export function printBanner(info: BannerInfo): void {
  if (!process.stdout.isTTY) {
    return;
  }

  process.stdout.write(`${buildBanner(info)}\n`);
}
