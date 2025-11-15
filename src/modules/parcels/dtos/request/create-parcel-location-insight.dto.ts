import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { LocationInsightCategory } from '../../constants/location-insight-category.constant';

export class CreateParcelLocationInsightDto {
  @ApiProperty({ enum: LocationInsightCategory, description: 'Insight category' })
  @IsEnum(LocationInsightCategory)
  category: LocationInsightCategory;

  @ApiProperty({ description: 'Title for the insight', example: 'New highway interchange approved' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Narrative description', example: 'Construction expected to drive accessibility' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Status label', example: 'Planned' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  status?: string;

  @ApiProperty({ description: 'Expected completion date', example: '2026-06-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  expectedCompletion?: Date;

  @ApiProperty({ description: 'Confidence score (0-100)', example: 70 })
  @IsOptional()
  @IsNumber()
  confidenceScore?: number;

  @ApiProperty({ description: 'Impact score (0-100)', example: 85 })
  @IsOptional()
  @IsNumber()
  impactScore?: number;

  @ApiProperty({ description: 'Source or reference', example: 'Ministry of Infrastructure' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  source?: string;
}

