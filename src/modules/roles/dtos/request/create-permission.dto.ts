import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'lands:create' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Allows creation of land records', required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
