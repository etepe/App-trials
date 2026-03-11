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
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CesiumWebView, { BridgeMessage, CesiumWebViewRef } from '../../components/CesiumWebView';
import { searchMountains, getWeather, analyzeTerrain, Mountain, WeatherData, ElevationPoint } from '../../services/api';
import { getCachedMountains, cacheMountains, loadTrackGeojson, listTracks } from '../../services/storage/offlineCache';
import ElevationProfile from '../../components/ElevationProfile';

const DEFAULT_API_URL = 'http://localhost:8000';

// ─── Weather Card ───────────────────────────────────────────────────────────

function WeatherCard({ weather, onClose }: { weather: WeatherData; onClose: () => void }) {
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

  return (
    <View style={wStyles.card}>
      <View style={wStyles.header}>
        <Text style={wStyles.title}>
          Hava Durumu {weather.elevation_m > 0 ? `(${Math.round(weather.elevation_m)}m)` : ''}
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={wStyles.closeBtn}>
          <Text style={wStyles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <View style={wStyles.row}>
        <View style={wStyles.stat}>
          <Text style={wStyles.statVal}>{Math.round(w.temperature_c)}°C</Text>
          <Text style={wStyles.statLbl}>Sıcaklık</Text>
        </View>
        <View style={wStyles.stat}>
          <Text style={wStyles.statVal}>{(w.wind_speed_ms * 3.6).toFixed(0)} km/h</Text>
          <Text style={wStyles.statLbl}>Rüzgar {deg2compass(w.wind_direction_deg)}</Text>
        </View>
        {w.pressure_hpa && (
          <View style={wStyles.stat}>
            <Text style={wStyles.statVal}>{Math.round(w.pressure_hpa)}</Text>
            <Text style={wStyles.statLbl}>hPa</Text>
          </View>
        )}
      </View>

      {weather.thermals && (
        <View style={[wStyles.thermalBar, { borderColor: thermalColor }]}>
          <Text style={[wStyles.thermalText, { color: thermalColor }]}>
            Termik:{' '}
            {weather.thermals.conditions === 'excellent' ? 'Mükemmel'
              : weather.thermals.conditions === 'good' ? 'İyi'
              : weather.thermals.conditions === 'moderate' ? 'Orta'
              : 'Zayıf'}
          </Text>
          {weather.thermals.thermal_height_m && (
            <Text style={wStyles.thermalSub}>
              Tavan ~{Math.round(weather.thermals.thermal_height_m)}m
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const wStyles = StyleSheet.create({
  card: { backgroundColor: '#1a2035', borderRadius: 12, padding: 14, margin: 10, borderWidth: 1, borderColor: '#2a3050' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  closeBtn: { padding: 6, borderRadius: 12, backgroundColor: '#242d45' },
  close: { color: '#6b7a99', fontSize: 16, lineHeight: 18, width: 18, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statVal: { color: '#7eb8f7', fontSize: 18, fontWeight: '700' },
  statLbl: { color: '#6b7a99', fontSize: 11, marginTop: 2 },
  thermalBar: { marginTop: 12, borderWidth: 1, borderRadius: 8, padding: 8, alignItems: 'center' },
  thermalText: { fontWeight: '700', fontSize: 13 },
  thermalSub: { color: '#6b7a99', fontSize: 11, marginTop: 2 },
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
        <Text style={mStyles.title}>Yakın Zirveler ({mountains.length})</Text>
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

// ─── Globe Screen ───────────────────────────────────────────────────────────

export default function GlobeScreen() {
  const cesiumRef = useRef<CesiumWebViewRef>(null);
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ trackId?: string; flyLat?: string; flyLon?: string; flyAlt?: string }>();

  // Settings loaded from AsyncStorage
  const [apiUrl, setApiUrl] = useState<string>(DEFAULT_API_URL);
  const [cesiumToken, setCesiumToken] = useState<string>('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [ready, setReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [mountains, setMountains] = useState<Mountain[]>([]);
  const [showMountains, setShowMountains] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'slope' | 'aspect' | null>(null);
  const [lastClickPos, setLastClickPos] = useState<{ lat: number; lon: number; elevation: number } | null>(null);
  const [elevationProfile, setElevationProfile] = useState<ElevationPoint[] | null>(null);

  // Load settings from AsyncStorage on mount
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

  // Load track from navigation params (when coming from Tracks screen)
  useEffect(() => {
    if (!ready || !params.trackId) return;
    (async () => {
      try {
        const tracks = await listTracks();
        const track = tracks.find((t) => t.id === params.trackId);
        if (!track) return;
        const geojson = await loadTrackGeojson(track);
        cesiumRef.current?.clearTracks();
        cesiumRef.current?.loadTrack(geojson, { color: '#2ecc71', width: 3, flyTo: true });
      } catch (e) {
        console.warn('Failed to load track:', e);
      }
    })();
  }, [ready, params.trackId]);

  // Fly to location from navigation params (when coming from Mountain detail)
  useEffect(() => {
    if (!ready || !params.flyLat || !params.flyLon) return;
    const lat = parseFloat(params.flyLat);
    const lon = parseFloat(params.flyLon);
    const alt = params.flyAlt ? parseFloat(params.flyAlt) : 5000;
    if (!isNaN(lat) && !isNaN(lon)) {
      cesiumRef.current?.flyToLocation(lat, lon, alt, 0, -35);
    }
  }, [ready, params.flyLat, params.flyLon, params.flyAlt]);

  // Build Cesium WebView URL — token passed as query param so index.html can read it
  const cesiumUrl = `${apiUrl}/static/cesium/index.html${
    cesiumToken ? `?token=${encodeURIComponent(cesiumToken)}` : ''
  }`;

  const handleMessage = useCallback(async (msg: BridgeMessage) => {
    if (msg.action === 'mapClick') {
      const { lat, lon, elevation } = msg.payload;
      setLastClickPos({ lat, lon, elevation });

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
  }, []);

  const handleSearch = useCallback(async () => {
    if (!lastClickPos && !searchQuery) {
      Alert.alert('Konum seç', 'Önce haritada bir noktaya dokunun.');
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
      Alert.alert('Arama başarısız', String(e));
    } finally {
      setSearching(false);
    }
  }, [lastClickPos, searchQuery]);

  const handleMountainSelect = useCallback((m: Mountain) => {
    cesiumRef.current?.flyToLocation(m.lat, m.lon, (m.elevation ?? 1000) + 2500, 0, -35);
    setShowMountains(false);
  }, []);

  const handleAnalysis = useCallback(async (type: 'slope' | 'aspect') => {
    if (!lastClickPos) {
      Alert.alert('Alan seç', 'Önce bir dağ bölgesine dokunun.');
      return;
    }
    const { lat, lon } = lastClickPos;
    const delta = 0.1;
    try {
      const result = await analyzeTerrain(
        { minLon: lon - delta, minLat: lat - delta, maxLon: lon + delta, maxLat: lat + delta },
        type
      );
      if (result.tiles_url) {
        cesiumRef.current?.showSlopeLayer(result.tiles_url);
        setAnalysisMode(type);
      }
    } catch (e) {
      Alert.alert('Analiz başarısız', String(e));
    }
  }, [lastClickPos]);

  const handleProfileAnalysis = useCallback(async () => {
    if (!lastClickPos) {
      Alert.alert('Alan seç', 'Önce bir dağ bölgesine dokunun.');
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
      Alert.alert('Profil analizi başarısız', String(e));
    }
  }, [lastClickPos]);

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
          placeholder="Dağ ara…"
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
            <Text style={styles.searchBtnText}>🔍 Ara</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Analysis toolbar */}
      <View style={[styles.toolbar, { top: Math.max(insets.top + 56, 64) }]}>
        <TouchableOpacity
          style={[styles.toolBtn, analysisMode === 'slope' && styles.toolBtnActive]}
          onPress={() => {
            if (analysisMode === 'slope') { cesiumRef.current?.clearLayers(); setAnalysisMode(null); }
            else handleAnalysis('slope');
          }}
        >
          <Text style={styles.toolBtnText}>Eğim</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, analysisMode === 'aspect' && styles.toolBtnActive]}
          onPress={() => {
            if (analysisMode === 'aspect') { cesiumRef.current?.clearLayers(); setAnalysisMode(null); }
            else handleAnalysis('aspect');
          }}
        >
          <Text style={styles.toolBtnText}>Bakı</Text>
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

        <TouchableOpacity
          style={styles.toolBtn}
          onPress={() => {
            cesiumRef.current?.clearMarkers();
            cesiumRef.current?.clearLayers();
            setAnalysisMode(null);
            setShowMountains(false);
            setWeather(null);
            setElevationProfile(null);
          }}
        >
          <Text style={styles.toolBtnText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom overlays */}
      <View style={styles.overlays}>
        {loadingWeather && (
          <View style={styles.loadingBar}>
            <ActivityIndicator color="#7eb8f7" size="small" />
            <Text style={styles.loadingText}>Hava durumu yükleniyor…</Text>
          </View>
        )}
        {weather && !loadingWeather && (
          <WeatherCard weather={weather} onClose={() => setWeather(null)} />
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
      </View>

      {!ready && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#7eb8f7" size="large" />
          <Text style={styles.loadingOverlayText}>3D Küre yükleniyor…</Text>
          <Text style={styles.loadingOverlaySub}>İlk yüklemede biraz bekleyebilir</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  globe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    position: 'absolute', left: 12, right: 12,
    flexDirection: 'row',
    backgroundColor: '#1a2035ee',
    borderRadius: 10, borderWidth: 1, borderColor: '#2a3050', overflow: 'hidden',
  },
  searchInput: { flex: 1, color: '#e8eaf6', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  searchBtn: { paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', backgroundColor: '#2d4a7a' },
  searchBtnText: { color: '#7eb8f7', fontWeight: '700', fontSize: 13 },
  toolbar: { position: 'absolute', right: 12 },
  toolBtn: {
    backgroundColor: '#1a2035dd', paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a3050', marginBottom: 6,
  },
  toolBtnActive: { borderColor: '#7eb8f7', backgroundColor: '#2d4a7a' },
  toolBtnText: { color: '#7eb8f7', fontSize: 12, fontWeight: '600' },
  overlays: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  loadingBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1a2035cc', margin: 10, padding: 10, borderRadius: 8, gap: 8,
  },
  loadingText: { color: '#7eb8f7', fontSize: 13 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0f1ecc', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingOverlayText: { color: '#7eb8f7', fontSize: 15 },
  loadingOverlaySub: { color: '#4a5568', fontSize: 12 },
});
