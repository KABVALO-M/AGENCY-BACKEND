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
      return extractGeometryFromGeoJson(geojson, PARCEL_MESSAGES.SHAPEFILE_EMPTY);
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
    // KML parsing handles its own errors internally
    return parseKmlString(fileBuffer.toString());
  }

  if (ext === '.kmz') {
    // KMZ parsing handles its own errors internally
    return await parseKmzBuffer(fileBuffer);
  }

  // .geojson / .json
  try {
    const geojson = JSON.parse(fileBuffer.toString());
    console.log('GeoJSON parsed:', { 
      type: geojson?.type, 
      featureCount: geojson?.features?.length 
    });
    return extractGeometryFromGeoJson(geojson, PARCEL_MESSAGES.GEOJSON_EMPTY);
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
      return extractGeometryFromGeoJson(geojson, PARCEL_MESSAGES.SHAPEFILE_EMPTY);
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
      return extractGeometryFromGeoJson(geojson, PARCEL_MESSAGES.GEOJSON_EMPTY);
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
  
  // Check for parsing errors
  const parseError = xml.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    throw new BadRequestException('Invalid KML file: XML parsing failed');
  }
  
  // Debug: Log KML structure
  const placemarks = xml.getElementsByTagName('Placemark');
  console.log('KML Debug:', {
    placemarks: placemarks.length,
    documents: xml.getElementsByTagName('Document').length,
    folders: xml.getElementsByTagName('Folder').length
  });
  
  // Always try manual parsing first (more reliable)
  let geojson: any;
  
  // If no placemarks, try toGeoJSON (it might handle other structures)
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
    // We have placemarks, parse manually
    console.log('Found placemarks, using manual parser...');
    try {
      geojson = parseKmlManually(xml);
      console.log('Manual parsing succeeded');
    } catch (manualError) {
      const manualMsg = manualError instanceof Error ? manualError.message : String(manualError);
      
      // Fallback to toGeoJSON if manual parsing fails
      console.log('Manual parsing failed, trying toGeoJSON...');
      try {
        geojson = toGeoJSON.kml(xml);
        console.log('toGeoJSON succeeded as fallback');
      } catch (toGeoJsonError) {
        // Both failed, throw the manual parsing error (more specific)
        throw new BadRequestException(
          `Failed to parse KML file: ${manualMsg}`
        );
      }
    }
  }
  
  // Additional validation
  if (!geojson) {
    throw new BadRequestException('KML file contains no valid geographic data');
  }
  
  console.log('KML parsed result:', {
    type: geojson.type,
    featureCount: geojson.features?.length
  });
  
  return extractGeometryFromGeoJson(geojson, PARCEL_MESSAGES.KML_EMPTY);
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
    
    // Try to find coordinates
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
    
    // Parse coordinates (format: lon,lat,alt lon,lat,alt ...)
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
    
    // Determine geometry type based on KML elements
    let geometry: any;
    const hasPolygon = placemark.getElementsByTagName('Polygon').length > 0;
    const hasLineString = placemark.getElementsByTagName('LineString').length > 0;
    const hasPoint = placemark.getElementsByTagName('Point').length > 0;
    
    if (hasPolygon) {
      // For polygons, coordinates should be closed ring
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
      // Auto-detect based on coordinate count
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

function extractGeometryFromGeoJson(
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
    
    // If multiple features, combine them into a GeometryCollection or use first one
    if (validFeatures.length > 1) {
      // For parcels, we typically want a single geometry
      // You can either:
      // 1. Take the first feature (current behavior)
      // 2. Combine all features into a GeometryCollection
      // 3. Throw an error asking user to select one
      
      console.warn(`File contains ${validFeatures.length} features. Using the first one.`);
    }
    
    const geometry = validFeatures[0].geometry;
    if (!geometry) {
      throw new BadRequestException(emptyMessage);
    }
    
    return geometry;
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
