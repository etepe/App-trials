# Mountain Explorer — 3D Outdoor Activity App

A 3D world explorer for outdoor athletes (paragliders, hikers, alpinists).

## Structure

```
mobile/   — React Native (Expo) app
backend/  — Python FastAPI backend
```

## Features

- **3D Globe** (CesiumJS via WebView) with satellite imagery and world terrain
- **Mountain search** via OpenStreetMap Overpass API
- **GPS track import**: GPX, FIT (Garmin), IGC (paragliding), KML/KMZ
- **3D track visualization** on terrain
- **Terrain analysis**: slope angle & aspect direction maps
- **Weather**: current + 48h forecast with paragliding thermal assessment (Open-Meteo)
- **Offline cache**: tracks stored locally, mountain data cached 24h

## Quick Start

### Mobile
```bash
cd mobile
npm install
npx expo start
```

Set your Cesium Ion token in the Settings tab.

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Set `OPENTOPO_API_KEY` env var for terrain analysis (free at opentopography.org).

Set `EXPO_PUBLIC_API_URL` in mobile to point to your backend.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENTOPO_API_KEY` | OpenTopography API key for DEM downloads |
| `EXPO_PUBLIC_API_URL` | Backend URL (default: `http://localhost:8000`) |
