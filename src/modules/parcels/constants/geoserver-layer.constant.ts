export interface GeoServerLayerConfig {
  name: string;
  nativeName?: string;
  title: string;
  srs?: string;
}

export const GEOSERVER_LAYER_CONFIGS: GeoServerLayerConfig[] = [
  {
    name: 'parcels',
    title: 'Parcels',
  },
  {
    name: 'parcel_risk_summary_mv',
    title: 'Parcel Risk Summary',
  },
  {
    name: 'population_density_grid_mv',
    title: 'Population Density Grid',
  },
];
