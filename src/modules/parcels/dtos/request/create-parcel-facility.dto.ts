import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { Geometry } from 'geojson';
import { ParcelFacilityType } from '../../constants/parcel-facility-type.constant';

export class CreateParcelFacilityDto {
  @ApiProperty({ enum: ParcelFacilityType, description: 'Type of facility' })
  @IsEnum(ParcelFacilityType)
  facilityType: ParcelFacilityType;

  @ApiProperty({
    description: 'Facility name',
    example: 'St. Francis Hospital',
  })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({
    description: 'Short description',
    example: 'Regional referral hospital with ER',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Importance score (0-100)', example: 80 })
  @IsOptional()
  @IsNumber()
  importanceScore?: number;

  @ApiPropertyOptional({
    description: 'Distance from parcel centroid in meters',
    example: 450,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  distanceMeters?: number;

  @ApiProperty({
    description: 'Facility geometry (point or polygon)',
    type: 'object',
    additionalProperties: false,
  })
  @IsObject()
  geometry: Geometry;

  @ApiPropertyOptional({
    description: 'Arbitrary metadata for the facility',
    example: { beds: 120 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Source of the information',
    example: 'Admin entry',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  source?: string;

  @ApiPropertyOptional({
    description: 'When the information was collected',
    example: '2024-10-10T00:00:00Z',
  })
  @IsOptional()
  @IsOptional()
  @IsDateString()
  collectedAt?: Date;
}
