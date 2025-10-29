import { RoleName } from '../../roles/constants/role-name.constant';

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleName;
  tokenVersion: number;
  iat?: number;
  exp?: number;
}
