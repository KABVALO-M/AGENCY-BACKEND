import { ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({ name: 'parcel_risk_summary_mv' })
export class ParcelRiskSummaryView {
  @ViewColumn({ name: 'parcel_id' })
  parcelId: string;

  @ViewColumn({ name: 'overallScore' })
  overallScore: number | null;

  @ViewColumn({ name: 'riskBand' })
  riskBand: string | null;

  @ViewColumn({ name: 'drivers' })
  drivers: Record<string, unknown> | null;

  @ViewColumn({ name: 'assessedAt' })
  assessedAt: Date | null;

  @ViewColumn({ name: 'population' })
  population: number | null;

  @ViewColumn({ name: 'density_per_sqkm' })
  densityPerSqKm: number | null;

  @ViewColumn({ name: 'population_collected_at' })
  populationCollectedAt: Date | null;

  @ViewColumn({ name: 'facility_count' })
  facilityCount: number | null;

  @ViewColumn({ name: 'avg_facility_score' })
  avgFacilityScore: number | null;

  @ViewColumn({ name: 'avgTemperatureC' })
  avgTemperatureC: number | null;

  @ViewColumn({ name: 'rainfallMm' })
  rainfallMm: number | null;

  @ViewColumn({ name: 'elevationMeters' })
  elevationMeters: number | null;

  @ViewColumn({ name: 'floodRiskScore' })
  floodRiskScore: number | null;

  @ViewColumn({ name: 'climate_metric_date' })
  climateMetricDate: Date | null;
}

