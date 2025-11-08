import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsObject,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ParcelStatus } from '../../constants/parcel-status.constant';

export class CreateParcelDto {
  @ApiProperty({
    description: 'Human friendly parcel name',
    example: 'Parcel 17 - Downtown',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Optional free-text details about the parcel',
    example: 'Vacant lot close to the river.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Land/registry title document number',
    example: 'TTX-009123',
  })
  @IsOptional()
  @IsString()
  titleNumber?: string;

  @ApiPropertyOptional({
    description:
      'GeoJSON polygon geometry. If omitted, upload a shapefile instead.',
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [30.121, -1.951],
          [30.122, -1.951],
          [30.122, -1.952],
          [30.121, -1.952],
          [30.121, -1.951],
        ],
      ],
    },
  })
  @IsOptional()
  @IsObject()
  geometry?: any; // GeoJSON polygon if not using shapefile

  @ApiPropertyOptional({
    description: 'Estimated population living within the parcel',
    example: 125,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  population?: number;

  @ApiPropertyOptional({
    description: 'Workflow status of the parcel',
    enum: ParcelStatus,
    example: ParcelStatus.AVAILABLE,
    default: ParcelStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(ParcelStatus)
  status?: ParcelStatus;
}
