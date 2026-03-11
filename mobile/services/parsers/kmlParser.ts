// KML/KMZ parser — uses @tmcw/togeojson for KML and jszip for KMZ (zipped KML)

export interface ParsedTrack {
  name: string;
  date: string;
  fileType: 'kml' | 'kmz';
  geojson: GeoJSON.FeatureCollection;
  distanceM: number;
  durationSec: number | null;
  maxAltM: number | null;
  minAltM: number | null;
  pointCount: number;
}

function extractCoords(geojson: GeoJSON.FeatureCollection): [number, number, number][] {
  const coords: [number, number, number][] = [];
  for (const feature of geojson.features) {
    const geom = feature.geometry;
    if (!geom) continue;
    if (geom.type === 'LineString') {
      coords.push(...(geom.coordinates as [number, number, number][]));
    } else if (geom.type === 'MultiLineString') {
      geom.coordinates.forEach((line) =>
        coords.push(...(line as [number, number, number][]))
      );
    } else if (geom.type === 'Point') {
      coords.push(geom.coordinates as [number, number, number]);
    }
  }
  return coords;
}

function haversineM(a: [number, number, number], b: [number, number, number]): number {
  const R = 6371000;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

async function kmlStringToGeoJson(kmlString: string): Promise<GeoJSON.FeatureCollection> {
  const { kml } = await import('@tmcw/togeojson');
  const parser = new DOMParser();
  const kmlDom = parser.parseFromString(kmlString, 'text/xml');
  const parserError = kmlDom.querySelector('parsererror');
  if (parserError) throw new Error('Invalid KML: ' + parserError.textContent);
  return kml(kmlDom) as GeoJSON.FeatureCollection;
}

function buildResult(
  geojson: GeoJSON.FeatureCollection,
  fileType: 'kml' | 'kmz',
): ParsedTrack {
  const allCoords = extractCoords(geojson);
  const elevations = allCoords.map((c) => c[2]).filter((e) => e > 0);

  let distanceM = 0;
  const lineCoords = geojson.features
    .filter((f) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString')
    .flatMap((f) => {
      if (f.geometry?.type === 'LineString') return f.geometry.coordinates as [number, number, number][];
      if (f.geometry?.type === 'MultiLineString') return (f.geometry.coordinates as [number, number, number][][]).flat();
      return [];
    });

  for (let i = 1; i < lineCoords.length; i++) {
    distanceM += haversineM(lineCoords[i - 1] as [number,number,number], lineCoords[i] as [number,number,number]);
  }

  const firstName = geojson.features.find((f) => f.properties?.name)?.properties?.name ?? fileType.toUpperCase() + ' Track';

  // Try to extract date from first timestamp in coordinates
  let date = new Date().toISOString();
  for (const f of geojson.features) {
    const times = (f.properties as Record<string, unknown>)?.coordTimes as string[][] | string[] | undefined;
    if (Array.isArray(times)) {
      const first = Array.isArray(times[0]) ? times[0][0] : times[0];
      if (first) { date = first; break; }
    }
  }

  return {
    name: firstName,
    date,
    fileType,
    geojson,
    distanceM,
    durationSec: null,
    maxAltM: elevations.length ? Math.max(...elevations) : null,
    minAltM: elevations.length ? Math.min(...elevations) : null,
    pointCount: allCoords.length,
  };
}

export async function parseKml(content: string): Promise<ParsedTrack> {
  const geojson = await kmlStringToGeoJson(content);
  return buildResult(geojson, 'kml');
}

export async function parseKmz(buffer: ArrayBuffer): Promise<ParsedTrack> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buffer);

  // Find the first .kml file in the zip
  const kmlFile = Object.values(zip.files).find(
    (f) => !f.dir && f.name.toLowerCase().endsWith('.kml')
  );
  if (!kmlFile) throw new Error('No KML file found inside KMZ');

  const kmlString = await kmlFile.async('string');
  const geojson = await kmlStringToGeoJson(kmlString);
  return buildResult(geojson, 'kmz');
}
