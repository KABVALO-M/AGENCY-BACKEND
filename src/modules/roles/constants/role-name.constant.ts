export enum RoleName {
  Admin = 'admin',
  User = 'user',
}

export const DEFAULT_ROLES: { name: RoleName; description: string }[] = [
  {
    name: RoleName.Admin,
    description: 'System administrator with full access',
  },
  {
    name: RoleName.User,
    description: 'Standard user with limited access',
  },
];
