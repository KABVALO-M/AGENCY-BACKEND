import { BadRequestException } from '@nestjs/common';
import { FeatureCollection, Geometry } from 'geojson';
import { DOMParser } from 'xmldom';
import JSZip from 'jszip';
import * as toGeoJSON from '@tmcw/togeojson';
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
      const shpParser = await loadShapefileParser();
      return extractGeometryFromGeoJson(await shpParser(fileBuffer), PARCEL_MESSAGES.SHAPEFILE_EMPTY);
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
    const details = error instanceof Error ? error.message : String(error);
    console.error('Geometry parse error', { ext, details });
    throw new BadRequestException(`${PARCEL_MESSAGES.GEOMETRY_PARSE_ERROR}: ${details}`);
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

type ShapefileParser = (input: ArrayBuffer | Buffer | Blob | string) => Promise<any>;
let shapefileParserPromise: Promise<ShapefileParser> | null = null;

async function loadShapefileParser(): Promise<ShapefileParser> {
  if (!shapefileParserPromise) {
    shapefileParserPromise = (async () => {
      try {
        // Import the entire shpjs module
        const shpjs = await import('shpjs');
        
        // Handle different export patterns
        // shpjs might export as default, named export, or direct function
        let parser: any;
        
        if (typeof shpjs === 'function') {
          parser = shpjs;
        } else if (typeof (shpjs as any).default === 'function') {
          parser = (shpjs as any).default;
        } else if (typeof (shpjs as any).parseZip === 'function') {
          parser = (shpjs as any).parseZip;
        } else {
          // Last resort: find the first function export
          const functionExport = Object.values(shpjs).find(exp => typeof exp === 'function');
          if (functionExport) {
            parser = functionExport;
          }
        }
        
        if (!parser || typeof parser !== 'function') {
          throw new Error('Could not find valid parser function in shpjs module');
        }
        
        return parser as ShapefileParser;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Failed to load shpjs:', errorMsg);
        throw new Error(
          `Failed to load shapefile parser. Error: ${errorMsg}. ` +
          'Please ensure shpjs is properly installed: npm install shpjs@latest'
        );
      }
    })();
  }

  return shapefileParserPromise;
}