import { execSync } from 'child_process';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

// Postgres réel et éphémère pour les tests e2e (ADR 0013) : une instance
// fraîche par fichier de test, zéro setup manuel local (Docker requis).
// En CI, un service `postgres:` est fourni par .gitlab-ci.yml —
// DATABASE_URL est alors déjà positionnée, testcontainers est sauté (le
// runner n'expose pas le socket Docker nécessaire).
//
// Détection CI via `process.env.CI` (positionnée par GitLab CI, comme par
// toute plateforme CI usuelle) plutôt que "DATABASE_URL est déjà définie" :
// importer AppModule (fait par chaque *.e2e-spec.ts) déclenche
// ConfigModule.forRoot() dès l'évaluation du décorateur @Module, qui charge
// .env immédiatement — DATABASE_URL est donc déjà présente localement bien
// avant que ce fichier ne s'exécute, même hors CI.
let container: StartedPostgreSqlContainer | undefined;

export async function startTestPostgres(): Promise<string> {
  if (process.env.CI) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL doit être définie en CI (voir .gitlab-ci.yml)',
      );
    }
    applyMigrations(databaseUrl);
    return databaseUrl;
  }

  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  const connectionUri = container.getConnectionUri();
  applyMigrations(connectionUri);
  return connectionUri;
}

export async function stopTestPostgres(): Promise<void> {
  await container?.stop();
  container = undefined;
}

function applyMigrations(databaseUrl: string): void {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}
