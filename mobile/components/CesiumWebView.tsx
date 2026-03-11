import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// ─── Types ─────────────────────────────────────────────────────────────────

export type BridgeMessage =
  | { action: 'mapClick'; payload: { lat: number; lon: number; elevation: number } }
  | { action: 'peakSelected'; payload: { osmId: string; lat: number; lon: number; elevation: number } }
  | { action: 'cameraChanged'; payload: { lat: number; lon: number; altitude: number; heading: number; pitch: number } }
  | { action: 'cesiumReady'; payload: Record<string, never> }
  | { action: 'terrainExaggerationChanged'; payload: { factor: number } }
  | { action: 'measureStarted'; payload: { mode: string } }
  | { action: 'measurePointAdded'; payload: { index: number; lat: number; lon: number; elevation: number } }
  | { action: 'measureResult'; payload: { mode: string; distance_m?: number; area_m2?: number } };

export interface CesiumWebViewRef {
  // Camera
  flyTo(lat: number, lon: number, altitude?: number): void;
  flyToLocation(lat: number, lon: number, altitude?: number, heading?: number, pitch?: number): void;
  orbitAround(lat: number, lon: number, altitude?: number, radiusM?: number, durationSec?: number): void;

  // Markers
  addMarker(lat: number, lon: number, label: string, osmId?: string, elevation?: number): void;
  removeMarker(osmId: string): void;
  clearMarkers(): void;

  // Track loading
  loadTrack(geojsonFC: object, options?: { color?: string; width?: number; flyTo?: boolean }): void;
  loadTrack3D(geojsonFC: object, options?: { color?: string; flyTo?: boolean }): void;
  loadTrackColored(geojsonFC: object, options?: { width?: number; elevated?: boolean }): void;
  clearTracks(): void;

  // Overlay layers
  showOverlay(imageUrl: string | null, bbox?: number[]): void;
  showContourOverlay(imageUrl: string | null, bbox?: number[]): void;
  showSlopeLayer(tilesUrl: string | null): void;
  clearLayers(): void;

  // Terrain
  setTerrainExaggeration(factor: number): void;

  // Measurement
  startMeasure(mode: 'distance' | 'area'): void;
  finishMeasure(): void;
  cancelMeasure(): void;

  // Viewshed
  showViewshed(lat: number, lon: number, elevation: number, radiusM?: number): void;
  clearViewshed(): void;

  // Replay
  replayTrack(geojsonFC: object, opts?: { durationSec?: number; speed?: number; trailTime?: number; followCamera?: boolean }): void;
  stopReplay(): void;

  // Scene quality
  setSceneQuality(quality: 'low' | 'medium' | 'high'): void;
  setShadows(enabled: boolean): void;
}

interface Props {
  sourceUri: string;
  onMessage?: (msg: BridgeMessage) => void;
  onReady?: () => void;
  style?: object;
}

// ─── Component ─────────────────────────────────────────────────────────────

const CesiumWebView = forwardRef<CesiumWebViewRef, Props>(({ sourceUri, onMessage, onReady, style }, ref) => {
  const webViewRef = useRef<WebView>(null);

  const inject = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(`(function(){ try { ${js} } catch(e) { console.warn('[Bridge]', e); } })(); true;`);
  }, []);

  useImperativeHandle(ref, () => ({
    // Camera
    flyTo(lat, lon, altitude) {
      inject(`cesiumBridge.flyTo(${lat}, ${lon}, ${altitude ?? 5000});`);
    },
    flyToLocation(lat, lon, altitude, heading, pitch) {
      inject(`cesiumBridge.flyToLocation(${lat}, ${lon}, ${altitude ?? 3000}, ${heading ?? 0}, ${pitch ?? -30});`);
    },
    orbitAround(lat, lon, altitude, radiusM, durationSec) {
      inject(`cesiumBridge.orbitAround(${lat}, ${lon}, ${altitude ?? 2000}, ${radiusM ?? 3000}, ${durationSec ?? 20});`);
    },

    // Markers
    addMarker(lat, lon, label, osmId, elevation) {
      const id = osmId ? `'${osmId}'` : 'undefined';
      inject(`cesiumBridge.addMarker(${lat}, ${lon}, '${label.replace(/'/g, "\\'")}', ${id}, ${elevation ?? 0});`);
    },
    removeMarker(osmId) {
      inject(`cesiumBridge.removeMarker('${osmId}');`);
    },
    clearMarkers() {
      inject(`cesiumBridge.clearMarkers();`);
    },

    // Tracks
    loadTrack(geojsonFC, options) {
      const optsJson = options ? JSON.stringify(options) : '{}';
      inject(`cesiumBridge.loadTrack(${JSON.stringify(geojsonFC)}, ${optsJson});`);
    },
    loadTrack3D(geojsonFC, options) {
      const optsJson = options ? JSON.stringify(options) : '{}';
      inject(`cesiumBridge.loadTrack3D(${JSON.stringify(geojsonFC)}, ${optsJson});`);
    },
    loadTrackColored(geojsonFC, options) {
      const optsJson = options ? JSON.stringify(options) : '{}';
      inject(`cesiumBridge.loadTrackColored(${JSON.stringify(geojsonFC)}, ${optsJson});`);
    },
    clearTracks() {
      inject(`cesiumBridge.clearTracks();`);
    },

    // Overlays
    showOverlay(imageUrl, bbox) {
      if (!imageUrl) {
        inject(`cesiumBridge.showOverlay(null, null);`);
      } else {
        inject(`cesiumBridge.showOverlay('${imageUrl}', ${JSON.stringify(bbox)});`);
      }
    },
    showContourOverlay(imageUrl, bbox) {
      if (!imageUrl) {
        inject(`cesiumBridge.showContourOverlay(null, null);`);
      } else {
        inject(`cesiumBridge.showContourOverlay('${imageUrl}', ${JSON.stringify(bbox)});`);
      }
    },
    showSlopeLayer(tilesUrl) {
      inject(`cesiumBridge.showSlopeLayer(${tilesUrl ? `'${tilesUrl}'` : 'null'});`);
    },
    clearLayers() {
      inject(`cesiumBridge.clearLayers();`);
    },

    // Terrain
    setTerrainExaggeration(factor) {
      inject(`cesiumBridge.setTerrainExaggeration(${factor});`);
    },

    // Measurement
    startMeasure(mode) {
      inject(`cesiumBridge.startMeasure('${mode}');`);
    },
    finishMeasure() {
      inject(`cesiumBridge.finishMeasure();`);
    },
    cancelMeasure() {
      inject(`cesiumBridge.cancelMeasure();`);
    },

    // Viewshed
    showViewshed(lat, lon, elevation, radiusM) {
      inject(`cesiumBridge.showViewshed(${lat}, ${lon}, ${elevation}, ${radiusM ?? 5000});`);
    },
    clearViewshed() {
      inject(`cesiumBridge.clearViewshed();`);
    },

    // Replay
    replayTrack(geojsonFC, opts) {
      const optsJson = opts ? JSON.stringify(opts) : '{}';
      inject(`cesiumBridge.replayTrack(${JSON.stringify(geojsonFC)}, ${optsJson});`);
    },
    stopReplay() {
      inject(`cesiumBridge.stopReplay();`);
    },

    // Scene
    setSceneQuality(quality) {
      inject(`cesiumBridge.setSceneQuality('${quality}');`);
    },
    setShadows(enabled) {
      inject(`cesiumBridge.setShadows(${enabled});`);
    },
  }));

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const msg: BridgeMessage = JSON.parse(event.nativeEvent.data);
      if (msg.action === 'cesiumReady') onReady?.();
      onMessage?.(msg);
    } catch {
      // ignore non-JSON messages
    }
  }, [onMessage, onReady]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ uri: sourceUri }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        geolocationEnabled
        onError={(e) => console.warn('[CesiumWebView] error:', e.nativeEvent)}
      />
    </View>
  );
});

CesiumWebView.displayName = 'CesiumWebView';
export default CesiumWebView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
