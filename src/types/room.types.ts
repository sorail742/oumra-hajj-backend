// Idée #40 (backlog "Cent Fonctionnalités") — allotement de chambres.

// Places par chambre selon le type, convention des agences Oumra/Hadj.
export const ROOM_CAPACITY = {
  double: 2,
  triple: 3,
  quadruple: 4,
  quintuple: 5,
} as const;

export type RoomType = keyof typeof ROOM_CAPACITY;
export const ROOM_TYPES = Object.keys(ROOM_CAPACITY) as RoomType[];

export class RoomOccupantShape {
  bookingId!: string;
  pilgrimName!: string;
}

export class RoomShape {
  number!: number;
  occupants!: RoomOccupantShape[];
}

export class RoomBlockShape {
  id!: string;
  packageId!: string;
  packageTitle!: string;
  stageId?: string;
  hotelName!: string;
  city!: string;
  roomType!: RoomType;
  roomCount!: number;
  bedsPerRoom!: number;
  totalBeds!: number;
  assignedBeds!: number;
  releaseDate?: Date;
  notes?: string;
  rooms!: RoomShape[];
  // Réservations actives du forfait sans place dans ce bloc.
  unassigned!: RoomOccupantShape[];
}

export class MyRoomShape {
  hotelName!: string;
  city!: string;
  roomType!: RoomType;
  roomNumber!: number;
  packageTitle!: string;
  startDate?: Date;
  endDate?: Date;
}
