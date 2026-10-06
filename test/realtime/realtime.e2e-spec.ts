import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { EMAIL_OTP_SENDER } from '../../src/modules/auth/otp/otp-sender.interface';
import { setupApp } from '../../src/setup-app';
import { startTestPostgres, stopTestPostgres } from '../utils/postgres-test-db';

// Handshake Socket.IO par ticket éphémère (ADR 0027), sur un vrai serveur.
describe('Temps réel (e2e)', () => {
  let app: INestApplication;
  let url: string;
  const codes = new Map<string, string>();
  const ouverts: Socket[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = await startTestPostgres();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EMAIL_OTP_SENDER)
      .useValue({
        send: (email: string, code: string) => {
          codes.set(email, code);
          return Promise.resolve();
        },
      })
      .compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.listen(0);
    url = (await app.getUrl()).replace('[::1]', 'localhost');
  });

  afterEach(() => ouverts.splice(0).forEach((s) => s.close()));

  afterAll(async () => {
    await app.close();
    await stopTestPostgres();
  });

  async function connexion(email: string) {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/v1/auth/otp/request')
      .send({ email })
      .expect(200);
    const verif = await request(server)
      .post('/api/v1/auth/otp/verify')
      .send({ email, code: codes.get(email), fullName: 'Pèlerin Factice' })
      .expect(200);
    return verif.body as { accessToken: string; refreshToken: string };
  }

  async function ticket(accessToken: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/realtime-ticket')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    return (res.body as { ticket: string }).ticket;
  }

  // Résout `true` si la connexion tient, `false` si le serveur la ferme.
  function ouvrir(auth: Record<string, string>): Promise<{
    socket: Socket;
    accepte: boolean;
  }> {
    const socket = io(`${url}/community`, {
      auth,
      transports: ['websocket'],
      reconnection: false,
    });
    ouverts.push(socket);
    return new Promise((resolve) => {
      const refus = () => resolve({ socket, accepte: false });
      socket.on('disconnect', refus);
      socket.on('connect_error', refus);
      socket.on('connect', () => {
        setTimeout(() => {
          socket.off('disconnect', refus);
          resolve({ socket, accepte: socket.connected });
        }, 300);
      });
    });
  }

  it('accepte un ticket une seule fois et refuse une connexion sans preuve', async () => {
    const { accessToken } = await connexion('temps.reel.un@example.test');
    const t = await ticket(accessToken);

    expect((await ouvrir({ ticket: t })).accepte).toBe(true);
    expect((await ouvrir({ ticket: t })).accepte).toBe(false);
    expect((await ouvrir({})).accepte).toBe(false);
  });

  it('exige une session pour obtenir un ticket', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/realtime-ticket')
      .expect(401);
  });

  it("ferme les connexions temps réel à la déconnexion de l'utilisateur", async () => {
    const { accessToken, refreshToken } = await connexion(
      'temps.reel.deux@example.test',
    );
    const { socket, accepte } = await ouvrir({
      ticket: await ticket(accessToken),
    });
    expect(accepte).toBe(true);

    const ferme = new Promise<void>((resolve) =>
      socket.on('disconnect', () => resolve()),
    );
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(204);
    await expect(ferme).resolves.toBeUndefined();
  });
});
