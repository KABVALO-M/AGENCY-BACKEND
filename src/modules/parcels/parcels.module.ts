import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParcelsService } from './services/parcels.service';
import { ParcelsController } from './controllers/parcels.controller';
import { Parcel } from './entities/parcel.entity';
import { ParcelPopulationStat } from './entities/parcel-population-stat.entity';
import { ParcelFacility } from './entities/parcel-facility.entity';
import { ParcelClimateMetric } from './entities/parcel-climate-metric.entity';
import { ParcelRiskInput } from './entities/parcel-risk-input.entity';
import { ParcelRiskAssessment } from './entities/parcel-risk-assessment.entity';
import { ParcelLocationInsight } from './entities/parcel-location-insight.entity';
import { MaterializedViewRefresh } from './entities/materialized-view-refresh.entity';
import { ParcelSchemaService } from './services/parcel-schema.service';
import { ParcelIngestionService } from './services/parcel-ingestion.service';
import { EnvironmentalDataService } from './services/environmental-data.service';
import { GeoServerSyncService } from './services/geoserver-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Parcel,
      ParcelPopulationStat,
      ParcelFacility,
      ParcelClimateMetric,
      ParcelRiskInput,
      ParcelRiskAssessment,
      ParcelLocationInsight,
      MaterializedViewRefresh,
    ]),
  ],
  controllers: [ParcelsController],
  providers: [
    ParcelsService,
    ParcelSchemaService,
    ParcelIngestionService,
    EnvironmentalDataService,
    GeoServerSyncService,
  ],
  exports: [ParcelsService],
})
export class ParcelsModule {}
