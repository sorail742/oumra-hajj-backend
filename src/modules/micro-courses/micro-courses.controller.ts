import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import {
  MicroCourseProgressShape,
  MicroCourseShape,
} from '../../types/micro-course.types';
import { CreateMicroCourseDto } from './dto/create-micro-course.dto';
import { SyncMicroCourseProgressDto } from './dto/sync-micro-course-progress.dto';
import { UpdateMicroCourseDto } from './dto/update-micro-course.dto';
import { MicroCoursesService } from './micro-courses.service';

@ApiTags('micro-courses')
@Controller('micro-courses')
export class MicroCoursesController {
  constructor(private readonly microCoursesService: MicroCoursesService) {}

  @Public()
  @Get()
  listAll(@Query('category') category?: string): Promise<MicroCourseShape[]> {
    return this.microCoursesService.listAll(category);
  }

  @Public()
  @Get(':id')
  findById(@Param('id') id: string): Promise<MicroCourseShape> {
    return this.microCoursesService.findById(id);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateMicroCourseDto): Promise<MicroCourseShape> {
    return this.microCoursesService.create(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMicroCourseDto,
  ): Promise<MicroCourseShape> {
    return this.microCoursesService.update(id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string): Promise<void> {
    return this.microCoursesService.delete(id);
  }

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Get('progress/mine')
  getMyProgress(
    @CurrentUser() user: JwtPayload,
  ): Promise<MicroCourseProgressShape[]> {
    return this.microCoursesService.findMyProgress(user.sub);
  }

  // Synchronisation par lot depuis l'application mobile (offline-first, ADR 0007).
  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Post('progress/sync')
  syncProgress(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SyncMicroCourseProgressDto,
  ): Promise<MicroCourseProgressShape[]> {
    return this.microCoursesService.syncBatch(user.sub, dto);
  }
}
