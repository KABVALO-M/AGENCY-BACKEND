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
import { ParcelRiskMetric } from '../../constants/parcel-risk-metric.constant';

export class UpsertParcelRiskInputDto {
  @ApiProperty({ enum: ParcelRiskMetric, description: 'Metric identifier' })
  @IsEnum(ParcelRiskMetric)
  metric: ParcelRiskMetric;

  @ApiProperty({ description: 'Measured value', example: 1450 })
  @IsOptional()
  @IsNumber()
  value?: number;

  @ApiProperty({
    description: 'Weight applied to this metric in risk calculation',
    example: 1.2,
  })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiProperty({
    description: 'Normalized score (0-100) used in risk algorithm',
    example: 75,
  })
  @IsOptional()
  @IsNumber()
  normalizedScore?: number;

  @ApiProperty({
    description: 'Data source reference',
    example: 'SRTM 30m DEM',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  dataSource?: string;

  @ApiProperty({
    description: 'Additional details for the metric',
    example: { sample: 'centroid' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description: 'Timestamp when the metric was captured',
    example: '2024-11-01T12:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  lastEvaluatedAt?: Date;
}
