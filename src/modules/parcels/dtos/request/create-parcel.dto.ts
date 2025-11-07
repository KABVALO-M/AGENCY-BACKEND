import { IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

export class CreateParcelDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  // GeoJSON or coordinate object
  @IsObject()
  geometry: any;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  titleNumber?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
