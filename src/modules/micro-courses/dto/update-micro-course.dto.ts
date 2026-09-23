import { PartialType } from '@nestjs/swagger';
import { CreateMicroCourseDto } from './create-micro-course.dto';

export class UpdateMicroCourseDto extends PartialType(CreateMicroCourseDto) {}

