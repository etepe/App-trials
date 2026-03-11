// CesiumJS 3D Globe — Mountain Explorer
// Communicates with React Native via window.ReactNativeWebView.postMessage
// Communicates with Web via window.parent.postMessage

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
  let orbitHandler = null;
  let replayTimer = null;
  let replayPaused = false;
  let replaySpeed = 1;
  let replayCameraMode = 'free'; // 'free' | 'chase' | 'birdseye'

  // ─── Bridge: React Native / Web → Cesium ─────────────────────────────────
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

    // ─── 3D Track rendering (not clamped to ground) ─────────────────────
    loadTrack3D(geojsonFC, options) {
      const opts = options || {};
      const colorBy = opts.colorBy || 'altitude'; // 'altitude' | 'speed' | 'vario' | 'solid'
      const baseColor = opts.color
        ? Cesium.Color.fromCssColorString(opts.color)
        : Cesium.Color.CYAN;

      const features = geojsonFC.features || [];
      features.forEach((feature) => {
        if (!feature.geometry) return;
        let coordArrays = [];
        if (feature.geometry.type === 'LineString') {
          coordArrays = [feature.geometry.coordinates];
        } else if (feature.geometry.type === 'MultiLineString') {
          coordArrays = feature.geometry.coordinates;
        }

        coordArrays.forEach((coords) => {
          if (coords.length < 2) return;

          if (colorBy === 'solid') {
            // Simple solid-color 3D polyline
            const positions = coords.map((c) => Cesium.Cartesian3.fromDegrees(c[0], c[1], c[2] || 0));
            viewer.entities.add({
              polyline: {
                positions,
                width: opts.width || 3,
                material: baseColor,
              },
            });
          } else {
            // Color gradient segments
            const alts = coords.map((c) => c[2] || 0);
            const minAlt = Math.min(...alts);
            const maxAlt = Math.max(...alts);
            const altRange = maxAlt - minAlt || 1;

            for (let i = 0; i < coords.length - 1; i++) {
              const t = (alts[i] - minAlt) / altRange;
              const segColor = _altitudeColor(t);

              viewer.entities.add({
                polyline: {
                  positions: [
                    Cesium.Cartesian3.fromDegrees(coords[i][0], coords[i][1], coords[i][2] || 0),
                    Cesium.Cartesian3.fromDegrees(coords[i + 1][0], coords[i + 1][1], coords[i + 1][2] || 0),
                  ],
                  width: opts.width || 3,
                  material: segColor,
                },
              });
            }
          }
        });
      });

      if (opts.flyTo !== false && features.length > 0) {
        const allCoords = features.flatMap((f) => {
          if (f.geometry.type === 'LineString') return f.geometry.coordinates;
          if (f.geometry.type === 'MultiLineString') return f.geometry.coordinates.flat();
          return [];
        });
        if (allCoords.length > 0) {
          const lats = allCoords.map((c) => c[1]);
          const lons = allCoords.map((c) => c[0]);
          const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          const centerLon = (Math.min(...lons) + Math.max(...lons)) / 2;
          const maxAlt = Math.max(...allCoords.map((c) => c[2] || 0));
          window.cesiumBridge.flyToLocation(centerLat, centerLon, maxAlt + 2000, 0, -45);
        }
      }
    },

    showTrackWaypoints(waypoints) {
      (waypoints || []).forEach((wp) => {
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(wp.lon, wp.lat, wp.altitude || 0),
          point: { pixelSize: 8, color: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
          label: {
            text: wp.name || '',
            font: '11px sans-serif',
            fillColor: Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -14),
          },
        });
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

    // ─── Mountain face inspection ───────────────────────────────────────

    orbitPeak(lat, lon, elevation, radius) {
      window.cesiumBridge.stopOrbit();
      radius = radius || 3000;
      const center = Cesium.Cartesian3.fromDegrees(lon, lat, elevation || 0);
      let heading = 0;

      // Position camera looking at the peak
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, (elevation || 0) + radius),
        orientation: {
          heading: Cesium.Math.toRadians(heading),
          pitch: Cesium.Math.toRadians(-30),
          roll: 0,
        },
        duration: 1.5,
        complete: function () {
          // Start orbit animation
          orbitHandler = viewer.clock.onTick.addEventListener(() => {
            heading = (heading + 0.3) % 360;
            const headingRad = Cesium.Math.toRadians(heading);
            const pitchRad = Cesium.Math.toRadians(-30);

            const offset = new Cesium.HeadingPitchRange(headingRad, pitchRad, radius);
            viewer.camera.lookAt(center, offset);

            _postToRN({
              action: 'orbitUpdate',
              payload: { heading: heading, progress: heading / 360 },
            });
          });
        },
      });
    },

    stopOrbit() {
      if (orbitHandler) {
        orbitHandler();
        orbitHandler = null;
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      }
    },

    setTerrainExaggeration(factor) {
      viewer.scene.globe.terrainExaggeration = Math.max(1, Math.min(5, factor));
    },

    lookAtFace(lat, lon, elevation, heading) {
      const distance = 2000;
      const center = Cesium.Cartesian3.fromDegrees(lon, lat, elevation || 0);
      const offset = new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(heading || 0),
        Cesium.Math.toRadians(-20),
        distance
      );
      viewer.camera.flyTo({
        destination: center,
        duration: 2,
        complete: function () {
          viewer.camera.lookAt(center, offset);
          // Release lookAt after settling
          setTimeout(() => {
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
          }, 100);
        },
      });
    },

    getTerrainHeight(lat, lon) {
      const positions = [Cesium.Cartographic.fromDegrees(lon, lat)];
      Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, positions).then((updated) => {
        _postToRN({
          action: 'terrainHeight',
          payload: { lat, lon, height: updated[0].height },
        });
      });
    },

    // ─── Enhanced replay ────────────────────────────────────────────────

    replayTrack(geojsonFC, opts) {
      const coords = geojsonFC.features
        .flatMap((f) => {
          if (f.geometry.type === 'LineString') return f.geometry.coordinates;
          if (f.geometry.type === 'MultiLineString')
            return f.geometry.coordinates.flat();
          return [];
        });

      if (!coords.length) return;

      replayPaused = false;
      replaySpeed = opts?.speed || 1;
      replayCameraMode = opts?.cameraMode || 'free';

      const czml = _buildCzmlFromCoords(coords, opts || {});
      const ds = new Cesium.CzmlDataSource();
      ds.load(czml).then(() => {
        viewer.dataSources.add(ds);
        trackDataSources.push(ds);
        viewer.clock.shouldAnimate = true;
        viewer.clock.multiplier = replaySpeed;
        viewer.flyTo(ds);

        // Track replay progress
        const totalDur = (opts?.durationSec || 60);
        const startTime = viewer.clock.startTime.clone();
        if (replayTimer) clearInterval(replayTimer);
        replayTimer = setInterval(() => {
          if (replayPaused) return;
          const elapsed = Cesium.JulianDate.secondsDifference(viewer.clock.currentTime, startTime);
          const progress = Math.min(1, elapsed / totalDur);
          const idx = Math.floor(progress * (coords.length - 1));
          const currentCoord = coords[Math.min(idx, coords.length - 1)];
          _postToRN({
            action: 'replayProgress',
            payload: {
              progress,
              currentIndex: idx,
              speed: replaySpeed,
              altitude: currentCoord[2] || 0,
            },
          });
          if (progress >= 1) clearInterval(replayTimer);
        }, 200);
      });
    },

    setReplaySpeed(speed) {
      replaySpeed = speed;
      viewer.clock.multiplier = speed;
    },

    toggleReplayPause() {
      replayPaused = !replayPaused;
      viewer.clock.shouldAnimate = !replayPaused;
    },

    setReplayCameraMode(mode) {
      replayCameraMode = mode;
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

  // ─── Web postMessage listener (for iframe communication) ──────────────────
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'cesiumExec' && event.data.code) {
      try {
        new Function(event.data.code)();
      } catch (e) {
        console.warn('[Bridge] exec error:', e);
      }
    }
  });

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
    const json = JSON.stringify(msg);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(json);
    } else if (window.parent !== window) {
      // Web iframe mode — post to parent
      window.parent.postMessage(json, '*');
    } else {
      console.log('[Bridge →]', msg);
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

  function _altitudeColor(t) {
    // Gradient: blue (low) → green → yellow → red (high)
    if (t < 0.25) {
      return Cesium.Color.fromCssColorString(_lerpHex('#2196F3', '#4CAF50', t / 0.25));
    } else if (t < 0.5) {
      return Cesium.Color.fromCssColorString(_lerpHex('#4CAF50', '#FFEB3B', (t - 0.25) / 0.25));
    } else if (t < 0.75) {
      return Cesium.Color.fromCssColorString(_lerpHex('#FFEB3B', '#FF9800', (t - 0.5) / 0.25));
    } else {
      return Cesium.Color.fromCssColorString(_lerpHex('#FF9800', '#F44336', (t - 0.75) / 0.25));
    }
  }

  function _lerpHex(c1, c2, t) {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  function _buildCzmlFromCoords(coords, opts) {
    const durationSec = opts.durationSec || 60;
    const start = Cesium.JulianDate.now();
    const stop = Cesium.JulianDate.addSeconds(start, durationSec, new Cesium.JulianDate());

    viewer.clock.startTime = start.clone();
    viewer.clock.stopTime = stop.clone();
    viewer.clock.currentTime = start.clone();
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
    viewer.clock.multiplier = replaySpeed;

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
        multiplier: replaySpeed,
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

  // Signal ready
  _postToRN({ action: 'cesiumReady', payload: {} });
})();
