import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Alice' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Johnson' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+265998001122', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: 'role-uuid-here',
    format: 'uuid',
    description: 'ID of the role to assign to the user',
  })
  @IsUUID()
  roleId: string;

  @ApiProperty({
    example: true,
    required: false,
    default: true,
    description: 'Whether the user should be active immediately',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    example: false,
    required: false,
    default: false,
    description: 'Whether the email should be marked verified on creation',
  })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @ApiProperty({
    example: 'ChangeMe123!',
    required: false,
    default: 'ChangeMe123!',
    description: 'Temporary password (defaults to "ChangeMe123!" if omitted)',
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}
