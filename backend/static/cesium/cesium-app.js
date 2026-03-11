// CesiumJS 3D Globe — Mountain Explorer (Enhanced)
// Communicates with React Native via window.ReactNativeWebView.postMessage

(function () {
  'use strict';

  // ─── Cesium Ion token ─────────────────────────────────────────────────────
  Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN || 'YOUR_CESIUM_ION_TOKEN_HERE';

  // ─── Viewer setup ──────────────────────────────────────────────────────────
  const viewer = new Cesium.Viewer('cesiumContainer', {
    terrainProvider: Cesium.createWorldTerrain({
      requestWaterMask: true,
      requestVertexNormals: true,
    }),
    imageryProvider: new Cesium.IonImageryProvider({ assetId: 2 }),
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
    shadows: true,
    terrainShadows: Cesium.ShadowMode.RECEIVE_ONLY,
  });

  // ─── Enhanced scene settings ──────────────────────────────────────────────
  const scene = viewer.scene;
  const globe = scene.globe;

  globe.enableLighting = true;
  globe.depthTestAgainstTerrain = true;
  globe.showGroundAtmosphere = true;
  globe.showWaterEffect = true;

  scene.skyAtmosphere.show = true;
  scene.fog.enabled = true;
  scene.fog.density = 2.0e-4;
  scene.fog.minimumBrightness = 0.03;

  // Anti-aliasing
  scene.postProcessStages.fxaa.enabled = true;

  // ─── State ─────────────────────────────────────────────────────────────────
  const markers = new Map();
  const trackDataSources = [];
  let overlayLayer = null;
  let contourLayer = null;
  let replayDataSource = null;
  let measureEntities = [];
  let measurePoints = [];
  let measureMode = null; // 'distance' | 'area' | null
  let viewshedPrimitive = null;
  let terrainExaggeration = 1.0;

  // ─── Bridge: React Native → Cesium ────────────────────────────────────────
  window.cesiumBridge = {
    setToken(token) {
      Cesium.Ion.defaultAccessToken = token;
    },

    // ── Camera controls ────────────────────────────────────────────────────
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

    orbitAround(lat, lon, altitude, radiusM, durationSec) {
      const center = Cesium.Cartesian3.fromDegrees(lon, lat, altitude || 2000);
      const radius = radiusM || 3000;
      const duration = durationSec || 20;
      const steps = 120;
      const interval = (duration * 1000) / steps;
      let step = 0;

      const timer = setInterval(() => {
        if (step >= steps) {
          clearInterval(timer);
          return;
        }
        const angle = (step / steps) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        const offset = new Cesium.Cartesian3(x, y, altitude || 2000);
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(
          Cesium.Cartesian3.fromDegrees(lon, lat, 0)
        );
        const position = Cesium.Matrix4.multiplyByPoint(
          transform, offset, new Cesium.Cartesian3()
        );

        viewer.camera.lookAt(
          center,
          new Cesium.HeadingPitchRange(angle, Cesium.Math.toRadians(-35), radius)
        );
        step++;
      }, interval);
    },

    // ── Terrain Exaggeration ───────────────────────────────────────────────
    setTerrainExaggeration(factor) {
      terrainExaggeration = Math.max(1, Math.min(factor, 10));
      globe.terrainExaggeration = terrainExaggeration;
      globe.terrainExaggerationRelativeHeight = 0;
      _postToRN({
        action: 'terrainExaggerationChanged',
        payload: { factor: terrainExaggeration },
      });
    },

    getTerrainExaggeration() {
      return terrainExaggeration;
    },

    // ── Markers ─────────────────────────────────────────────────────────────
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
          scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 50000, 0.4),
        },
        label: {
          text: label,
          font: '13px "Segoe UI", sans-serif',
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          pixelOffset: new Cesium.Cartesian2(0, -40),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(500, 1.0, 50000, 0.4),
          showBackground: true,
          backgroundColor: new Cesium.Color(0.1, 0.12, 0.2, 0.7),
          backgroundPadding: new Cesium.Cartesian2(6, 3),
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

    // ── Track loading (2D clamped to ground) ─────────────────────────────
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

    // ── 3D Track Wall (elevation ribbon from track to ground) ─────────────
    loadTrack3D(geojsonFC, options) {
      const opts = options || {};
      const coords = _extractCoordsFromGeoJSON(geojsonFC);
      if (!coords.length) return;

      const color = opts.color
        ? Cesium.Color.fromCssColorString(opts.color)
        : Cesium.Color.CYAN;

      // Track line at actual elevation
      const positions = coords.map((c) =>
        Cesium.Cartesian3.fromDegrees(c[0], c[1], c[2] || 0)
      );

      // Wall from track to ground
      const wallPositions = coords.map((c) =>
        Cesium.Cartographic.fromDegrees(c[0], c[1])
      );

      const entity = viewer.entities.add({
        polyline: {
          positions: positions,
          width: 4,
          material: new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.25,
            color: color,
          }),
          clampToGround: false,
        },
        wall: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights(
            coords.flatMap((c) => [c[0], c[1], c[2] || 0])
          ),
          minimumHeights: new Array(coords.length).fill(0),
          material: color.withAlpha(0.25),
        },
      });

      // Ground shadow line
      const groundEntity = viewer.entities.add({
        polyline: {
          positions: positions,
          width: 2,
          material: Cesium.Color.BLACK.withAlpha(0.4),
          clampToGround: true,
        },
      });

      trackDataSources.push({ _entities: [entity, groundEntity], _isManual: true });
      if (opts.flyTo !== false) viewer.flyTo(entity);
    },

    // ── Elevation-colored track ────────────────────────────────────────────
    loadTrackColored(geojsonFC, options) {
      const opts = options || {};
      const coords = _extractCoordsFromGeoJSON(geojsonFC);
      if (coords.length < 2) return;

      const elevations = coords.map((c) => c[2] || 0);
      const minElev = Math.min(...elevations);
      const maxElev = Math.max(...elevations);
      const range = maxElev - minElev || 1;

      // Create segments with gradient colors
      const segmentSize = Math.max(1, Math.floor(coords.length / 50));

      for (let i = 0; i < coords.length - segmentSize; i += segmentSize) {
        const segCoords = coords.slice(i, i + segmentSize + 1);
        const avgElev = segCoords.reduce((s, c) => s + (c[2] || 0), 0) / segCoords.length;
        const t = (avgElev - minElev) / range;

        // Blue (low) → Green (mid) → Red (high)
        const color = t < 0.5
          ? Cesium.Color.lerp(Cesium.Color.BLUE, Cesium.Color.GREEN, t * 2, new Cesium.Color())
          : Cesium.Color.lerp(Cesium.Color.GREEN, Cesium.Color.RED, (t - 0.5) * 2, new Cesium.Color());

        const positions = segCoords.map((c) =>
          Cesium.Cartesian3.fromDegrees(c[0], c[1], c[2] || 0)
        );

        const entity = viewer.entities.add({
          polyline: {
            positions: positions,
            width: opts.width || 5,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.15,
              color: color,
            }),
            clampToGround: !opts.elevated,
          },
        });
        trackDataSources.push({ _entities: [entity], _isManual: true });
      }
    },

    clearTracks() {
      trackDataSources.forEach((ds) => {
        if (ds._isManual) {
          ds._entities.forEach((e) => viewer.entities.remove(e));
        } else {
          viewer.dataSources.remove(ds, true);
        }
      });
      trackDataSources.length = 0;
    },

    // ── Overlay layers (slope/aspect/contour images) ──────────────────────
    showOverlay(imageUrl, bbox) {
      if (overlayLayer) {
        viewer.imageryLayers.remove(overlayLayer);
        overlayLayer = null;
      }
      if (!imageUrl || !bbox) return;

      const [minLon, minLat, maxLon, maxLat] = bbox;
      const provider = new Cesium.SingleTileImageryProvider({
        url: imageUrl,
        rectangle: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
      });
      overlayLayer = viewer.imageryLayers.addImageryProvider(provider);
      overlayLayer.alpha = 0.65;
    },

    showContourOverlay(imageUrl, bbox) {
      if (contourLayer) {
        viewer.imageryLayers.remove(contourLayer);
        contourLayer = null;
      }
      if (!imageUrl || !bbox) return;

      const [minLon, minLat, maxLon, maxLat] = bbox;
      const provider = new Cesium.SingleTileImageryProvider({
        url: imageUrl,
        rectangle: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
      });
      contourLayer = viewer.imageryLayers.addImageryProvider(provider);
      contourLayer.alpha = 0.8;
    },

    // Legacy support
    showSlopeLayer(tilesUrl) {
      // Kept for backwards compatibility
      if (overlayLayer) {
        viewer.imageryLayers.remove(overlayLayer);
        overlayLayer = null;
      }
      if (!tilesUrl) return;
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: tilesUrl,
        maximumLevel: 14,
        minimumLevel: 5,
      });
      overlayLayer = viewer.imageryLayers.addImageryProvider(provider);
      overlayLayer.alpha = 0.6;
    },

    clearLayers() {
      if (overlayLayer) {
        viewer.imageryLayers.remove(overlayLayer);
        overlayLayer = null;
      }
      if (contourLayer) {
        viewer.imageryLayers.remove(contourLayer);
        contourLayer = null;
      }
    },

    // ── Measurement tools ──────────────────────────────────────────────────
    startMeasure(mode) {
      // mode: 'distance' or 'area'
      measureMode = mode;
      measurePoints = [];
      _clearMeasureEntities();
      _postToRN({ action: 'measureStarted', payload: { mode } });
    },

    finishMeasure() {
      if (!measureMode) return;

      let result = {};
      if (measureMode === 'distance' && measurePoints.length >= 2) {
        let totalDist = 0;
        for (let i = 1; i < measurePoints.length; i++) {
          totalDist += Cesium.Cartesian3.distance(
            measurePoints[i - 1].cartesian,
            measurePoints[i].cartesian
          );
        }
        result = { distance_m: Math.round(totalDist * 100) / 100 };
      } else if (measureMode === 'area' && measurePoints.length >= 3) {
        // Simple polygon area using Shoelace
        const coords = measurePoints.map((p) => p.carto);
        let area = 0;
        for (let i = 0; i < coords.length; i++) {
          const j = (i + 1) % coords.length;
          const lat1 = coords[i].lat, lon1 = coords[i].lon;
          const lat2 = coords[j].lat, lon2 = coords[j].lon;
          area += (lon2 - lon1) * (lat2 + lat1);
        }
        // Convert deg² to m² (approximate)
        const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
        const mPerDegLon = 111320 * Math.cos(avgLat * Math.PI / 180);
        const mPerDegLat = 110574;
        const areaM2 = Math.abs(area / 2) * mPerDegLon * mPerDegLat;
        result = { area_m2: Math.round(areaM2 * 100) / 100 };
      }

      _postToRN({ action: 'measureResult', payload: { mode: measureMode, ...result } });
      measureMode = null;
    },

    cancelMeasure() {
      measureMode = null;
      measurePoints = [];
      _clearMeasureEntities();
    },

    // ── Viewshed analysis ──────────────────────────────────────────────────
    showViewshed(lat, lon, elevation, radiusM) {
      _clearViewshed();
      const center = Cesium.Cartesian3.fromDegrees(lon, lat, (elevation || 0) + 2);
      const radius = radiusM || 5000;

      // Create a visual circle showing approximate viewshed area
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          material: Cesium.Color.CYAN.withAlpha(0.15),
          outline: true,
          outlineColor: Cesium.Color.CYAN.withAlpha(0.6),
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });

      // Observer marker
      const observerEntity = viewer.entities.add({
        position: center,
        point: {
          pixelSize: 12,
          color: Cesium.Color.CYAN,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: 'Gozlem Noktasi',
          font: '12px sans-serif',
          fillColor: Cesium.Color.CYAN,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: new Cesium.Color(0.1, 0.12, 0.2, 0.8),
        },
      });

      // Sight lines in 8 directions
      const sightLines = [];
      for (let angle = 0; angle < 360; angle += 45) {
        const rad = Cesium.Math.toRadians(angle);
        const endLon = lon + (radius / 111320) * Math.sin(rad) / Math.cos(lat * Math.PI / 180);
        const endLat = lat + (radius / 110574) * Math.cos(rad);

        const lineEntity = viewer.entities.add({
          polyline: {
            positions: [
              Cesium.Cartesian3.fromDegrees(lon, lat, (elevation || 0) + 2),
              Cesium.Cartesian3.fromDegrees(endLon, endLat, (elevation || 0) + 2),
            ],
            width: 1.5,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.CYAN.withAlpha(0.5),
              dashLength: 16,
            }),
          },
        });
        sightLines.push(lineEntity);
      }

      viewshedPrimitive = { entity, observerEntity, sightLines };
    },

    clearViewshed() {
      _clearViewshed();
    },

    // ── Time control ────────────────────────────────────────────────────────
    setTime(isoString) {
      viewer.clock.currentTime = Cesium.JulianDate.fromIso8601(isoString);
    },

    // ── Track replay (enhanced with trail + camera follow) ─────────────────
    replayTrack(geojsonFC, opts) {
      const coords = _extractCoordsFromGeoJSON(geojsonFC);
      if (!coords.length) return;

      const options = opts || {};
      const czml = _buildCzmlFromCoords(coords, options);
      const ds = new Cesium.CzmlDataSource();
      ds.load(czml).then(() => {
        viewer.dataSources.add(ds);
        trackDataSources.push(ds);
        replayDataSource = ds;
        viewer.clock.shouldAnimate = true;

        // Camera follow mode
        if (options.followCamera) {
          const entity = ds.entities.getById('track_replay');
          if (entity) {
            viewer.trackedEntity = entity;
          }
        } else {
          viewer.flyTo(ds);
        }
      });
    },

    stopReplay() {
      viewer.clock.shouldAnimate = false;
      viewer.trackedEntity = undefined;
    },

    // ── Scene quality ───────────────────────────────────────────────────────
    setSceneQuality(quality) {
      // quality: 'low' | 'medium' | 'high'
      if (quality === 'low') {
        scene.fog.density = 4.0e-4;
        scene.globe.maximumScreenSpaceError = 4;
        scene.postProcessStages.fxaa.enabled = false;
        viewer.resolutionScale = 0.75;
      } else if (quality === 'medium') {
        scene.fog.density = 2.0e-4;
        scene.globe.maximumScreenSpaceError = 2;
        scene.postProcessStages.fxaa.enabled = true;
        viewer.resolutionScale = 1.0;
      } else {
        scene.fog.density = 1.0e-4;
        scene.globe.maximumScreenSpaceError = 1.5;
        scene.postProcessStages.fxaa.enabled = true;
        viewer.resolutionScale = 1.0;
      }
    },

    // ── Shadows toggle ─────────────────────────────────────────────────────
    setShadows(enabled) {
      viewer.shadows = !!enabled;
      globe.enableLighting = !!enabled;
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
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  handler.setInputAction(async (click) => {
    const ray = viewer.camera.getPickRay(click.position);
    const cartesian = await scene.globe.pick(ray, scene);
    if (!cartesian) return;

    const carto = Cesium.Cartographic.fromCartesian(cartesian);
    const lat = Cesium.Math.toDegrees(carto.latitude);
    const lon = Cesium.Math.toDegrees(carto.longitude);
    const elevation = carto.height;

    // Measurement mode handling
    if (measureMode) {
      const point = { cartesian, carto: { lat, lon, elevation } };
      measurePoints.push(point);

      // Add visual marker
      const markerEntity = viewer.entities.add({
        position: cartesian,
        point: {
          pixelSize: 10,
          color: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${measurePoints.length}`,
          font: '11px sans-serif',
          fillColor: Cesium.Color.YELLOW,
          pixelOffset: new Cesium.Cartesian2(12, -12),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      measureEntities.push(markerEntity);

      // Draw lines between points
      if (measurePoints.length > 1) {
        const prev = measurePoints[measurePoints.length - 2];
        const lineEntity = viewer.entities.add({
          polyline: {
            positions: [prev.cartesian, cartesian],
            width: 3,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.YELLOW,
              dashLength: 12,
            }),
            clampToGround: true,
          },
        });
        measureEntities.push(lineEntity);

        // Show distance label at midpoint
        const dist = Cesium.Cartesian3.distance(prev.cartesian, cartesian);
        const mid = Cesium.Cartesian3.midpoint(prev.cartesian, cartesian, new Cesium.Cartesian3());
        const distLabel = viewer.entities.add({
          position: mid,
          label: {
            text: dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`,
            font: 'bold 12px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true,
            backgroundColor: new Cesium.Color(0.2, 0.2, 0.0, 0.8),
            backgroundPadding: new Cesium.Cartesian2(5, 3),
          },
        });
        measureEntities.push(distLabel);
      }

      // Close polygon for area mode
      if (measureMode === 'area' && measurePoints.length >= 3) {
        // Draw closing line
        const first = measurePoints[0];
        const last = measurePoints[measurePoints.length - 1];
        // Remove previous closing line if exists
        const closeLineEntity = viewer.entities.add({
          polyline: {
            positions: [last.cartesian, first.cartesian],
            width: 2,
            material: new Cesium.PolylineDashMaterialProperty({
              color: Cesium.Color.YELLOW.withAlpha(0.5),
              dashLength: 8,
            }),
            clampToGround: true,
          },
        });
        measureEntities.push(closeLineEntity);
      }

      _postToRN({
        action: 'measurePointAdded',
        payload: { index: measurePoints.length, lat, lon, elevation },
      });
      return;
    }

    _postToRN({ action: 'mapClick', payload: { lat, lon, elevation } });

    // Check if a peak entity was clicked
    const picked = scene.pick(click.position);
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

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function _postToRN(msg) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(msg));
    } else {
      console.log('[Bridge →RN]', msg);
    }
  }

  function _extractCoordsFromGeoJSON(geojsonFC) {
    return (geojsonFC.features || []).flatMap((f) => {
      if (f.geometry.type === 'LineString') return f.geometry.coordinates;
      if (f.geometry.type === 'MultiLineString') return f.geometry.coordinates.flat();
      if (f.geometry.type === 'Point') return [f.geometry.coordinates];
      return [];
    });
  }

  function _clearMeasureEntities() {
    measureEntities.forEach((e) => viewer.entities.remove(e));
    measureEntities = [];
  }

  function _clearViewshed() {
    if (viewshedPrimitive) {
      viewer.entities.remove(viewshedPrimitive.entity);
      viewer.entities.remove(viewshedPrimitive.observerEntity);
      viewshedPrimitive.sightLines.forEach((e) => viewer.entities.remove(e));
      viewshedPrimitive = null;
    }
  }

  function _createPinCanvas(label) {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 56;
    const ctx = canvas.getContext('2d');

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;

    // Pin body
    ctx.beginPath();
    ctx.arc(24, 22, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Pin tail
    ctx.beginPath();
    ctx.moveTo(12, 34);
    ctx.lineTo(24, 56);
    ctx.lineTo(36, 34);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();

    // Mountain icon (triangle with snow cap)
    ctx.beginPath();
    ctx.moveTo(24, 8);
    ctx.lineTo(12, 30);
    ctx.lineTo(36, 30);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Snow cap
    ctx.beginPath();
    ctx.moveTo(24, 8);
    ctx.lineTo(19, 16);
    ctx.lineTo(22, 15);
    ctx.lineTo(24, 17);
    ctx.lineTo(26, 15);
    ctx.lineTo(29, 16);
    ctx.closePath();
    ctx.fillStyle = '#dfe6e9';
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
    viewer.clock.multiplier = opts.speed || 1;

    const interval = durationSec / (coords.length - 1);
    const cartesian = [];

    coords.forEach((c, i) => {
      const t = Cesium.JulianDate.addSeconds(start, i * interval, new Cesium.JulianDate());
      cartesian.push(Cesium.JulianDate.toIso8601(t));
      cartesian.push(c[0], c[1], c[2] || 0);
    });

    return [
      {
        id: 'document',
        name: 'Track Replay',
        version: '1.0',
        clock: {
          interval: `${Cesium.JulianDate.toIso8601(start)}/${Cesium.JulianDate.toIso8601(stop)}`,
          currentTime: Cesium.JulianDate.toIso8601(start),
          multiplier: opts.speed || 1,
        },
      },
      {
        id: 'track_replay',
        availability: `${Cesium.JulianDate.toIso8601(start)}/${Cesium.JulianDate.toIso8601(stop)}`,
        position: {
          cartographicDegrees: cartesian,
          interpolationAlgorithm: 'LAGRANGE',
          interpolationDegree: 2,
        },
        point: {
          pixelSize: 14,
          color: { rgba: [255, 100, 50, 255] },
          outlineColor: { rgba: [255, 255, 255, 200] },
          outlineWidth: 2,
        },
        path: {
          material: {
            polylineGlow: {
              color: { rgba: [255, 100, 50, 220] },
              glowPower: 0.3,
            },
          },
          width: 5,
          trailTime: opts.trailTime || 30,
          leadTime: 0,
        },
      },
    ];
  }

  // Signal ready to React Native
  _postToRN({ action: 'cesiumReady', payload: {} });
})();
