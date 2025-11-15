import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PARCEL_MATERIALIZED_VIEWS,
  ParcelMaterializedView,
} from '../constants/materialized-view.constant';

const POPULATION_DENSITY_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS population_density_grid_mv AS
WITH parcel_extent AS (
  SELECT ST_SetSRID(ST_Extent(p.geometry)::geometry, 4326) AS geom
  FROM parcels p
),
bounds AS (
  SELECT
    ST_XMin(geom) AS minx,
    ST_XMax(geom) AS maxx,
    ST_YMin(geom) AS miny,
    ST_YMax(geom) AS maxy,
    0.02::double precision AS cell_size,
    GREATEST(CEIL((ST_XMax(geom) - ST_XMin(geom)) / 0.02)::int, 1) AS x_steps,
    GREATEST(CEIL((ST_YMax(geom) - ST_YMin(geom)) / 0.02)::int, 1) AS y_steps
  FROM parcel_extent
  WHERE geom IS NOT NULL
),
grid AS (
  SELECT
    ST_SetSRID(
      ST_MakeEnvelope(
        bounds.minx + gx.step * bounds.cell_size,
        bounds.miny + gy.step * bounds.cell_size,
        bounds.minx + (gx.step + 1) * bounds.cell_size,
        bounds.miny + (gy.step + 1) * bounds.cell_size
      ),
      4326
    ) AS geom
  FROM bounds,
  LATERAL generate_series(0, bounds.x_steps - 1) AS gx(step),
  LATERAL generate_series(0, bounds.y_steps - 1) AS gy(step)
)
SELECT
  ROW_NUMBER() OVER () AS cell_id,
  g.geom,
  COALESCE(SUM(pps."population"), 0) AS total_population,
  CASE
    WHEN ST_Area(ST_Transform(g.geom, 3857)) = 0 THEN 0
    ELSE COALESCE(SUM(pps."population"), 0) / (ST_Area(ST_Transform(g.geom, 3857)) / 1000000.0)
  END AS density_per_sqkm,
  NOW() AS computed_at
FROM grid g
LEFT JOIN parcels p ON ST_Intersects(p.geometry, g.geom)
LEFT JOIN parcel_population_stats pps ON pps.parcel_id = p.id
GROUP BY g.geom;`;

const POPULATION_DENSITY_GEOM_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS population_density_grid_mv_geom_idx
ON population_density_grid_mv USING GIST (geom);`;

const POPULATION_DENSITY_ID_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS population_density_grid_mv_cell_idx
ON population_density_grid_mv (cell_id);`;

const RISK_SUMMARY_VIEW_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS parcel_risk_summary_mv AS
WITH latest_population AS (
  SELECT DISTINCT ON (pps.parcel_id)
    pps.parcel_id,
    pps."population",
    pps."densityPerSqKm",
    pps."collectedAt"
  FROM parcel_population_stats pps
  ORDER BY pps.parcel_id, pps."collectedAt" DESC NULLS LAST, pps."createdAt" DESC
),
latest_climate AS (
  SELECT DISTINCT ON (pcm.parcel_id)
    pcm.parcel_id,
    pcm."avgTemperatureC",
    pcm."rainfallMm",
    pcm."elevationMeters",
    pcm."floodRiskScore",
    pcm."metricDate"
  FROM parcel_climate_metrics pcm
  ORDER BY pcm.parcel_id, pcm."metricDate" DESC NULLS LAST, pcm."createdAt" DESC
),
facility_aggregates AS (
  SELECT
    pf.parcel_id,
    COUNT(*) AS facility_count,
    AVG(pf."importanceScore") AS avg_facility_score
  FROM parcel_facilities pf
  GROUP BY pf.parcel_id
)
SELECT
  p.id AS parcel_id,
  ra."overallScore",
  ra."riskBand",
  ra."drivers",
  ra."assessedAt",
  COALESCE(lp."population", 0) AS population,
  lp."densityPerSqKm" AS density_per_sqkm,
  lp."collectedAt" AS population_collected_at,
  fc.facility_count,
  fc.avg_facility_score,
  lc."avgTemperatureC",
  lc."rainfallMm",
  lc."elevationMeters",
  lc."floodRiskScore",
  lc."metricDate" AS climate_metric_date
FROM parcels p
LEFT JOIN LATERAL (
  SELECT pra."overallScore", pra."riskBand", pra."drivers", pra."assessedAt"
  FROM parcel_risk_assessments pra
  WHERE pra.parcel_id = p.id
  ORDER BY pra."assessedAt" DESC
  LIMIT 1
) ra ON true
LEFT JOIN latest_population lp ON lp.parcel_id = p.id
LEFT JOIN facility_aggregates fc ON fc.parcel_id = p.id
LEFT JOIN latest_climate lc ON lc.parcel_id = p.id;`;

const RISK_SUMMARY_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS parcel_risk_summary_mv_parcel_idx
ON parcel_risk_summary_mv (parcel_id);`;

const MATERIALIZED_VIEW_SEED_SQL = `
INSERT INTO materialized_view_refreshes ("viewName", "status")
  SELECT view_name, 'idle'
  FROM (VALUES
    ${PARCEL_MATERIALIZED_VIEWS.map((view) => `('${view}')`).join(',\n    ')}
  ) AS src(view_name)
  ON CONFLICT ("viewName") DO NOTHING;`;

@Injectable()
export class ParcelSchemaService implements OnModuleInit {
  private readonly logger = new Logger(ParcelSchemaService.name);
  private readonly trackedViews = [...PARCEL_MATERIALIZED_VIEWS];

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.ensureMaterializedViews();
  }

  private async ensureMaterializedViews(): Promise<void> {
    const statements = [
      POPULATION_DENSITY_VIEW_SQL,
      POPULATION_DENSITY_GEOM_INDEX_SQL,
      POPULATION_DENSITY_ID_INDEX_SQL,
      RISK_SUMMARY_VIEW_SQL,
      RISK_SUMMARY_INDEX_SQL,
      MATERIALIZED_VIEW_SEED_SQL,
    ];

    for (const statement of statements) {
      try {
        await this.dataSource.query(statement);
      } catch (error) {
        const err = error as Error;
        this.logger.error('Failed executing schema statement', err.stack);
      }
    }
  }

  getTrackedViews(): ParcelMaterializedView[] {
    return [...this.trackedViews];
  }

  async refreshMaterializedView(viewName: ParcelMaterializedView): Promise<void> {
    if (!this.trackedViews.includes(viewName)) {
      this.logger.warn(`Attempted to refresh untracked materialized view: ${viewName}`);
      return;
    }

    const startTime = Date.now();
    await this.dataSource.query(
      `UPDATE materialized_view_refreshes SET status = 'running', "errorMessage" = NULL WHERE "viewName" = $1`,
      [viewName],
    );

    try {
      await this.dataSource.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`);
      const duration = Date.now() - startTime;
      await this.dataSource.query(
        `UPDATE materialized_view_refreshes
         SET status = 'idle', "lastRefreshedAt" = NOW(), "durationMs" = $2
         WHERE "viewName" = $1`,
        [viewName, duration],
      );
    } catch (error) {
      const err = error as Error;
      await this.dataSource.query(
        `UPDATE materialized_view_refreshes
         SET status = 'error', "errorMessage" = $2
         WHERE "viewName" = $1`,
        [viewName, err.message],
      );
      this.logger.error(`Failed refreshing materialized view ${viewName}`, err.stack);
      throw err;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledRefresh(): Promise<void> {
    for (const view of this.getTrackedViews()) {
      try {
        await this.refreshMaterializedView(view);
      } catch {
        // Errors already logged within refreshMaterializedView
      }
    }
  }
}
