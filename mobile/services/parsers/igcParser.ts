// IGC B-record parser for paragliding/hang-gliding flight logs
// IGC spec: https://www.fai.org/sites/default/files/igc_fr_specification.pdf

export interface IgcPoint {
  time: string;       // HH:MM:SS
  lat: number;
  lon: number;
  fixValid: boolean;  // A = valid, V = invalid
  pressureAlt: number; // meters
  gpsAlt: number;     // meters
}

export interface IgcFlight {
  pilot?: string;
  glider?: string;
  date?: string;      // ISO date string
  site?: string;
  competitionClass?: string;
  points: IgcPoint[];
}

export interface ParsedTrack {
  name: string;
  date: string;
  fileType: 'igc';
  geojson: GeoJSON.FeatureCollection;
  distanceM: number;
  durationSec: number | null;
  maxAltM: number | null;
  minAltM: number | null;
  pointCount: number;
}

// ─── IGC record parsers ───────────────────────────────────────────────────

function parseDate(hfdte: string): string | undefined {
  // HFDTE or HFDTEDATE
  const m = hfdte.match(/HFDTE(?:DATE:)?(\d{2})(\d{2})(\d{2})/);
  if (!m) return undefined;
  const [, dd, mm, yy] = m;
  const year = parseInt(yy, 10) + (parseInt(yy, 10) < 70 ? 2000 : 1900);
  return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

function parseDDMM(raw: string, hemi: string): number {
  // Format: DDMMMM (degrees + minutes*1000)
  const degLen = raw.length === 8 ? 2 : 3; // lat=7 chars, lon=8 chars
  const degrees = parseInt(raw.slice(0, degLen), 10);
  const minutes = parseInt(raw.slice(degLen), 10) / 1000 / 60;
  const val = degrees + minutes;
  return hemi === 'S' || hemi === 'W' ? -val : val;
}

function parseBRecord(line: string): IgcPoint | null {
  // B HHMMSS DDMMmmmN DDDMMmmmE V PPPPP GGGGG CR LF
  if (line[0] !== 'B' || line.length < 35) return null;

  const hh = parseInt(line.slice(1, 3), 10);
  const mm = parseInt(line.slice(3, 5), 10);
  const ss = parseInt(line.slice(5, 7), 10);
  const time = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

  const latRaw = line.slice(7, 15);   // DDMMmmmN
  const latHemi = line[14];
  const lonRaw = line.slice(15, 24);  // DDDMMmmmE
  const lonHemi = line[23];
  const fixValid = line[24];          // A or V
  const pressureAlt = parseInt(line.slice(25, 30), 10);
  const gpsAlt = parseInt(line.slice(30, 35), 10);

  const lat = parseDDMM(latRaw.slice(0, 7), latHemi);
  const lon = parseDDMM(lonRaw.slice(0, 8), lonHemi);

  if (isNaN(lat) || isNaN(lon)) return null;

  return { time, lat, lon, fixValid: fixValid === 'A', pressureAlt, gpsAlt };
}

// ─── Main parse function ──────────────────────────────────────────────────

export function parseIgcContent(content: string): IgcFlight {
  const lines = content.split(/\r?\n/);
  const flight: IgcFlight = { points: [] };

  for (const line of lines) {
    if (!line) continue;

    switch (line[0]) {
      case 'H': {
        const upper = line.toUpperCase();
        if (upper.includes('HFDTE')) {
          flight.date = parseDate(upper);
        } else if (upper.startsWith('HFPLTPILOT') || upper.startsWith('HFPLT')) {
          flight.pilot = line.split(':')[1]?.trim();
        } else if (upper.startsWith('HFGTYGLIDERTYPE') || upper.startsWith('HFGTY')) {
          flight.glider = line.split(':')[1]?.trim();
        } else if (upper.startsWith('HFSITSITE') || upper.startsWith('HFTZNTIMEZONE')) {
          // ignore
        }
        break;
      }
      case 'B': {
        const pt = parseBRecord(line);
        if (pt) flight.points.push(pt);
        break;
      }
    }
  }

  return flight;
}

export function igcToGeoJson(flight: IgcFlight): GeoJSON.FeatureCollection {
  const validPoints = flight.points.filter((p) => p.fixValid);
  if (validPoints.length === 0) return { type: 'FeatureCollection', features: [] };

  const coords: [number, number, number][] = validPoints.map((p) => [
    p.lon, p.lat, p.gpsAlt || p.pressureAlt,
  ]);

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          name: flight.pilot ?? 'IGC Flight',
          type: 'track',
          glider: flight.glider,
        },
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  };
}

function haversineM(a: IgcPoint, b: IgcPoint): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export async function parseIgc(content: string): Promise<ParsedTrack> {
  const flight = parseIgcContent(content);
  const geojson = igcToGeoJson(flight);

  const pts = flight.points.filter((p) => p.fixValid);
  const alts = pts.map((p) => p.gpsAlt || p.pressureAlt).filter((a) => a > 0);

  let distanceM = 0;
  for (let i = 1; i < pts.length; i++) {
    distanceM += haversineM(pts[i - 1], pts[i]);
  }

  let durationSec: number | null = null;
  if (pts.length >= 2) {
    const parseTime = (t: string) => {
      const [h, m, s] = t.split(':').map(Number);
      return h * 3600 + m * 60 + s;
    };
    durationSec = parseTime(pts[pts.length - 1].time) - parseTime(pts[0].time);
    if (durationSec < 0) durationSec += 86400; // midnight wrap
  }

  const isoDate = flight.date
    ? (pts[0] ? `${flight.date}T${pts[0].time}Z` : `${flight.date}T00:00:00Z`)
    : new Date().toISOString();

  return {
    name: flight.pilot ? `${flight.pilot} — IGC` : 'IGC Flight',
    date: isoDate,
    fileType: 'igc',
    geojson,
    distanceM,
    durationSec,
    maxAltM: alts.length ? Math.max(...alts) : null,
    minAltM: alts.length ? Math.min(...alts) : null,
    pointCount: pts.length,
  };
}
