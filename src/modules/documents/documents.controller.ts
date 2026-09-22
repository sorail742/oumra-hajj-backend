import {
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import {
  DocumentExpiryAlertShape,
  PilgrimDocumentShape,
} from '../../types/document.types';
import { DocumentsService } from './documents.service';
import { RejectDocumentDto } from './dto/reject-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { AccessUrl } from '../storage/storage-provider.interface';

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo — passeport/visa/billet scannés.

@ApiBearerAuth()
@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Roles(Role.PILGRIM)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Post()
  upload(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UploadDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_SIZE_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<PilgrimDocumentShape> {
    return this.documentsService.upload(user.sub, dto, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  @Roles(Role.PILGRIM)
  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload): Promise<PilgrimDocumentShape[]> {
    return this.documentsService.findMine(user.sub);
  }

  @Roles(Role.PILGRIM, Role.AGENCY)
  @Get()
  listByBooking(
    @CurrentUser() user: JwtPayload,
    @Query('bookingId') bookingId: string,
  ): Promise<PilgrimDocumentShape[]> {
    const role = user.role === Role.AGENCY ? 'agency' : 'pilgrim';
    return this.documentsService.findByBooking(user.sub, role, bookingId);
  }

  // Idée #59 (backlog "Cent Fonctionnalités") — vérification croisée des
  // dates d'expiration de documents avec les dates du voyage.
  @Roles(Role.PILGRIM, Role.AGENCY)
  @Get('expiry-alerts')
  getExpiryAlerts(
    @CurrentUser() user: JwtPayload,
    @Query('bookingId') bookingId: string,
  ): Promise<DocumentExpiryAlertShape[]> {
    const role = user.role === Role.AGENCY ? 'agency' : 'pilgrim';
    return this.documentsService.getExpiryAlerts(user.sub, role, bookingId);
  }

  @Roles(Role.PILGRIM, Role.AGENCY)
  @Get(':id/access-url')
  getAccessUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<AccessUrl> {
    const role = user.role === Role.AGENCY ? 'agency' : 'pilgrim';
    return this.documentsService.getAccessUrl(user.sub, role, id);
  }

  @Roles(Role.AGENCY)
  @Patch(':id/validate')
  validate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PilgrimDocumentShape> {
    return this.documentsService.validate(user.sub, id);
  }

  @Roles(Role.AGENCY)
  @Patch(':id/reject')
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
  ): Promise<PilgrimDocumentShape> {
    return this.documentsService.reject(user.sub, id, dto.reason);
  }
}
