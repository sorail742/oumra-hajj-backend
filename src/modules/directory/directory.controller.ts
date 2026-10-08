import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AgencyDirectoryEntryShape } from '../../types/agency.types';
import { DirectoryService } from './directory.service';

// Chemin distinct de `/agencies` : `GET /agencies/:id` (admin) capturerait
// sinon « directory » comme identifiant.
@ApiTags('directory')
@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  @Public()
  @Get('agencies')
  listAgencies(): Promise<AgencyDirectoryEntryShape[]> {
    return this.directoryService.listApprovedAgencies();
  }
}
