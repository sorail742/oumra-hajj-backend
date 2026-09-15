import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Charge `src/i18n/request.ts` à chaque rendu serveur. Une seule locale
// (`fr`) au départ : pas de segment `[locale]`, pas de middleware de
// routing i18n — à revoir si une deuxième langue devient nécessaire.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  reactStrictMode: true,

  // Sortie autonome pour une image Docker éventuelle : Next trace les
  // dépendances réellement utilisées et les copie dans `.next/standalone`,
  // avec un serveur minimal — quelques dizaines de Mo au lieu de plusieurs
  // centaines. Ne change rien au fonctionnement : le serveur Node reste
  // indispensable, les Route Handlers de `src/app/api/` doivent s'exécuter
  // pour que le jeton reste hors du navigateur (voir ADR-0002 de ce kit).
  output: "standalone",

  // Une erreur de typage ne doit jamais être contournée au build : l'ignorer
  // ici laisserait du code cassé atteindre la production.
  typescript: { ignoreBuildErrors: false },

  // Le navigateur ne parle jamais au backend directement (voir ADR-0002) :
  // il appelle les Route Handlers de `src/app/api/`, qui relaient en
  // ajoutant le jeton lu dans un cookie httpOnly. `BACKEND_URL` n'est donc
  // volontairement pas déclarée ici — sans préfixe NEXT_PUBLIC_, elle reste
  // côté serveur et ne part jamais dans le bundle envoyé au navigateur.

  // Identité de la version servie, si un composant `VersionBadge` en a
  // besoin. `NEXT_PUBLIC_` est ici volontaire, contrairement à
  // `BACKEND_URL` : ce sont des variables destinées au navigateur, sans
  // rien de sensible. Lues au build, figées dans le bundle : changer la
  // version demande un rebuild, ce qui est correct.
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.0.0",
  },

  // Ancre la racine du projet pour Turbopack — sans cela, il peut remonter
  // l'arborescence et trouver un lock file dans un dossier parent.
  turbopack: { root: import.meta.dirname },

  // Interdit les images distantes non déclarées : une source oubliée passe
  // sinon en production sans que personne ne s'en aperçoive.
  images: { remotePatterns: [] },
};

export default withNextIntl(config);
