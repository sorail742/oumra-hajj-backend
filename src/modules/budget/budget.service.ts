import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { PackagesService } from '../packages/packages.service';

@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly packagesService: PackagesService,
  ) {}

  async create(pilgrimId: string, dto: CreateBudgetDto) {
    let packagePrice = 0;
    if (dto.packageId) {
      const pkg = await this.packagesService.findByIdOrFail(dto.packageId);
      packagePrice = pkg.price;
    }

    return this.prisma.budgetSimulation.create({
      data: {
        pilgrimId,
        packageId: dto.packageId,
        packagePrice,
        pocketMoney: dto.pocketMoney ?? 0,
        gifts: dto.gifts ?? 0,
        sacrifice: dto.sacrifice ?? 0,
        insurance: dto.insurance ?? 0,
        otherExpenses: dto.otherExpenses ?? 0,
      },
    });
  }

  async findForPilgrim(pilgrimId: string) {
    return this.prisma.budgetSimulation.findMany({
      where: { pilgrimId },
    });
  }

  async findByIdOrFail(id: string) {
    const simulation = await this.prisma.budgetSimulation.findUnique({
      where: { id },
    });
    if (!simulation) {
      throw new NotFoundException('Simulation introuvable');
    }
    return simulation;
  }

  async update(pilgrimId: string, id: string, dto: UpdateBudgetDto) {
    const simulation = await this.findByIdOrFail(id);
    if (simulation.pilgrimId !== pilgrimId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier cette simulation',
      );
    }

    let packagePrice = simulation.packagePrice;
    if (dto.packageId && dto.packageId !== simulation.packageId) {
      const pkg = await this.packagesService.findByIdOrFail(dto.packageId);
      packagePrice = pkg.price;
    }

    return this.prisma.budgetSimulation.update({
      where: { id },
      data: {
        packageId: dto.packageId,
        packagePrice,
        pocketMoney: dto.pocketMoney,
        gifts: dto.gifts,
        sacrifice: dto.sacrifice,
        insurance: dto.insurance,
        otherExpenses: dto.otherExpenses,
      },
    });
  }

  async remove(pilgrimId: string, id: string) {
    const simulation = await this.findByIdOrFail(id);
    if (simulation.pilgrimId !== pilgrimId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer cette simulation',
      );
    }
    await this.prisma.budgetSimulation.delete({ where: { id } });
    return { success: true };
  }
}
