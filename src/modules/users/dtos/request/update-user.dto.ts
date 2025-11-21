import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ example: 'Jane' })
  @IsNotEmpty()
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty()
  @IsString()
  lastName: string;

  @ApiProperty({ example: 'jane@terracore.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+265 99 000 0000', required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({
    example: 'role-uuid-here',
    format: 'uuid',
    description: 'Role assigned to the user',
  })
  @IsUUID()
  roleId: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ example: false })
  @IsBoolean()
  emailVerified: boolean;
}
