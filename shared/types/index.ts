// Shared type definitions for Mountain Explorer
// Used by both mobile (React Native) and web platforms

// ─── Mountain ───────────────────────────────────────────────────────────────

export interface Mountain {
  osm_id: string;
  name: string;
  lat: number;
  lon: number;
  elevation?: number;
  type: string;
  tags?: Record<string, string>;
}

// ─── Track ──────────────────────────────────────────────────────────────────

export type TrackFileType = 'gpx' | 'fit' | 'igc' | 'kml' | 'kmz' | 'csv';

export interface ParsedTrack {
  name: string;
  date: string;
  fileType: TrackFileType;
  geojson: GeoJSON.FeatureCollection;
  distanceM: number;
  durationSec: number | null;
  maxAltM: number | null;
  minAltM: number | null;
  pointCount: number;
  sport?: string;
  varioData?: VarioData;
}

export interface StoredTrack {
  id: string;
  name: string;
  date: string;
  fileType: TrackFileType;
  distanceM: number;
  durationSec: number | null;
  maxAltM: number | null;
  minAltM: number | null;
  pointCount: number;
  geojsonPath: string;
  createdAt: string;
}

// ─── Vario / Flight Data ────────────────────────────────────────────────────

export interface VarioData {
  maxClimbRate: number;    // m/s
  maxSinkRate: number;     // m/s
  avgClimbRate: number;    // m/s
  avgSinkRate: number;     // m/s
  thermals: ThermalInfo[];
  glideRatio?: number;
}

export interface ThermalInfo {
  startIndex: number;
  endIndex: number;
  avgClimbRate: number;
  maxClimbRate: number;
  altitudeGain: number;
  durationSec: number;
  centerLat: number;
  centerLon: number;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  altitude: number;
  timestamp?: number;      // unix ms
  speed?: number;          // m/s
  verticalSpeed?: number;  // m/s (vario)
  heartRate?: number;
  pressureAlt?: number;
  gpsAlt?: number;
}

// ─── Weather ────────────────────────────────────────────────────────────────

export interface WeatherData {
  lat: number;
  lon: number;
  elevation_m: number;
  current: CurrentWeather;
  hourly?: HourlyWeather[];
  thermals?: ThermalConditions;
}

export interface CurrentWeather {
  temperature_c: number;
  wind_speed_ms: number;
  wind_direction_deg: number;
  wind_gusts_ms?: number;
  pressure_hpa?: number;
  cloud_cover_pct?: number;
  weather_code?: number;
}

export interface HourlyWeather {
  time: string;
  temperature_c: number;
  wind_speed_ms: number;
  wind_direction_deg: number;
  precipitation_mm: number;
  cloud_cover_pct: number;
}

export interface ThermalConditions {
  thermal_index: number;
  best_time_utc?: string;
  thermal_height_m?: number;
  conditions: 'poor' | 'moderate' | 'good' | 'excellent';
}

// ─── Terrain ────────────────────────────────────────────────────────────────

export type AnalysisType = 'slope' | 'aspect' | 'profile';

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface TerrainAnalysisResult {
  analysis_type: AnalysisType;
  tiles_url?: string;
  profile?: ElevationPoint[];
  stats?: {
    min_slope_deg?: number;
    max_slope_deg?: number;
    mean_slope_deg?: number;
    dominant_aspect?: string;
  };
}

export interface ElevationPoint {
  distance_m: number;
  elevation_m: number;
  lat: number;
  lon: number;
}

// ─── Bookmark ───────────────────────────────────────────────────────────────

export interface Bookmark {
  id: string;
  name: string;
  lat: number;
  lon: number;
  altitude: number;
  heading: number;
  pitch: number;
  createdAt: string;
}

// ─── Cesium Bridge ──────────────────────────────────────────────────────────

export type BridgeMessage =
  | { action: 'mapClick'; payload: { lat: number; lon: number; elevation: number } }
  | { action: 'peakSelected'; payload: { osmId: string; lat: number; lon: number; elevation: number } }
  | { action: 'cameraChanged'; payload: CameraState }
  | { action: 'cesiumReady'; payload: Record<string, never> }
  | { action: 'orbitUpdate'; payload: { heading: number; progress: number } }
  | { action: 'terrainHeight'; payload: { lat: number; lon: number; height: number } }
  | { action: 'replayProgress'; payload: { progress: number; currentIndex: number; speed: number; altitude: number } };

export interface CameraState {
  lat: number;
  lon: number;
  altitude: number;
  heading: number;
  pitch: number;
}

// ─── Server Track ───────────────────────────────────────────────────────────

export interface ServerTrack {
  id: string;
  name: string;
  date: string;
  file_type: string;
  distance_m: number;
  duration_sec: number | null;
  max_alt_m: number | null;
  geojson: GeoJSON.FeatureCollection;
}
