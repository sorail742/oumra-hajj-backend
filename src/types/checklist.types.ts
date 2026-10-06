// Élément de la checklist de préparation d'une réservation.
export class ChecklistItemShape {
  id!: string;
  bookingId!: string;
  title!: string;
  // "document", "vaccine", "luggage", "spiritual"
  category!: string;
  isCompleted!: boolean;
  reminderDate!: Date | null;
  reminderSent!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
}
