// Variometer calculations — vertical speed, thermal detection, glide ratio
// Works with any track that has altitude data

import type { VarioData, ThermalInfo, TrackPoint } from '../types';
import { haversineDistance } from './geo';

/**
 * Compute vertical speeds from altitude + timestamp data.
 * Returns array of vertical speeds in m/s for each point (first point is 0).
 */
export function computeVerticalSpeeds(
  altitudes: number[],
  timestampsMs: number[],
  smoothingWindow = 3,
): number[] {
  if (altitudes.length < 2) return altitudes.map(() => 0);

  const raw: number[] = [0];
  for (let i = 1; i < altitudes.length; i++) {
    const dt = (timestampsMs[i] - timestampsMs[i - 1]) / 1000;
    if (dt > 0) {
      raw.push((altitudes[i] - altitudes[i - 1]) / dt);
    } else {
      raw.push(0);
    }
  }

  // Apply moving average smoothing
  if (smoothingWindow <= 1) return raw;

  const smoothed: number[] = [];
  const half = Math.floor(smoothingWindow / 2);
  for (let i = 0; i < raw.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(raw.length - 1, i + half);
    let sum = 0;
    for (let j = start; j <= end; j++) sum += raw[j];
    smoothed.push(sum / (end - start + 1));
  }

  return smoothed;
}

/**
 * Detect thermals from vertical speed data.
 * A thermal is a sustained period of positive vertical speed.
 */
export function detectThermals(
  points: TrackPoint[],
  minClimbRate = 0.5,
  minDurationSec = 15,
): ThermalInfo[] {
  const thermals: ThermalInfo[] = [];
  let inThermal = false;
  let thermalStart = 0;

  for (let i = 0; i < points.length; i++) {
    const vario = points[i].verticalSpeed ?? 0;

    if (!inThermal && vario >= minClimbRate) {
      inThermal = true;
      thermalStart = i;
    } else if (inThermal && (vario < minClimbRate * 0.3 || i === points.length - 1)) {
      inThermal = false;
      const endIdx = i;

      if (points[thermalStart].timestamp && points[endIdx].timestamp) {
        const duration = (points[endIdx].timestamp! - points[thermalStart].timestamp!) / 1000;
        if (duration >= minDurationSec) {
          const thermalPoints = points.slice(thermalStart, endIdx + 1);
          const varioValues = thermalPoints.map((p) => p.verticalSpeed ?? 0);
          const altGain = points[endIdx].altitude - points[thermalStart].altitude;

          thermals.push({
            startIndex: thermalStart,
            endIndex: endIdx,
            avgClimbRate: varioValues.reduce((s, v) => s + v, 0) / varioValues.length,
            maxClimbRate: Math.max(...varioValues),
            altitudeGain: Math.max(0, altGain),
            durationSec: duration,
            centerLat: thermalPoints.reduce((s, p) => s + p.lat, 0) / thermalPoints.length,
            centerLon: thermalPoints.reduce((s, p) => s + p.lon, 0) / thermalPoints.length,
          });
        }
      }
    }
  }

  return thermals;
}

/**
 * Compute glide ratio from a segment of track points.
 * Glide ratio = horizontal distance / altitude loss.
 */
export function computeGlideRatio(points: TrackPoint[]): number | undefined {
  if (points.length < 2) return undefined;

  let horizontalDist = 0;
  for (let i = 1; i < points.length; i++) {
    horizontalDist += haversineDistance(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
  }

  const altLoss = points[0].altitude - points[points.length - 1].altitude;
  if (altLoss <= 0) return undefined; // climbing or level, no glide ratio

  return horizontalDist / altLoss;
}

/**
 * Compute full vario analysis from track points.
 */
export function analyzeVarioData(points: TrackPoint[]): VarioData {
  const varioValues = points.map((p) => p.verticalSpeed ?? 0);
  const climbValues = varioValues.filter((v) => v > 0);
  const sinkValues = varioValues.filter((v) => v < 0);

  return {
    maxClimbRate: climbValues.length ? Math.max(...climbValues) : 0,
    maxSinkRate: sinkValues.length ? Math.min(...sinkValues) : 0,
    avgClimbRate: climbValues.length ? climbValues.reduce((s, v) => s + v, 0) / climbValues.length : 0,
    avgSinkRate: sinkValues.length ? sinkValues.reduce((s, v) => s + v, 0) / sinkValues.length : 0,
    thermals: detectThermals(points),
    glideRatio: computeGlideRatio(points),
  };
}
