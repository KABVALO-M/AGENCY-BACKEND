export const PARCEL_MESSAGES = {
    // ─────────────── GENERAL ───────────────
    CREATED: 'Parcel created successfully.',
    UPDATED: 'Parcel updated successfully.',
    DELETED: 'Parcel deleted successfully.',
    CREATE_FAILED: 'Failed to create parcel. Please try again later.',
    UPDATE_FAILED: 'Failed to update parcel. Please try again later.',
    DELETE_FAILED: 'Failed to delete parcel. Please try again later.',

    NOT_FOUND: 'Parcel not found.',
    ALREADY_DELETED: 'Parcel has already been deleted.',

    GEOMETRY_REQUIRED: 'Geometry data is required to create a parcel.',
    GEOMETRY_INVALID: 'Invalid geometry structure or coordinates.',
    GEOMETRY_PARSE_ERROR: 'Failed to parse geometry data.',

    // ─────────────── FILE UPLOADS ───────────────
    SHAPEFILE_EMPTY: 'Uploaded shapefile is empty or contains no features.',
    SHAPEFILE_PARSE_ERROR: 'Unable to parse shapefile. Ensure it is a valid .zip shapefile archive.',
    GEOJSON_EMPTY: 'Uploaded GeoJSON file has no features or invalid geometry.',
    KML_EMPTY: 'Uploaded KML file contains no valid geometries.',
    KMZ_NO_KML: 'KMZ archive does not contain a valid .kml file.',
    KMZ_EMPTY: 'Uploaded KMZ file contains no valid geometries.',
    FILE_UNSUPPORTED:
      'Unsupported file format. Please upload a valid .zip (Shapefile), .geojson, .kml, or .kmz file.',

    FILE_MISSING: 'No geometry file or GeoJSON data provided.',
    FILE_SAVE_ERROR: 'Error saving uploaded file to disk.',

    // ─────────────── COMPUTATION ───────────────
    AREA_COMPUTE_ERROR: 'Failed to compute parcel area.',
    PERIMETER_COMPUTE_ERROR: 'Failed to compute parcel perimeter.',

    // ─────────────── FILTER / FETCH ───────────────
    FETCH_FAILED: 'Failed to fetch parcels.',
    NO_PARCELS_FOUND: 'No parcels available for the given criteria.',

    // ─────────────── ANALYTICS / METRICS ───────────────
    POPULATION_STAT_CREATED: 'Population statistic recorded successfully.',
    FACILITY_CREATED: 'Facility information recorded successfully.',
    CLIMATE_METRIC_CREATED: 'Climate metric recorded successfully.',
    RISK_INPUT_RECORDED: 'Risk input stored successfully.',
    RISK_ASSESSMENT_CREATED: 'Risk assessment saved successfully.',
    LOCATION_INSIGHT_CREATED: 'Location insight recorded successfully.',
    MATERIALIZED_VIEW_REFRESHED: 'Materialized view refresh triggered.',
    MATERIALIZED_VIEW_STATUS_FETCHED: 'Materialized view statuses retrieved.',
    GEOSERVER_SYNC_TRIGGERED:
      'GeoServer synchronization triggered. Layers will be available shortly.',
  } as const;

  export type ParcelMessageKey = keyof typeof PARCEL_MESSAGES;
  
