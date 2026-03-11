// Track statistics computation — pure functions, no platform dependencies

import { haversineDistance } from './geo';
import type { TrackPoint } from '../types';

export interface TrackStatistics {
  totalDistanceM: number;
  totalAscentM: number;
  totalDescentM: number;
  maxAltitudeM: number;
  minAltitudeM: number;
  avgSpeedMs: number | null;
  maxSpeedMs: number;
  durationSec: number | null;
  elevationGain: number;
  elevationLoss: number;
}

/**
 * Compute track statistics from an array of coordinates [lon, lat, alt].
 */
export function computeStats(
  coords: [number, number, number][],
  timestamps?: number[],
): TrackStatistics {
  if (coords.length === 0) {
    return {
      totalDistanceM: 0, totalAscentM: 0, totalDescentM: 0,
      maxAltitudeM: 0, minAltitudeM: 0,
      avgSpeedMs: null, maxSpeedMs: 0, durationSec: null,
      elevationGain: 0, elevationLoss: 0,
    };
  }

  let totalDistance = 0;
  let ascent = 0;
  let descent = 0;
  let maxAlt = coords[0][2];
  let minAlt = coords[0][2];
  let maxSpeed = 0;

  for (let i = 1; i < coords.length; i++) {
    const d = haversineDistance(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    totalDistance += d;

    const dAlt = coords[i][2] - coords[i - 1][2];
    if (dAlt > 0) ascent += dAlt;
    else descent += Math.abs(dAlt);

    if (coords[i][2] > maxAlt) maxAlt = coords[i][2];
    if (coords[i][2] < minAlt) minAlt = coords[i][2];

    if (timestamps && timestamps[i] && timestamps[i - 1]) {
      const dt = (timestamps[i] - timestamps[i - 1]) / 1000;
      if (dt > 0) {
        const speed = d / dt;
        if (speed > maxSpeed && speed < 200) maxSpeed = speed; // filter GPS spikes
      }
    }
  }

  let durationSec: number | null = null;
  let avgSpeed: number | null = null;
  if (timestamps && timestamps.length >= 2) {
    durationSec = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
    if (durationSec > 0) avgSpeed = totalDistance / durationSec;
  }

  return {
    totalDistanceM: totalDistance,
    totalAscentM: ascent,
    totalDescentM: descent,
    maxAltitudeM: maxAlt,
    minAltitudeM: minAlt,
    avgSpeedMs: avgSpeed,
    maxSpeedMs: maxSpeed,
    durationSec,
    elevationGain: ascent,
    elevationLoss: descent,
  };
}

/**
 * Extract coordinates array from a GeoJSON FeatureCollection.
 */
export function extractCoordinates(geojson: GeoJSON.FeatureCollection): [number, number, number][] {
  const coords: [number, number, number][] = [];
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === 'LineString') {
      coords.push(...(geom.coordinates as [number, number, number][]));
    } else if (geom.type === 'MultiLineString') {
      for (const line of geom.coordinates) {
        coords.push(...(line as [number, number, number][]));
      }
    }
  }
  return coords;
}

/**
 * Build an elevation profile from coordinates.
 */
export function buildElevationProfile(
  coords: [number, number, number][],
): Array<{ distanceM: number; altitudeM: number; lat: number; lon: number }> {
  const profile: Array<{ distanceM: number; altitudeM: number; lat: number; lon: number }> = [];
  let cumDist = 0;

  for (let i = 0; i < coords.length; i++) {
    if (i > 0) {
      cumDist += haversineDistance(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    }
    profile.push({
      distanceM: cumDist,
      altitudeM: coords[i][2] ?? 0,
      lat: coords[i][1],
      lon: coords[i][0],
    });
  }

  return profile;
}

/**
 * Convert TrackPoint array to coordinate array.
 */
export function trackPointsToCoords(points: TrackPoint[]): [number, number, number][] {
  return points.map((p) => [p.lon, p.lat, p.altitude]);
}
