import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentRemindersService } from './payment-reminders.service';
import { balanceDueDate, daysBetween } from './payment-schedule';

// Réservations et montants explicitement factices (backlog #67).
describe('PaymentRemindersService', () => {
  const now = new Date('2026-10-07T08:00:00Z');
  let findMany: jest.Mock;
  let send: jest.Mock;
  let service: PaymentRemindersService;

  // Départ tel que la date limite du solde tombe `joursAvantEcheance` jours
  // après `now`.
  const depart = (joursAvantEcheance: number) => {
    const d = new Date('2026-10-07T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 30 + joursAvantEcheance);
    return d;
  };
  const reservation = (
    joursAvantEcheance: number,
    paiements: number[] = [],
  ) => ({
    pilgrimId: 'pelerin-1',
    package: {
      title: 'Forfait factice',
      price: 1000,
      startDate: depart(joursAvantEcheance),
    },
    payments: paiements.map((amount) => ({ amount })),
  });

  beforeEach(() => {
    findMany = jest.fn();
    send = jest.fn().mockResolvedValue([]);
    service = new PaymentRemindersService(
      { booking: { findMany } } as unknown as PrismaService,
      { send } as unknown as NotificationsService,
    );
  });

  it('calcule la date limite 30 jours avant le départ', () => {
    const due = balanceDueDate(new Date('2027-03-15T00:00:00Z'));
    expect(due.toISOString()).toBe('2027-02-13T00:00:00.000Z');
    expect(daysBetween(now, due)).toBe(129);
  });

  it('relance à J-14, J-7 et J-1 de la date limite, avec le solde restant', async () => {
    findMany.mockResolvedValue([
      reservation(14, [400]),
      reservation(7),
      reservation(1),
      reservation(10),
    ]);

    const sent = await service.sendPreventiveReminders(now);

    expect(sent).toBe(3);
    expect(send).toHaveBeenCalledTimes(3);
    expect(send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        recipientIds: ['pelerin-1'],
        type: 'payment',
        isCritical: false,
        content: expect.stringContaining('600 GNF'),
      }),
    );
  });

  it('ne relance pas une réservation soldée', async () => {
    findMany.mockResolvedValue([reservation(7, [600, 400])]);

    await expect(service.sendPreventiveReminders(now)).resolves.toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it('ne cherche que les réservations actives dont le départ tombe dans la fenêtre', async () => {
    findMany.mockResolvedValue([]);

    await service.sendPreventiveReminders(now);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ['pending_payment', 'confirmed'] },
          package: {
            startDate: {
              gte: new Date('2026-11-06T08:00:00Z'),
              lt: new Date('2026-11-21T08:00:00Z'),
            },
          },
        },
      }),
    );
  });

  it("continue après l'échec d'un envoi", async () => {
    findMany.mockResolvedValue([reservation(7), reservation(1)]);
    send.mockRejectedValueOnce(new Error('panne factice'));

    await expect(service.sendPreventiveReminders(now)).resolves.toBe(1);
  });
});
