import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QuizAttemptResultShape,
  QuizQuestionAdminShape,
  QuizQuestionShape,
  QuizStatsShape,
} from '../../types';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';

// `options` est stocké en JSON ; seules les chaînes forment le contrat.
function toOptions(options: Prisma.JsonValue): string[] {
  return Array.isArray(options)
    ? options.filter((o): o is string => typeof o === 'string')
    : [];
}

function toQuestionShape<T extends { options: Prisma.JsonValue }>(
  question: T,
): Omit<T, 'options'> & { options: string[] } {
  return { ...question, options: toOptions(question.options) };
}

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestion(
    dto: CreateQuizQuestionDto,
  ): Promise<QuizQuestionAdminShape> {
    if (dto.correctOption >= dto.options.length) {
      throw new BadRequestException('correctOption is out of range');
    }

    const riteSheet = await this.prisma.riteSheet.findUnique({
      where: { id: dto.riteSheetId },
    });
    if (!riteSheet) throw new NotFoundException('Rite sheet not found');

    const question = await this.prisma.quizQuestion.create({
      data: {
        riteSheetId: dto.riteSheetId,
        question: dto.question,
        options: dto.options,
        correctOption: dto.correctOption,
        explanation: dto.explanation,
      },
    });
    return toQuestionShape(question);
  }

  async validateQuestion(
    id: string,
    adminId: string,
  ): Promise<QuizQuestionAdminShape> {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id },
    });
    if (!question) throw new NotFoundException('Question not found');

    const validated = await this.prisma.quizQuestion.update({
      where: { id },
      data: {
        isValidated: true,
        validatedById: adminId,
        validatedAt: new Date(),
      },
    });
    return toQuestionShape(validated);
  }

  // La bonne réponse et l'explication ne sont révélées qu'après une
  // tentative (voir submitAttempt), sinon le quiz n'a plus d'intérêt.
  async getQuestionsForRite(riteSheetId: string): Promise<QuizQuestionShape[]> {
    const questions = await this.prisma.quizQuestion.findMany({
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
    return questions.map(toQuestionShape);
  }

  async submitAttempt(
    questionId: string,
    pilgrimId: string,
    dto: SubmitQuizAttemptDto,
  ): Promise<QuizAttemptResultShape> {
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

  async getMyStats(pilgrimId: string): Promise<QuizStatsShape> {
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
