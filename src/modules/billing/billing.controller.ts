import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { ContractShape, InvoiceShape } from '../../types/billing.types';
import { BillingService } from './billing.service';

// Idée #37 — facture et contrat d'une réservation : pèlerin concerné,
// agence de la réservation, administration.
@ApiTags('bookings')
@ApiBearerAuth()
@Roles(Role.PILGRIM, Role.AGENCY, Role.ADMIN)
@Controller('bookings')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  // Émet la facture à la première demande (numéro définitif), la relit
  // ensuite.
  @Get(':id/invoice')
  getInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InvoiceShape> {
    return this.billingService.getInvoice(user.sub, user.role, id);
  }

  @Get(':id/contract')
  getContract(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ContractShape> {
    return this.billingService.getContract(user.sub, user.role, id);
  }
}
