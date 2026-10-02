import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { setupApp } from '../../src/setup-app';
import {
  AGENCE_DEMO,
  FORFAIT_DEMO,
  OptionsSeedDemo,
  seedDemo,
} from '../../scripts/seed-demo';
import { startTestPostgres, stopTestPostgres } from '../utils/postgres-test-db';

// Identifiants factices, propres à ce test (jamais ceux d'un environnement).
const OPTIONS: OptionsSeedDemo = {
  adminEmail: 'admin@demo-test.example',
  adminPassword: 'mot-de-passe-test-admin',
  agencyEmail: 'agence@demo-test.example',
  agencyPassword: 'mot-de-passe-test-agence',
  maintenant: new Date('2026-10-01T12:00:00Z'),
};

describe('Seed de démonstration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = await startTestPostgres();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    setupApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await stopTestPostgres();
  });

  it('crée un admin et une agence validée qui peuvent se connecter', async () => {
    await seedDemo(prisma, OPTIONS);

    for (const [email, password] of [
      [OPTIONS.adminEmail, OPTIONS.adminPassword],
      [OPTIONS.agencyEmail, OPTIONS.agencyPassword],
    ]) {
      const reponse = await request(app.getHttpServer())
        .post('/api/v1/auth/agency/login')
        .send({ email, password })
        .expect(200);
      expect(reponse.body).toHaveProperty('accessToken');
    }

    const agence = await prisma.agency.findFirstOrThrow({
      where: { legalName: AGENCE_DEMO },
    });
    expect(agence.validationStatus).toBe('approved');
  });

  it('publie le forfait fictif dans le catalogue public, daté dans le futur', async () => {
    const reponse = await request(app.getHttpServer())
      .get('/api/v1/packages')
      .expect(200);
    const titres = (reponse.body as { title: string; startDate: string }[]).map(
      (p) => p.title,
    );
    expect(titres).toContain(FORFAIT_DEMO);
  });

  it('est idempotent : un second passage ne duplique rien', async () => {
    const premier = await seedDemo(prisma, OPTIONS);
    const second = await seedDemo(prisma, OPTIONS);

    expect(second).toEqual(premier);
    expect(
      await prisma.agency.count({ where: { legalName: AGENCE_DEMO } }),
    ).toBe(1);
    expect(await prisma.package.count({ where: { title: FORFAIT_DEMO } })).toBe(
      1,
    );
  });

  it("refuse de réutiliser l'email d'un compte existant d'un autre rôle", async () => {
    await prisma.user.create({
      data: {
        email: 'pelerin@demo-test.example',
        role: 'pilgrim',
        fullName: 'Pèlerin factice',
      },
    });

    await expect(
      seedDemo(prisma, { ...OPTIONS, adminEmail: 'pelerin@demo-test.example' }),
    ).rejects.toThrow('seed interrompu');
  });

  it('refuse un mot de passe trop court', async () => {
    await expect(
      seedDemo(prisma, { ...OPTIONS, adminPassword: 'court' }),
    ).rejects.toThrow('trop court');
  });
});
