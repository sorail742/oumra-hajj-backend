import { Module } from '@nestjs/common';
import { MicroCoursesController } from './micro-courses.controller';
import { MicroCoursesService } from './micro-courses.service';

@Module({
  controllers: [MicroCoursesController],
  providers: [MicroCoursesService],
  exports: [MicroCoursesService],
})
export class MicroCoursesModule {}

