import React, { useRef, useCallback, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { BridgeMessage } from '../../shared/types';

export interface CesiumViewRef {
  flyTo(lat: number, lon: number, altitude?: number): void;
  flyToLocation(lat: number, lon: number, altitude?: number, heading?: number, pitch?: number): void;
  addMarker(lat: number, lon: number, label: string, osmId?: string, elevation?: number): void;
  removeMarker(osmId: string): void;
  clearMarkers(): void;
  loadTrack(geojsonFC: object, options?: { color?: string; width?: number; flyTo?: boolean }): void;
  loadTrack3D(geojsonFC: object, options?: { color?: string; width?: number; flyTo?: boolean; colorBy?: string }): void;
  clearTracks(): void;
  showSlopeLayer(tilesUrl: string | null): void;
  clearLayers(): void;
  replayTrack(geojsonFC: object, opts?: { durationSec?: number }): void;
  orbitPeak(lat: number, lon: number, elevation: number, radius?: number): void;
  stopOrbit(): void;
  setTerrainExaggeration(factor: number): void;
  lookAtFace(lat: number, lon: number, elevation: number, heading: number): void;
  setReplaySpeed(speed: number): void;
  toggleReplayPause(): void;
  setReplayCameraMode(mode: string): void;
}

interface Props {
  sourceUri: string;
  onMessage?: (msg: BridgeMessage) => void;
  onReady?: () => void;
  style?: object;
}

/**
 * Web-specific CesiumJS component — renders Cesium directly in an iframe.
 * The iframe loads the same cesium-app.js HTML page from the backend,
 * and communicates via postMessage instead of ReactNativeWebView.
 */
const CesiumWebViewWeb = forwardRef<CesiumViewRef, Props>(({ sourceUri, onMessage, onReady, style }, ref) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  const postToIframe = useCallback((js: string) => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'cesiumExec', code: js }, '*');
    }
  }, []);

  // Listen for messages from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        try {
          const msg: BridgeMessage = JSON.parse(event.data);
          if (msg.action === 'cesiumReady') {
            setReady(true);
            onReady?.();
          }
          onMessage?.(msg);
        } catch {
          // ignore non-JSON
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMessage, onReady]);

  useImperativeHandle(ref, () => ({
    flyTo(lat, lon, altitude) {
      postToIframe(`cesiumBridge.flyTo(${lat}, ${lon}, ${altitude ?? 5000});`);
    },
    flyToLocation(lat, lon, altitude, heading, pitch) {
      postToIframe(`cesiumBridge.flyToLocation(${lat}, ${lon}, ${altitude ?? 3000}, ${heading ?? 0}, ${pitch ?? -30});`);
    },
    addMarker(lat, lon, label, osmId, elevation) {
      const id = osmId ? `'${osmId}'` : 'undefined';
      postToIframe(`cesiumBridge.addMarker(${lat}, ${lon}, '${label.replace(/'/g, "\\'")}', ${id}, ${elevation ?? 0});`);
    },
    removeMarker(osmId) {
      postToIframe(`cesiumBridge.removeMarker('${osmId}');`);
    },
    clearMarkers() {
      postToIframe(`cesiumBridge.clearMarkers();`);
    },
    loadTrack(geojsonFC, options) {
      const optsJson = options ? JSON.stringify(options) : '{}';
      postToIframe(`cesiumBridge.loadTrack(${JSON.stringify(geojsonFC)}, ${optsJson});`);
    },
    loadTrack3D(geojsonFC, options) {
      const optsJson = options ? JSON.stringify(options) : '{}';
      postToIframe(`cesiumBridge.loadTrack3D(${JSON.stringify(geojsonFC)}, ${optsJson});`);
    },
    clearTracks() {
      postToIframe(`cesiumBridge.clearTracks();`);
    },
    showSlopeLayer(tilesUrl) {
      postToIframe(`cesiumBridge.showSlopeLayer(${tilesUrl ? `'${tilesUrl}'` : 'null'});`);
    },
    clearLayers() {
      postToIframe(`cesiumBridge.clearLayers();`);
    },
    replayTrack(geojsonFC, opts) {
      const optsJson = opts ? JSON.stringify(opts) : '{}';
      postToIframe(`cesiumBridge.replayTrack(${JSON.stringify(geojsonFC)}, ${optsJson});`);
    },
    orbitPeak(lat, lon, elevation, radius) {
      postToIframe(`cesiumBridge.orbitPeak(${lat}, ${lon}, ${elevation}, ${radius ?? 3000});`);
    },
    stopOrbit() {
      postToIframe(`cesiumBridge.stopOrbit();`);
    },
    setTerrainExaggeration(factor) {
      postToIframe(`cesiumBridge.setTerrainExaggeration(${factor});`);
    },
    lookAtFace(lat, lon, elevation, heading) {
      postToIframe(`cesiumBridge.lookAtFace(${lat}, ${lon}, ${elevation}, ${heading});`);
    },
    setReplaySpeed(speed) {
      postToIframe(`cesiumBridge.setReplaySpeed(${speed});`);
    },
    toggleReplayPause() {
      postToIframe(`cesiumBridge.toggleReplayPause();`);
    },
    setReplayCameraMode(mode) {
      postToIframe(`cesiumBridge.setReplayCameraMode('${mode}');`);
    },
  }));

  return (
    <View style={[styles.container, style]}>
      <iframe
        ref={iframeRef}
        src={sourceUri}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#0a0f1e',
        }}
        allow="geolocation; fullscreen"
        title="CesiumJS 3D Globe"
      />
    </View>
  );
});

CesiumWebViewWeb.displayName = 'CesiumView';
export default CesiumWebViewWeb;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1e',
  },
});
