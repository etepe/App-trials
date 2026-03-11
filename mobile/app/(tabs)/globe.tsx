import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CesiumWebView, { BridgeMessage, CesiumWebViewRef } from '../../components/CesiumWebView';
import { searchMountains, getWeather, analyzeTerrain, Mountain, WeatherData, ElevationPoint } from '../../services/api';
import { getCachedMountains, cacheMountains, loadTrackGeojson, listTracks } from '../../services/storage/offlineCache';
import ElevationProfile from '../../components/ElevationProfile';
import HourlyForecastChart from '../../components/HourlyForecastChart';
import WeatherAlerts from '../../components/WeatherAlerts';

const DEFAULT_API_URL = 'http://localhost:8000';

// ─── Weather Card (Enhanced) ────────────────────────────────────────────────

function WeatherCard({
  weather,
  onClose,
  onShowHourly,
  onShowAlerts,
}: {
  weather: WeatherData;
  onClose: () => void;
  onShowHourly: () => void;
  onShowAlerts: () => void;
}) {
  const w = weather.current;
  const deg2compass = (d: number) => {
    const dirs = ['N', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
    return dirs[Math.round(d / 45) % 8];
  };

  const thermalColor =
    weather.thermals?.conditions === 'excellent' ? '#2ecc71'
    : weather.thermals?.conditions === 'good' ? '#f39c12'
    : weather.thermals?.conditions === 'moderate' ? '#e67e22'
    : '#e74c3c';

  const uvColor = (uv: number) =>
    uv >= 8 ? '#e74c3c' : uv >= 6 ? '#e67e22' : uv >= 3 ? '#f39c12' : '#2ecc71';

  const alertCount = (weather as any).alerts?.length ?? 0;

  return (
    <View style={wStyles.card}>
      <View style={wStyles.header}>
        <View style={wStyles.headerLeft}>
          <Text style={wStyles.title}>
            {w.weather_description ?? 'Hava Durumu'}
          </Text>
          {weather.elevation_m > 0 && (
            <Text style={wStyles.subtitle}>{Math.round(weather.elevation_m)}m</Text>
          )}
        </View>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={wStyles.closeBtn}>
          <Text style={wStyles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Main stats row */}
      <View style={wStyles.row}>
        <View style={wStyles.stat}>
          <Text style={wStyles.statVal}>{Math.round(w.temperature_c)}°C</Text>
          <Text style={wStyles.statLbl}>
            {w.feels_like_c != null ? `His: ${Math.round(w.feels_like_c)}°` : 'Sicaklik'}
          </Text>
        </View>
        <View style={wStyles.stat}>
          <Text style={wStyles.statVal}>{(w.wind_speed_ms * 3.6).toFixed(0)} km/h</Text>
          <Text style={wStyles.statLbl}>
            Ruzgar {deg2compass(w.wind_direction_deg)}
            {w.wind_gusts_ms ? ` (R:${Math.round(w.wind_gusts_ms * 3.6)})` : ''}
          </Text>
        </View>
        {w.pressure_hpa != null && (
          <View style={wStyles.stat}>
            <Text style={wStyles.statVal}>{Math.round(w.pressure_hpa)}</Text>
            <Text style={wStyles.statLbl}>hPa</Text>
          </View>
        )}
      </View>

      {/* Secondary stats row */}
      <View style={[wStyles.row, { marginTop: 10 }]}>
        {w.humidity_pct != null && (
          <View style={wStyles.stat}>
            <Text style={wStyles.statVal2}>{Math.round(w.humidity_pct)}%</Text>
            <Text style={wStyles.statLbl}>Nem</Text>
          </View>
        )}
        {w.uv_index != null && (
          <View style={wStyles.stat}>
            <Text style={[wStyles.statVal2, { color: uvColor(w.uv_index) }]}>
              {Math.round(w.uv_index)}
            </Text>
            <Text style={wStyles.statLbl}>UV</Text>
          </View>
        )}
        {w.freezing_level_m != null && (
          <View style={wStyles.stat}>
            <Text style={wStyles.statVal2}>{Math.round(w.freezing_level_m)}m</Text>
            <Text style={wStyles.statLbl}>Donma Sv.</Text>
          </View>
        )}
        {w.visibility_m != null && (
          <View style={wStyles.stat}>
            <Text style={wStyles.statVal2}>
              {w.visibility_m >= 1000 ? `${(w.visibility_m / 1000).toFixed(1)}km` : `${Math.round(w.visibility_m)}m`}
            </Text>
            <Text style={wStyles.statLbl}>Gorus</Text>
          </View>
        )}
      </View>

      {/* Thermal bar */}
      {weather.thermals && (
        <View style={[wStyles.thermalBar, { borderColor: thermalColor }]}>
          <Text style={[wStyles.thermalText, { color: thermalColor }]}>
            Termik:{' '}
            {weather.thermals.conditions === 'excellent' ? 'Mukemmel'
              : weather.thermals.conditions === 'good' ? 'Iyi'
              : weather.thermals.conditions === 'moderate' ? 'Orta'
              : 'Zayif'}
            {weather.thermals.thermal_index != null ? ` (${weather.thermals.thermal_index}/10)` : ''}
          </Text>
          {weather.thermals.thermal_height_m && (
            <Text style={wStyles.thermalSub}>
              Tavan ~{Math.round(weather.thermals.thermal_height_m)}m
            </Text>
          )}
        </View>
      )}

      {/* Action buttons */}
      <View style={wStyles.actions}>
        <TouchableOpacity style={wStyles.actionBtn} onPress={onShowHourly}>
          <Text style={wStyles.actionText}>Saatlik Tahmin</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[wStyles.actionBtn, alertCount > 0 && wStyles.actionBtnAlert]}
          onPress={onShowAlerts}
        >
          <Text style={[wStyles.actionText, alertCount > 0 && { color: '#f39c12' }]}>
            Uyarilar{alertCount > 0 ? ` (${alertCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Daily summary */}
      {(weather as any).daily && (weather as any).daily.length > 0 && (
        <View style={wStyles.dailyRow}>
          {((weather as any).daily as any[]).slice(0, 5).map((d: any, i: number) => {
            const dayName = (() => {
              try {
                const date = new Date(d.date);
                return ['Paz', 'Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt'][date.getDay()];
              } catch { return ''; }
            })();
            return (
              <View key={i} style={wStyles.dailyItem}>
                <Text style={wStyles.dailyDay}>{i === 0 ? 'Bugun' : dayName}</Text>
                <Text style={wStyles.dailyTemp}>
                  {d.temp_max_c != null ? `${Math.round(d.temp_max_c)}°` : '-'}
                </Text>
                <Text style={wStyles.dailyTempMin}>
                  {d.temp_min_c != null ? `${Math.round(d.temp_min_c)}°` : ''}
                </Text>
                <Text style={wStyles.dailyDesc}>{d.weather_description ?? ''}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const wStyles = StyleSheet.create({
  card: { backgroundColor: '#1a2035', borderRadius: 12, padding: 14, margin: 10, borderWidth: 1, borderColor: '#2a3050' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerLeft: { flex: 1 },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  subtitle: { color: '#6b7a99', fontSize: 11, marginTop: 1 },
  closeBtn: { padding: 6, borderRadius: 12, backgroundColor: '#242d45' },
  close: { color: '#6b7a99', fontSize: 16, lineHeight: 18, width: 18, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statVal: { color: '#7eb8f7', fontSize: 18, fontWeight: '700' },
  statVal2: { color: '#7eb8f7', fontSize: 14, fontWeight: '700' },
  statLbl: { color: '#6b7a99', fontSize: 10, marginTop: 2 },
  thermalBar: { marginTop: 12, borderWidth: 1, borderRadius: 8, padding: 8, alignItems: 'center' },
  thermalText: { fontWeight: '700', fontSize: 13 },
  thermalSub: { color: '#6b7a99', fontSize: 11, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, backgroundColor: '#242d45', paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  actionBtnAlert: { borderWidth: 1, borderColor: '#f39c1244' },
  actionText: { color: '#7eb8f7', fontSize: 12, fontWeight: '600' },
  dailyRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#2a3050' },
  dailyItem: { alignItems: 'center', flex: 1 },
  dailyDay: { color: '#6b7a99', fontSize: 10, fontWeight: '600' },
  dailyTemp: { color: '#e8eaf6', fontSize: 13, fontWeight: '700', marginTop: 2 },
  dailyTempMin: { color: '#4a5568', fontSize: 11 },
  dailyDesc: { color: '#4a5568', fontSize: 8, marginTop: 1, textAlign: 'center' },
});

// ─── Mountain Info Panel ────────────────────────────────────────────────────

function MountainPanel({
  mountains,
  onSelect,
  onClose,
}: {
  mountains: Mountain[];
  onSelect: (m: Mountain) => void;
  onClose: () => void;
}) {
  return (
    <View style={mStyles.panel}>
      <View style={mStyles.header}>
        <Text style={mStyles.title}>Yakin Zirveler ({mountains.length})</Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={mStyles.closeBtn}>
          <Text style={mStyles.close}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView style={mStyles.list} showsVerticalScrollIndicator={false}>
        {mountains.map((m) => (
          <TouchableOpacity key={m.osm_id} style={mStyles.item} onPress={() => onSelect(m)} activeOpacity={0.6}>
            <View style={mStyles.itemContent}>
              <Text style={mStyles.name}>{m.name}</Text>
              <Text style={mStyles.meta}>
                {m.elevation ? `${Math.round(m.elevation)}m` : ''} · {m.type}
              </Text>
            </View>
            <Text style={mStyles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const mStyles = StyleSheet.create({
  panel: { backgroundColor: '#1a2035', borderRadius: 12, margin: 10, maxHeight: 220, borderWidth: 1, borderColor: '#2a3050' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#2a3050' },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  closeBtn: { padding: 6, borderRadius: 12, backgroundColor: '#242d45' },
  close: { color: '#6b7a99', fontSize: 16, lineHeight: 18, width: 18, textAlign: 'center' },
  list: { padding: 8 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#242d45' },
  itemContent: { flex: 1 },
  name: { color: '#e8eaf6', fontSize: 14, fontWeight: '600' },
  meta: { color: '#6b7a99', fontSize: 12, marginTop: 2 },
  chevron: { color: '#4a5568', fontSize: 20, fontWeight: '300', marginLeft: 8 },
});

// ─── Measurement Result Panel ────────────────────────────────────────────────

function MeasurePanel({
  mode,
  pointCount,
  result,
  onFinish,
  onCancel,
}: {
  mode: 'distance' | 'area';
  pointCount: number;
  result: { distance_m?: number; area_m2?: number } | null;
  onFinish: () => void;
  onCancel: () => void;
}) {
  const formatDistance = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
  const formatArea = (m2: number) => {
    if (m2 >= 1e6) return `${(m2 / 1e6).toFixed(2)} km²`;
    if (m2 >= 1e4) return `${(m2 / 1e4).toFixed(2)} ha`;
    return `${Math.round(m2)} m²`;
  };

  return (
    <View style={measureStyles.panel}>
      <View style={measureStyles.header}>
        <Text style={measureStyles.title}>
          {mode === 'distance' ? 'Mesafe Olcumu' : 'Alan Olcumu'}
        </Text>
        <Text style={measureStyles.subtitle}>
          {result
            ? (mode === 'distance' && result.distance_m != null
              ? formatDistance(result.distance_m)
              : result.area_m2 != null ? formatArea(result.area_m2) : '')
            : `${pointCount} nokta secildi - haritaya dokunun`}
        </Text>
      </View>
      <View style={measureStyles.actions}>
        {!result && (
          <TouchableOpacity
            style={[measureStyles.btn, measureStyles.btnPrimary]}
            onPress={onFinish}
            disabled={mode === 'distance' ? pointCount < 2 : pointCount < 3}
          >
            <Text style={measureStyles.btnText}>Tamamla</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={measureStyles.btn} onPress={onCancel}>
          <Text style={measureStyles.btnText}>{result ? 'Kapat' : 'Iptal'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const measureStyles = StyleSheet.create({
  panel: { backgroundColor: '#1a2035', borderRadius: 12, margin: 10, padding: 14, borderWidth: 1, borderColor: '#f39c12' },
  header: { marginBottom: 10 },
  title: { color: '#f39c12', fontWeight: '700', fontSize: 14 },
  subtitle: { color: '#e8eaf6', fontSize: 13, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, backgroundColor: '#242d45', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#2d4a7a' },
  btnText: { color: '#7eb8f7', fontSize: 13, fontWeight: '600' },
});

// ─── Terrain Stats Panel ─────────────────────────────────────────────────────

function TerrainStatsPanel({
  stats,
  analysisType,
  onClose,
}: {
  stats: { min_slope_deg?: number; max_slope_deg?: number; mean_slope_deg?: number; dominant_aspect?: string };
  analysisType: string;
  onClose: () => void;
}) {
  return (
    <View style={tsStyles.panel}>
      <View style={tsStyles.header}>
        <Text style={tsStyles.title}>
          {analysisType === 'slope' ? 'Egim Analizi' : 'Baki Analizi'}
        </Text>
        <TouchableOpacity onPress={onClose} style={tsStyles.closeBtn}>
          <Text style={tsStyles.close}>✕</Text>
        </TouchableOpacity>
      </View>
      <View style={tsStyles.statsRow}>
        {stats.min_slope_deg != null && (
          <View style={tsStyles.stat}>
            <Text style={tsStyles.val}>{stats.min_slope_deg}°</Text>
            <Text style={tsStyles.lbl}>Min Egim</Text>
          </View>
        )}
        {stats.mean_slope_deg != null && (
          <View style={tsStyles.stat}>
            <Text style={tsStyles.val}>{stats.mean_slope_deg}°</Text>
            <Text style={tsStyles.lbl}>Ort. Egim</Text>
          </View>
        )}
        {stats.max_slope_deg != null && (
          <View style={tsStyles.stat}>
            <Text style={tsStyles.val}>{stats.max_slope_deg}°</Text>
            <Text style={tsStyles.lbl}>Max Egim</Text>
          </View>
        )}
        {stats.dominant_aspect != null && (
          <View style={tsStyles.stat}>
            <Text style={tsStyles.val}>{stats.dominant_aspect}</Text>
            <Text style={tsStyles.lbl}>Baki</Text>
          </View>
        )}
      </View>
      {analysisType === 'slope' && (
        <View style={tsStyles.legend}>
          <View style={tsStyles.legendItem}>
            <View style={[tsStyles.legendColor, { backgroundColor: '#22c55e' }]} />
            <Text style={tsStyles.legendText}>0-20°</Text>
          </View>
          <View style={tsStyles.legendItem}>
            <View style={[tsStyles.legendColor, { backgroundColor: '#f1c40f' }]} />
            <Text style={tsStyles.legendText}>20-35°</Text>
          </View>
          <View style={tsStyles.legendItem}>
            <View style={[tsStyles.legendColor, { backgroundColor: '#e74c3c' }]} />
            <Text style={tsStyles.legendText}>35-50°</Text>
          </View>
          <View style={tsStyles.legendItem}>
            <View style={[tsStyles.legendColor, { backgroundColor: '#8e0044' }]} />
            <Text style={tsStyles.legendText}>50°+</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const tsStyles = StyleSheet.create({
  panel: { backgroundColor: '#1a2035', borderRadius: 12, margin: 10, padding: 14, borderWidth: 1, borderColor: '#2a3050' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  closeBtn: { padding: 6, borderRadius: 12, backgroundColor: '#242d45' },
  close: { color: '#6b7a99', fontSize: 16, lineHeight: 18, width: 18, textAlign: 'center' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 },
  stat: { alignItems: 'center' },
  val: { color: '#7eb8f7', fontSize: 18, fontWeight: '700' },
  lbl: { color: '#6b7a99', fontSize: 10, marginTop: 2 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#2a3050' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendColor: { width: 14, height: 10, borderRadius: 2 },
  legendText: { color: '#6b7a99', fontSize: 10 },
});

// ─── Globe Screen ───────────────────────────────────────────────────────────

export default function GlobeScreen() {
  const cesiumRef = useRef<CesiumWebViewRef>(null);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ trackId?: string; flyLat?: string; flyLon?: string; flyAlt?: string }>();

  // Settings
  const [apiUrl, setApiUrl] = useState<string>(DEFAULT_API_URL);
  const [cesiumToken, setCesiumToken] = useState<string>('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Core state
  const [ready, setReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [showMountains, setShowMountains] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'slope' | 'aspect' | 'contour' | null>(null);
  const [analysisStats, setAnalysisStats] = useState<any>(null);
  const [lastClickPos, setLastClickPos] = useState<{ lat: number; lon: number; elevation: number } | null>(null);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[] | null>(null);
  const [showHourlyChart, setShowHourlyChart] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);

  // New 3D feature state
  const [terrainExaggeration, setTerrainExaggeration] = useState(1);
  const [showToolsExpanded, setShowToolsExpanded] = useState(false);
  const [measureMode, setMeasureMode] = useState<'distance' | 'area' | null>(null);
  const [measurePointCount, setMeasurePointCount] = useState(0);
  const [measureResult, setMeasureResult] = useState<any>(null);
  const [trackMode, setTrackMode] = useState<'2d' | '3d' | 'colored'>('2d');
  const [showViewshed, setShowViewshed] = useState(false);

  // Load settings
  useEffect(() => {
    (async () => {
      const [url, token] = await Promise.all([
        AsyncStorage.getItem('@settings/apiUrl'),
        AsyncStorage.getItem('@settings/cesiumToken'),
      ]);
      if (url) setApiUrl(url);
      if (token) setCesiumToken(token);
      setSettingsLoaded(true);
    })();
  }, []);

  // Load track from navigation params
  useEffect(() => {
    if (!ready || !params.trackId) return;
    (async () => {
      try {
        const tracks = await listTracks();
        const track = tracks.find((t) => t.id === params.trackId);
        if (!track) return;
        const geojson = await loadTrackGeojson(track);
        cesiumRef.current?.clearTracks();
        if (trackMode === '3d') {
          cesiumRef.current?.loadTrack3D(geojson, { color: '#2ecc71', flyTo: true });
        } else if (trackMode === 'colored') {
          cesiumRef.current?.loadTrackColored(geojson, { width: 5 });
        } else {
          cesiumRef.current?.loadTrack(geojson, { color: '#2ecc71', width: 3, flyTo: true });
        }
      } catch (e) {
        console.warn('Failed to load track:', e);
      }
    })();
  }, [ready, params.trackId, trackMode]);

  // Fly to location from navigation params
  useEffect(() => {
    if (!ready || !params.flyLat || !params.flyLon) return;
    const lat = parseFloat(params.flyLat);
    const lon = parseFloat(params.flyLon);
    const alt = params.flyAlt ? parseFloat(params.flyAlt) : 5000;
    if (!isNaN(lat) && !isNaN(lon)) {
      cesiumRef.current?.flyToLocation(lat, lon, alt, 0, -35);
    }
  }, [ready, params.flyLat, params.flyLon, params.flyAlt]);

  const cesiumUrl = `${apiUrl}/static/cesium/index.html${
    cesiumToken ? `?token=${encodeURIComponent(cesiumToken)}` : ''
  }`;

  const handleMessage = useCallback(async (msg: BridgeMessage) => {
    if (msg.action === 'mapClick') {
      const { lat, lon, elevation } = msg.payload;
      setLastClickPos({ lat, lon, elevation });

      // Don't fetch weather if in measure mode
      if (measureMode) return;

      setLoadingWeather(true);
      try {
        const w = await getWeather(lat, lon, elevation);
        setWeather(w);
      } catch (e) {
        console.warn('Weather fetch failed:', e);
      } finally {
        setLoadingWeather(false);
      }
    }

    if (msg.action === 'peakSelected') {
      const { lat, lon, elevation } = msg.payload;
      cesiumRef.current?.flyToLocation(lat, lon, (elevation ?? 0) + 2000, 0, -30);
    }

    if (msg.action === 'measurePointAdded') {
      setMeasurePointCount((msg.payload as any).index);
    }

    if (msg.action === 'measureResult') {
      setMeasureResult(msg.payload);
    }

    if (msg.action === 'terrainExaggerationChanged') {
      setTerrainExaggeration((msg.payload as any).factor);
    }
  }, [measureMode]);

  const handleSearch = useCallback(async () => {
    if (!lastClickPos && !searchQuery) {
      Alert.alert('Konum sec', 'Once haritada bir noktaya dokunun.');
      return;
    }
    const lat = lastClickPos?.lat ?? 46.0;
    const lon = lastClickPos?.lon ?? 7.5;

    setSearching(true);
    try {
      const cached = await getCachedMountains(lat, lon, 25);
      let results: Mountain[] = cached ?? [];

      if (!cached) {
        results = await searchMountains(lat, lon, 25, searchQuery || undefined);
        await cacheMountains(lat, lon, 25,
          results.map((r) => ({ osmId: r.osm_id, name: r.name, lat: r.lat, lon: r.lon, elevation: r.elevation, type: r.type }))
        );
      }

      setMountains(results);
      setShowMountains(results.length > 0);

      cesiumRef.current?.clearMarkers();
      results.slice(0, 30).forEach((m) => {
        cesiumRef.current?.addMarker(m.lat, m.lon, m.name, m.osm_id, m.elevation);
      });
    } catch (e) {
      Alert.alert('Arama basarisiz', String(e));
    } finally {
      setSearching(false);
    }
  }, [lastClickPos, searchQuery]);

  const handleMountainSelect = useCallback((m: Mountain) => {
    cesiumRef.current?.flyToLocation(m.lat, m.lon, (m.elevation ?? 1000) + 2500, 0, -35);
    setShowMountains(false);
  }, []);

  const handleAnalysis = useCallback(async (type: 'slope' | 'aspect' | 'contour') => {
    if (!lastClickPos) {
      Alert.alert('Alan sec', 'Once bir dag bolgesine dokunun.');
      return;
    }
    const { lat, lon } = lastClickPos;
    const delta = 0.1;
    try {
      const result = await analyzeTerrain(
        { minLon: lon - delta, minLat: lat - delta, maxLon: lon + delta, maxLat: lat + delta },
        type
      );

      if (result.overlay_image && result.bbox) {
        const fullUrl = `${apiUrl}${result.overlay_image}`;
        if (type === 'contour') {
          cesiumRef.current?.showContourOverlay(fullUrl, result.bbox);
        } else {
          cesiumRef.current?.showOverlay(fullUrl, result.bbox);
        }
        setAnalysisMode(type);
      }

      if (result.stats) {
        setAnalysisStats({ ...result.stats, analysisType: type });
      }
    } catch (e) {
      Alert.alert('Analiz basarisiz', String(e));
    }
  }, [lastClickPos, apiUrl]);

  const handleProfileAnalysis = useCallback(async () => {
    if (!lastClickPos) {
      Alert.alert('Alan sec', 'Once bir dag bolgesine dokunun.');
      return;
    }
    const { lat, lon } = lastClickPos;
    const delta = 0.05;
    try {
      const result = await analyzeTerrain(
        { minLon: lon - delta, minLat: lat - delta, maxLon: lon + delta, maxLat: lat + delta },
        'profile'
      );
      if (result.profile && result.profile.length > 0) {
        setElevationProfile(result.profile);
      }
    } catch (e) {
      Alert.alert('Profil analizi basarisiz', String(e));
    }
  }, [lastClickPos]);

  const handleTerrainExaggeration = useCallback((delta: number) => {
    const newFactor = Math.max(1, Math.min(terrainExaggeration + delta, 10));
    cesiumRef.current?.setTerrainExaggeration(newFactor);
    setTerrainExaggeration(newFactor);
  }, [terrainExaggeration]);

  const handleStartMeasure = useCallback((mode: 'distance' | 'area') => {
    setMeasureMode(mode);
    setMeasurePointCount(0);
    setMeasureResult(null);
    cesiumRef.current?.startMeasure(mode);
  }, []);

  const handleFinishMeasure = useCallback(() => {
    cesiumRef.current?.finishMeasure();
  }, []);

  const handleCancelMeasure = useCallback(() => {
    cesiumRef.current?.cancelMeasure();
    setMeasureMode(null);
    setMeasurePointCount(0);
    setMeasureResult(null);
  }, []);

  const handleViewshed = useCallback(() => {
    if (!lastClickPos) {
      Alert.alert('Konum sec', 'Once haritada bir noktaya dokunun.');
      return;
    }
    if (showViewshed) {
      cesiumRef.current?.clearViewshed();
      setShowViewshed(false);
    } else {
      cesiumRef.current?.showViewshed(lastClickPos.lat, lastClickPos.lon, lastClickPos.elevation, 5000);
      setShowViewshed(true);
    }
  }, [lastClickPos, showViewshed]);

  const handleOrbit = useCallback(() => {
    if (!lastClickPos) {
      Alert.alert('Konum sec', 'Once bir zirveye dokunun.');
      return;
    }
    cesiumRef.current?.orbitAround(lastClickPos.lat, lastClickPos.lon, lastClickPos.elevation + 500, 4000, 25);
  }, [lastClickPos]);

  const clearAll = useCallback(() => {
    cesiumRef.current?.clearMarkers();
    cesiumRef.current?.clearLayers();
    cesiumRef.current?.clearViewshed();
    cesiumRef.current?.cancelMeasure();
    setAnalysisMode(null);
    setAnalysisStats(null);
    setShowMountains(false);
    setWeather(null);
    setElevationProfile(null);
    setMeasureMode(null);
    setMeasurePointCount(0);
    setMeasureResult(null);
    setShowViewshed(false);
  }, []);

  if (!settingsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7eb8f7" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CesiumWebView
        ref={cesiumRef}
        sourceUri={cesiumUrl}
        onReady={() => setReady(true)}
        onMessage={handleMessage}
        style={styles.globe}
      />

      {/* Search bar */}
      <View style={[styles.searchBar, { top: Math.max(insets.top + 4, 12) }]}>
        <TextInput
          style={styles.searchInput}
          placeholder="Dag ara..."
          placeholderTextColor="#4a5568"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          blurOnSubmit
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => { Keyboard.dismiss(); handleSearch(); }}
          disabled={searching}
        >
          {searching ? (
            <ActivityIndicator color="#7eb8f7" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Ara</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Main toolbar */}
      <View style={[styles.toolbar, { top: Math.max(insets.top + 56, 64) }]}>
        {/* Analysis tools */}
        <TouchableOpacity
          style={[styles.toolBtn, analysisMode === 'slope' && styles.toolBtnActive]}
          onPress={() => {
            if (analysisMode === 'slope') { cesiumRef.current?.clearLayers(); setAnalysisMode(null); setAnalysisStats(null); }
            else handleAnalysis('slope');
          }}
        >
          <Text style={styles.toolBtnText}>Egim</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, analysisMode === 'aspect' && styles.toolBtnActive]}
          onPress={() => {
            if (analysisMode === 'aspect') { cesiumRef.current?.clearLayers(); setAnalysisMode(null); setAnalysisStats(null); }
            else handleAnalysis('aspect');
          }}
        >
          <Text style={styles.toolBtnText}>Baki</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, analysisMode === 'contour' && styles.toolBtnActive]}
          onPress={() => {
            if (analysisMode === 'contour') { cesiumRef.current?.clearLayers(); setAnalysisMode(null); }
            else handleAnalysis('contour');
          }}
        >
          <Text style={styles.toolBtnText}>Kontur</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, elevationProfile ? styles.toolBtnActive : null]}
          onPress={() => {
            if (elevationProfile) setElevationProfile(null);
            else handleProfileAnalysis();
          }}
        >
          <Text style={styles.toolBtnText}>Profil</Text>
        </TouchableOpacity>

        {/* Expand more tools */}
        <TouchableOpacity
          style={[styles.toolBtn, showToolsExpanded && styles.toolBtnActive]}
          onPress={() => setShowToolsExpanded(!showToolsExpanded)}
        >
          <Text style={styles.toolBtnText}>{showToolsExpanded ? '▲' : '▼'} 3D</Text>
        </TouchableOpacity>

        {/* Expanded tools */}
        {showToolsExpanded && (
          <>
            {/* Measurement */}
            <TouchableOpacity
              style={[styles.toolBtn, measureMode === 'distance' && styles.toolBtnMeasure]}
              onPress={() => {
                if (measureMode) handleCancelMeasure();
                else handleStartMeasure('distance');
              }}
            >
              <Text style={styles.toolBtnText}>Mesafe</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.toolBtn, measureMode === 'area' && styles.toolBtnMeasure]}
              onPress={() => {
                if (measureMode) handleCancelMeasure();
                else handleStartMeasure('area');
              }}
            >
              <Text style={styles.toolBtnText}>Alan</Text>
            </TouchableOpacity>

            {/* Viewshed */}
            <TouchableOpacity
              style={[styles.toolBtn, showViewshed && styles.toolBtnActive]}
              onPress={handleViewshed}
            >
              <Text style={styles.toolBtnText}>Gorunum</Text>
            </TouchableOpacity>

            {/* Orbit */}
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleOrbit}
            >
              <Text style={styles.toolBtnText}>Orbit</Text>
            </TouchableOpacity>

            {/* Track mode selector */}
            <View style={styles.trackModeGroup}>
              {(['2d', '3d', 'colored'] as const).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.trackModeBtn, trackMode === mode && styles.trackModeBtnActive]}
                  onPress={() => setTrackMode(mode)}
                >
                  <Text style={[styles.trackModeBtnText, trackMode === mode && styles.trackModeBtnTextActive]}>
                    {mode === '2d' ? '2D' : mode === '3d' ? '3D' : 'Renk'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Clear all */}
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={clearAll}
        >
          <Text style={styles.toolBtnText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {/* Terrain exaggeration control (left side) */}
      <View style={[styles.exaggerationControl, { top: Math.max(insets.top + 56, 64) }]}>
        <TouchableOpacity
          style={styles.exagBtn}
          onPress={() => handleTerrainExaggeration(1)}
        >
          <Text style={styles.exagBtnText}>+</Text>
        </TouchableOpacity>
        <Text style={styles.exagLabel}>{terrainExaggeration}x</Text>
        <TouchableOpacity
          style={styles.exagBtn}
          onPress={() => handleTerrainExaggeration(-1)}
        >
          <Text style={styles.exagBtnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.exagSublabel}>Arazi</Text>
      </View>

      {/* Bottom overlays */}
      <ScrollView
        style={styles.overlays}
        contentContainerStyle={styles.overlaysContent}
        showsVerticalScrollIndicator={false}
        pointerEvents="box-none"
      >
        {/* Measurement panel */}
        {measureMode && (
          <MeasurePanel
            mode={measureMode}
            pointCount={measurePointCount}
            result={measureResult}
            onFinish={handleFinishMeasure}
            onCancel={handleCancelMeasure}
          />
        )}

        {loadingWeather && (
          <View style={styles.loadingBar}>
            <ActivityIndicator color="#7eb8f7" size="small" />
            <Text style={styles.loadingText}>Hava durumu yukleniyor...</Text>
          </View>
        )}

        {/* Terrain stats panel */}
        {analysisStats && (
          <TerrainStatsPanel
            stats={analysisStats}
            analysisType={analysisStats.analysisType}
            onClose={() => setAnalysisStats(null)}
          />
        )}

        {weather && !loadingWeather && showAlerts && (
          <WeatherAlerts
            alerts={(weather as any).alerts ?? []}
            avalancheRisk={(weather as any).avalanche_risk}
            onClose={() => setShowAlerts(false)}
          />
        )}
        {weather && !loadingWeather && showHourlyChart && (weather as any).hourly && (
          <HourlyForecastChart
            hourly={(weather as any).hourly}
            onClose={() => setShowHourlyChart(false)}
          />
        )}
        {weather && !loadingWeather && (
          <WeatherCard
            weather={weather}
            onClose={() => { setWeather(null); setShowHourlyChart(false); setShowAlerts(false); }}
            onShowHourly={() => setShowHourlyChart((v) => !v)}
            onShowAlerts={() => setShowAlerts((v) => !v)}
          />
        )}
        {showMountains && (
          <MountainPanel
            mountains={mountains}
            onSelect={handleMountainSelect}
            onClose={() => setShowMountains(false)}
          />
        )}
        {elevationProfile && (
          <ElevationProfile
            profile={elevationProfile}
            onClose={() => setElevationProfile(null)}
          />
        )}
      </ScrollView>

      {!ready && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#7eb8f7" size="large" />
          <Text style={styles.loadingOverlayText}>3D Kure yukleniyor...</Text>
          <Text style={styles.loadingOverlaySub}>Ilk yuklemede biraz bekleyebilir</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  globe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Search bar
  searchBar: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row',
    backgroundColor: '#1a2035ee',
    borderRadius: 10, borderWidth: 1, borderColor: '#2a3050', overflow: 'hidden',
  },
  searchInput: { flex: 1, color: '#e8eaf6', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  searchBtn: { paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', backgroundColor: '#2d4a7a' },
  searchBtnText: { color: '#7eb8f7', fontWeight: '700', fontSize: 13 },

  // Toolbar (right)
  toolbar: { position: 'absolute', right: 12 },
  toolBtn: {
    backgroundColor: '#1a2035dd', paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a3050', marginBottom: 5,
    minWidth: 54, alignItems: 'center',
  },
  toolBtnActive: { borderColor: '#7eb8f7', backgroundColor: '#2d4a7a' },
  toolBtnMeasure: { borderColor: '#f39c12', backgroundColor: '#3a2d1a' },
  toolBtnText: { color: '#7eb8f7', fontSize: 11, fontWeight: '600' },

  // Track mode
  trackModeGroup: {
    flexDirection: 'row', marginBottom: 5, gap: 2,
  },
  trackModeBtn: {
    backgroundColor: '#1a2035dd', paddingVertical: 5, paddingHorizontal: 8,
    borderWidth: 1, borderColor: '#2a3050', borderRadius: 6,
  },
  trackModeBtnActive: { borderColor: '#2ecc71', backgroundColor: '#1a3520' },
  trackModeBtnText: { color: '#6b7a99', fontSize: 10, fontWeight: '600' },
  trackModeBtnTextActive: { color: '#2ecc71' },

  // Terrain exaggeration (left side)
  exaggerationControl: {
    position: 'absolute', left: 12,
    alignItems: 'center',
  },
  exagBtn: {
    width: 36, height: 36,
    backgroundColor: '#1a2035dd',
    borderRadius: 8, borderWidth: 1, borderColor: '#2a3050',
    justifyContent: 'center', alignItems: 'center',
  },
  exagBtnText: { color: '#7eb8f7', fontSize: 18, fontWeight: '700' },
  exagLabel: { color: '#e8eaf6', fontSize: 12, fontWeight: '700', marginVertical: 4 },
  exagSublabel: { color: '#4a5568', fontSize: 9 },

  // Bottom overlays
  overlays: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '60%' },
  overlaysContent: { flexGrow: 1, justifyContent: 'flex-end' },
  loadingBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a2035cc', margin: 10, padding: 10, borderRadius: 8, gap: 8,
  },
  loadingText: { color: '#7eb8f7', fontSize: 13 },

  // Loading overlay
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0f1ecc', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingOverlayText: { color: '#7eb8f7', fontSize: 15 },
  loadingOverlaySub: { color: '#4a5568', fontSize: 12 },
});
