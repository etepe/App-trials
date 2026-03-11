// GPX Parser — wraps @we-gold/gpxjs and returns a normalized GeoJSON FeatureCollection
import { GpxFileObject, Point } from '@we-gold/gpxjs';

export interface ParsedTrack {
  name: string;
  date: string;
  fileType: 'gpx';
  geojson: GeoJSON.FeatureCollection;
  distanceM: number;
  durationSec: number | null;
  maxAltM: number | null;
  minAltM: number | null;
  pointCount: number;
}

export async function parseGpx(content: string): Promise<ParsedTrack> {
  // Dynamic import to keep bundle size manageable
  const { parseGPX } = await import('@we-gold/gpxjs');

  const [gpx, error] = parseGPX(content);
  if (error || !gpx) throw new Error(`GPX parse error: ${error?.message ?? 'unknown'}`);

  const tracks = gpx.tracks ?? [];
  const waypoints = gpx.waypoints ?? [];

  const allPoints: Point[] = tracks.flatMap((t) =>
    (t.points ?? []).filter((p): p is Point => !!p)
  );

  const name = gpx.metadata?.name ?? tracks[0]?.name ?? 'GPX Track';
  const date = allPoints[0]?.time?.toISOString() ?? new Date().toISOString();

  const coords: [number, number, number][] = allPoints.map((p) => [
    p.lon,
    p.lat,
    p.ele ?? 0,
  ]);

  const features: GeoJSON.Feature[] = [];

  // Main track as LineString(s)
  tracks.forEach((track, i) => {
    const pts = (track.points ?? []).filter((p): p is Point => !!p);
    if (pts.length < 2) return;
    features.push({
      type: 'Feature',
      properties: { name: track.name ?? `Segment ${i + 1}`, type: 'track' },
      geometry: {
        type: 'LineString',
        coordinates: pts.map((p) => [p.lon, p.lat, p.ele ?? 0]),
      },
    });
  });

  // Waypoints as Points
  waypoints.forEach((wpt) => {
    if (!wpt.lat || !wpt.lon) return;
    features.push({
      type: 'Feature',
      properties: { name: wpt.name ?? 'Waypoint', type: 'waypoint' },
      geometry: { type: 'Point', coordinates: [wpt.lon, wpt.lat, wpt.ele ?? 0] },
    });
  });

  const elevations = allPoints.map((p) => p.ele ?? 0).filter((e) => e !== 0);
  const distanceM = gpx.tracks.reduce((sum, t) => sum + (t.distance?.total ?? 0), 0);

  let durationSec: number | null = null;
  if (allPoints.length >= 2) {
    const t0 = allPoints[0].time;
    const t1 = allPoints[allPoints.length - 1].time;
    if (t0 && t1) durationSec = (t1.getTime() - t0.getTime()) / 1000;
  }

  return {
    name,
    date,
    fileType: 'gpx',
    geojson: { type: 'FeatureCollection', features },
    distanceM,
    durationSec,
    maxAltM: elevations.length ? Math.max(...elevations) : null,
    minAltM: elevations.length ? Math.min(...elevations) : null,
    pointCount: coords.length,
  };
}
