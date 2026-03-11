// Platform-agnostic API client for Mountain Explorer backend
// Works on both React Native and Web (uses fetch API)

import type {
  Mountain,
  WeatherData,
  TerrainAnalysisResult,
  AnalysisType,
  BBox,
  ServerTrack,
} from '../types';

let _baseUrl = 'http://localhost:8000';

export function setBaseUrl(url: string): void {
  _baseUrl = url.replace(/\/+$/, '');
}

export function getBaseUrl(): string {
  return _baseUrl;
}

interface RequestOptions {
  signal?: AbortSignal;
}

async function apiRequest<T>(path: string, init?: RequestInit & RequestOptions): Promise<T> {
  const url = `${_baseUrl}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ─── Mountains ──────────────────────────────────────────────────────────────

export function searchMountains(
  lat: number,
  lon: number,
  radiusKm = 25,
  query?: string,
  opts?: RequestOptions,
): Promise<Mountain[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius_km: String(radiusKm),
    ...(query ? { query } : {}),
  });
  return apiRequest<Mountain[]>(`/mountains/search?${params}`, opts);
}

export function searchMountainsByName(
  query: string,
  opts?: RequestOptions,
): Promise<Mountain[]> {
  const params = new URLSearchParams({ query });
  return apiRequest<Mountain[]>(`/mountains/search/global?${params}`, opts);
}

export function getMountain(osmId: string, opts?: RequestOptions): Promise<Mountain> {
  return apiRequest<Mountain>(`/mountains/${osmId}`, opts);
}

// ─── Terrain ────────────────────────────────────────────────────────────────

export function analyzeTerrain(
  bbox: BBox,
  analysisType: AnalysisType,
  opts?: RequestOptions,
): Promise<TerrainAnalysisResult> {
  return apiRequest<TerrainAnalysisResult>('/terrain/analyze', {
    method: 'POST',
    body: JSON.stringify({ bbox, analysis_type: analysisType }),
    ...opts,
  });
}

// ─── Weather ────────────────────────────────────────────────────────────────

export function getWeather(
  lat: number,
  lon: number,
  elevation: number,
  days = 3,
  opts?: RequestOptions,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    elevation: String(elevation),
    days: String(days),
  });
  return apiRequest<WeatherData>(`/weather?${params}`, opts);
}

// ─── Tracks ─────────────────────────────────────────────────────────────────

export function uploadTrack(
  track: Omit<ServerTrack, 'id'>,
  opts?: RequestOptions,
): Promise<ServerTrack> {
  return apiRequest<ServerTrack>('/tracks', {
    method: 'POST',
    body: JSON.stringify(track),
    ...opts,
  });
}

export function listServerTracks(opts?: RequestOptions): Promise<ServerTrack[]> {
  return apiRequest<ServerTrack[]>('/tracks', opts);
}

export function getServerTrack(id: string, opts?: RequestOptions): Promise<ServerTrack> {
  return apiRequest<ServerTrack>(`/tracks/${id}`, opts);
}

export function deleteServerTrack(id: string, opts?: RequestOptions): Promise<void> {
  return apiRequest<void>(`/tracks/${id}`, { method: 'DELETE', ...opts });
}

// ─── Analysis ───────────────────────────────────────────────────────────────

export interface TrackProfileResult {
  points: Array<{ distance_m: number; elevation_m: number; lat: number; lon: number }>;
}

export interface TrackStatsResult {
  total_distance_m: number;
  total_ascent_m: number;
  total_descent_m: number;
  max_altitude_m: number;
  min_altitude_m: number;
  avg_speed_ms: number;
  max_speed_ms: number;
  duration_sec: number;
}

export function getTrackProfile(
  coordinates: [number, number, number][],
  opts?: RequestOptions,
): Promise<TrackProfileResult> {
  return apiRequest<TrackProfileResult>('/analysis/track-profile', {
    method: 'POST',
    body: JSON.stringify({ coordinates }),
    ...opts,
  });
}

export function getTrackStats(
  coordinates: [number, number, number][],
  timestamps?: number[],
  opts?: RequestOptions,
): Promise<TrackStatsResult> {
  return apiRequest<TrackStatsResult>('/analysis/track-stats', {
    method: 'POST',
    body: JSON.stringify({ coordinates, timestamps }),
    ...opts,
  });
}

// ─── Health ─────────────────────────────────────────────────────────────────

export function healthCheck(): Promise<{ status: string; version: string }> {
  return apiRequest('/health');
}
