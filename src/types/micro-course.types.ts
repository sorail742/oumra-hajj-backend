export class MicroCourseShape {
  id!: string;
  title!: string;
  description!: string | null;
  videoUrl!: string;
  durationSeconds!: number;
  order!: number;
  category!: string;
  createdAt!: Date;
  updatedAt!: Date;
}

export class MicroCourseProgressShape {
  id!: string;
  pilgrimId!: string;
  courseId!: string;
  isCompleted!: boolean;
  clientUpdatedAt!: Date;
}
