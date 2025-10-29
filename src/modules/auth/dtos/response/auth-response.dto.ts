import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '../../../roles/constants/role-name.constant';

class AuthPermissionDto {
  @ApiProperty({ example: '9c5e8dc3-5a07-41f4-a1bd-ffbb5db359c3' })
  id: string;

  @ApiProperty({ example: 'manage_users' })
  name: string;

  @ApiProperty({ example: 'Allows managing user accounts', required: false })
  description?: string;
}

class AuthRoleDto {
  @ApiProperty({ example: 'f4b16d32-0a19-4b63-9f82-7fd4167436dd' })
  id: string;

  @ApiProperty({ enum: RoleName, example: RoleName.User })
  name: RoleName;

  @ApiProperty({
    example: 'Standard user role with basic permissions',
    required: false,
  })
  description?: string;

  @ApiProperty({ type: AuthPermissionDto, isArray: true })
  permissions: AuthPermissionDto[];
}

class AuthUserDto {
  @ApiProperty({ example: 'a6a3f4c5-2d14-49f5-9621-7b9dc4f4391a' })
  id: string;

  @ApiProperty({ example: 'John' })
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  lastName: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ example: '+265998001122', required: false })
  phone?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({
    example: '2025-01-08T09:35:27.000Z',
    required: false,
    type: String,
    format: 'date-time',
  })
  lastLogin?: Date;

  @ApiProperty({ type: AuthRoleDto })
  role: AuthRoleDto;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'Login successful' })
  message: string;

  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJpYXQiOjE3MzU1OTIwMDAsImV4cCI6MTczNTU5NTYwMH0.UHWmNnt3nODG8nQtN_BbCgQeW_tilQ_ylQEusF7-hig',
  })
  accessToken: string;

  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJ0b2tlblZlcnNpb24iOjAsImlhdCI6MTczNTU5MjAwMCwiZXhwIjoxNzM3MTk2ODAwfQ.REFRESH_SAMPLE',
  })
  refreshToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
