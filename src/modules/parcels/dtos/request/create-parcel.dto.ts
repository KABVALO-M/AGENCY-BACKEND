import {
    IsNotEmpty,
    IsOptional,
    IsString,
    IsNumber,
    IsObject,
  } from 'class-validator';
  import { Type } from 'class-transformer';
  
  export class CreateParcelDto {
    @IsString()
    @IsNotEmpty()
    name: string;
  
    @IsOptional()
    @IsString()
    description?: string;
  
    @IsOptional()
    @IsString()
    titleNumber?: string;
  
    @IsOptional()
    @IsObject()
    geometry?: any; // GeoJSON polygon if not using shapefile
  
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    population?: number;
  
    @IsOptional()
    @IsString()
    status?: string;
  }
  