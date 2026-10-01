/**
 * Données de DÉMONSTRATION pour un environnement hébergé (ADR 0023) :
 * un administrateur, une agence fictive déjà validée et un forfait fictif.
 *
 *   SEED_DEMO=true SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… \
 *   SEED_AGENCY_EMAIL=… SEED_AGENCY_PASSWORD=… npm run seed:demo
 *
 * - **Opt-in** : sans `SEED_DEMO=true`, le script ne fait rien (il peut donc
 *   être appelé à chaque build sans risque).
 * - **Idempotent** : rejouable ; rien n'est dupliqué. Le mot de passe des
 *   deux comptes est réaligné sur la variable d'environnement à chaque
 *   exécution (les variables de l'hébergeur font foi).
 * - **Aucun secret dans le code ni dans les logs** : identifiants lus dans
 *   l'environnement, jamais journalisés.
 * - **Données explicitement factices** (CLAUDE.md) : libellés préfixés
 *   `[DÉMO]`, aucun document d'identité, aucune donnée de paiement.
 *   Ne jamais utiliser sur une base de production.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AgencyValidationStatus,
  PackageStatus,
  PilgrimageType,
  PrismaClient,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

/** Même coût que `AuthService`/`AgenciesService`. */
const SALT_ROUNDS = 12;
const LONGUEUR_MIN_MOT_DE_PASSE = 12;
const JOUR_MS = 24 * 60 * 60 * 1000;

export const AGENCE_DEMO = '[DÉMO] Agence fictive Oumra & Hadj';
export const FORFAIT_DEMO = '[DÉMO] Oumra fictive — 15 jours';

export interface OptionsSeedDemo {
  adminEmail: string;
  adminPassword: string;
  agencyEmail: string;
  agencyPassword: string;
  /** Injectable pour les tests ; sert à dater le forfait dans le futur. */
  maintenant?: Date;
}

export interface ResultatSeedDemo {
  adminId: string;
  agencyId: string;
  packageId: string;
}

type ClientSeed = Pick<PrismaClient, 'user' | 'agency' | 'package'>;

async function compte(
  prisma: ClientSeed,
  email: string,
  motDePasse: string,
  role: Role,
  nom: string,
): Promise<string> {
  const passwordHash = await bcrypt.hash(motDePasse, SALT_ROUNDS);
  const existant = await prisma.user.findUnique({ where: { email } });
  if (existant) {
    // Ne jamais « promouvoir » un compte réel existant par erreur de
    // configuration : un email déjà pris par un autre rôle arrête tout.
    if (existant.role !== role) {
      throw new Error(
        `Un compte existe déjà avec cet email et le rôle « ${existant.role} » — seed interrompu.`,
      );
    }
    await prisma.user.update({
      where: { id: existant.id },
      data: { passwordHash, isActive: true },
    });
    return existant.id;
  }
  const cree = await prisma.user.create({
    data: { email, passwordHash, role, fullName: nom },
  });
  return cree.id;
}

export async function seedDemo(
  prisma: ClientSeed,
  options: OptionsSeedDemo,
): Promise<ResultatSeedDemo> {
  for (const motDePasse of [options.adminPassword, options.agencyPassword]) {
    if (motDePasse.length < LONGUEUR_MIN_MOT_DE_PASSE) {
      throw new Error(
        `Mot de passe de démonstration trop court (${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum).`,
      );
    }
  }

  const adminId = await compte(
    prisma,
    options.adminEmail,
    options.adminPassword,
    Role.admin,
    '[DÉMO] Administrateur',
  );
  const ownerId = await compte(
    prisma,
    options.agencyEmail,
    options.agencyPassword,
    Role.agency,
    AGENCE_DEMO,
  );

  const maintenant = options.maintenant ?? new Date();
  const agence =
    (await prisma.agency.findUnique({ where: { ownerId } })) ??
    (await prisma.agency.create({
      data: {
        legalName: AGENCE_DEMO,
        ownerId,
        contactEmail: options.agencyEmail,
        contactPhone: '+224000000000',
        address: '[DÉMO] Adresse fictive, Conakry',
        validationStatus: AgencyValidationStatus.approved,
        validatedById: adminId,
        validatedAt: maintenant,
        commissionRate: 0.05,
      },
    }));

  const debut = new Date(
    Date.UTC(
      maintenant.getUTCFullYear(),
      maintenant.getUTCMonth(),
      maintenant.getUTCDate(),
    ) +
      60 * JOUR_MS,
  );
  const forfait =
    (await prisma.package.findFirst({
      where: { agencyId: agence.id, title: FORFAIT_DEMO },
    })) ??
    (await prisma.package.create({
      data: {
        agencyId: agence.id,
        type: PilgrimageType.oumra,
        title: FORFAIT_DEMO,
        description:
          'Forfait fictif de démonstration — aucune réservation, aucun paiement réels.',
        startDate: debut,
        endDate: new Date(debut.getTime() + 15 * JOUR_MS),
        price: 30_000_000,
        currency: 'GNF',
        capacity: 20,
        inclusions: [
          'Vol aller-retour (fictif)',
          'Hébergement (fictif)',
          'Visa (fictif)',
        ],
        status: PackageStatus.open,
      },
    }));

  return { adminId, agencyId: agence.id, packageId: forfait.id };
}

function variable(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new Error(`Variable d'environnement manquante : ${nom}`);
  }
  return valeur;
}

async function main(): Promise<void> {
  if (process.env.SEED_DEMO !== 'true') {
    console.log(
      '[seed:demo] SEED_DEMO != "true" — aucune donnée de démonstration créée.',
    );
    return;
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: variable('DATABASE_URL') }),
  });
  try {
    await seedDemo(prisma, {
      adminEmail: variable('SEED_ADMIN_EMAIL'),
      adminPassword: variable('SEED_ADMIN_PASSWORD'),
      agencyEmail: variable('SEED_AGENCY_EMAIL'),
      agencyPassword: variable('SEED_AGENCY_PASSWORD'),
    });
    // Ni email ni mot de passe journalisés.
    console.log(
      '[seed:demo] Administrateur, agence et forfait de démonstration à jour.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((erreur: unknown) => {
    console.error(
      '[seed:demo] Échec :',
      erreur instanceof Error ? erreur.message : erreur,
    );
    process.exit(1);
  });
}
