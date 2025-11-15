export const PARCEL_MATERIALIZED_VIEWS = [
  'population_density_grid_mv',
  'parcel_risk_summary_mv',
] as const;

export type ParcelMaterializedView = (typeof PARCEL_MATERIALIZED_VIEWS)[number];

