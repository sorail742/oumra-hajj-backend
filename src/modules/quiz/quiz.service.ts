import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestion(dto: CreateQuizQuestionDto) {
    if (dto.correctOption >= dto.options.length) {
      throw new BadRequestException('correctOption is out of range');
    }

    const riteSheet = await this.prisma.riteSheet.findUnique({
      where: { id: dto.riteSheetId },
    });
    if (!riteSheet) throw new NotFoundException('Rite sheet not found');

    return this.prisma.quizQuestion.create({
      data: {
        riteSheetId: dto.riteSheetId,
        question: dto.question,
        options: dto.options,
        correctOption: dto.correctOption,
        explanation: dto.explanation,
      },
    });
  }

  async validateQuestion(id: string, adminId: string) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id },
    });
    if (!question) throw new NotFoundException('Question not found');

    return this.prisma.quizQuestion.update({
      where: { id },
      data: {
        isValidated: true,
        validatedById: adminId,
        validatedAt: new Date(),
      },
    });
  }

  // La bonne réponse et l'explication ne sont révélées qu'après une
  // tentative (voir submitAttempt), sinon le quiz n'a plus d'intérêt.
  async getQuestionsForRite(riteSheetId: string) {
    return this.prisma.quizQuestion.findMany({
      where: {
        riteSheetId,
        isValidated: true,
      },
      select: {
        id: true,
        riteSheetId: true,
        question: true,
        options: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async submitAttempt(
    questionId: string,
    pilgrimId: string,
    dto: SubmitQuizAttemptDto,
  ) {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (!question.isValidated)
      throw new ForbiddenException('Question is not validated yet');

    const isCorrect = dto.selectedOption === question.correctOption;

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        pilgrimId,
        questionId,
        selectedOption: dto.selectedOption,
        isCorrect,
      },
    });

    return {
      ...attempt,
      correctOption: question.correctOption,
      explanation: question.explanation,
    };
  }

  async getMyStats(pilgrimId: string) {
    const attempts = await this.prisma.quizAttempt.findMany({
      where: { pilgrimId },
      include: {
        question: {
          select: { riteSheetId: true },
        },
      },
    });

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((a) => a.isCorrect).length;

    return {
      totalAttempts,
      correctAttempts,
      scorePercentage:
        totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
      attempts,
    };
  }
}
