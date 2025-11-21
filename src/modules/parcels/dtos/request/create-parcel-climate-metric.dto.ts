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

export class CreateParcelClimateMetricDto {
  @ApiPropertyOptional({
    description: 'Date for which the measurement applies',
    example: '2024-11-01',
  })
  @IsOptional()
  @IsDateString()
  metricDate?: string;

  @ApiPropertyOptional({
    description: 'Average temperature in Celsius',
    example: 27.4,
  })
  @IsOptional()
  @IsNumber()
  avgTemperatureC?: number;

  @ApiPropertyOptional({
    description: 'Maximum temperature in Celsius',
    example: 33.1,
  })
  @IsOptional()
  @IsNumber()
  maxTemperatureC?: number;

  @ApiPropertyOptional({
    description: 'Minimum temperature in Celsius',
    example: 21.9,
  })
  @IsOptional()
  @IsNumber()
  minTemperatureC?: number;

  @ApiPropertyOptional({
    description: 'Rainfall in millimeters',
    example: 120.5,
  })
  @IsOptional()
  @IsNumber()
  rainfallMm?: number;

  @ApiPropertyOptional({
    description: 'Relative humidity percentage',
    example: 70,
  })
  @IsOptional()
  @IsNumber()
  humidityPercentage?: number;

  @ApiPropertyOptional({ description: 'Flood risk score (0-100)', example: 65 })
  @IsOptional()
  @IsNumber()
  floodRiskScore?: number;

  @ApiPropertyOptional({
    description: 'Drought risk score (0-100)',
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  droughtRiskScore?: number;

  @ApiPropertyOptional({
    description: 'Sea level risk score (0-100)',
    example: 75,
  })
  @IsOptional()
  @IsNumber()
  seaLevelRiskScore?: number;

  @ApiPropertyOptional({
    description: 'Elevation in meters sourced from DEM',
    example: 1420,
  })
  @IsOptional()
  @IsNumber()
  elevationMeters?: number;

  @ApiPropertyOptional({
    description: 'Slope degrees from terrain model',
    example: 5.6,
  })
  @IsOptional()
  @IsNumber()
  slopeDegrees?: number;

  @ApiPropertyOptional({
    description: 'Geometry used for sample extraction (centroid, buffer, etc.)',
    type: 'object',
    additionalProperties: false,
  })
  @IsOptional()
  @IsObject()
  sampleArea?: Geometry;

  @ApiPropertyOptional({
    description: 'Data source (API, dataset, etc.)',
    example: 'SRTM Tile 37',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  dataSource?: string;

  @ApiPropertyOptional({
    description: 'Timestamp when data was collected',
    example: '2024-11-01T14:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  collectedAt?: Date;
}
