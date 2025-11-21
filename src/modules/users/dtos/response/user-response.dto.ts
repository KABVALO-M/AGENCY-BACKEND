import { ApiProperty } from '@nestjs/swagger';
import { RoleName } from '../../../roles/constants/role-name.constant';
import { User } from '../../entities/user.entity';

class UserRoleResponseDto {
  @ApiProperty({ example: 'f26c1eef-a8f8-4c3d-987a-1234abcd5678' })
  id: string;

  @ApiProperty({ enum: RoleName, example: RoleName.User })
  name: RoleName;

  @ApiProperty({
    example: 'Standard user with limited access',
    required: false,
  })
  description?: string;
}

export class UserResponseDto {
  @ApiProperty({ example: 'd18a8d7f-1d6c-4714-b6fd-d587f9a02c75' })
  id: string;

  @ApiProperty({ example: 'Alice' })
  firstName: string;

  @ApiProperty({ example: 'Johnson' })
  lastName: string;

  @ApiProperty({ example: 'alice@example.com' })
  email: string;

  @ApiProperty({ example: '+265998001122', required: false })
  phone?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({
    example: '2025-01-10T12:01:33.456Z',
    required: false,
  })
  emailVerifiedAt?: Date;

  @ApiProperty({
    example: '2025-01-04T10:15:00.000Z',
    required: false,
  })
  lastLogin?: Date;

  @ApiProperty({ type: UserRoleResponseDto })
  role: UserRoleResponseDto;

  @ApiProperty({ example: '2025-01-04T10:15:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-01-04T10:15:00.000Z' })
  updatedAt: Date;

  static fromEntity(user: User): UserResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      isActive: user.isActive,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLogin: user.lastLogin,
      role: {
        id: user.role?.id ?? '',
        name: user.role?.name ?? RoleName.User,
        description: user.role?.description,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
