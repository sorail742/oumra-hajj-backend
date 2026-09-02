import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';
import { startInMemoryMongo, stopInMemoryMongo } from './utils/mongo-memory';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.MONGO_URI = await startInMemoryMongo();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo();
  });

  it('/api/v1/health (GET) répond ok', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res: { body: { status: string } }) => {
        expect(res.body.status).toBe('ok');
      });
  });

  it("parcours d'inscription pèlerin par OTP (cahier des charges §4.1)", async () => {
    const phone = '+224620000001';

    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone })
      .expect(200);

    // En environnement de dev/test, le code OTP est journalisé (voir
    // ConsoleOtpSender) plutôt qu'envoyé par SMS réel — on ne peut donc pas
    // le récupérer ici. On vérifie seulement qu'un code invalide est rejeté,
    // ce qui exerce le chemin de validation critique de l'auth.
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code: '000000' })
      .expect(401);
  });

  it('rejette un accès sans jeton sur une route protégée', () => {
    return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });
});
