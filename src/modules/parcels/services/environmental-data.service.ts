import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Geometry } from 'geojson';
import * as turf from '@turf/turf';

export interface EnvironmentalSample {
  elevationMeters?: number;
  slopeDegrees?: number;
  avgTemperatureC?: number;
  rainfallMm?: number;
  floodRiskScore?: number;
  droughtRiskScore?: number;
  seaLevelRiskScore?: number;
  source?: string;
}

@Injectable()
export class EnvironmentalDataService {
  private readonly logger = new Logger(EnvironmentalDataService.name);

  constructor(private readonly configService: ConfigService) {}

  async sample(geometry: Geometry): Promise<EnvironmentalSample | null> {
    const centroid = turf.centroid(geometry);
    const coords = centroid.geometry.coordinates as [number, number];
    const [lon, lat] = coords;

    const sample: EnvironmentalSample = { source: 'ingestion' };
    const elevation = await this.fetchElevation(lat, lon);

    if (typeof elevation === 'number') {
      sample.elevationMeters = Number(elevation.toFixed(2));
      sample.seaLevelRiskScore = this.estimateSeaLevelRisk(elevation);
      sample.floodRiskScore = this.estimateFloodRisk(elevation);
    }

    sample.slopeDegrees = this.estimateSlope(geometry);
    sample.avgTemperatureC = this.estimateTemperature(lat);
    sample.rainfallMm = this.estimateRainfall(lat);
    sample.droughtRiskScore = this.estimateDroughtRisk(sample.rainfallMm);

    const hasValue = Object.entries(sample).some(
      ([key, value]) => key !== 'source' && typeof value === 'number',
    );

    return hasValue ? sample : null;
  }

  private estimateSlope(geometry: Geometry): number | undefined {
    try {
      const bbox = turf.bbox(geometry);
      const bottomLeft = turf.point([bbox[0], bbox[1]]);
      const topRight = turf.point([bbox[2], bbox[3]]);
      const diagonalKm = turf.distance(bottomLeft, topRight, {
        units: 'kilometers',
      });
      if (!diagonalKm || diagonalKm === 0) {
        return undefined;
      }

      const areaSqKm = turf.area(geometry) / 1_000_000;
      const slope = Math.min(30, (areaSqKm / diagonalKm) * 5);
      return Number(slope.toFixed(2));
    } catch (error) {
      this.logger.debug(`Slope estimation failed: ${(error as Error).message}`);
      return undefined;
    }
  }

  private estimateTemperature(lat: number): number {
    const base = 27 - Math.abs(lat) * 0.4;
    return Number(base.toFixed(2));
  }

  private estimateRainfall(lat: number): number {
    const rainfall = 1200 - Math.abs(lat) * 10;
    return Number(Math.max(200, rainfall).toFixed(2));
  }

  private estimateFloodRisk(elevation: number): number {
    if (elevation <= 20) return 85;
    if (elevation <= 100) return 60;
    if (elevation <= 500) return 30;
    return 10;
  }

  private estimateDroughtRisk(rainfall?: number): number | undefined {
    if (typeof rainfall !== 'number') return undefined;
    if (rainfall < 400) return 70;
    if (rainfall < 800) return 40;
    return 15;
  }

  private estimateSeaLevelRisk(elevation: number): number {
    if (elevation <= 10) return 90;
    if (elevation <= 50) return 55;
    return 15;
  }

  private async fetchElevation(
    lat: number,
    lon: number,
  ): Promise<number | undefined> {
    const endpoint = this.configService.get<string>('ELEVATION_API_URL');
    if (!endpoint) {
      return undefined;
    }

    try {
      const url = new URL(endpoint);
      if (!url.searchParams.has('locations')) {
        url.searchParams.set('locations', `${lat},${lon}`);
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        results?: Array<{ elevation: number }>;
      };

      const value = data?.results?.[0]?.elevation;
      return typeof value === 'number' ? value : undefined;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch elevation: ${(error as Error).message}`,
      );
      return undefined;
    }
  }
}
