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

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

async function apiRequest<T>(path: string, init?: RequestInit & ApiOptions): Promise<T> {
  const base = await getBaseUrl();
  const url = `${base}${path}`;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        ...init,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // Don't retry on client errors (4xx)
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`API ${res.status}: ${text || res.statusText}`);
        }
        throw new Error(`API ${res.status}: ${text || res.statusText}`);
      }
      return res.json() as Promise<T>;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      // Don't retry on client errors or abort signals
      const isClientError = lastError.message.startsWith('API 4');
      const isAborted = init?.signal?.aborted;
      if (isClientError || isAborted || attempt === MAX_RETRIES) {
        throw lastError;
      }
      // Wait before retrying on network/server errors
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }
  throw lastError ?? new Error('Request failed');
}

/**
 * Check if the backend server is reachable.
 * Returns true if health endpoint responds, false otherwise.
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Geocoding ──────────────────────────────────────────────────────────────

export interface GeocodingResult {
  name: string;
  display_name: string;
  lat: number;
  lon: number;
  type: string;
  importance: number;
  bbox?: number[];
}

export function geocodeSearch(
  query: string,
  limit = 10,
  lang = 'tr',
  opts?: ApiOptions
): Promise<GeocodingResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    lang,
  });
  return apiRequest<GeocodingResult[]>(`/geocode/search?${params}`, opts);
}

export function reverseGeocode(
  lat: number,
  lon: number,
  lang = 'tr',
  opts?: ApiOptions
): Promise<GeocodingResult> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    lang,
  });
  return apiRequest<GeocodingResult>(`/geocode/reverse?${params}`, opts);
}

// ─── Mountains (by name, no coordinates needed) ─────────────────────────────

export function searchMountainsByName(
  name: string,
  limit = 20,
  opts?: ApiOptions
): Promise<Mountain[]> {
  const params = new URLSearchParams({
    name,
    limit: String(limit),
  });
  return apiRequest<Mountain[]>(`/mountains/by-name?${params}`, opts);
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

export type AnalysisType = 'slope' | 'aspect' | 'profile' | 'contour';

export interface BBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface TerrainAnalysisResult {
  analysis_type: AnalysisType;
  overlay_image?: string;     // URL to overlay PNG image
  bbox?: number[];            // [minLon, minLat, maxLon, maxLat]
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

export function analyzeTerrain(
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
    feels_like_c?: number;
    humidity_pct?: number;
    wind_speed_ms: number;
    wind_direction_deg: number;
    wind_gusts_ms?: number;
    pressure_hpa?: number;
    cloud_cover_pct?: number;
    weather_code?: number;
    weather_description?: string;
    visibility_m?: number;
    uv_index?: number;
    freezing_level_m?: number;
    is_day?: boolean;
  };
  hourly?: HourlyWeather[];
  daily?: DailyWeather[];
  thermals?: ThermalConditions;
  avalanche_risk?: AvalancheRisk;
  alerts?: WeatherAlert[];
}

export interface HourlyWeather {
  time: string;
  temperature_c: number;
  wind_speed_ms: number;
  wind_speed_80m_ms?: number | null;
  wind_speed_120m_ms?: number | null;
  wind_direction_deg: number;
  wind_direction_80m_deg?: number | null;
  wind_direction_120m_deg?: number | null;
  wind_gusts_ms?: number | null;
  precipitation_mm: number;
  precipitation_probability_pct?: number | null;
  snowfall_cm?: number | null;
  cloud_cover_pct: number;
  visibility_m?: number | null;
  uv_index?: number | null;
  freezing_level_m?: number | null;
  temp_80m_c?: number | null;
  temp_120m_c?: number | null;
  cape?: number | null;
}

export interface DailyWeather {
  date: string;
  weather_code?: number;
  weather_description?: string;
  temp_max_c?: number;
  temp_min_c?: number;
  sunrise?: string;
  sunset?: string;
  uv_index_max?: number;
  precipitation_sum_mm?: number;
  snowfall_sum_cm?: number;
  wind_speed_max_ms?: number;
  wind_gusts_max_ms?: number;
  wind_direction_dominant_deg?: number;
}

export interface ThermalConditions {
  thermal_index: number;
  best_window_start?: number;
  best_window_end?: number;
  thermal_height_m?: number;
  conditions: 'poor' | 'moderate' | 'good' | 'excellent';
}

export interface AvalancheRisk {
  level: number;           // 1-5 European scale
  label: string;
  description: string;
  risk_score: number;
}

export interface WeatherAlert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  icon: string;
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

export function getWeatherAlerts(
  lat: number,
  lon: number,
  elevation: number,
  opts?: ApiOptions
): Promise<{ lat: number; lon: number; alerts: WeatherAlert[]; avalanche_risk: AvalancheRisk }> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    elevation: String(elevation),
  });
  return apiRequest(`/weather/alerts?${params}`, opts);
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

// ─── Favorites ────────────────────────────────────────────────────────────────

export interface Favorite {
  id: number;
  osm_id: string;
  name: string;
  lat: number;
  lon: number;
  elevation: number | null;
  type: string;
  notes: string;
  created_at: string;
}

export function listFavorites(opts?: ApiOptions): Promise<Favorite[]> {
  return apiRequest<Favorite[]>('/favorites', opts);
}

export function addFavorite(
  data: { osm_id: string; name: string; lat: number; lon: number; elevation?: number; type: string; notes?: string },
  opts?: ApiOptions
): Promise<Favorite> {
  return apiRequest<Favorite>('/favorites', {
    method: 'POST',
    body: JSON.stringify(data),
    ...opts,
  });
}

export function removeFavorite(osmId: string, opts?: ApiOptions): Promise<void> {
  return apiRequest<void>(`/favorites/${osmId}`, { method: 'DELETE', ...opts });
}

export function checkFavorite(osmId: string, opts?: ApiOptions): Promise<{ is_favorite: boolean }> {
  return apiRequest<{ is_favorite: boolean }>(`/favorites/check/${osmId}`, opts);
}
