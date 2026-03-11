// CesiumJS 3D Globe — Mountain Explorer
// Communicates with React Native via window.ReactNativeWebView.postMessage

(function () {
  'use strict';

  // ─── Cesium Ion token (set via bridge before init or use env) ─────────────
  Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || 'YOUR_CESIUM_ION_TOKEN_HERE';

  // ─── Viewer setup ──────────────────────────────────────────────────────────
  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain({
      requestWaterMask: true,
      requestVertexNormals: true,
    }),
    imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 }), // Bing Maps Aerial
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    scene3DOnly: true,
  });

  viewer.scene.globe.enableLighting = true;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.fog.enabled = true;

  // ─── State ─────────────────────────────────────────────────────────────────
  const markers = new Map();         // osmId → entity
  const trackDataSources = [];
  let slopeImageryLayer = null;
  let replayTimer = null;

  // ─── Bridge: React Native → Cesium ────────────────────────────────────────
  window.cesiumBridge = {
    setToken(token) {
      Cesium.Ion.defaultAccessToken = token;
    },

    flyTo(lat, lon, altitude) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude || 5000),
        orientation: { pitch: Cesium.Math.toRadians(-45) },
        duration: 2,
      });
    },

    flyToLocation(lat, lon, altitude, heading, pitch) {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude || 3000),
        orientation: {
          heading: Cesium.Math.toRadians(heading || 0),
          pitch: Cesium.Math.toRadians(pitch || -30),
          roll: 0,
        },
        duration: 2,
      });
    },

    addMarker(lat, lon, label, osmId, elevation) {
      const id = osmId || `marker_${Date.now()}`;
      if (markers.has(id)) viewer.entities.remove(markers.get(id));

      const entity = viewer.entities.add({
        id,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, elevation || 0),
        billboard: {
          image: _createPinCanvas(label),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: label,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, -36),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      markers.set(id, entity);
      return id;
    },

    removeMarker(osmId) {
      if (markers.has(osmId)) {
        viewer.entities.remove(markers.get(osmId));
        markers.delete(osmId);
      }
    },

    clearMarkers() {
      markers.forEach((entity) => viewer.entities.remove(entity));
      markers.clear();
    },

    loadTrack(geojsonFC, options) {
      const opts = options || {};
      const color = opts.color
        ? Cesium.Color.fromCssColorString(opts.color)
        : Cesium.Color.fromRandom({ alpha: 1 });

      Cesium.GeoJsonDataSource.load(geojsonFC, {
        stroke: color,
        strokeWidth: opts.width || 3,
        clampToGround: true,
      }).then((ds) => {
        viewer.dataSources.add(ds);
        trackDataSources.push(ds);
        if (opts.flyTo !== false) viewer.flyTo(ds);
      });
    },

    clearTracks() {
      trackDataSources.forEach((ds) => viewer.dataSources.remove(ds, true));
      trackDataSources.length = 0;
    },

    showSlopeLayer(tilesUrl) {
      if (slopeImageryLayer) {
        viewer.imageryLayers.remove(slopeImageryLayer);
        slopeImageryLayer = null;
      }
      if (!tilesUrl) return;
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: tilesUrl,
        maximumLevel: 14,
        minimumLevel: 5,
      });
      slopeImageryLayer = viewer.imageryLayers.addImageryProvider(provider);
      slopeImageryLayer.alpha = 0.6;
    },

    clearLayers() {
      if (slopeImageryLayer) {
        viewer.imageryLayers.remove(slopeImageryLayer);
        slopeImageryLayer = null;
      }
    },

    setTime(isoString) {
      viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(isoString);
    },

    replayTrack(geojsonFC, opts) {
      // Animated replay along a track using Cesium CZML
      const coords = geojsonFC.features
        .flatMap((f) => {
          if (f.geometry.type === 'LineString') return f.geometry.coordinates;
          if (f.geometry.type === 'MultiLineString')
            return f.geometry.coordinates.flat();
          return [];
        });

      if (!coords.length) return;

      const czml = _buildCzmlFromCoords(coords, opts || {});
      const ds = new Cesium.CzmlDataSource();
      ds.load(czml).then(() => {
        viewer.dataSources.add(ds);
        trackDataSources.push(ds);
        viewer.clock.shouldAnimate = true;
        viewer.flyTo(ds);
      });
    },

    getCamera() {
      const pos = viewer.camera.positionCartographic;
      return {
        lat: Cesium.Math.toDegrees(pos.latitude),
        lon: Cesium.Math.toDegrees(pos.longitude),
        altitude: pos.height,
        heading: Cesium.Math.toDegrees(viewer.camera.heading),
        pitch: Cesium.Math.toDegrees(viewer.camera.pitch),
      };
    },
  };

  // ─── Click handler ─────────────────────────────────────────────────────────
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(async (click) => {
    const ray = viewer.camera.getPickRay(click.position);
    const cartesian = await viewer.scene.globe.pick(ray, viewer.scene);
    if (!cartesian) return;

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const elevation = carto.height;

    _postToRN({ action: 'mapClick', payload: { lat, lon, elevation } });

    // Check if a peak entity was clicked
    const picked = viewer.scene.pick(click.position);
    if (picked && picked.id && picked.id.id) {
      const osmId = picked.id.id;
      if (markers.has(osmId)) {
        _postToRN({ action: 'peakSelected', payload: { osmId, lat, lon, elevation } });
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // Camera change (throttled)
  let camTimer = null;
  viewer.camera.changed.addEventListener(() => {
    if (camTimer) return;
    camTimer = setTimeout(() => {
      camTimer = null;
      const cam = window.cesiumBridge.getCamera();
      _postToRN({ action: 'cameraChanged', payload: cam });
    }, 300);
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────
  function _postToRN(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else {
      console.log('[Bridge →RN]', msg);
    }
  }

  function _createPinCanvas(label) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');

    // Pin body
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pin tail
    ctx.beginPath();
    ctx.moveTo(10, 26);
    ctx.lineTo(16, 40);
    ctx.lineTo(22, 26);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();

    // Mountain icon (simple triangle)
    ctx.beginPath();
    ctx.moveTo(16, 6);
    ctx.lineTo(8, 22);
    ctx.lineTo(24, 22);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();

    return canvas.toDataURL();
  }

  function _buildCzmlFromCoords(coords, opts) {
    const durationSec = opts.durationSec || 60;
    const start = Cesium.JulianDate.now();
    const stop = Cesium.JulianDate.addSeconds(start, durationSec, new Cesium.JulianDate());

    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = start.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = 1;

    const interval = durationSec / (coords.length - 1);
    const cartesian = [];

    coords.forEach((c, i) => {
      const t = Cesium.JulianDate.addSeconds(start, i * interval, new Cesium.JulianDate());
      cartesian.push(Cesium.JulianDate.toIso8601(t));
      cartesian.push(c[0], c[1], c[2] || 0);
    });

    return [
      { id: 'document', name: 'Track Replay', version: '1.0', clock: {
        interval: `${Cesium.JulianDate.toIso8601(start)}/${Cesium.JulianDate.toIso8601(stop)}`,
        currentTime: Cesium.JulianDate.toIso8601(start),
        multiplier: 1,
      }},
      {
        id: 'track_replay',
        availability: `${Cesium.JulianDate.toIso8601(start)}/${Cesium.JulianDate.toIso8601(stop)}`,
        position: { cartographicDegrees: cartesian },
        point: { pixelSize: 10, color: { rgba: [255, 100, 50, 255] } },
        path: {
          material: { polylineGlow: { color: { rgba: [255, 100, 50, 200] }, glowPower: 0.2 } },
          width: 4,
          trailTime: 30,
          leadTime: 0,
        },
      },
    ];
  }

  // Signal ready to React Native
  _postToRN({ action: 'cesiumReady', payload: {} });
})();
