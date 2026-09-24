import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { QuizService } from './quiz.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('QuizService', () => {
  let service: QuizService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        {
          provide: PrismaService,
          useValue: {
            riteSheet: {
              findUnique: jest.fn(),
            },
            quizQuestion: {
              create: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
              findMany: jest.fn(),
            },
            quizAttempt: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createQuestion', () => {
    const dto = {
      riteSheetId: '1',
      question: 'Q',
      options: ['A', 'B'],
      correctOption: 0,
    };

    it('should create a question', async () => {
      (prismaService.riteSheet.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
      });
      (prismaService.quizQuestion.create as jest.Mock).mockResolvedValue({
        id: 'q1',
        ...dto,
      });

      const res = await service.createQuestion(dto);
      expect(res.id).toBe('q1');
      expect(prismaService.quizQuestion.create).toHaveBeenCalledWith({
        data: dto,
      });
    });

    it('should reject a correctOption outside the options', async () => {
      await expect(
        service.createQuestion({ ...dto, correctOption: 2 }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaService.quizQuestion.create).not.toHaveBeenCalled();
    });

    it('should throw when the rite sheet does not exist', async () => {
      (prismaService.riteSheet.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.createQuestion(dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getQuestionsForRite', () => {
    it('should only return validated questions without the answer', async () => {
      (prismaService.quizQuestion.findMany as jest.Mock).mockResolvedValue([]);

      await service.getQuestionsForRite('1');

      const args = (prismaService.quizQuestion.findMany as jest.Mock).mock
        .calls[0][0];
      expect(args.where).toEqual({ riteSheetId: '1', isValidated: true });
      expect(args.select.correctOption).toBeUndefined();
      expect(args.select.explanation).toBeUndefined();
    });
  });

  describe('submitAttempt', () => {
    const question = {
      id: 'q1',
      correctOption: 1,
      explanation: 'Explication factice',
      isValidated: true,
    };

    it('should record a correct attempt and reveal the answer', async () => {
      (prismaService.quizQuestion.findUnique as jest.Mock).mockResolvedValue(
        question,
      );
      (prismaService.quizAttempt.create as jest.Mock).mockImplementation(
        ({ data }: { data: object }) => Promise.resolve({ id: 'a1', ...data }),
      );

      const res = await service.submitAttempt('q1', 'p1', {
        selectedOption: 1,
      });

      expect(res.isCorrect).toBe(true);
      expect(res.correctOption).toBe(1);
      expect(res.explanation).toBe('Explication factice');
    });

    it('should mark a wrong answer as incorrect', async () => {
      (prismaService.quizQuestion.findUnique as jest.Mock).mockResolvedValue(
        question,
      );
      (prismaService.quizAttempt.create as jest.Mock).mockImplementation(
        ({ data }: { data: object }) => Promise.resolve({ id: 'a1', ...data }),
      );

      const res = await service.submitAttempt('q1', 'p1', {
        selectedOption: 0,
      });

      expect(res.isCorrect).toBe(false);
    });

    it('should refuse an attempt on a non-validated question', async () => {
      (prismaService.quizQuestion.findUnique as jest.Mock).mockResolvedValue({
        ...question,
        isValidated: false,
      });

      await expect(
        service.submitAttempt('q1', 'p1', { selectedOption: 1 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaService.quizAttempt.create).not.toHaveBeenCalled();
    });

    it('should throw when the question does not exist', async () => {
      (prismaService.quizQuestion.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.submitAttempt('missing', 'p1', { selectedOption: 0 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getMyStats', () => {
    it('should compute the score percentage', async () => {
      (prismaService.quizAttempt.findMany as jest.Mock).mockResolvedValue([
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: true },
      ]);

      const res = await service.getMyStats('p1');
      expect(res.totalAttempts).toBe(4);
      expect(res.correctAttempts).toBe(3);
      expect(res.scorePercentage).toBe(75);
    });

    it('should return 0 when there are no attempts', async () => {
      (prismaService.quizAttempt.findMany as jest.Mock).mockResolvedValue([]);

      const res = await service.getMyStats('p1');
      expect(res.scorePercentage).toBe(0);
    });
  });
});
