import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Has full access to system resources' })
  @IsOptional()
  @IsString()
  description?: string;
}
