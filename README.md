# Mountain Explorer — 3D Outdoor Activity App

Doga sporculari (yamac parasutuculer, dagcilar, yuruyusculer) icin gelistirilmis, **CesiumJS** tabanli 3D kure gezgini ve arazi analiz uygulamasi.

Uygulama, uydu goruntuleri uzerinde gercek zamanli arazi modelleme, hava durumu tahmini, GPS rota analizi ve dag arama/kesif islevleri sunar.

---

## Ozellikler

### 3D Kure ve Goruntuleme
- CesiumJS ile gercek dunyali 3D kure (uydu goruntuleri + arazi modeli)
- Gercekci aydinlatma, golge, sis ve atmosfer efektleri
- Arazi yukseklik abartma (1x-10x) ile detayli topografya inceleme
- Sahne kalitesi ayari (dusuk/orta/yuksek) — mobil performans optimizasyonu
- FXAA anti-aliasing

### Konum Arama ve Navigasyon
- **Geocoding**: Yer adi ile arama (Nominatim/OpenStreetMap)
- **Ters geocoding**: Koordinattan yer adi alma
- **GPS konum destegi**: Mobil cihazin mevcut konumunu kullanma (expo-location)
- **Dag zirve arama**: OpenStreetMap Overpass API ile isim veya koordinat bazli
- Tiklanan noktaya ucus animasyonu
- 360 derece orbit kamera

### Arazi Analizi
- **Egim (slope) haritasi**: Renk kodlu egim acisi goruntulemesi (yesil → sari → kirmizi → mor)
- **Baki (aspect) haritasi**: Yamaclarin yonelim analizi (N/NE/E/SE/S/SW/W/NW)
- **Kontur cizgileri**: 100m aralikli yukseklik konturlari (500m ana konturlar)
- **Yukseklik profili**: Secilen alan icin yukseklik kesiti
- Istatistikler: min/max/ortalama egim, baskın baki yonu

### Hava Durumu ve Guvenlik
- Open-Meteo API ile gercek zamanli hava durumu (API key gerektirmez)
- 48 saatlik detayli tahmin (saatlik sicaklik, ruzgar, yagis)
- Coklu yukseklik ruzgar profilleri (10m, 80m, 120m)
- Termik degerlendirme (yamac parasutu icin)
- Cig riski hesaplayicisi (1-5 Avrupa olcegi)
- Dag guvenligi uyarilari (firtina, ruzgar, UV, gorus mesafesi, donma seviyesi, kar)

### GPS Rota Yonetimi
- **Coklu format destegi**: GPX, FIT (Garmin), IGC (yamac parasutu), KML/KMZ
- **3 farkli gorsellestirme modu**:
  - 2D: Yere yapisik rota cizgisi
  - 3D Wall: Yukseklik seritli 3D rota (yerden rotaya duvar)
  - Renkli: Yukseklige gore renk gradyani (mavi→yesil→kirmizi)
- Rota animasyonu (CZML replay) ile kamera takibi
- Cevrimdisi kayit ve onbellek

### Olcum ve Analiz Araclari
- Mesafe olcumu (cok noktali)
- Alan olcumu (poligon)
- Gorus alani (viewshed) analizi — 8 yonlu gorus cizgileri

---

## Proje Yapisi

```
App-trials/
├── backend/                     # Python FastAPI backend sunucusu
│   ├── app/
│   │   ├── main.py              # FastAPI uygulama giris noktasi, middleware, router kayitlari
│   │   ├── database.py          # Veritabani baglantisi (SQLite)
│   │   ├── models/
│   │   │   ├── mountain.py      # Mountain Pydantic modeli (osm_id, name, lat, lon, elevation)
│   │   │   └── track.py         # Track modeli
│   │   ├── routers/
│   │   │   ├── mountains.py     # GET /mountains/search, /mountains/by-name, /mountains/{id}
│   │   │   ├── terrain.py       # POST /terrain/analyze (slope/aspect/contour/profile)
│   │   │   ├── weather.py       # GET /weather (Open-Meteo entegrasyonu)
│   │   │   ├── tracks.py        # Rota CRUD islemleri
│   │   │   ├── favorites.py     # Favori konumlar
│   │   │   └── geocode.py       # GET /geocode/search, /geocode/reverse (Nominatim)
│   │   └── services/
│   │       ├── overpass_service.py    # OpenStreetMap Overpass API istemcisi
│   │       ├── terrain_service.py     # DEM indirme, slope/aspect hesaplama, PNG overlay uretimi
│   │       ├── weather_service.py     # Open-Meteo API, termik/cig analizi, guvenlik uyarilari
│   │       └── geocoding_service.py   # Nominatim geocoding/ters geocoding istemcisi
│   ├── static/
│   │   └── cesium/
│   │       ├── index.html       # CesiumJS WebView HTML sayfasi
│   │       └── cesium-app.js    # Cesium 3D kure mantigi + React Native bridge
│   ├── Dockerfile               # Python 3.12 + GDAL/rasterio Docker imaji
│   └── requirements.txt         # Python bagimliliklar
│
├── mobile/                      # React Native (Expo) mobil uygulama
│   ├── app/
│   │   ├── _layout.tsx          # Root layout
│   │   └── (tabs)/
│   │       ├── _layout.tsx      # Tab bar layout (Kure, Rotalar, Ayarlar)
│   │       ├── globe.tsx        # Ana 3D kure ekrani (arama, hava durumu, analiz)
│   │       ├── tracks.tsx       # Rota yonetimi (import/list/delete)
│   │       └── settings.tsx     # Ayarlar (token, URL, birimler)
│   ├── components/
│   │   ├── CesiumWebView.tsx    # WebView + JS bridge sarmalayicisi
│   │   ├── ElevationProfile.tsx # Yukseklik profili grafigi
│   │   ├── HourlyForecastChart.tsx  # Saatlik tahmin grafigi
│   │   ├── TrackCard.tsx        # Rota kart bileseni
│   │   └── WeatherAlerts.tsx    # Hava durumu uyari bileseni
│   ├── services/
│   │   ├── api.ts               # Backend API istemcisi (retry, geocoding, search)
│   │   ├── parsers/
│   │   │   ├── gpxParser.ts     # GPX → GeoJSON donusturucu
│   │   │   ├── fitParser.ts     # Garmin FIT → GeoJSON donusturucu
│   │   │   ├── igcParser.ts     # IGC (paragliding) → GeoJSON donusturucu
│   │   │   └── kmlParser.ts     # KML/KMZ → GeoJSON donusturucu
│   │   └── storage/
│   │       └── offlineCache.ts  # AsyncStorage tabanli cevrimdisi cache
│   ├── cesium/
│   │   ├── index.html           # Mobil icin CesiumJS HTML (token destekli)
│   │   └── cesium-app.js        # Mobil icin Cesium bridge (backend ile senkron)
│   ├── package.json             # Node.js bagimliliklar
│   └── tsconfig.json            # TypeScript yapilandirmasi
│
├── docker-compose.yml           # Backend Docker Compose yapilandirmasi
├── .env.example                 # Ortam degiskenleri sablonu
├── start.sh                     # Tek tikla baslatma scripti (Mac/Linux)
├── start.bat                    # Tek tikla baslatma scripti (Windows)
├── SETUP.md                     # Adim adim kurulum kilavuzu (teknik bilgi gerektirmez)
└── README.md                    # Bu dosya
```

---

## Teknoloji ve Kutuphaneler

### Backend (Python)

| Kutuphane | Surum | Kullanim |
|-----------|-------|----------|
| **FastAPI** | 0.109.2 | REST API framework |
| **Uvicorn** | 0.27.1 | ASGI web sunucusu |
| **httpx** | 0.27.0 | Async HTTP istemcisi (Overpass, Open-Meteo, Nominatim, OpenTopo) |
| **numpy** | 2.0.0 | DEM veri isleme, egim/baki hesaplama |
| **scipy** | 1.14.0 | Bilimsel hesaplamalar |
| **rasterio** | 1.3.10 | GeoTIFF (DEM) dosya okuma/yazma |
| **Pillow** | 10.4.0 | PNG overlay goruntu uretimi |
| **shapely** | 2.0.5 | Geometri islemleri |
| **pyproj** | 3.7.0 | Koordinat donusumleri |
| **pydantic** | 2.6.1 | Veri modelleri ve dogrulama |

Sistem bagimlilik: **GDAL** (rasterio icin gerekli — Dockerfile ile otomatik kurulur)

### Mobil (React Native / Expo)

| Kutuphane | Surum | Kullanim |
|-----------|-------|----------|
| **Expo** | ~52.0.0 | React Native gelistirme platformu |
| **expo-router** | ~4.0.0 | Dosya tabanli navigasyon |
| **expo-location** | ~18.0.0 | GPS konum erisimi |
| **expo-document-picker** | ~13.0.0 | Dosya secme (rota import) |
| **expo-file-system** | ~18.0.0 | Dosya okuma/yazma |
| **react-native-webview** | ^13.10.0 | CesiumJS WebView konteyneri |
| **@we-gold/gpxjs** | ^2.0.4 | GPX dosya ayristirma |
| **fit-file-parser** | ^2.3.0 | Garmin FIT dosya ayristirma |
| **@tmcw/togeojson** | ^5.8.1 | KML → GeoJSON donusturme |
| **jszip** | ^3.10.1 | KMZ (ZIP) dosya acma |
| **@react-native-async-storage** | ~2.1.0 | Yerel veri depolama ve onbellek |

### 3D Gorsellestirme

| Teknoloji | Surum | Kullanim |
|-----------|-------|----------|
| **CesiumJS** | 1.115 | 3D kure, arazi modeli, uydu goruntuleri |
| **Cesium Ion** | - | Arazi verisi ve uydu goruntuleri saglayicisi |
| **SRTM GL1 (30m)** | - | OpenTopography uzerinden DEM verisi |

### Dis Servisler (API)

| Servis | Maliyet | Kullanim |
|--------|---------|----------|
| **Cesium Ion** | Ucretsiz katman | Arazi modeli + Bing Maps uydu goruntuleri |
| **OpenStreetMap Overpass** | Ucretsiz | Dag zirve/gecit arama |
| **Nominatim** | Ucretsiz | Yer adi → koordinat geocoding |
| **Open-Meteo** | Ucretsiz | Hava durumu ve tahminler |
| **OpenTopography** | Ucretsiz (kayit gerekli) | DEM verisi (egim/baki analizi icin) |

---

## API Endpointleri

### Mountains (Dag Arama)
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | `/mountains/search?lat=&lon=&radius_km=&query=` | Koordinat etrafinda zirve ara |
| GET | `/mountains/by-name?name=Uludag` | Isimle global zirve arama |
| GET | `/mountains/{osm_id}` | Tek zirve detayi |

### Geocode (Konum Arama)
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | `/geocode/search?q=Istanbul&limit=10&lang=tr` | Yer adi ile arama |
| GET | `/geocode/reverse?lat=41.0&lon=29.0&lang=tr` | Koordinattan yer adi |

### Terrain (Arazi Analizi)
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| POST | `/terrain/analyze` | Egim/baki/kontur/profil analizi |

### Weather (Hava Durumu)
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | `/weather?lat=&lon=&elevation=&days=` | Hava durumu + tahmin + uyarilar |

### Tracks & Favorites
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET/POST | `/tracks` | Rota CRUD |
| GET/POST | `/favorites` | Favori konum CRUD |

### Sistem
| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | `/health` | Saglik kontrolu |
| GET | `/docs` | Swagger/OpenAPI dokumantasyonu |

---

## Kurulum

### Hizli Baslangic (Docker + Expo)

```bash
# 1. Repoyu klonlayin
git clone <repo-url>
cd App-trials

# 2. Ortam degiskenlerini ayarlayin
cp .env.example .env
# .env dosyasina OpenTopography API key ekleyin (opsiyonel)

# 3. Tek komutla baslatin
./start.sh          # Mac/Linux
start.bat           # Windows
```

Bu script Docker ile backend'i, npm ile mobil uygulamayi baslatir.

### Manuel Kurulum

#### Backend
```bash
cd backend

# Secik A: Docker ile (onerilen)
docker compose up -d --build

# Secenek B: Yerel Python ile
pip install -r requirements.txt
# Not: rasterio icin GDAL sistem kutuphanesi gerekli
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Mobil Uygulama
```bash
cd mobile
npm install
npx expo start
```

Expo Go uygulamasini telefonunuza kurun ve QR kodu tarayin.

---

## Ortam Degiskenleri

| Degisken | Zorunlu | Aciklama |
|----------|---------|----------|
| `OPENTOPO_API_KEY` | Hayir | OpenTopography API anahtari (egim/baki analizi icin). Ucretsiz: https://portal.opentopography.org/requestApiKey |

Cesium Ion Token uygulama icinden Ayarlar sekmesinde girilir.

---

## Sunucu Konfigurasyonu (Production)

### Minimum Gereksinimler
| Kaynak | Deger |
|--------|-------|
| **CPU** | 2 vCPU |
| **RAM** | 2 GB |
| **Disk** | 10 GB (overlay goruntuler icin + 20 GB bos alan onerisi) |
| **OS** | Linux (Ubuntu 22.04+ onerilen) |
| **Python** | 3.11+ |
| **Docker** | 24.0+ (Docker ile calistirmak icin) |
| **Node.js** | 18 LTS+ (mobil gelistirme icin) |

### Onerilen Konfigürasyon (50+ kullanici)
| Kaynak | Deger |
|--------|-------|
| **CPU** | 4 vCPU |
| **RAM** | 4 GB |
| **Disk** | 50 GB SSD |
| **Ag** | 100 Mbps+ (DEM indirme ve uydu tile'lari icin) |

### Ag Gereksinimleri
Backend sunucusunun asagidaki dis servislere erisebilmesi gerekir:
- `overpass-api.de` (443) — Dag arama
- `nominatim.openstreetmap.org` (443) — Geocoding
- `api.open-meteo.com` (443) — Hava durumu
- `portal.opentopography.org` (443) — DEM verisi
- `cesium.com` (443) — CesiumJS CDN (istemci tarafli)
- `ion.cesium.com` (443) — Cesium Ion arazi/goruntu tile'lari (istemci tarafli)

### Rate Limiting
Backend'de yerlesik rate limiter vardir:
- **60 istek/dakika** IP basina
- `/health`, `/docs`, `/openapi.json` muaftir

### Production Onerileri
- **Reverse proxy**: Nginx veya Caddy arkasinda calistirin (TLS/SSL icin)
- **CORS**: `main.py` icindeki `allow_origins=["*"]` degerini production domain ile sinirlayin
- **Overlay temizligi**: `/static/overlays/` klasoru buyuyebilir — cron ile eski dosyalari temizleyin
- **Log yonetimi**: Loglar stdout'a yazilir — log toplayici (Loki, ELK) baglayabilirsiniz

---

## Mobil Uygulama Ekranlari

| Sekme | Aciklama |
|-------|----------|
| **Kure** | Ana 3D harita ekrani — arama, hava durumu, arazi analizi, olcum araclari |
| **Rotalar** | GPS rota import/listeleme/silme (GPX/FIT/IGC/KML/KMZ) |
| **Ayarlar** | API token, sunucu URL, birim tercihi, termik uyari ayarlari |

---

## Mimari

```
┌──────────────────────┐         ┌─────────────────────────┐
│   Mobil Uygulama     │         │   Backend (FastAPI)     │
│   (React Native)     │  HTTP   │                         │
│                      │◄───────►│  /mountains             │
│  ┌────────────────┐  │         │  /geocode               │
│  │ CesiumWebView  │  │         │  /terrain               │
│  │ (WebView +     │  │         │  /weather               │
│  │  cesium-app.js)│  │         │  /tracks                │
│  └────────────────┘  │         │  /favorites             │
│                      │         │                         │
│  ┌────────────────┐  │         │  ┌───────────────────┐  │
│  │ expo-location  │  │         │  │ Overpass API       │  │
│  │ (GPS)          │  │         │  │ Nominatim          │  │
│  └────────────────┘  │         │  │ Open-Meteo         │  │
│                      │         │  │ OpenTopography     │  │
│  ┌────────────────┐  │         │  └───────────────────┘  │
│  │ AsyncStorage   │  │         │                         │
│  │ (Offline Cache)│  │         │  ┌───────────────────┐  │
│  └────────────────┘  │         │  │ Static Files       │  │
│                      │         │  │ (CesiumJS + PNG    │  │
│  ┌────────────────┐  │         │  │  overlay'ler)      │  │
│  │ File Parsers   │  │         │  └───────────────────┘  │
│  │ GPX/FIT/IGC/KML│  │         │                         │
│  └────────────────┘  │         └─────────────────────────┘
└──────────────────────┘
        │
        ▼ (CDN)
┌─────────────────┐
│ Cesium Ion      │
│ (Arazi + Uydu)  │
└─────────────────┘
```

---

## Lisans

Bu proje acik kaynak olarak gelistirilmektedir.
