import { Role } from '../common/enums/role.enum';

export interface AuthTokensShape {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayloadShape {
  sub: string;
  role: Role;
  phone?: string;
  email?: string;
}
