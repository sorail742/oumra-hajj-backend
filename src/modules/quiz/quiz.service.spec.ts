import { Test, TestingModule } from '@nestjs/testing';
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

  // Basic testing
  describe('createQuestion', () => {
    it('should create a question', async () => {
      const dto = {
        riteSheetId: '1',
        question: 'Q',
        options: ['A', 'B'],
        correctOption: 0,
      };
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
  });
});
