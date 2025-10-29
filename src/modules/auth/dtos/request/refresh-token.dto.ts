import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMiLCJ0b2tlblZlcnNpb24iOjAsImlhdCI6MTczNTU5MjAwMCwiZXhwIjoxNzM2MTk2ODAwfQ.SAMPLE',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
