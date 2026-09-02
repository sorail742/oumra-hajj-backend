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
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { CreateRiteSheetDto } from './dto/create-rite-sheet.dto';
import { SyncRiteProgressDto } from './dto/sync-rite-progress.dto';
import { UpdateRiteSheetDto } from './dto/update-rite-sheet.dto';
import { RiteProgressService } from './rite-progress.service';
import { RiteSheetsService } from './rite-sheets.service';
import { RiteProgressDocument } from './schemas/rite-progress.schema';
import { RiteSheetDocument } from './schemas/rite-sheet.schema';

@ApiTags('rites')
@Controller('rites')
export class RitesController {
  constructor(
    private readonly riteSheetsService: RiteSheetsService,
    private readonly riteProgressService: RiteProgressService,
  ) {}

  @Public()
  @Get('sheets')
  listPublished(
    @Query('pilgrimageType') pilgrimageType?: string,
    @Query('language') language?: string,
  ): Promise<RiteSheetDocument[]> {
    return this.riteSheetsService.listPublished(pilgrimageType, language);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get('sheets/admin')
  listAll(): Promise<RiteSheetDocument[]> {
    return this.riteSheetsService.listAll();
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post('sheets')
  createSheet(@Body() dto: CreateRiteSheetDto): Promise<RiteSheetDocument> {
    return this.riteSheetsService.create(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('sheets/:id')
  updateSheet(
    @Param('id') id: string,
    @Body() dto: UpdateRiteSheetDto,
  ): Promise<RiteSheetDocument> {
    return this.riteSheetsService.update(id, dto);
  }

  // Relecture par une personne qualifiée avant publication (voir CLAUDE.md).
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch('sheets/:id/validate')
  validateSheet(
    @CurrentUser() reviewer: JwtPayload,
    @Param('id') id: string,
  ): Promise<RiteSheetDocument> {
    return this.riteSheetsService.validate(id, reviewer.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Get('progress')
  getMyProgress(
    @CurrentUser() user: JwtPayload,
  ): Promise<RiteProgressDocument[]> {
    return this.riteProgressService.findMine(user.sub);
  }

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Post('progress/sync')
  syncProgress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SyncRiteProgressDto,
  ): Promise<RiteProgressDocument[]> {
    return this.riteProgressService.syncBatch(user.sub, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Patch('progress/:riteKey/reset-counter')
  resetCounter(
    @CurrentUser() user: JwtPayload,
    @Param('riteKey') riteKey: string,
  ): Promise<RiteProgressDocument> {
    return this.riteProgressService.resetCounter(user.sub, riteKey);
  }
}
