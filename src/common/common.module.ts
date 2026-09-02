import { Module } from '@nestjs/common';

// Regroupe guards, decorateurs, filtres et pipes transverses (voir ADR 0002).
// Ces éléments sont pour l'instant importés directement là où nécessaire ;
// ce module sert de point d'ancrage si des providers transverses (ex. un
// service de journalisation d'accès aux documents sensibles) doivent être
// partagés plus tard.
@Module({})
export class CommonModule {}
