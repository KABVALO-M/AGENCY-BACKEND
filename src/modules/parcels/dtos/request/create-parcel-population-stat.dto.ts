import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { Geometry } from 'geojson';

export class CreateParcelPopulationStatDto {
  @ApiPropertyOptional({ description: 'Estimated population within the parcel catchment', example: 4200 })
  @IsOptional()
  @IsNumber()
  population?: number;

  @ApiPropertyOptional({ description: 'Number of households counted for this statistic', example: 800 })
  @IsOptional()
  @IsNumber()
  households?: number;

  @ApiPropertyOptional({ description: 'Population density per square kilometer', example: 1500 })
  @IsOptional()
  @IsNumber()
  densityPerSqKm?: number;

  @ApiPropertyOptional({ description: 'Annual growth rate percentage (e.g. 2.4)', example: 2.5 })
  @IsOptional()
  @IsNumber()
  annualGrowthRate?: number;

  @ApiPropertyOptional({ description: 'Source of the statistic', example: 'National census 2024' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  source?: string;

  @ApiPropertyOptional({ description: 'Date the metric was collected', example: '2024-11-23T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  collectedAt?: Date;

  @ApiPropertyOptional({
    description: 'Area that the statistic covers (if broader than parcel)',
    type: 'object',
    additionalProperties: false,
    example: { type: 'Polygon', coordinates: [[[30.1, -1.9], [30.2, -1.9], [30.2, -1.8], [30.1, -1.8], [30.1, -1.9]]] },
  })
  @IsOptional()
  @IsObject()
  coverageArea?: Geometry;

  @ApiPropertyOptional({ description: 'Any notes or assumptions to capture', example: 'Projection from last survey' })
  @IsOptional()
  @IsString()
  notes?: string;
}
