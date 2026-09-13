import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { PaymentShape } from '../../types/payment.types';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentWebhookDto } from './dto/payment-webhook.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

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
}
