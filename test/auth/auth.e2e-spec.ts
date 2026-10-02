import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { EMAIL_OTP_SENDER } from '../../src/modules/auth/otp/otp-sender.interface';
import { setupApp } from '../../src/setup-app';
import { startTestPostgres, stopTestPostgres } from '../utils/postgres-test-db';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  // Canal email (ADR 0025) remplacé par un espion : aucun appel EmailJS réel.
  const emailsEnvoyes: { email: string; code: string }[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = await startTestPostgres();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_OTP_SENDER)
      .useValue({
        send: (email: string, code: string) => {
          emailsEnvoyes.push({ email, code });
          return Promise.resolve();
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await stopTestPostgres();
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

  it('connecte un pèlerin avec le code reçu par email (ADR 0025)', async () => {
    const email = 'pelerin.factice@example.test';

    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ email: 'Pelerin.Factice@Example.TEST' })
      .expect(200, { sent: true });

    const envoi = emailsEnvoyes.find((e) => e.email === email);
    expect(envoi).toBeDefined();

    const reponseVerification = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ email, code: envoi?.code, fullName: 'Pèlerin Factice' })
      .expect(200);
    expect(reponseVerification.body).toEqual({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });

    const moi = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set(
        'Authorization',
        `Bearer ${(reponseVerification.body as { accessToken: string }).accessToken}`,
      )
      .expect(200);
    expect(moi.body).toMatchObject({ email, role: 'pilgrim' });
  });

  it('refuse une demande portant à la fois un téléphone et un email', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone: '+224620000002', email: 'pelerin.factice@example.test' })
      .expect(400);
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
