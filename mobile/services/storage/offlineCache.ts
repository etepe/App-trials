// Offline storage for tracks and cached mountain data
// Uses expo-file-system for persistence

import * as FileSystem from 'expo-file-system';

const TRACKS_DIR = `${FileSystem.documentDirectory}tracks/`;
const MOUNTAINS_CACHE_FILE = `${FileSystem.documentDirectory}mountains_cache.json`;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Track {
  id: string;
  name: string;
  date: string;
  fileType: 'gpx' | 'fit' | 'igc' | 'kml' | 'kmz';
  distanceM: number;
  durationSec: number | null;
  maxAltM: number | null;
  minAltM: number | null;
  pointCount: number;
  geojsonPath: string;  // path to stored GeoJSON file
  createdAt: string;
}

export interface MountainCacheEntry {
  lat: number;
  lon: number;
  radiusKm: number;
  mountains: Mountain[];
  fetchedAt: string;
}

export interface Mountain {
  osmId: string;
  name: string;
  lat: number;
  lon: number;
  elevation?: number;
  type: string;
}

// ─── Track storage ─────────────────────────────────────────────────────────

async function ensureTracksDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(TRACKS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true });
}

export async function saveTrack(
  parsedTrack: Omit<Track, 'id' | 'geojsonPath' | 'createdAt'> & { geojson: GeoJSON.FeatureCollection }
): Promise<Track> {
  await ensureTracksDir();

  const id = `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const geojsonPath = `${TRACKS_DIR}${id}.geojson`;

  await FileSystem.writeAsStringAsync(
    geojsonPath,
    JSON.stringify(parsedTrack.geojson),
    { encoding: FileSystem.EncodingType.UTF8 }
  );

  const track: Track = {
    id,
    name: parsedTrack.name,
    date: parsedTrack.date,
    fileType: parsedTrack.fileType,
    distanceM: parsedTrack.distanceM,
    durationSec: parsedTrack.durationSec,
    maxAltM: parsedTrack.maxAltM,
    minAltM: parsedTrack.minAltM,
    pointCount: parsedTrack.pointCount,
    geojsonPath,
    createdAt: new Date().toISOString(),
  };

  await _saveTrackIndex(track);
  return track;
}

export async function loadTrackGeojson(track: Track): Promise<GeoJSON.FeatureCollection> {
  const content = await FileSystem.readAsStringAsync(track.geojsonPath, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return JSON.parse(content) as GeoJSON.FeatureCollection;
}

export async function deleteTrack(trackId: string): Promise<void> {
  const tracks = await listTracks();
  const track = tracks.find((t) => t.id === trackId);
  if (!track) return;

  const info = await FileSystem.getInfoAsync(track.geojsonPath);
  if (info.exists) await FileSystem.deleteAsync(track.geojsonPath);

  await _removeFromIndex(trackId);
}

export async function listTracks(): Promise<Track[]> {
  const indexPath = `${TRACKS_DIR}index.json`;
  const info = await FileSystem.getInfoAsync(indexPath);
  if (!info.exists) return [];

  const content = await FileSystem.readAsStringAsync(indexPath);
  const data = JSON.parse(content) as { tracks: Track[] };
  return (data.tracks ?? []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

async function _saveTrackIndex(track: Track): Promise<void> {
  const tracks = await listTracks();
  tracks.unshift(track);
  const indexPath = `${TRACKS_DIR}index.json`;
  await FileSystem.writeAsStringAsync(indexPath, JSON.stringify({ tracks }), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function _removeFromIndex(trackId: string): Promise<void> {
  const tracks = await listTracks();
  const updated = tracks.filter((t) => t.id !== trackId);
  const indexPath = `${TRACKS_DIR}index.json`;
  await FileSystem.writeAsStringAsync(indexPath, JSON.stringify({ tracks: updated }), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

// ─── Mountains cache ────────────────────────────────────────────────────────

export async function getCachedMountains(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<Mountain[] | null> {
  const info = await FileSystem.getInfoAsync(MOUNTAINS_CACHE_FILE);
  if (!info.exists) return null;

  const content = await FileSystem.readAsStringAsync(MOUNTAINS_CACHE_FILE);
  const entries: MountainCacheEntry[] = JSON.parse(content) ?? [];

  for (const entry of entries) {
    const age = Date.now() - new Date(entry.fetchedAt).getTime();
    if (age > CACHE_TTL_MS) continue;

    // Simple bbox match — if request is within cached area
    const latDiff = Math.abs(entry.lat - lat);
    const lonDiff = Math.abs(entry.lon - lon);
    const degPerKm = 1 / 111;
    if (latDiff < radiusKm * degPerKm && lonDiff < radiusKm * degPerKm * 1.4 && entry.radiusKm >= radiusKm) {
      return entry.mountains;
    }
  }

  return null;
}

export async function cacheMountains(
  lat: number,
  lon: number,
  radiusKm: number,
  mountains: Mountain[]
): Promise<void> {
  let entries: MountainCacheEntry[] = [];
  const info = await FileSystem.getInfoAsync(MOUNTAINS_CACHE_FILE);
  if (info.exists) {
    const content = await FileSystem.readAsStringAsync(MOUNTAINS_CACHE_FILE);
    entries = JSON.parse(content) ?? [];
  }

  // Remove stale entries
  const now = Date.now();
  entries = entries.filter((e) => now - new Date(e.fetchedAt).getTime() < CACHE_TTL_MS);

  entries.push({ lat, lon, radiusKm, mountains, fetchedAt: new Date().toISOString() });

  // Keep last 20 entries
  if (entries.length > 20) entries.splice(0, entries.length - 20);

  await FileSystem.writeAsStringAsync(MOUNTAINS_CACHE_FILE, JSON.stringify(entries), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}
