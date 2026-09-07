import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { AppConfig } from '../config/configuration';

// Wrapper injectable autour de PrismaClient — voir ADR 0013. Prisma 7
// impose un driver adapter explicite (plus d'URL lue implicitement depuis
// schema.prisma) : voir prisma.config.ts pour le CLI/migrations, et ici pour
// le client applicatif.
//
// Connexion volontairement paresseuse (pas de $connect() dans un
// onModuleInit) : l'application ne doit pas échouer au démarrage si
// PostgreSQL n'est pas encore joignable — Prisma se connecte de lui-même à
// la première requête réelle.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService<AppConfig, true>) {
    const adapter = new PrismaPg({
      connectionString: configService.get('databaseUrl', { infer: true }),
    });
    // Équivalent Prisma du `select: false` Mongoose sur User.passwordHash :
    // omis par défaut sur toute requête, ré-inclus explicitement uniquement
    // là où c'est nécessaire (vérification du mot de passe au login) via
    // `omit: { passwordHash: false }` sur la requête concernée — voir
    // UsersService.findByEmailWithPassword. Ne jamais retirer ce défaut.
    super({ adapter, omit: { user: { passwordHash: true } } });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
