export interface MicroCourseShape {
  id: string;
  title: string;
  description: string | null;
  videoUrl: string;
  durationSeconds: number;
  order: number;
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MicroCourseProgressShape {
  id: string;
  pilgrimId: string;
  courseId: string;
  isCompleted: boolean;
  clientUpdatedAt: Date;
}

