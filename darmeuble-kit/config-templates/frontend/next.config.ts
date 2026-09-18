import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,

  // Sortie autonome pour une image Docker éventuelle — voir
  // docs/frontend/adr/0001-*.md. Le serveur Node reste indispensable : les
  // Route Handlers de `src/app/api/` doivent s'exécuter pour que le jeton
  // reste hors du navigateur (docs/frontend/adr/0002-*.md).
  output: "standalone",

  // Une erreur de typage ne doit jamais être contournée au build.
  typescript: { ignoreBuildErrors: false },

  // Le navigateur ne parle jamais au backend directement (voir
  // docs/frontend/adr/0002-*.md) : il appelle les Route Handlers de
  // `src/app/api/`, qui relaient en ajoutant le jeton lu dans un cookie
  // httpOnly. `BACKEND_URL` n'est donc volontairement pas déclarée ici —
  // sans préfixe NEXT_PUBLIC_, elle reste côté serveur.

  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "0.0.0",
  },

  turbopack: { root: import.meta.dirname },

  // Interdit les images distantes non déclarées.
  images: { remotePatterns: [] },
};

export default config;
