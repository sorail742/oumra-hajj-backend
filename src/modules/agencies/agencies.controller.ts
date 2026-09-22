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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AgencyValidationStatus } from '../../common/enums/agency-validation-status.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { AgencyShape, LegalDocumentAlertShape } from '../../types/agency.types';
import { AccessUrl } from '../storage/storage-provider.interface';
import { AgenciesService } from './agencies.service';
import { AddLegalDocumentDto } from './dto/add-legal-document.dto';
import { RegisterAgencyDto } from './dto/register-agency.dto';
import { RejectAgencyDto } from './dto/reject-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo — même limite que les documents pèlerins.

@ApiTags('agencies')
@Controller('agencies')
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterAgencyDto): Promise<AgencyShape> {
    return this.agenciesService.register(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('me')
  getOwn(@CurrentUser() user: JwtPayload): Promise<AgencyShape> {
    return this.agenciesService.findByOwnerOrFail(user.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Patch('me')
  updateOwn(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateAgencyDto,
  ): Promise<AgencyShape> {
    return this.agenciesService.updateOwn(user.sub, dto);
  }

  // Idée #56 (backlog "Cent Fonctionnalités") — alertes de conformité
  // documentaire.
  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Post('me/legal-documents')
  addLegalDocument(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AddLegalDocumentDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_UPLOAD_SIZE_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<AgencyShape> {
    return this.agenciesService.addLegalDocument(user.sub, dto, {
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('me/legal-documents/alerts')
  getComplianceAlerts(
    @CurrentUser() user: JwtPayload,
  ): Promise<LegalDocumentAlertShape[]> {
    return this.agenciesService.getComplianceAlerts(user.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('me/legal-documents/:id/access-url')
  getLegalDocumentAccessUrl(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<AccessUrl> {
    return this.agenciesService.getLegalDocumentAccessUrl(user.sub, id);
  }

  // Validation des agences — cahier des charges §3.4.
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get()
  list(
    @Query('status') status?: AgencyValidationStatus,
  ): Promise<AgencyShape[]> {
    return this.agenciesService.findByStatus(status);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get(':id')
  getById(@Param('id') id: string): Promise<AgencyShape> {
    return this.agenciesService.findByIdOrFail(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
  ): Promise<AgencyShape> {
    return this.agenciesService.approve(id, admin.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: RejectAgencyDto,
  ): Promise<AgencyShape> {
    return this.agenciesService.reject(id, admin.sub, dto.reason);
  }
}
