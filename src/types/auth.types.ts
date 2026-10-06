import { Role } from '../common/enums/role.enum';

export class AuthTokensShape {
  accessToken!: string;
  refreshToken!: string;
}

export class JwtPayloadShape {
  sub!: string;
  role!: Role;
  phone?: string;
  email?: string;
}

// Ticket WebSocket (ADR 0027) : 30 s, à usage unique, présenté au handshake
// Socket.IO (`auth: { ticket }`).
export class RealtimeTicketShape {
  ticket!: string;
  expiresAt!: Date;
}
