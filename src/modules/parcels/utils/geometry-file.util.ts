import { BadRequestException } from '@nestjs/common';
import { FeatureCollection, Geometry } from 'geojson';
import { DOMParser } from 'xmldom';
import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
import shp from 'shpjs';
import * as path from 'path';
import { PARCEL_MESSAGES } from '../messages/parcel.messages';

const SUPPORTED_EXTENSIONS = new Set([
  '.zip',
  '.shp',
  '.kml',
  '.kmz',
  '.geojson',
  '.json',
]);

export async function parseGeometryFile(
  fileBuffer: Buffer,
  originalName: string,
): Promise<Geometry> {
  const ext = path.extname(originalName).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new BadRequestException(PARCEL_MESSAGES.FILE_UNSUPPORTED);
  }

  try {
    if (ext === '.zip' || ext === '.shp') {
      return extractGeometryFromGeoJson(await shp(fileBuffer), PARCEL_MESSAGES.SHAPEFILE_EMPTY);
    }

    if (ext === '.kml') {
      return parseKmlString(fileBuffer.toString());
    }

    if (ext === '.kmz') {
      return await parseKmzBuffer(fileBuffer);
    }

    // .geojson / .json
    const geojson = JSON.parse(fileBuffer.toString());
    return extractGeometryFromGeoJson(geojson, PARCEL_MESSAGES.GEOJSON_EMPTY);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException(PARCEL_MESSAGES.GEOMETRY_PARSE_ERROR);
  }
}

async function parseKmzBuffer(buffer: Buffer): Promise<Geometry> {
  const zip = await JSZip.loadAsync(buffer);
  const kmlEntry = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith('.kml'));

  if (!kmlEntry) {
    throw new BadRequestException(PARCEL_MESSAGES.KMZ_NO_KML);
  }

  const kmlContent = await zip.files[kmlEntry].async('string');
  return parseKmlString(kmlContent);
}

function parseKmlString(kmlContent: string): Geometry {
  const xml = new DOMParser().parseFromString(kmlContent);
  const geojson = toGeoJSON.kml(xml);
  return extractGeometryFromGeoJson(geojson, PARCEL_MESSAGES.KML_EMPTY);
}

function extractGeometryFromGeoJson(
  data: FeatureCollection | Geometry | { type?: string; features?: any[] },
  emptyMessage: string,
): Geometry {
  if (!data) {
    throw new BadRequestException(emptyMessage);
  }

  if ((data as FeatureCollection).type === 'FeatureCollection') {
    const collection = data as FeatureCollection;
    if (!collection.features?.length) {
      throw new BadRequestException(emptyMessage);
    }
    const geometry = collection.features[0]?.geometry;
    if (!geometry) {
      throw new BadRequestException(emptyMessage);
    }
    return geometry;
  }

  if ((data as any).type === 'Feature' && (data as any).geometry) {
    return (data as any).geometry;
  }

  const geometryCandidate = data as Geometry;
  const candidateWithCoords = geometryCandidate as unknown as {
    coordinates?: unknown;
  };
  if (
    typeof geometryCandidate?.type === 'string' &&
    typeof candidateWithCoords.coordinates !== 'undefined'
  ) {
    return geometryCandidate;
  }

  throw new BadRequestException(emptyMessage);
}
