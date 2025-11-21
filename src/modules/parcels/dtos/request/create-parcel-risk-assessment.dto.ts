import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ParcelRiskBand } from '../../constants/parcel-risk-band.constant';

export class CreateParcelRiskAssessmentDto {
  @ApiProperty({ description: 'Overall risk score (0-100)', example: 62 })
  @IsNumber()
  overallScore: number;

  @ApiProperty({
    enum: ParcelRiskBand,
    description: 'Risk band classification',
  })
  @IsEnum(ParcelRiskBand)
  riskBand: ParcelRiskBand;

  @ApiProperty({
    description: 'JSON structure describing score drivers',
    example: { flood: 0.4 },
  })
  @IsOptional()
  @IsObject()
  drivers?: Record<string, unknown>;

  @ApiProperty({
    description: 'Methodology version identifier',
    example: 'v1.0',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  methodologyVersion?: string;

  @ApiProperty({
    description: 'Timestamp when the parcel was assessed',
    example: '2024-11-05T10:00:00Z',
  })
  @IsDateString()
  assessedAt: Date;

  @ApiProperty({
    description: 'Additional notes',
    example: 'High floodplain risk due to low elevation',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
