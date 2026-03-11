// Generic CSV/log parser for standalone variometer devices
// Supports common formats from: Skytraxx, Flymaster, XC Tracer, generic CSV

import type { ParsedTrack, TrackPoint } from '../types';
import { haversineDistance } from '../utils/geo';
import { computeVerticalSpeeds, analyzeVarioData } from '../utils/varioCalc';

interface CsvColumn {
  name: string;
  index: number;
}

/**
 * Auto-detect CSV column mapping from header row.
 */
function detectColumns(header: string, separator: string): Map<string, number> {
  const cols = header.split(separator).map((c) => c.trim().toLowerCase());
  const mapping = new Map<string, number>();

  const aliases: Record<string, string[]> = {
    lat: ['lat', 'latitude', 'lat_deg', 'position_lat'],
    lon: ['lon', 'lng', 'longitude', 'lon_deg', 'long', 'position_long'],
    alt: ['alt', 'altitude', 'ele', 'elevation', 'height', 'gps_alt', 'alt_gps', 'baro_alt'],
    pressureAlt: ['press_alt', 'pressure_alt', 'baro_alt', 'pressure_altitude', 'alt_baro'],
    time: ['time', 'timestamp', 'utc_time', 'datetime', 'date_time', 'utc'],
    speed: ['speed', 'ground_speed', 'groundspeed', 'gps_speed', 'speed_ms'],
    vario: ['vario', 'vertical_speed', 'climb_rate', 'vert_speed', 'vs'],
    heartRate: ['hr', 'heart_rate', 'heartrate', 'pulse'],
  };

  for (const [key, aliasList] of Object.entries(aliases)) {
    for (const alias of aliasList) {
      const idx = cols.indexOf(alias);
      if (idx !== -1) {
        mapping.set(key, idx);
        break;
      }
    }
  }

  return mapping;
}

/**
 * Detect CSV separator (comma, semicolon, or tab).
 */
function detectSeparator(line: string): string {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  for (const ch of line) {
    if (ch in counts) counts[ch as keyof typeof counts]++;
  }
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

/**
 * Parse a timestamp string into unix milliseconds.
 */
function parseTimestamp(value: string, baseDate?: string): number | undefined {
  // Try ISO format first
  const isoDate = new Date(value);
  if (!isNaN(isoDate.getTime())) return isoDate.getTime();

  // Try HH:MM:SS format
  const timeMatch = value.match(/^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (timeMatch) {
    const [, h, m, s] = timeMatch;
    const base = baseDate ? new Date(baseDate).getTime() : 0;
    return base + (parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)) * 1000;
  }

  // Try unix timestamp (seconds)
  const num = parseFloat(value);
  if (!isNaN(num)) {
    return num > 1e12 ? num : num * 1000; // assume seconds if small
  }

  return undefined;
}

/**
 * Parse a generic CSV variometer/GPS log file.
 */
export async function parseCsv(content: string): Promise<ParsedTrack> {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');

  const separator = detectSeparator(lines[0]);
  const columns = detectColumns(lines[0], separator);

  if (!columns.has('lat') || !columns.has('lon')) {
    throw new Error('CSV must contain latitude and longitude columns');
  }

  const points: TrackPoint[] = [];
  const coords: [number, number, number][] = [];
  const timestamps: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(separator).map((f) => f.trim());

    const lat = parseFloat(fields[columns.get('lat')!]);
    const lon = parseFloat(fields[columns.get('lon')!]);
    if (isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) continue;

    const alt = columns.has('alt') ? parseFloat(fields[columns.get('alt')!]) || 0 : 0;
    const pressureAlt = columns.has('pressureAlt') ? parseFloat(fields[columns.get('pressureAlt')!]) : undefined;

    let timestamp: number | undefined;
    if (columns.has('time')) {
      timestamp = parseTimestamp(fields[columns.get('time')!]);
    }

    const speed = columns.has('speed') ? parseFloat(fields[columns.get('speed')!]) : undefined;
    const vario = columns.has('vario') ? parseFloat(fields[columns.get('vario')!]) : undefined;
    const hr = columns.has('heartRate') ? parseInt(fields[columns.get('heartRate')!]) : undefined;

    const point: TrackPoint = {
      lat, lon,
      altitude: alt,
      timestamp,
      speed: isNaN(speed!) ? undefined : speed,
      verticalSpeed: isNaN(vario!) ? undefined : vario,
      heartRate: isNaN(hr!) ? undefined : hr,
      pressureAlt: isNaN(pressureAlt!) ? undefined : pressureAlt,
      gpsAlt: alt,
    };

    points.push(point);
    coords.push([lon, lat, alt]);
    if (timestamp) timestamps.push(timestamp);
  }

  if (points.length === 0) throw new Error('No valid GPS data found in CSV');

  // Compute vertical speeds if not provided but timestamps available
  if (!columns.has('vario') && timestamps.length === points.length) {
    const altitudes = points.map((p) => p.altitude);
    const vspeeds = computeVerticalSpeeds(altitudes, timestamps);
    for (let i = 0; i < points.length; i++) {
      points[i].verticalSpeed = vspeeds[i];
    }
  }

  const varioData = analyzeVarioData(points);

  // Calculate distance
  let distanceM = 0;
  for (let i = 1; i < coords.length; i++) {
    distanceM += haversineDistance(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }

  const elevations = coords.map((c) => c[2]).filter((e) => e > 0);
  let durationSec: number | null = null;
  if (timestamps.length >= 2) {
    durationSec = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
  }

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name: 'CSV Track', type: 'track' },
      geometry: { type: 'LineString', coordinates: coords },
    }],
  };

  return {
    name: 'Variometer Log',
    date: timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : new Date().toISOString(),
    fileType: 'csv',
    geojson,
    distanceM,
    durationSec,
    maxAltM: elevations.length ? Math.max(...elevations) : null,
    minAltM: elevations.length ? Math.min(...elevations) : null,
    pointCount: points.length,
    varioData,
  };
}
