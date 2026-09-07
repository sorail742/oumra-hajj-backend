import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { Role as PrismaRole } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { Role } from '../../src/common/enums/role.enum';
import { OTP_SENDER } from '../../src/modules/auth/otp/otp-sender.interface';
import { PrismaService } from '../../src/prisma/prisma.service';
import { setupApp } from '../../src/setup-app';
import { startInMemoryMongo, stopInMemoryMongo } from '../utils/mongo-memory';
import { startTestPostgres, stopTestPostgres } from '../utils/postgres-test-db';

// Parcours d'intégration complet : inscription agence -> validation admin ->
// publication d'un forfait -> inscription pèlerin par OTP -> réservation ->
// paiement -> confirmation webhook. Couvre l'enchaînement réel entre
// modules, que les tests unitaires (qui mockent chaque dépendance) ne
// peuvent pas vérifier — voir cahier des charges §4.1.
describe('Parcours réservation + paiement (e2e)', () => {
  let app: INestApplication;
  let lastOtpCode: string;

  beforeAll(async () => {
    process.env.MONGO_URI = await startInMemoryMongo();
    process.env.DATABASE_URL = await startTestPostgres();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(OTP_SENDER)
      .useValue({
        send: (_phone: string, code: string) => {
          lastOtpCode = code;
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
    await stopInMemoryMongo();
    await stopTestPostgres();
  });

  it("mène une agence, un admin et un pèlerin jusqu'à un paiement confirmé", async () => {
    const server = app.getHttpServer();

    // 1. Une agence s'inscrit — reste en attente de validation.
    const agencyEmail = 'contact@agence-e2e.gn';
    const agencyPassword = 'password123';
    await request(server)
      .post('/api/v1/agencies/register')
      .send({
        legalName: 'Agence E2E',
        contactEmail: agencyEmail,
        contactPhone: '+224620000010',
        password: agencyPassword,
      })
      .expect(201);

    const agencyLogin = await request(server)
      .post('/api/v1/auth/agency/login')
      .send({ email: agencyEmail, password: agencyPassword })
      .expect(200);
    const agencyToken = agencyLogin.body.accessToken as string;

    // 2. Tant que l'agence n'est pas validée, impossible de publier un forfait.
    await request(server)
      .post('/api/v1/packages')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({
        type: 'oumra',
        title: 'Oumra Ramadan',
        startDate: '2027-03-01',
        endDate: '2027-03-15',
        price: 500,
        capacity: 1,
      })
      .expect(409);

    // 3. Un admin (provisionné directement en base — aucune inscription
    // publique pour ce rôle, voir docs/auth-setup.md) valide l'agence.
    const prisma = app.get(PrismaService);
    const adminEmail = 'admin@e2e.local';
    const adminPassword = 'adminpass123';
    await prisma.user.create({
      data: {
        fullName: 'Admin E2E',
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPassword, 4),
        role: Role.ADMIN as unknown as PrismaRole,
        isActive: true,
      },
    });

    const adminLogin = await request(server)
      .post('/api/v1/auth/agency/login')
      .send({ email: adminEmail, password: adminPassword })
      .expect(200);
    const adminToken = adminLogin.body.accessToken as string;

    const pendingAgencies = await request(server)
      .get('/api/v1/agencies?status=pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const agencyId = pendingAgencies.body[0].id as string;

    await request(server)
      .patch(`/api/v1/agencies/${agencyId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 4. L'agence, désormais validée, publie un forfait à une place.
    const pkgRes = await request(server)
      .post('/api/v1/packages')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({
        type: 'oumra',
        title: 'Oumra Ramadan',
        startDate: '2027-03-01',
        endDate: '2027-03-15',
        price: 500,
        capacity: 1,
      })
      .expect(201);
    const packageId = pkgRes.body.id as string;

    // 5. Un pèlerin s'inscrit par OTP.
    const pilgrimPhone = '+224620000011';
    await request(server)
      .post('/api/v1/auth/otp/request')
      .send({ phone: pilgrimPhone })
      .expect(200);
    const pilgrimVerify = await request(server)
      .post('/api/v1/auth/otp/verify')
      .send({ phone: pilgrimPhone, code: lastOtpCode, fullName: 'Pèlerin E2E' })
      .expect(200);
    const pilgrimToken = pilgrimVerify.body.accessToken as string;

    // 6. Le pèlerin réserve la seule place disponible.
    const bookingRes = await request(server)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${pilgrimToken}`)
      .send({ packageId })
      .expect(201);
    const bookingId = bookingRes.body.id as string;

    // Le forfait est désormais complet pour un second pèlerin.
    await request(server)
      .post('/api/v1/auth/otp/request')
      .send({ phone: '+224620000012' })
      .expect(200);
    const secondVerify = await request(server)
      .post('/api/v1/auth/otp/verify')
      .send({ phone: '+224620000012', code: lastOtpCode })
      .expect(200);
    await request(server)
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${secondVerify.body.accessToken}`)
      .send({ packageId })
      .expect(409);

    // 7. Le pèlerin paie le forfait en une seule tranche.
    const paymentRes = await request(server)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${pilgrimToken}`)
      .send({ bookingId, amount: 500, method: 'mobile_money_orange' })
      .expect(201);
    const providerReference = paymentRes.body.providerReference as string;

    // 8. Le prestataire confirme le paiement via son callback serveur-à-serveur.
    await request(server)
      .post('/api/v1/payments/webhook')
      .send({ providerReference, status: 'succeeded' })
      .expect(200);

    // 9. L'étape "paiement" du dossier est soldée automatiquement.
    const booking = await request(server)
      .get(`/api/v1/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${pilgrimToken}`)
      .expect(200);
    const paymentStep = (
      booking.body.steps as Array<{ key: string; status: string }>
    ).find((s) => s.key === 'payment');
    expect(paymentStep?.status).toBe('done');
  });
});
