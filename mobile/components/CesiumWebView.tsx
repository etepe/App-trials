import React, { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

// ─── Types ─────────────────────────────────────────────────────────────────

export type BridgeMessage =
  | { action: 'mapClick'; payload: { lat: number; lon: number; elevation: number } }
  | { action: 'peakSelected'; payload: { osmId: string; lat: number; lon: number; elevation: number } }
  | { action: 'cameraChanged'; payload: { lat: number; lon: number; altitude: number; heading: number; pitch: number } }
  | { action: 'cesiumReady'; payload: Record<string, never> };

export interface CesiumWebViewRef {
  flyTo(lat: number, lon: number, altitude?: number): void;
  flyToLocation(lat: number, lon: number, altitude?: number, heading?: number, pitch?: number): void;
  addMarker(lat: number, lon: number, label: string, osmId?: string, elevation?: number): void;
  removeMarker(osmId: string): void;
  clearMarkers(): void;
  loadTrack(geojsonFC: object, options?: { color?: string; width?: number; flyTo?: boolean }): void;
  clearTracks(): void;
  showSlopeLayer(tilesUrl: string | null): void;
  clearLayers(): void;
  replayTrack(geojsonFC: object, opts?: { durationSec?: number }): void;
  setToken(token: string): void;
}

interface Props {
  onMessage?: (msg: BridgeMessage) => void;
  onReady?: () => void;
  style?: object;
}

// ─── Component ─────────────────────────────────────────────────────────────

const CesiumWebView = forwardRef<CesiumWebViewRef, Props>(({ onMessage, onReady, style }, ref) => {
  const webViewRef = useRef<WebView>(null);

  // Inject a JS call into the CesiumJS context
  const inject = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(`(function(){ try { ${js} } catch(e) { console.warn('[Bridge]', e); } })(); true;`);
  }, []);

  // Expose bridge methods to parent components
  useImperativeHandle(ref, () => ({
    flyTo(lat, lon, altitude) {
      inject(`cesiumBridge.flyTo(${lat}, ${lon}, ${altitude ?? 5000});`);
    },
    flyToLocation(lat, lon, altitude, heading, pitch) {
      inject(`cesiumBridge.flyToLocation(${lat}, ${lon}, ${altitude ?? 3000}, ${heading ?? 0}, ${pitch ?? -30});`);
    },
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
    loadTrack(geojsonFC, options) {
      const optsJson = options ? JSON.stringify(options) : '{}';
      inject(`cesiumBridge.loadTrack(${JSON.stringify(geojsonFC)}, ${optsJson});`);
    },
    clearTracks() {
      inject(`cesiumBridge.clearTracks();`);
    },
    showSlopeLayer(tilesUrl) {
      inject(`cesiumBridge.showSlopeLayer(${tilesUrl ? `'${tilesUrl}'` : 'null'});`);
    },
    clearLayers() {
      inject(`cesiumBridge.clearLayers();`);
    },
    replayTrack(geojsonFC, opts) {
      const optsJson = opts ? JSON.stringify(opts) : '{}';
      inject(`cesiumBridge.replayTrack(${JSON.stringify(geojsonFC)}, ${optsJson});`);
    },
    setToken(token) {
      inject(`cesiumBridge.setToken('${token}');`);
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

  // Determine source: on web use uri, on native use bundled HTML
  const source = Platform.select({
    web: { uri: '/cesium/index.html' },
    default: { uri: 'file:///android_asset/cesium/index.html' }, // overridden by asset bundling
  });

  // For native, use the bundled HTML file from the cesium/ directory
  const nativeSource =
    Platform.OS === 'ios'
      ? require('../cesium/index.html')
      : { uri: 'file:///android_asset/cesium/index.html' };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={Platform.OS === 'ios' ? nativeSource : source}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        geolocationEnabled
        // iOS: allow local file access
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        // Android: allow asset loading
        androidLayerType="hardware"
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
