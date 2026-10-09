import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { QuoteShape, SharedQuoteShape } from '../../types/quote.types';
import { Audited } from '../audit/audited.decorator';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ListQuotesQueryDto } from './dto/list-quotes-query.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuotesService } from './quotes.service';

const montant = (r: unknown) => ({
  number: (r as QuoteShape).number,
  totalAmount: (r as QuoteShape).totalAmount,
  currency: (r as QuoteShape).currency,
});

// Idée #49 (backlog "Cent Fonctionnalités") — devis groupes et entreprises.
@ApiTags('quotes')
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  // Lien client, sans compte : jeton opaque de 48 caractères.
  @Public()
  @Get('shared/:token')
  getShared(@Param('token') token: string): Promise<SharedQuoteShape> {
    return this.quotesService.getShared(token);
  }

  @Public()
  @Post('shared/:token/accept')
  @HttpCode(HttpStatus.OK)
  @Audited({ action: 'quote.accept', entityType: 'quote', idField: 'number' })
  accept(@Param('token') token: string): Promise<SharedQuoteShape> {
    return this.quotesService.respond(token, true);
  }

  @Public()
  @Post('shared/:token/decline')
  @HttpCode(HttpStatus.OK)
  @Audited({ action: 'quote.decline', entityType: 'quote', idField: 'number' })
  decline(@Param('token') token: string): Promise<SharedQuoteShape> {
    return this.quotesService.respond(token, false);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListQuotesQueryDto,
  ): Promise<QuoteShape[]> {
    return this.quotesService.list(user.sub, query);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateQuoteDto,
  ): Promise<QuoteShape> {
    return this.quotesService.create(user.sub, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get(':id')
  get(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteShape> {
    return this.quotesService.get(user.sub, id);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ): Promise<QuoteShape> {
    return this.quotesService.update(user.sub, id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  @Audited({ action: 'quote.send', entityType: 'quote', metadata: montant })
  send(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<QuoteShape> {
    return this.quotesService.send(user.sub, id);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.quotesService.remove(user.sub, id);
  }
}
