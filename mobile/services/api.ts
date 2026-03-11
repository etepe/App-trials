// API client — re-exports shared client with AsyncStorage integration
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../../shared/api/client';

// Re-export all types and functions from shared
export {
  searchMountains,
  searchMountainsByName,
  getMountain,
  analyzeTerrain,
  getWeather,
  uploadTrack,
  listServerTracks,
  getServerTrack,
  deleteServerTrack,
  getTrackProfile,
  getTrackStats,
  healthCheck,
  setBaseUrl,
  getBaseUrl,
} from '../../shared/api/client';

// Re-export types
export type {
  Mountain,
  WeatherData,
  TerrainAnalysisResult,
  AnalysisType,
  BBox,
  ElevationPoint,
  HourlyWeather,
  ThermalConditions,
  ServerTrack,
} from '../../shared/types';

// Keep backward compat: analyzeTerain (typo in original) → analyzeTerrain
export const analyzeTerain = api.analyzeTerrain;

const DEFAULT_BASE_URL = 'http://localhost:8000';

/**
 * Initialize the API client with stored settings.
 * Call this on app startup.
 */
export async function initApiClient(): Promise<void> {
  const stored = await AsyncStorage.getItem('@settings/apiUrl');
  api.setBaseUrl(stored || DEFAULT_BASE_URL);
}
