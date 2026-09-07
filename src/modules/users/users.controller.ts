import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { UserShape } from '../../types/user.types';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() user: JwtPayload): Promise<UserShape> {
    return this.usersService.findByIdOrFail(user.sub);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserShape> {
    return this.usersService.updateProfile(user.sub, dto);
  }

  // Réservé à l'admin plateforme (supervision des utilisateurs — cahier des
  // charges §3.4 "Gestion des utilisateurs").
  @Roles(Role.ADMIN)
  @Get()
  listByRole(
    @Query('role') role: Role,
    @Query('agencyId') agencyId?: string,
  ): Promise<UserShape[]> {
    return this.usersService.findByRole(role, agencyId);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/suspend')
  suspend(@Param('id') id: string): Promise<UserShape> {
    return this.usersService.setActive(id, false);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/reactivate')
  reactivate(@Param('id') id: string): Promise<UserShape> {
    return this.usersService.setActive(id, true);
  }
}
