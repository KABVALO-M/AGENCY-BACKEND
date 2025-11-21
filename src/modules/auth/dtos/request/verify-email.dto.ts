import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'a9f1b6cce4b84d4fa2af4378f3d92d35',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
