import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';
import { setupApp } from './setup-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  setupApp(app);

  const configService = app.get(ConfigService<AppConfig, true>);
  const apiPrefix = configService.get('apiPrefix', { infer: true });
  const env = configService.get('env', { infer: true });

  if (env !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Plateforme Oumra & Hadj — API')
      .setDescription(
        'API centrale : pèlerins, agences, forfaits, réservations, paiements, documents, rites, groupes, notifications.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  const port = configService.get('port', { infer: true });
  await app.listen(port);
  Logger.log(
    `API démarrée sur http://localhost:${port}/${apiPrefix}/v1`,
    'Bootstrap',
  );
}

void bootstrap();
