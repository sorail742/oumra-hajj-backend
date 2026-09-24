import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/authenticated-request.interface';
import { MicroCoursesController } from './micro-courses.controller';
import { MicroCoursesService } from './micro-courses.service';

describe('MicroCoursesController', () => {
  let controller: MicroCoursesController;
  let service: {
    listAll: jest.Mock;
    findById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    findMyProgress: jest.Mock;
    syncBatch: jest.Mock;
  };

  const user: JwtPayload = {
    sub: 'pilgrim-1',
    role: Role.PILGRIM,
  };

  const mockCourse = {
    id: 'course-1',
    title: 'Préparer son bagage',
    description: 'Guide valise',
    videoUrl: 'https://cdn.example.com/bagage.mp4',
    durationSeconds: 120,
    order: 1,
    category: 'preparation',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      listAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMyProgress: jest.fn(),
      syncBatch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MicroCoursesController],
      providers: [{ provide: MicroCoursesService, useValue: service }],
    }).compile();

    controller = module.get(MicroCoursesController);
  });

  it('listAll appelle service.listAll', async () => {
    service.listAll.mockResolvedValue([mockCourse]);

    const result = await controller.listAll('preparation');

    expect(service.listAll).toHaveBeenCalledWith('preparation');
    expect(result).toEqual([mockCourse]);
  });

  it('findById appelle service.findById', async () => {
    service.findById.mockResolvedValue(mockCourse);

    const result = await controller.findById('course-1');

    expect(service.findById).toHaveBeenCalledWith('course-1');
    expect(result).toEqual(mockCourse);
  });

  it('create appelle service.create', async () => {
    service.create.mockResolvedValue(mockCourse);

    const dto = {
      title: 'Préparer son bagage',
      videoUrl: 'https://cdn.example.com/bagage.mp4',
    };
    const result = await controller.create(dto);

    expect(service.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(mockCourse);
  });

  it('update appelle service.update', async () => {
    service.update.mockResolvedValue(mockCourse);

    const dto = { title: 'Nouveau titre' };
    const result = await controller.update('course-1', dto);

    expect(service.update).toHaveBeenCalledWith('course-1', dto);
    expect(result).toEqual(mockCourse);
  });

  it('delete appelle service.delete', async () => {
    service.delete.mockResolvedValue(undefined);

    await controller.delete('course-1');

    expect(service.delete).toHaveBeenCalledWith('course-1');
  });

  it('getMyProgress appelle service.findMyProgress avec l ID pèlerin', async () => {
    const progress = [
      {
        id: 'p-1',
        pilgrimId: user.sub,
        courseId: 'course-1',
        isCompleted: true,
        clientUpdatedAt: new Date(),
      },
    ];
    service.findMyProgress.mockResolvedValue(progress);

    const result = await controller.getMyProgress(user);

    expect(service.findMyProgress).toHaveBeenCalledWith(user.sub);
    expect(result).toEqual(progress);
  });

  it('syncProgress appelle service.syncBatch avec le payload de synchronisation', async () => {
    const dto = {
      items: [
        {
          courseId: 'course-1',
          isCompleted: true,
          clientUpdatedAt: new Date().toISOString(),
        },
      ],
    };
    service.syncBatch.mockResolvedValue([]);

    await controller.syncProgress(user, dto);

    expect(service.syncBatch).toHaveBeenCalledWith(user.sub, dto);
  });
});
