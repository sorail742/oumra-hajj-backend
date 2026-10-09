import { Controller, Get, Header, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { AuditLogShape } from '../../types/audit.types';
import { AuditService } from './audit.service';
import { Audited } from './audited.decorator';
import { ListAuditQueryDto } from './dto/list-audit-query.dto';

// Idée #85 — piste d'audit, réservée à l'administration.
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query() query: ListAuditQueryDto): Promise<AuditLogShape[]> {
    return this.auditService.list(query);
  }

  // L'export lui-même est tracé : qui a extrait la piste, et quand.
  @Get('csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="piste-audit.csv"')
  @Audited({ action: 'audit.export', entityType: 'audit' })
  exportCsv(@Query() query: ListAuditQueryDto): Promise<string> {
    return this.auditService.exportCsv(query);
  }
}
