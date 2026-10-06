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
