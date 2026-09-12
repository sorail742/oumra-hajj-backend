import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { AgencyTrustScoreShape } from '../../types/agency.types';
import { ReviewShape } from '../../types/review.types';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewShape> {
    return this.reviewsService.create(user.sub, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.PILGRIM)
  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload): Promise<ReviewShape[]> {
    return this.reviewsService.findMine(user.sub);
  }

  @Public()
  @Get('agency/:agencyId')
  listByAgency(@Param('agencyId') agencyId: string): Promise<ReviewShape[]> {
    return this.reviewsService.listByAgency(agencyId);
  }

  // Score de confiance agence — idée #96 du backlog "Cent Fonctionnalités".
  @Public()
  @Get('agency/:agencyId/trust-score')
  getTrustScore(
    @Param('agencyId') agencyId: string,
  ): Promise<AgencyTrustScoreShape> {
    return this.reviewsService.getTrustScore(agencyId);
  }
}
