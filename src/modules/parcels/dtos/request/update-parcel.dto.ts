import { PartialType } from '@nestjs/mapped-types';
import { CreateParcelDto } from './create-parcel.dto';
import { IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateParcelDto extends PartialType(CreateParcelDto) {
  /**
   * When true and new images are uploaded, existing stored images will be deleted first.
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  deleteOldImage?: boolean;
}
