# Mountain Explorer — Deployment Rehberi

Bu rehber, Mountain Explorer uygulamasını **Railway** (backend) ve **Expo EAS Build** (mobil) ile production ortamına deploy etme adımlarını içerir.

---

## Ön Gereksinimler

| Araç | Amaç | Kurulum |
|------|-------|---------|
| [Railway CLI](https://docs.railway.com/guides/cli) | Backend deploy | `npm i -g @railway/cli` |
| [Expo CLI + EAS CLI](https://docs.expo.dev/get-started/) | Mobil build | `npm i -g eas-cli` |
| [Git](https://git-scm.com/) | Versiyon kontrolü | Zaten mevcut |
| Expo hesabı | EAS Build için | https://expo.dev/signup |
| Railway hesabı | Backend için | https://railway.com |

---

## BÖLÜM 1: Backend Deploy (Railway)

### Adım 1 — Railway Hesabı ve Proje Oluşturma

1. https://railway.com adresine gidin ve GitHub hesabınızla giriş yapın
2. Dashboard'da **"New Project"** → **"Deploy from GitHub Repo"** seçin
3. Bu repository'yi (`App-trials`) seçin

### Adım 2 — Ortam Değişkenlerini Ayarlama

Railway dashboard'da projenize tıklayın → **Variables** sekmesi:

```
OPENTOPO_API_KEY=<opsiyonel — OpenTopography API anahtarınız>
ALLOWED_ORIGINS=*
```

> **Not:** `PORT` değişkenini Railway otomatik atar — eklemenize gerek yok.

### Adım 3 — Deploy Ayarları

Railway, kök dizindeki `railway.toml` dosyasını otomatik algılar:
- Dockerfile: `backend/Dockerfile`
- Health check: `/health` endpoint'i
- Otomatik yeniden başlatma: Hata durumunda

### Adım 4 — Deploy Etme

**Yöntem A — GitHub entegrasyonu (Önerilen):**
```bash
# main branch'e push ettiğinizde otomatik deploy olur
git push origin main
```

**Yöntem B — Railway CLI:**
```bash
# Railway'e giriş yapın
railway login

# Projeyi bağlayın
railway link

# Deploy edin
railway up
```

### Adım 5 — Domain Alma

1. Railway dashboard → projeniz → **Settings** → **Networking**
2. **"Generate Domain"** butonuna tıklayın
3. `https://mountain-explorer-xxx.up.railway.app` gibi bir URL alacaksınız
4. Bu URL'yi not edin — mobil uygulamada kullanacaksınız

### Adım 6 — Deploy'u Doğrulama

```bash
# Health check
curl https://YOUR-RAILWAY-URL.up.railway.app/health

# Beklenen yanıt:
# {"status":"ok","version":"1.1.0"}

# API docs sayfası
# Tarayıcıda açın: https://YOUR-RAILWAY-URL.up.railway.app/docs
```

---

## BÖLÜM 2: Mobil Uygulama Build (Expo EAS)

### Adım 1 — Expo Hesabı ve EAS CLI Kurulumu

```bash
# EAS CLI'yi yükleyin
npm install -g eas-cli

# Expo hesabınıza giriş yapın
eas login
```

### Adım 2 — Backend URL'sini Güncelleme

Mobil uygulamada varsayılan API URL'si `http://localhost:8000` olarak ayarlı. Production build için bunu güncellemeniz gerekiyor.

`mobile/services/api.ts` dosyasında:
```typescript
const DEFAULT_BASE_URL = 'https://YOUR-RAILWAY-URL.up.railway.app';
```

> **Alternatif:** Kullanıcılar uygulamanın **Ayarlar** sekmesinden API URL'sini manuel olarak değiştirebilir. Bu durumda kod değişikliği gerekmez.

### Adım 3 — EAS Projesi Oluşturma

```bash
cd mobile

# EAS projesini başlatın (ilk seferde)
eas build:configure
```

### Adım 4 — Android APK Build (Test için)

```bash
cd mobile

# Test APK'sı oluşturun (ücretsiz)
eas build --platform android --profile preview
```

Bu komut:
- Kodu Expo sunucularına yükler
- Bulutta APK oluşturur (5-15 dakika sürer)
- İndirme linki verir

### Adım 5 — Android Production Build (Google Play için)

```bash
cd mobile

# AAB (Android App Bundle) oluşturun
eas build --platform android --profile production
```

### Adım 6 — iOS Build (Opsiyonel)

```bash
# Apple Developer hesabı gerektirir ($99/yıl)
eas build --platform ios --profile production
```

### Adım 7 — Google Play Store'a Yükleme

1. [Google Play Console](https://play.google.com/console) hesabı oluşturun ($25 tek seferlik)
2. Yeni uygulama oluşturun → "Mountain Explorer"
3. EAS'ten indirdiğiniz `.aab` dosyasını yükleyin
4. Store listing'i doldurun (açıklama, ekran görüntüleri, ikon)
5. İncelemeye gönderin

**Veya EAS Submit ile otomatik yükleme:**
```bash
# Google Play service account JSON dosyasını mobile/ dizinine koyun
eas submit --platform android --profile production
```

---

## BÖLÜM 3: Production Kontrol Listesi

### Güvenlik

- [ ] `ALLOWED_ORIGINS` ortam değişkenini belirli domain'lerle sınırlayın
- [ ] Rate limiting değerlerini production trafiğine göre ayarlayın
- [ ] HTTPS kullandığınızdan emin olun (Railway otomatik sağlar)

### API Anahtarları

- [ ] [CesiumJS Ion Token](https://ion.cesium.com/tokens) — 3D küre için (uygulama ayarlarından girilir)
- [ ] [OpenTopography API Key](https://portal.opentopography.org/requestApiKey) — Terrain analizi için (opsiyonel)

### Veritabanı

Railway'de SQLite kullanırken dikkat:
- Railway her deploy'da container yeniden oluşturur
- Kalıcı veri için Railway'in **Volume** özelliğini kullanın:
  1. Dashboard → projeniz → **Settings** → **Volumes**
  2. **"Add Volume"** → Mount path: `/app/data`
  3. Bu sayede `mountain_explorer.db` dosyası deploy'lar arasında korunur

### Monitoring

- Railway dashboard'dan logları takip edin
- `/health` endpoint'ini uptime servisine ekleyin (ör. [UptimeRobot](https://uptimerobot.com))

---

## Hızlı Komut Özeti

```bash
# ── Backend (Railway) ──────────────────────
railway login                                    # Giriş
railway link                                     # Projeyi bağla
railway up                                       # Deploy

# ── Mobil (EAS) ────────────────────────────
cd mobile
eas login                                        # Giriş
eas build --platform android --profile preview   # Test APK
eas build --platform android --profile production # Production AAB
eas submit --platform android                    # Play Store'a yükle
```

---

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| Railway build hatası | Dashboard → Deploy logs'u kontrol edin. GDAL bağımlılıkları büyük olduğu için build süresi uzun olabilir |
| EAS build hatası | `eas build` çıktısında hata detaylarını okuyun. `expo doctor` ile uyumluluk kontrolü yapın |
| API bağlantı hatası | Mobil ayarlardan doğru Railway URL'sini girdiğinizden emin olun |
| SQLite veri kaybı | Railway Volume eklediğinizden emin olun (Bölüm 3) |
| CORS hatası | Railway'de `ALLOWED_ORIGINS` değişkenini kontrol edin |
