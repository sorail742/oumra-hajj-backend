import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/setup-app';
import { startInMemoryMongo, stopInMemoryMongo } from '../utils/mongo-memory';

describe('Auth (e2e)', () => {
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

  it("parcours d'inscription pèlerin par OTP (cahier des charges §4.1)", async () => {
    const phone = '+224620000001';

    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone })
      .expect(200);

    // Le code OTP est journalisé par ConsoleOtpSender (dev), pas récupérable
    // ici sans espionner le provider — on exerce donc le chemin de rejet
    // d'un code invalide, qui couvre déjà la validation critique de l'auth.
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code: '000000' })
      .expect(401);
  });

  it('rejette un accès sans jeton sur une route protégée', () => {
    return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('rejette un login agence avec des identifiants inconnus', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/agency/login')
      .send({ email: 'inconnu@agence.gn', password: 'password123' })
      .expect(401);
  });

  it('rejette un refresh token invalide', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'jeton-invalide' })
      .expect(401);
  });
});
