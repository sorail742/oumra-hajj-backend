import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import {
  AccountingExportShape,
  PaymentShape,
  SavingsPlanShape,
  TreasuryProjectionShape,
} from '../../types/payment.types';
import { AccountingExportService } from './accounting-export.service';
import { AccountingExportQueryDto } from './dto/accounting-export-query.dto';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { SetupSavingsPlanDto } from './dto/setup-savings-plan.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly accountingExportService: AccountingExportService,
  ) {}

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Post('initiate')
  initiate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InitiatePaymentDto,
  ): Promise<PaymentShape> {
    return this.paymentsService.initiate(user.sub, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload): Promise<PaymentShape[]> {
    return this.paymentsService.findForPilgrim(user.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('agency')
  listForAgency(@CurrentUser() user: JwtPayload): Promise<PaymentShape[]> {
    return this.paymentsService.findForAgency(user.sub);
  }

  // Ticket #38 : trésorerie prévisionnelle de l'agence. Déclarée avant
  // `:id`, qui capturerait « agency ».
  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('agency/treasury')
  treasury(@CurrentUser() user: JwtPayload): Promise<TreasuryProjectionShape> {
    return this.paymentsService.getTreasuryProjection(user.sub);
  }

  // Idée #57 : journal comptable de l'agence sur une période — aperçu
  // JSON, puis le même contenu en CSV pour Sage ou un tableur. Déclarées
  // avant `:id`, comme la trésorerie.
  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('agency/accounting')
  accountingJournal(
    @CurrentUser() user: JwtPayload,
    @Query() query: AccountingExportQueryDto,
  ): Promise<AccountingExportShape> {
    return this.accountingExportService.getJournal(user.sub, query);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('agency/accounting/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async accountingJournalCsv(
    @CurrentUser() user: JwtPayload,
    @Query() query: AccountingExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.accountingExportService.getJournalCsv(
      user.sub,
      query,
    );
    const periode = [query.from, query.to].filter(Boolean).join('_');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="export-comptable${periode ? `-${periode}` : ''}.csv"`,
    );
    return csv;
  }

  // Endpoint de callback serveur-à-serveur du prestataire de paiement — non
  // protégé par JWT (le prestataire n'authentifie pas via nos tokens), une
  // vérification de signature devra être ajoutée une fois l'agrégateur
  // retenu (voir ADR 0006).
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(@Body() dto: PaymentWebhookDto): Promise<PaymentShape> {
    return this.paymentsService.handleWebhook(dto);
  }

  @ApiBearerAuth()
  @Get(':id')
  getById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PaymentShape> {
    return this.paymentsService.findAuthorizedOrFail(user.sub, user.role, id);
  }

  // Idée #58 (backlog "Cent Fonctionnalités") — barème clair, voir
  // PaymentsService.requestRefund.
  @ApiBearerAuth()
  @Roles(Role.PILGRIM, Role.AGENCY, Role.ADMIN)
  @Post(':id/refund')
  requestRefund(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PaymentShape> {
    return this.paymentsService.requestRefund(user.sub, user.role, id);
  }

  // --- Plan d'épargne (Ticket 1) ---

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Get('bookings/:bookingId/savings-plan')
  getSavingsPlan(
    @CurrentUser() user: JwtPayload,
    @Param('bookingId') bookingId: string,
  ): Promise<SavingsPlanShape | null> {
    return this.paymentsService.findSavingsPlanByBooking(user.sub, bookingId);
  }

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Post('bookings/:bookingId/savings-plan')
  setupSavingsPlan(
    @CurrentUser() user: JwtPayload,
    @Param('bookingId') bookingId: string,
    @Body() dto: SetupSavingsPlanDto,
  ): Promise<SavingsPlanShape> {
    return this.paymentsService.setupSavingsPlan(user.sub, bookingId, dto);
  }
}
