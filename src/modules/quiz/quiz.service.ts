import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQuizQuestionDto } from './dto/create-quiz-question.dto';
import { SubmitQuizAttemptDto } from './dto/submit-quiz-attempt.dto';

@Injectable()
export class QuizService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuestion(dto: CreateQuizQuestionDto) {
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

  async getQuestionsForRite(riteSheetId: string) {
    return this.prisma.quizQuestion.findMany({
      where: {
        riteSheetId,
        isValidated: true,
      },
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

    return this.prisma.quizAttempt.create({
      data: {
        pilgrimId,
        questionId,
        selectedOption: dto.selectedOption,
        isCorrect,
      },
    });
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
