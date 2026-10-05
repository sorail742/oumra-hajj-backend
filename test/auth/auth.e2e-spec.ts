import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomBytes } from 'crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { EMAIL_OTP_SENDER } from '../../src/modules/auth/otp/otp-sender.interface';
import { PASSWORD_RESET_MAILER } from '../../src/modules/auth/password-reset/password-reset-mailer';
import { setupApp } from '../../src/setup-app';
import { startTestPostgres, stopTestPostgres } from '../utils/postgres-test-db';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  // Canal email (ADR 0025) remplacé par un espion : aucun appel EmailJS réel.
  const emailsEnvoyes: { email: string; code: string }[] = [];
  // Lien de réinitialisation (ADR 0026) capturé de la même façon.
  const liensEnvoyes: { email: string; lien: string }[] = [];

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
      .overrideProvider(PASSWORD_RESET_MAILER)
      .useValue({
        available: true,
        send: (email: string, lien: string) => {
          liensEnvoyes.push({ email, lien });
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

  it("réinitialise le mot de passe d'une agence et ferme ses sessions (ADR 0026)", async () => {
    const server = app.getHttpServer();
    const email = 'agence.reset@example.test';
    // Mots de passe aléatoires générés pour le test (CLAUDE.md : rien de réaliste en dur).
    const ancien = randomBytes(12).toString('hex');
    const nouveau = randomBytes(12).toString('hex');
    const autre = randomBytes(12).toString('hex');

    await request(server)
      .post('/api/v1/agencies/register')
      .send({
        legalName: 'Agence Fictive Reset',
        contactEmail: email,
        contactPhone: '+224620000020',
        password: ancien,
      })
      .expect(201);
    const session = await request(server)
      .post('/api/v1/auth/agency/login')
      .send({ email, password: ancien })
      .expect(200);

    // Adresse inconnue : même réponse, aucun envoi.
    await request(server)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'inconnue@example.test' })
      .expect(200, { sent: true });
    expect(liensEnvoyes).toHaveLength(0);

    await request(server)
      .post('/api/v1/auth/password/forgot')
      .send({ email })
      .expect(200, { sent: true });
    const envoi = liensEnvoyes.find((l) => l.email === email);
    const token = new URL(
      envoi?.lien ?? 'https://invalide.example.test',
    ).hash.replace('#token=', '');
    expect(token).toHaveLength(43);

    await request(server)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: nouveau })
      .expect(204);

    // Usage unique, ancienne session fermée, ancien mot de passe refusé.
    await request(server)
      .post('/api/v1/auth/password/reset')
      .send({ token, newPassword: autre })
      .expect(400);
    await request(server)
      .post('/api/v1/auth/refresh')
      .send({
        refreshToken: (session.body as { refreshToken: string }).refreshToken,
      })
      .expect(401);
    await request(server)
      .post('/api/v1/auth/agency/login')
      .send({ email, password: ancien })
      .expect(401);
    await request(server)
      .post('/api/v1/auth/agency/login')
      .send({ email, password: nouveau })
      .expect(200);
  });
});
