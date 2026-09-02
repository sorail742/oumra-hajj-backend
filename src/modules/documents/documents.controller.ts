import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { DocumentsService } from './documents.service';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { PilgrimDocumentDocument } from './schemas/document.schema';

@ApiBearerAuth()
@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Roles(Role.PILGRIM)
  @Post()
  upload(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadDocumentDto,
  ): Promise<PilgrimDocumentDocument> {
    return this.documentsService.upload(user.sub, dto);
  }

  @Roles(Role.PILGRIM)
  @Get('mine')
  listMine(
    @CurrentUser() user: JwtPayload,
  ): Promise<PilgrimDocumentDocument[]> {
    return this.documentsService.findMine(user.sub);
  }

  @Roles(Role.PILGRIM, Role.AGENCY)
  @Get()
  listByBooking(
    @CurrentUser() user: JwtPayload,
    @Query('bookingId') bookingId: string,
  ): Promise<PilgrimDocumentDocument[]> {
    const role = user.role === Role.AGENCY ? 'agency' : 'pilgrim';
    return this.documentsService.findByBooking(user.sub, role, bookingId);
  }

  @Roles(Role.AGENCY)
  @Patch(':id/validate')
  validate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PilgrimDocumentDocument> {
    return this.documentsService.validate(user.sub, id);
  }

  @Roles(Role.AGENCY)
  @Patch(':id/reject')
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
  ): Promise<PilgrimDocumentDocument> {
    return this.documentsService.reject(user.sub, id, dto.reason);
  }
}
