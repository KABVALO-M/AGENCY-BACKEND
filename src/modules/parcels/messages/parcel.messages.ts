export const PARCEL_MESSAGES = {
    CREATED: 'Parcel created successfully.',
    CREATE_FAILED: 'Failed to create parcel.',
    UPDATED: 'Parcel updated successfully.',
    UPDATE_FAILED: 'Failed to update parcel.',
    GEOMETRY_REQUIRED: 'Geometry or shapefile must be provided.',
    GEOMETRY_INVALID: 'Invalid geometry format.',
    SHAPEFILE_PARSE_ERROR: 'Failed to parse shapefile.',
    SHAPEFILE_EMPTY: 'No features found in shapefile.',
    NOT_FOUND: 'Parcel not found.',
  } as const;
  
  export type ParcelMessageKey = keyof typeof PARCEL_MESSAGES;
  