import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateChecklistStatusDto } from './dto/update-checklist-status.dto';

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  async findByBookingId(pilgrimId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Réservation introuvable');
    }
    if (booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Accès refusé à cette checklist');
    }
    return this.prisma.checklistItem.findMany({
      where: { bookingId },
      orderBy: { reminderDate: 'asc' },
    });
  }

  async updateStatus(pilgrimId: string, id: string, dto: UpdateChecklistStatusDto) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id },
      include: { booking: true },
    });
    
    if (!item) {
      throw new NotFoundException('Élément de checklist introuvable');
    }
    if (item.booking.pilgrimId !== pilgrimId) {
      throw new ForbiddenException('Vous ne pouvez pas modifier cet élément');
    }

    return this.prisma.checklistItem.update({
      where: { id },
      data: { isCompleted: dto.isCompleted },
    });
  }

  async generateStandardChecklist(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { package: { include: { stages: true } } },
    });

    if (!booking) return;

    // Calcul de la date de départ
    let departureDate = new Date();
    if (booking.package.stages && booking.package.stages.length > 0) {
      departureDate = booking.package.stages.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0].startDate;
    } else {
      departureDate.setMonth(departureDate.getMonth() + 2); // Par défaut M+2
    }

    const mMinus30 = new Date(departureDate);
    mMinus30.setDate(mMinus30.getDate() - 30);

    const mMinus15 = new Date(departureDate);
    mMinus15.setDate(mMinus15.getDate() - 15);

    const mMinus7 = new Date(departureDate);
    mMinus7.setDate(mMinus7.getDate() - 7);

    await this.prisma.checklistItem.createMany({
      data: [
        {
          bookingId,
          title: 'Vérifier la validité du passeport (6 mois min)',
          category: 'document',
          reminderDate: mMinus30,
        },
        {
          bookingId,
          title: 'Effectuer le vaccin contre la méningite',
          category: 'vaccine',
          reminderDate: mMinus15,
        },
        {
          bookingId,
          title: 'Préparer la valise',
          category: 'luggage',
          reminderDate: mMinus7,
        },
        {
          bookingId,
          title: 'Faire ses adieux et prières (salat al-safar)',
          category: 'spiritual',
          reminderDate: departureDate, // Jour J
        },
      ],
    });
  }
}
