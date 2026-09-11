import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { printBanner } from './common/logger/banner';
import { AppConfig } from './config/configuration';
import { setupApp } from './setup-app';
import { buildSwaggerConfig } from './swagger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const configService = app.get(ConfigService<AppConfig, true>);
  const apiPrefix = configService.get('apiPrefix', { infer: true });
  const env = configService.get('env', { infer: true });

  if (env !== 'production') {
    const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  const port = configService.get('port', { infer: true });
  // Écoute explicitement sur toutes les interfaces IPv4 : `app.listen(port)`
  // seul se liait ici uniquement en IPv6 (`::`), ce qui rendait le serveur
  // injoignable via `127.0.0.1`/adb reverse (IPv4) depuis un appareil
  // mobile — un autre service local pouvait alors occuper le port 3000 en
  // IPv4 sans conflit apparent, et le mobile lui parlait par erreur.
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `API démarrée sur http://localhost:${port}/${apiPrefix}/v1`,
    'Bootstrap',
  );

  printBanner({
    port: String(port),
    environment: env,
    version: process.env.npm_package_version ?? '0.0.1',
  });
}

void bootstrap();
