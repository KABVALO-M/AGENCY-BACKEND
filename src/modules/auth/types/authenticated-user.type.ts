import { RoleName } from '../../roles/constants/role-name.constant';

export interface AuthPermissionPayload {
  id: string;
  name: string;
  description?: string;
}

export interface AuthRolePayload {
  id: string;
  name: RoleName;
  description?: string;
  permissions: AuthPermissionPayload[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  tokenVersion: number;
  lastLogin?: Date;
  role: AuthRolePayload;
}
