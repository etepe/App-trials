// API client for the Mountain Explorer FastAPI backend
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BASE_URL = 'http://localhost:8000';

async function getBaseUrl(): Promise<string> {
  const stored = await AsyncStorage.getItem('@settings/apiUrl');
  return stored || DEFAULT_BASE_URL;
}

interface ApiOptions {
  signal?: AbortSignal;
}

async function apiRequest<T>(path: string, init?: RequestInit & ApiOptions): Promise<T> {
  const base = await getBaseUrl();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Mountains ──────────────────────────────────────────────────────────────

export interface Mountain {
  osm_id: string;
  name: string;
  lat: number;
  lon: number;
  elevation?: number;
  type: string;
  tags?: Record<string, string>;
}

export function searchMountains(
  lat: number,
  lon: number,
  radiusKm = 25,
  query?: string,
  opts?: ApiOptions
): Promise<Mountain[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius_km: String(radiusKm),
    ...(query ? { query } : {}),
  });
  return apiRequest<Mountain[]>(`/mountains/search?${params}`, opts);
}

export function getMountain(osmId: string, opts?: ApiOptions): Promise<Mountain> {
  return apiRequest<Mountain>(`/mountains/${osmId}`, opts);
}

// ─── Terrain analysis ────────────────────────────────────────────────────────

export type AnalysisType = 'slope' | 'aspect' | 'profile';

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface TerrainAnalysisResult {
  analysis_type: AnalysisType;
  tiles_url?: string;         // XYZ tile URL for slope/aspect layers
  profile?: ElevationPoint[]; // for 'profile' type
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

export function analyzeTerain(
  bbox: BBox,
  analysisType: AnalysisType,
  opts?: ApiOptions
): Promise<TerrainAnalysisResult> {
  return apiRequest<TerrainAnalysisResult>('/terrain/analyze', {
    method: 'POST',
    body: JSON.stringify({ bbox, analysis_type: analysisType }),
    ...opts,
  });
}

// ─── Weather ─────────────────────────────────────────────────────────────────

export interface WeatherData {
  lat: number;
  lon: number;
  elevation_m: number;
  current: {
    temperature_c: number;
    wind_speed_ms: number;
    wind_direction_deg: number;
    wind_gusts_ms?: number;
    pressure_hpa?: number;
    cloud_cover_pct?: number;
    weather_code?: number;
  };
  hourly?: HourlyWeather[];
  thermals?: ThermalConditions;
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
  thermal_index: number;        // 0-10
  best_time_utc?: string;
  thermal_height_m?: number;
  conditions: 'poor' | 'moderate' | 'good' | 'excellent';
}

export function getWeather(
  lat: number,
  lon: number,
  elevation: number,
  days = 3,
  opts?: ApiOptions
): Promise<WeatherData> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    elevation: String(elevation),
    days: String(days),
  });
  return apiRequest<WeatherData>(`/weather?${params}`, opts);
}

// ─── Tracks ──────────────────────────────────────────────────────────────────

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

export function uploadTrack(
  track: Omit<ServerTrack, 'id'>,
  opts?: ApiOptions
): Promise<ServerTrack> {
  return apiRequest<ServerTrack>('/tracks', {
    method: 'POST',
    body: JSON.stringify(track),
    ...opts,
  });
}

export function listServerTracks(opts?: ApiOptions): Promise<ServerTrack[]> {
  return apiRequest<ServerTrack[]>('/tracks', opts);
}

export function getServerTrack(id: string, opts?: ApiOptions): Promise<ServerTrack> {
  return apiRequest<ServerTrack>(`/tracks/${id}`, opts);
}

export function deleteServerTrack(id: string, opts?: ApiOptions): Promise<void> {
  return apiRequest<void>(`/tracks/${id}`, { method: 'DELETE', ...opts });
}
