import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppConfig } from './config/configuration';

// Configuration partagée entre le bootstrap réel (main.ts) et les tests e2e,
// pour que les deux exercent exactement les mêmes routes/middlewares.
export function setupApp(app: INestApplication): void {
  const configService = app.get(ConfigService<AppConfig, true>);

  app.use(helmet());
  app.enableCors();
  app.setGlobalPrefix(configService.get('apiPrefix', { infer: true }));
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}
