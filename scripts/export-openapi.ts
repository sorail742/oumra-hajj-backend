/**
 * Écrit le document OpenAPI dans `openapi.json`, sans démarrer de serveur.
 *
 *   npm run openapi:export
 *
 * Sert de contrat pour générer les modèles côté mobile (Flutter) sans avoir
 * l'API en marche. Le même document reste aussi consultable en direct sur
 * /api/docs-json une fois l'application démarrée.
 */
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { buildSwaggerConfig } from '../src/swagger.config';

const OUTPUT = resolve(__dirname, '..', 'openapi.json');

async function main(): Promise<void> {
  // Pas d'`app.listen()` : Swagger lit les décorateurs des contrôleurs,
  // disponibles dès la construction du conteneur Nest, sans ouvrir de port
  // ni contacter PostgreSQL (connexion Prisma volontairement paresseuse,
  // voir `src/prisma/prisma.service.ts`).
  const app = await NestFactory.create(AppModule, { logger: false });
  setupApp(app);

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);

  const routes = Object.keys(document.paths ?? {}).length;
  process.stdout.write(`${routes} chemins écrits dans ${OUTPUT}\n`);

  await app.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
