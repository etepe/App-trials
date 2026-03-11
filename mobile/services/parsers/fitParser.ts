// FIT file parser — wraps fit-file-parser and returns normalized GeoJSON
// FIT format is used by Garmin, Suunto, Wahoo, etc.

export interface ParsedTrack {
  name: string;
  date: string;
  fileType: 'fit';
  geojson: GeoJSON.FeatureCollection;
  distanceM: number;
  durationSec: number | null;
  maxAltM: number | null;
  minAltM: number | null;
  pointCount: number;
  sport?: string;
}

// FIT coordinates are in semicircles — convert to degrees
function semicirclesToDeg(sc: number): number {
  return (sc * 180) / 2 ** 31;
}

export async function parseFit(buffer: ArrayBuffer): Promise<ParsedTrack> {
  const FitParser = (await import('fit-file-parser')).default;

  return new Promise((resolve, reject) => {
    const parser = new FitParser({
      force: true,
      speedUnit: 'm/s',
      lengthUnit: 'm',
      temperatureUnit: 'celsius',
      elapsedRecordField: false,
      mode: 'both',
    });

    parser.parse(buffer, (error: Error | null, data: FitData) => {
      if (error) {
        reject(new Error(`FIT parse error: ${error.message}`));
        return;
      }

      const records: FitRecord[] = data?.activity?.records ?? data?.records ?? [];
      const sessions: FitSession[] = data?.activity?.sessions ?? data?.sessions ?? [];
      const session = sessions[0];

      const validRecords = records.filter(
        (r) => r.position_lat != null && r.position_long != null
      );

      if (validRecords.length === 0) {
        reject(new Error('FIT file contains no GPS records'));
        return;
      }

      const coords: [number, number, number][] = validRecords.map((r) => [
        semicirclesToDeg(r.position_long!),
        semicirclesToDeg(r.position_lat!),
        r.altitude ?? r.enhanced_altitude ?? 0,
      ]);

      const elevations = coords.map((c) => c[2]).filter((e) => e > 0);

      const startTime = session?.start_time ?? validRecords[0]?.timestamp;
      const date = startTime ? new Date(startTime).toISOString() : new Date().toISOString();
      const sport = session?.sport ?? 'unknown';

      const name = [
        sport.charAt(0).toUpperCase() + sport.slice(1),
        session?.total_distance ? `${(session.total_distance / 1000).toFixed(1)}km` : '',
      ]
        .filter(Boolean)
        .join(' — ');

      const feature: GeoJSON.Feature = {
        type: 'Feature',
        properties: { name, type: 'track', sport },
        geometry: { type: 'LineString', coordinates: coords },
      };

      resolve({
        name: name || 'FIT Track',
        date,
        fileType: 'fit',
        geojson: { type: 'FeatureCollection', features: [feature] },
        distanceM: session?.total_distance ?? 0,
        durationSec: session?.total_elapsed_time ?? null,
        maxAltM: elevations.length ? Math.max(...elevations) : null,
        minAltM: elevations.length ? Math.min(...elevations) : null,
        pointCount: validRecords.length,
        sport,
      });
    });
  });
}

// Type stubs (fit-file-parser lacks good types)
interface FitRecord {
  position_lat?: number;
  position_long?: number;
  altitude?: number;
  enhanced_altitude?: number;
  timestamp?: string | Date;
  speed?: number;
  heart_rate?: number;
}

interface FitSession {
  start_time?: string | Date;
  sport?: string;
  total_distance?: number;
  total_elapsed_time?: number;
}

interface FitData {
  activity?: { records?: FitRecord[]; sessions?: FitSession[] };
  records?: FitRecord[];
  sessions?: FitSession[];
}
