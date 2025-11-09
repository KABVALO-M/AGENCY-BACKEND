import { BadRequestException } from '@nestjs/common';
import { FeatureCollection, Geometry, MultiPolygon, MultiLineString, MultiPoint } from 'geojson';
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

  // Handle each file type separately without wrapping in try-catch
  if (ext === '.zip') {
    return parseZipContainer(fileBuffer);
  }

  if (ext === '.shp') {
    try {
      const shpParser = await loadShapefileParser();
      const geojson = await shpParser(fileBuffer);
      console.log('Shapefile parsed:', { 
        type: geojson?.type, 
        featureCount: geojson?.features?.length 
      });
      return extractAndCombineGeometries(geojson, PARCEL_MESSAGES.SHAPEFILE_EMPTY);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const details = error instanceof Error ? error.message : String(error);
      console.error('Shapefile parse error:', { details, error });
      throw new BadRequestException(`${PARCEL_MESSAGES.GEOMETRY_PARSE_ERROR}: ${details}`);
    }
  }

  if (ext === '.kml') {
    return parseKmlString(fileBuffer.toString());
  }

  if (ext === '.kmz') {
    return await parseKmzBuffer(fileBuffer);
  }

  // .geojson / .json
  try {
    const geojson = JSON.parse(fileBuffer.toString());
    console.log('GeoJSON parsed:', { 
      type: geojson?.type, 
      featureCount: geojson?.features?.length 
    });
    return extractAndCombineGeometries(geojson, PARCEL_MESSAGES.GEOJSON_EMPTY);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    const details = error instanceof Error ? error.message : String(error);
    console.error('GeoJSON parse error:', { details, error });
    throw new BadRequestException(`${PARCEL_MESSAGES.GEOMETRY_PARSE_ERROR}: ${details}`);
  }
}

async function parseKmzBuffer(buffer: Buffer): Promise<Geometry> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const kmlEntry = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith('.kml'));

    if (!kmlEntry) {
      throw new BadRequestException(PARCEL_MESSAGES.KMZ_NO_KML);
    }

    const kmlContent = await zip.files[kmlEntry].async('string');
    return parseKmlString(kmlContent);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    const details = error instanceof Error ? error.message : String(error);
    console.error('KMZ parse error:', details);
    throw new BadRequestException(`Failed to parse KMZ file: ${details}`);
  }
}

async function parseZipContainer(buffer: Buffer): Promise<Geometry> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);
    const lowered = entries.map((name) => name.toLowerCase());

    if (lowered.some((name) => name.endsWith('.shp'))) {
      const shpParser = await loadShapefileParser();
      const geojson = await shpParser(buffer);
      return extractAndCombineGeometries(geojson, PARCEL_MESSAGES.SHAPEFILE_EMPTY);
    }

    const kmlIndex = lowered.findIndex((name) => name.endsWith('.kml'));
    if (kmlIndex !== -1) {
      const kmlContent = await zip.files[entries[kmlIndex]].async('string');
      return parseKmlString(kmlContent);
    }

    const geojsonIndex = lowered.findIndex(
      (name) => name.endsWith('.geojson') || name.endsWith('.json'),
    );
    if (geojsonIndex !== -1) {
      const content = await zip.files[entries[geojsonIndex]].async('string');
      const geojson = JSON.parse(content);
      return extractAndCombineGeometries(geojson, PARCEL_MESSAGES.GEOJSON_EMPTY);
    }

    throw new BadRequestException(PARCEL_MESSAGES.FILE_UNSUPPORTED);
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    const details = error instanceof Error ? error.message : String(error);
    console.error('ZIP container parse error:', details);
    throw new BadRequestException(`${PARCEL_MESSAGES.GEOMETRY_PARSE_ERROR}: ${details}`);
  }
}

function parseKmlString(kmlContent: string): Geometry {
  const xml = new DOMParser().parseFromString(kmlContent, 'text/xml');
  
  const parseError = xml.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new BadRequestException('Invalid KML file: XML parsing failed');
  }
  
  const placemarks = xml.getElementsByTagName('Placemark');
  console.log('KML Debug:', {
    placemarks: placemarks.length,
    documents: xml.getElementsByTagName('Document').length,
    folders: xml.getElementsByTagName('Folder').length
  });
  
  let geojson: any;
  
  if (placemarks.length === 0) {
    console.log('No placemarks found, trying toGeoJSON...');
    try {
      geojson = toGeoJSON.kml(xml);
      console.log('toGeoJSON succeeded');
    } catch (toGeoJsonError) {
      const errorMsg = toGeoJsonError instanceof Error ? toGeoJsonError.message : String(toGeoJsonError);
      throw new BadRequestException(
        `KML file has no Placemarks and toGeoJSON also failed: ${errorMsg}`
      );
    }
  } else {
    console.log('Found placemarks, using manual parser...');
    try {
      geojson = parseKmlManually(xml);
      console.log('Manual parsing succeeded');
    } catch (manualError) {
      const manualMsg = manualError instanceof Error ? manualError.message : String(manualError);
      console.log('Manual parsing failed, trying toGeoJSON...');
      try {
        geojson = toGeoJSON.kml(xml);
        console.log('toGeoJSON succeeded as fallback');
      } catch (toGeoJsonError) {
        throw new BadRequestException(`Failed to parse KML file: ${manualMsg}`);
      }
    }
  }
  
  if (!geojson) {
    throw new BadRequestException('KML file contains no valid geographic data');
  }
  
  console.log('KML parsed result:', {
    type: geojson.type,
    featureCount: geojson.features?.length
  });
  
  return extractAndCombineGeometries(geojson, PARCEL_MESSAGES.KML_EMPTY);
}

function parseKmlManually(xml: Document): any {
  const placemarks = xml.getElementsByTagName('Placemark');
  
  if (placemarks.length === 0) {
    throw new Error('No Placemarks found in KML file');
  }
  
  const features: any[] = [];
  
  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const nameNode = placemark.getElementsByTagName('name')[0];
    const name = nameNode?.textContent?.trim() || `Feature ${i + 1}`;
    
    const coordinatesNodes = placemark.getElementsByTagName('coordinates');
    if (coordinatesNodes.length === 0) {
      console.warn(`Placemark "${name}" has no coordinates`);
      continue;
    }
    
    const coordsText = coordinatesNodes[0]?.textContent?.trim();
    if (!coordsText) {
      console.warn(`Placemark "${name}" has empty coordinates`);
      continue;
    }
    
    const coordPairs = coordsText
      .split(/\s+/)
      .filter(s => s.trim())
      .map(pair => {
        const parts = pair.split(',').map(s => parseFloat(s.trim()));
        const [lon, lat, alt] = parts;
        return alt !== undefined ? [lon, lat, alt] : [lon, lat];
      })
      .filter(pair => !isNaN(pair[0]) && !isNaN(pair[1]));
    
    if (coordPairs.length === 0) {
      console.warn(`Placemark "${name}" has invalid coordinates`);
      continue;
    }
    
    let geometry: any;
    const hasPolygon = placemark.getElementsByTagName('Polygon').length > 0;
    const hasLineString = placemark.getElementsByTagName('LineString').length > 0;
    const hasPoint = placemark.getElementsByTagName('Point').length > 0;
    
    if (hasPolygon) {
      if (coordPairs.length >= 4) {
        geometry = {
          type: 'Polygon',
          coordinates: [coordPairs]
        };
      } else {
        console.warn(`Polygon "${name}" has too few coordinates (${coordPairs.length})`);
        continue;
      }
    } else if (hasLineString && coordPairs.length >= 2) {
      geometry = {
        type: 'LineString',
        coordinates: coordPairs
      };
    } else if (hasPoint && coordPairs.length === 1) {
      geometry = {
        type: 'Point',
        coordinates: coordPairs[0]
      };
    } else {
      if (coordPairs.length === 1) {
        geometry = { type: 'Point', coordinates: coordPairs[0] };
      } else if (coordPairs.length >= 4) {
        geometry = { type: 'Polygon', coordinates: [coordPairs] };
      } else {
        geometry = { type: 'LineString', coordinates: coordPairs };
      }
    }
    
    features.push({
      type: 'Feature',
      properties: { name },
      geometry
    });
  }
  
  if (features.length === 0) {
    throw new Error('No valid geometries found in KML file');
  }
  
  console.log(`Manually parsed ${features.length} feature(s) from KML`);
  
  return {
    type: 'FeatureCollection',
    features
  };
}

/**
 * Extracts geometries from GeoJSON and combines multiple features into a single geometry
 * - Single feature: returns its geometry as-is
 * - Multiple Polygons: combines into MultiPolygon
 * - Multiple LineStrings: combines into MultiLineString
 * - Multiple Points: combines into MultiPoint
 * - Mixed types: creates GeometryCollection
 */
function extractAndCombineGeometries(
  data: FeatureCollection | Geometry | { type?: string; features?: any[] },
  emptyMessage: string,
): Geometry {
  if (!data) {
    throw new BadRequestException(emptyMessage);
  }

  // Handle FeatureCollection
  if ((data as FeatureCollection).type === 'FeatureCollection') {
    const collection = data as FeatureCollection;
    
    if (!collection.features?.length) {
      throw new BadRequestException(emptyMessage);
    }
    
    // Filter out features without geometry
    const validFeatures = collection.features.filter(f => f.geometry);
    
    if (!validFeatures.length) {
      throw new BadRequestException('No valid geometries found in the file');
    }
    
    // Single feature - return as-is
    if (validFeatures.length === 1) {
      console.log('Single feature found, using it directly');
      return validFeatures[0].geometry;
    }
    
    // Multiple features - combine them
    console.log(`Combining ${validFeatures.length} features into a single parcel geometry`);
    return combineGeometries(validFeatures.map(f => f.geometry));
  }

  // Handle single Feature
  if ((data as any).type === 'Feature' && (data as any).geometry) {
    const feature = data as any;
    if (!feature.geometry) {
      throw new BadRequestException('Feature contains no geometry');
    }
    return feature.geometry;
  }

  // Handle raw Geometry
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

/**
 * Combines multiple geometries into a single geometry
 * - Same type geometries: creates Multi* version (MultiPolygon, MultiLineString, MultiPoint)
 * - Mixed types: creates GeometryCollection
 */
function combineGeometries(geometries: Geometry[]): Geometry {
  if (geometries.length === 0) {
    throw new BadRequestException('No geometries to combine');
  }
  
  if (geometries.length === 1) {
    return geometries[0];
  }
  
  // Check if all geometries are of the same type
  const types = new Set(geometries.map(g => g.type));
  
  // All Polygons -> MultiPolygon
  if (types.size === 1 && types.has('Polygon')) {
    const coordinates = geometries.map((g: any) => g.coordinates);
    console.log(`Creating MultiPolygon from ${geometries.length} Polygons`);
    return {
      type: 'MultiPolygon',
      coordinates
    } as MultiPolygon;
  }
  
  // All LineStrings -> MultiLineString
  if (types.size === 1 && types.has('LineString')) {
    const coordinates = geometries.map((g: any) => g.coordinates);
    console.log(`Creating MultiLineString from ${geometries.length} LineStrings`);
    return {
      type: 'MultiLineString',
      coordinates
    } as MultiLineString;
  }
  
  // All Points -> MultiPoint
  if (types.size === 1 && types.has('Point')) {
    const coordinates = geometries.map((g: any) => g.coordinates);
    console.log(`Creating MultiPoint from ${geometries.length} Points`);
    return {
      type: 'MultiPoint',
      coordinates
    } as MultiPoint;
  }
  
  // Mixed types or already Multi* types -> GeometryCollection
  console.log(`Creating GeometryCollection from ${geometries.length} mixed geometries`);
  return {
    type: 'GeometryCollection',
    geometries
  };
}

type ShapefileParser = (input: ArrayBuffer | Buffer | Blob | string) => Promise<any>;
let shapefileParserPromise: Promise<ShapefileParser> | null = null;

async function loadShapefileParser(): Promise<ShapefileParser> {
  if (!shapefileParserPromise) {
    shapefileParserPromise = (async () => {
      try {
        const shpjs = await import('shpjs');
        
        let parser: any;
        
        if (typeof shpjs === 'function') {
          parser = shpjs;
        } else if (typeof (shpjs as any).default === 'function') {
          parser = (shpjs as any).default;
        } else if (typeof (shpjs as any).parseZip === 'function') {
          parser = (shpjs as any).parseZip;
        } else {
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