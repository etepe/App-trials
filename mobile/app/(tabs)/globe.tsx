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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import CesiumWebView from '../../components/CesiumWebView';
import type { CesiumViewRef } from '../../components/CesiumWebView';
import type { BridgeMessage, Mountain, WeatherData, Bookmark } from '../../shared/types';
import { searchMountains, getWeather, analyzeTerrain } from '../../services/api';
import { getCachedMountains, cacheMountains } from '../../services/storage/offlineCache';
import MountainInspector from '../../components/MountainInspector';
import ReplayControls from '../../components/ReplayControls';
import BookmarkPanel from '../../components/BookmarkPanel';

const DEFAULT_API_URL = 'http://localhost:8000';

// ─── Weather Card ───────────────────────────────────────────────────────────

function WeatherCard({ weather, onClose }: { weather: WeatherData; onClose: () => void }) {
  const w = weather.current;
  const deg2compass = (d: number) => {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
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
          Weather {weather.elevation_m > 0 ? `(${Math.round(weather.elevation_m)}m)` : ''}
        </Text>
        <TouchableOpacity onPress={onClose}><Text style={wStyles.close}>✕</Text></TouchableOpacity>
      </View>

      <View style={wStyles.row}>
        <View style={wStyles.stat}>
          <Text style={wStyles.statVal}>{Math.round(w.temperature_c)}°C</Text>
          <Text style={wStyles.statLbl}>Temperature</Text>
        </View>
        <View style={wStyles.stat}>
          <Text style={wStyles.statVal}>{(w.wind_speed_ms * 3.6).toFixed(0)} km/h</Text>
          <Text style={wStyles.statLbl}>Wind {deg2compass(w.wind_direction_deg)}</Text>
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
            Thermals:{' '}
            {weather.thermals.conditions === 'excellent' ? 'Excellent'
              : weather.thermals.conditions === 'good' ? 'Good'
              : weather.thermals.conditions === 'moderate' ? 'Moderate'
              : 'Poor'}
          </Text>
          {weather.thermals.thermal_height_m && (
            <Text style={wStyles.thermalSub}>
              Ceiling ~{Math.round(weather.thermals.thermal_height_m)}m
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
  close: { color: '#6b7a99', fontSize: 18, paddingHorizontal: 4 },
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
  onInspect,
  onClose,
}: {
  mountains: Mountain[];
  onSelect: (m: Mountain) => void;
  onInspect: (m: Mountain) => void;
  onClose: () => void;
}) {
  return (
    <View style={mStyles.panel}>
      <View style={mStyles.header}>
        <Text style={mStyles.title}>Nearby Peaks ({mountains.length})</Text>
        <TouchableOpacity onPress={onClose}><Text style={mStyles.close}>✕</Text></TouchableOpacity>
      </View>
      <ScrollView style={mStyles.list} showsVerticalScrollIndicator={false}>
        {mountains.map((m) => (
          <View key={m.osm_id} style={mStyles.item}>
            <TouchableOpacity style={mStyles.itemContent} onPress={() => onSelect(m)}>
              <Text style={mStyles.name}>{m.name}</Text>
              <Text style={mStyles.meta}>
                {m.elevation ? `${Math.round(m.elevation)}m` : ''} {m.type}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={mStyles.inspectBtn} onPress={() => onInspect(m)}>
              <Text style={mStyles.inspectText}>3D</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const mStyles = StyleSheet.create({
  panel: { backgroundColor: '#1a2035', borderRadius: 12, margin: 10, maxHeight: 220, borderWidth: 1, borderColor: '#2a3050' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#2a3050' },
  title: { color: '#e8eaf6', fontWeight: '700', fontSize: 14 },
  close: { color: '#6b7a99', fontSize: 18, paddingHorizontal: 4 },
  list: { padding: 8 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#242d45' },
  itemContent: { flex: 1 },
  name: { color: '#e8eaf6', fontSize: 14, fontWeight: '600' },
  meta: { color: '#6b7a99', fontSize: 12, marginTop: 2 },
  inspectBtn: { backgroundColor: '#2d4a7a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  inspectText: { color: '#7eb8f7', fontSize: 11, fontWeight: '700' },
});

// ─── Globe Screen ───────────────────────────────────────────────────────────

export default function GlobeScreen() {
  const cesiumRef = useRef<CesiumViewRef>(null);

  // Settings
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

  // Enhanced features
  const [inspectingMountain, setInspectingMountain] = useState<Mountain | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayProgress, setReplayProgress] = useState(0);
  const [replayAltitude, setReplayAltitude] = useState(0);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Load settings
  useEffect(() => {
    (async () => {
      const [url, token, bm] = await Promise.all([
        AsyncStorage.getItem('@settings/apiUrl'),
        AsyncStorage.getItem('@settings/cesiumToken'),
        AsyncStorage.getItem('@bookmarks'),
      ]);
      if (url) setApiUrl(url);
      if (token) setCesiumToken(token);
      if (bm) {
        try { setBookmarks(JSON.parse(bm)); } catch { /* ignore */ }
      }
      setSettingsLoaded(true);
    })();
  }, []);

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

    if (msg.action === 'replayProgress') {
      setReplayProgress(msg.payload.progress);
      setReplayAltitude(msg.payload.altitude);
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!lastClickPos && !searchQuery) {
      Alert.alert('Select location', 'Tap a point on the map first.');
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
      Alert.alert('Search failed', String(e));
    } finally {
      setSearching(false);
    }
  }, [lastClickPos, searchQuery]);

  const handleMountainSelect = useCallback((m: Mountain) => {
    cesiumRef.current?.flyToLocation(m.lat, m.lon, (m.elevation ?? 1000) + 2500, 0, -35);
    setShowMountains(false);
  }, []);

  const handleMountainInspect = useCallback((m: Mountain) => {
    setInspectingMountain(m);
    setShowMountains(false);
    cesiumRef.current?.flyToLocation(m.lat, m.lon, (m.elevation ?? 1000) + 2500, 0, -35);
  }, []);

  const handleAnalysis = useCallback(async (type: 'slope' | 'aspect') => {
    if (!lastClickPos) {
      Alert.alert('Select area', 'Tap a mountain region first.');
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
      Alert.alert('Analysis failed', String(e));
    }
  }, [lastClickPos]);

  const handleMyLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      cesiumRef.current?.flyTo(loc.coords.latitude, loc.coords.longitude, 5000);
    } catch (e) {
      Alert.alert('Location error', String(e));
    }
  }, []);

  const handleAddBookmark = useCallback(async () => {
    if (!lastClickPos) {
      Alert.alert('Select location', 'Tap a point on the map first.');
      return;
    }
    const name = `Bookmark ${bookmarks.length + 1}`;
    const newBookmark: Bookmark = {
      id: `bm_${Date.now()}`,
      name,
      lat: lastClickPos.lat,
      lon: lastClickPos.lon,
      altitude: lastClickPos.elevation,
      heading: 0,
      pitch: -30,
      createdAt: new Date().toISOString(),
    };
    const updated = [...bookmarks, newBookmark];
    setBookmarks(updated);
    await AsyncStorage.setItem('@bookmarks', JSON.stringify(updated));
  }, [lastClickPos, bookmarks]);

  const handleBookmarkSelect = useCallback((bm: Bookmark) => {
    cesiumRef.current?.flyToLocation(bm.lat, bm.lon, bm.altitude + 2000, bm.heading, bm.pitch);
    setShowBookmarks(false);
  }, []);

  const handleBookmarkDelete = useCallback(async (id: string) => {
    const updated = bookmarks.filter((b) => b.id !== id);
    setBookmarks(updated);
    await AsyncStorage.setItem('@bookmarks', JSON.stringify(updated));
  }, [bookmarks]);

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
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search mountains..."
          placeholderTextColor="#4a5568"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator color="#7eb8f7" size="small" />
          ) : (
            <Text style={styles.searchBtnText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Right toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.toolBtn, analysisMode === 'slope' && styles.toolBtnActive]}
          onPress={() => {
            if (analysisMode === 'slope') { cesiumRef.current?.clearLayers(); setAnalysisMode(null); }
            else handleAnalysis('slope');
          }}
        >
          <Text style={styles.toolBtnText}>Slope</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolBtn, analysisMode === 'aspect' && styles.toolBtnActive]}
          onPress={() => {
            if (analysisMode === 'aspect') { cesiumRef.current?.clearLayers(); setAnalysisMode(null); }
            else handleAnalysis('aspect');
          }}
        >
          <Text style={styles.toolBtnText}>Aspect</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolBtn}
          onPress={() => {
            cesiumRef.current?.clearMarkers();
            cesiumRef.current?.clearLayers();
            cesiumRef.current?.stopOrbit();
            cesiumRef.current?.setTerrainExaggeration(1);
            setAnalysisMode(null);
            setShowMountains(false);
            setWeather(null);
            setInspectingMountain(null);
            setReplaying(false);
          }}
        >
          <Text style={styles.toolBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Left quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickBtn} onPress={handleMyLocation}>
          <Text style={styles.quickBtnText}>📍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickBtn} onPress={handleAddBookmark}>
          <Text style={styles.quickBtnText}>⭐</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickBtn, showBookmarks && styles.toolBtnActive]}
          onPress={() => setShowBookmarks(!showBookmarks)}
        >
          <Text style={styles.quickBtnText}>📋</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom overlays */}
      <View style={styles.overlays}>
        {loadingWeather && (
          <View style={styles.loadingBar}>
            <ActivityIndicator color="#7eb8f7" size="small" />
            <Text style={styles.loadingText}>Loading weather...</Text>
          </View>
        )}
        {weather && !loadingWeather && (
          <WeatherCard weather={weather} onClose={() => setWeather(null)} />
        )}
        {showMountains && (
          <MountainPanel
            mountains={mountains}
            onSelect={handleMountainSelect}
            onInspect={handleMountainInspect}
            onClose={() => setShowMountains(false)}
          />
        )}
        {inspectingMountain && (
          <MountainInspector
            mountainName={inspectingMountain.name}
            elevation={inspectingMountain.elevation}
            onOrbitStart={() => {
              cesiumRef.current?.orbitPeak(
                inspectingMountain.lat,
                inspectingMountain.lon,
                inspectingMountain.elevation ?? 0,
              );
            }}
            onOrbitStop={() => cesiumRef.current?.stopOrbit()}
            onLookAtFace={(heading) => {
              cesiumRef.current?.lookAtFace(
                inspectingMountain.lat,
                inspectingMountain.lon,
                inspectingMountain.elevation ?? 0,
                heading,
              );
            }}
            onTerrainExaggeration={(factor) => cesiumRef.current?.setTerrainExaggeration(factor)}
            onClose={() => {
              cesiumRef.current?.stopOrbit();
              cesiumRef.current?.setTerrainExaggeration(1);
              setInspectingMountain(null);
            }}
          />
        )}
        {replaying && (
          <ReplayControls
            progress={replayProgress}
            currentAltitude={replayAltitude}
            onSpeedChange={(speed) => cesiumRef.current?.setReplaySpeed(speed)}
            onTogglePause={() => cesiumRef.current?.toggleReplayPause()}
            onCameraModeChange={(mode) => cesiumRef.current?.setReplayCameraMode(mode)}
            onClose={() => setReplaying(false)}
          />
        )}
        {showBookmarks && (
          <BookmarkPanel
            bookmarks={bookmarks}
            onSelect={handleBookmarkSelect}
            onDelete={handleBookmarkDelete}
            onClose={() => setShowBookmarks(false)}
          />
        )}
      </View>

      {!ready && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#7eb8f7" size="large" />
          <Text style={styles.loadingOverlayText}>Loading 3D Globe...</Text>
          <Text style={styles.loadingOverlaySub}>First load may take a moment</Text>
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
    position: 'absolute', top: 12, left: 12, right: 12,
    flexDirection: 'row',
    backgroundColor: '#1a2035dd',
    borderRadius: 10, borderWidth: 1, borderColor: '#2a3050', overflow: 'hidden',
  },
  searchInput: { flex: 1, color: '#e8eaf6', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  searchBtn: { paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', backgroundColor: '#2d4a7a' },
  searchBtnText: { color: '#7eb8f7', fontWeight: '700', fontSize: 13 },
  toolbar: { position: 'absolute', top: 64, right: 12 },
  toolBtn: {
    backgroundColor: '#1a2035dd', paddingVertical: 7, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: '#2a3050', marginBottom: 6,
  },
  toolBtnActive: { borderColor: '#7eb8f7', backgroundColor: '#2d4a7a' },
  toolBtnText: { color: '#7eb8f7', fontSize: 12, fontWeight: '600' },
  quickActions: { position: 'absolute', top: 64, left: 12 },
  quickBtn: {
    backgroundColor: '#1a2035dd', width: 40, height: 40,
    borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2a3050', marginBottom: 6,
  },
  quickBtnText: { fontSize: 16 },
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
