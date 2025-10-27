import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { RoleName } from '../../constants/role-name.constant';

export class CreateRoleDto {
  @ApiProperty({
    example: RoleName.Admin,
    description: 'Unique name of the role (admin | user)',
    enum: RoleName,
  })
  @IsEnum(RoleName)
  @IsNotEmpty()
  name: RoleName;

  @ApiProperty({ example: 'System administrator', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
