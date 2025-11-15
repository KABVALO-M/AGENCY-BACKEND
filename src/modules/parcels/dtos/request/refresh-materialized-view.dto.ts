import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  PARCEL_MATERIALIZED_VIEWS,
  type ParcelMaterializedView,
} from '../../constants/materialized-view.constant';

export class RefreshMaterializedViewDto {
  @ApiPropertyOptional({
    description: 'Specific view to refresh. Omit to refresh all tracked views.',
    enum: PARCEL_MATERIALIZED_VIEWS,
  })
  @IsOptional()
  @IsString()
  @IsIn(PARCEL_MATERIALIZED_VIEWS)
  viewName?: ParcelMaterializedView;
}
