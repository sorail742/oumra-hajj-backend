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
import { PackageShape } from '../../types/package.types';
import { CreatePackageDto } from './dto/create-package.dto';
import { QueryPackagesDto } from './dto/query-packages.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PackagesService } from './packages.service';

@ApiTags('packages')
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Public()
  @Get()
  listPublic(@Query() query: QueryPackagesDto): Promise<PackageShape[]> {
    return this.packagesService.listPublic(query);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload): Promise<PackageShape[]> {
    return this.packagesService.listMine(user.sub);
  }

  @Public()
  @Get(':id')
  getById(@Param('id') id: string): Promise<PackageShape> {
    return this.packagesService.findByIdOrFail(id);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePackageDto,
  ): Promise<PackageShape> {
    return this.packagesService.create(user.sub, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePackageDto,
  ): Promise<PackageShape> {
    return this.packagesService.update(user.sub, id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.AGENCY)
  @Patch(':id/close')
  close(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ): Promise<PackageShape> {
    return this.packagesService.close(user.sub, id);
  }
}
