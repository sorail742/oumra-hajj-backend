// Question telle que vue par le pèlerin : ni la bonne réponse ni
// l'explication, révélées seulement après une tentative.
export class QuizQuestionShape {
  id!: string;
  riteSheetId!: string;
  question!: string;
  options!: string[];
}

// Question complète, pour le guide et l'administrateur.
export class QuizQuestionAdminShape extends QuizQuestionShape {
  correctOption!: number;
  explanation!: string | null;
  isValidated!: boolean;
  validatedById!: string | null;
  validatedAt!: Date | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class QuizAttemptShape {
  id!: string;
  pilgrimId!: string;
  questionId!: string;
  selectedOption!: number;
  isCorrect!: boolean;
  createdAt!: Date;
}

// Résultat d'une tentative : la correction est alors révélée.
export class QuizAttemptResultShape extends QuizAttemptShape {
  correctOption!: number;
  explanation!: string | null;
}

export class QuizAttemptQuestionRef {
  riteSheetId!: string;
}

export class QuizAttemptWithRiteShape extends QuizAttemptShape {
  question!: QuizAttemptQuestionRef;
}

export class QuizStatsShape {
  totalAttempts!: number;
  correctAttempts!: number;
  scorePercentage!: number;
  attempts!: QuizAttemptWithRiteShape[];
}
