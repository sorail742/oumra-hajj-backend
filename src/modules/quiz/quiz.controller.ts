import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  Get,
  UseGuards,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Post('questions')
  @Roles(Role.ADMIN, Role.GUIDE)
  createQuestion(@Body() dto: CreateQuizQuestionDto) {
    return this.quizService.createQuestion(dto);
  }

  @Patch('questions/:id/validate')
  @Roles(Role.ADMIN)
  validateQuestion(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.quizService.validateQuestion(id, user.sub);
  }

  @Get('questions/:riteSheetId')
  @Roles(Role.PILGRIM, Role.GUIDE, Role.ADMIN)
  getQuestionsForRite(@Param('riteSheetId') riteSheetId: string) {
    return this.quizService.getQuestionsForRite(riteSheetId);
  }

  @Post('questions/:id/attempts')
  @Roles(Role.PILGRIM)
  submitAttempt(
    @Param('id') questionId: string,
    @Body() dto: SubmitQuizAttemptDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.quizService.submitAttempt(questionId, user.sub, dto);
  }

  @Get('attempts/my-stats')
  @Roles(Role.PILGRIM)
  getMyStats(@CurrentUser() user: JwtPayload) {
    return this.quizService.getMyStats(user.sub);
  }
}
