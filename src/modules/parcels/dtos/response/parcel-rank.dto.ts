import { ApiProperty } from '@nestjs/swagger';

export class TopRiskParcelDto {
  @ApiProperty({ example: 'parcel-id' })
  parcelId: string;

  @ApiProperty({ example: 'Parcel Name' })
  name: string;

  @ApiProperty({ example: 72.5 })
  overallScore: number | null;

  @ApiProperty({ example: 'HIGH' })
  riskBand: string | null;

  @ApiProperty({ example: true })
  hasGeometry: boolean;
}

