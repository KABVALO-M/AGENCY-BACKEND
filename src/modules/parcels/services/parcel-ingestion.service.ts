import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as turf from '@turf/turf';
import type { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { Parcel } from '../entities/parcel.entity';
import { ParcelPopulationStat } from '../entities/parcel-population-stat.entity';
import { ParcelRiskInput } from '../entities/parcel-risk-input.entity';
import { ParcelClimateMetric } from '../entities/parcel-climate-metric.entity';
import { ParcelRiskMetric } from '../constants/parcel-risk-metric.constant';
import { ParcelSchemaService } from './parcel-schema.service';
import { EnvironmentalDataService } from './environmental-data.service';
import { EnvironmentalSample } from './environmental-data.service';
import { ParcelRiskAssessment } from '../entities/parcel-risk-assessment.entity';
import { ParcelRiskBand } from '../constants/parcel-risk-band.constant';
import {
  PARCEL_MATERIALIZED_VIEWS,
  ParcelMaterializedView,
} from '../constants/materialized-view.constant';

interface ParcelIngestionOptions {
  reason: 'create' | 'update';
  user?: AuthenticatedUser;
  providedPopulation?: number;
  geometryChanged?: boolean;
}

@Injectable()
export class ParcelIngestionService {
  private readonly logger = new Logger(ParcelIngestionService.name);

  constructor(
    @InjectRepository(Parcel)
    private readonly parcelRepository: Repository<Parcel>,
    @InjectRepository(ParcelPopulationStat)
    private readonly populationRepository: Repository<ParcelPopulationStat>,
    @InjectRepository(ParcelRiskInput)
    private readonly riskInputRepository: Repository<ParcelRiskInput>,
    @InjectRepository(ParcelClimateMetric)
    private readonly climateRepository: Repository<ParcelClimateMetric>,
    @InjectRepository(ParcelRiskAssessment)
    private readonly riskAssessmentRepository: Repository<ParcelRiskAssessment>,
    private readonly parcelSchemaService: ParcelSchemaService,
    private readonly environmentalDataService: EnvironmentalDataService,
  ) {}

  enqueue(parcelId: string, options: ParcelIngestionOptions): void {
    setImmediate(() =>
      this.process(parcelId, options).catch((error: Error) =>
        this.logger.error(
          `Parcel ingestion failed for ${parcelId}: ${error.message}`,
          error.stack,
        ),
      ),
    );
  }

  private async process(parcelId: string, options: ParcelIngestionOptions) {
    const parcel = await this.parcelRepository.findOne({
      where: { id: parcelId },
    });
    if (!parcel) {
      this.logger.warn(`Parcel ${parcelId} not found for ingestion`);
      return;
    }

    const auditUser = options.user?.email ?? options.user?.id ?? 'system';

    if (typeof options.providedPopulation === 'number') {
      await this.recordPopulationStat(
        parcel,
        options.providedPopulation,
        auditUser,
      );
    }

    if (options.geometryChanged ?? options.reason === 'create') {
      await this.captureEnvironmentalData(parcel, auditUser);
    }

    await this.refreshViews();
  }

  private async recordPopulationStat(
    parcel: Parcel,
    population: number,
    createdBy: string,
  ) {
    const areaSqMeters = parcel.area ? Number(parcel.area) : undefined;
    const density =
      areaSqMeters && areaSqMeters > 0
        ? population / (areaSqMeters / 1_000_000)
        : undefined;

    const stat = this.populationRepository.create({
      parcel,
      population,
      densityPerSqKm: density ? Number(density.toFixed(2)) : undefined,
      source: 'parcel_form',
      collectedAt: new Date(),
      createdBy,
      updatedBy: createdBy,
    });

    await this.populationRepository.save(stat);
  }

  private async captureEnvironmentalData(parcel: Parcel, createdBy: string) {
    const sample = await this.environmentalDataService.sample(parcel.geometry);
    if (!sample) {
      this.logger.debug(`No environmental sample available for ${parcel.id}`);
      return;
    }

    await this.storeClimateMetric(parcel, sample, createdBy);
    await this.storeRiskInputs(parcel, sample, createdBy);
    await this.storeRiskAssessment(parcel, sample, createdBy);
  }

  private async storeClimateMetric(
    parcel: Parcel,
    sample: EnvironmentalSample,
    createdBy: string,
  ) {
    const metric = this.climateRepository.create({
      parcel,
      avgTemperatureC: sample.avgTemperatureC,
      rainfallMm: sample.rainfallMm,
      elevationMeters: sample.elevationMeters,
      slopeDegrees: sample.slopeDegrees,
      floodRiskScore: sample.floodRiskScore,
      droughtRiskScore: sample.droughtRiskScore,
      seaLevelRiskScore: sample.seaLevelRiskScore,
      dataSource: sample.source ?? 'ingestion',
      collectedAt: new Date(),
      createdBy,
      updatedBy: createdBy,
    });

    await this.climateRepository.save(metric);
  }

  private async storeRiskInputs(
    parcel: Parcel,
    sample: EnvironmentalSample,
    createdBy: string,
  ) {
    const entries: Array<[ParcelRiskMetric, number | undefined]> = [
      [ParcelRiskMetric.ELEVATION, sample.elevationMeters],
      [ParcelRiskMetric.SLOPE, sample.slopeDegrees],
      [ParcelRiskMetric.FLOOD_RISK, sample.floodRiskScore],
      [ParcelRiskMetric.DROUGHT_RISK, sample.droughtRiskScore],
      [ParcelRiskMetric.SEA_LEVEL, sample.seaLevelRiskScore],
    ];

    for (const [metric, value] of entries) {
      if (typeof value !== 'number') continue;
      await this.upsertRiskInput(
        parcel,
        metric,
        value,
        createdBy,
        sample.source,
      );
    }
  }

  private async upsertRiskInput(
    parcel: Parcel,
    metric: ParcelRiskMetric,
    value: number,
    createdBy: string,
    source?: string,
  ) {
    let record = await this.riskInputRepository.findOne({
      where: { parcel: { id: parcel.id }, metric },
    });

    const normalized = this.normalizeRiskScore(metric, value);

    if (!record) {
      record = this.riskInputRepository.create({
        parcel,
        metric,
        value,
        normalizedScore: normalized,
        dataSource: source,
        createdBy,
        updatedBy: createdBy,
        lastEvaluatedAt: new Date(),
      });
    } else {
      record.value = value;
      record.normalizedScore = normalized;
      record.dataSource = source ?? record.dataSource;
      record.updatedBy = createdBy;
      record.lastEvaluatedAt = new Date();
    }

    await this.riskInputRepository.save(record);
  }

  private normalizeRiskScore(
    metric: ParcelRiskMetric,
    value: number,
  ): number | undefined {
    switch (metric) {
      case ParcelRiskMetric.ELEVATION:
        return value < 50 ? 80 : value < 200 ? 40 : 15;
      case ParcelRiskMetric.SLOPE:
        return value > 12 ? 60 : value > 5 ? 30 : 10;
      case ParcelRiskMetric.FLOOD_RISK:
      case ParcelRiskMetric.DROUGHT_RISK:
      case ParcelRiskMetric.SEA_LEVEL:
        return value;
      default:
        return undefined;
    }
  }

  private async storeRiskAssessment(
    parcel: Parcel,
    sample: EnvironmentalSample,
    createdBy: string,
  ) {
    const drivers: Record<string, unknown> = {
      elevationMeters: sample.elevationMeters,
      slopeDegrees: sample.slopeDegrees,
      floodRisk: sample.floodRiskScore,
      droughtRisk: sample.droughtRiskScore,
      seaLevelRisk: sample.seaLevelRiskScore,
    };

    const hazardScores = [
      sample.floodRiskScore,
      sample.droughtRiskScore,
      sample.seaLevelRiskScore,
    ].filter((value): value is number => typeof value === 'number');

    if (!hazardScores.length) {
      return;
    }

    const overall =
      hazardScores.reduce((sum, current) => sum + current, 0) /
      hazardScores.length;
    const band = this.mapScoreToBand(overall);

    const assessment = this.riskAssessmentRepository.create({
      parcel,
      overallScore: Number(overall.toFixed(2)),
      riskBand: band,
      drivers,
      assessedAt: new Date(),
      methodologyVersion: 'auto-ingest-v1',
      createdBy,
      updatedBy: createdBy,
    });

    await this.riskAssessmentRepository.save(assessment);
  }

  private mapScoreToBand(score: number): ParcelRiskBand {
    if (score >= 70) return ParcelRiskBand.HIGH;
    if (score >= 40) return ParcelRiskBand.MODERATE;
    return ParcelRiskBand.LOW;
  }

  private async refreshViews() {
    const views: ParcelMaterializedView[] = [...PARCEL_MATERIALIZED_VIEWS];
    for (const view of views) {
      try {
        await this.parcelSchemaService.refreshMaterializedView(view);
      } catch (error) {
        this.logger.error(
          `Failed refreshing view ${view}: ${(error as Error).message}`,
        );
      }
    }
  }
}
