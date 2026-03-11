# Mountain Explorer — Kurulum Kılavuzu

> Teknik bilgi gerektirmez. Her adımı sırasıyla yapın.

---

## Gereksinimler (bir kez kurulur)

### 1. Docker Desktop
3D harita sunucusunu çalıştırmak için gerekli.

1. Şu adresi açın: **https://www.docker.com/products/docker-desktop**
2. **"Download for Windows"** (veya Mac) butonuna tıklayın
3. İndirilen dosyayı çalıştırın ve kurulumu tamamlayın
4. Docker Desktop'ı başlatın — sistem tepsisinde balina simgesi görünmeli

---

### 2. Node.js
Mobil uygulamayı başlatmak için gerekli.

1. Şu adresi açın: **https://nodejs.org**
2. **"LTS"** yazan büyük butona tıklayın (soldaki)
3. İndirilen dosyayı çalıştırın, her şeyi varsayılan bırakın

---

### 3. Expo Go (Android telefonda)
Uygulamayı telefonunuzda çalıştırmak için.

1. Android telefonunuzda **Google Play**'i açın
2. **"Expo Go"** arayın
3. Kurun (Expo Tools tarafından)

---

## Uygulamayı Başlatma

### Adım 1 — Proje klasörünü açın

Masaüstünde veya istediğiniz bir yerde proje klasörü olmalı.
İçinde `start.bat` (Windows) veya `start.sh` (Mac/Linux) dosyası var.

**Windows'ta:**
- `start.bat` dosyasına çift tıklayın
- Siyah bir komut penceresi açılacak — kapanmasın bekliyoruz

**Mac/Linux'ta:**
- Terminal açın
- `cd /proje/klasörünün/yolu` yazın
- `./start.sh` yazın ve Enter'a basın

> İlk seferinde 5-10 dakika bekleyebilir — paketler indiriliyor. Sonraki seferler çok daha hızlı.

---

### Adım 2 — QR Kodu Tarayın

Komut penceresi hazır olduğunda şu bilgileri göreceksiniz:

```
✓ Backend başladı: http://localhost:8000
...
› Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android)
```

Ve büyük bir QR kodu.

1. Android telefonunuzda **Expo Go** uygulamasını açın
2. Ana ekrandaki **"Scan QR Code"** butonuna dokunun
3. QR kodu tarayın
4. Uygulama telefonunuzda yüklenmeye başlayacak

---

### Adım 3 — Ayarları Yapın

Uygulama açıldıktan sonra altta **3 sekme** var: Globe, Tracks, Ayarlar.

**Ayarlar sekmesine** dokunun ve şunları doldurun:

#### Backend URL
Komut penceresinde yazan IP adresini buraya girin.
Örnek: `http://192.168.1.45:8000`

> Telefon ve bilgisayar **aynı WiFi'ya** bağlı olmalı!

#### Cesium Ion Token
3D uydu görüntüsü için gerekli. Aşağıda nasıl alacağınız açıklanıyor.

**Kaydet** butonuna basın.

---

## Cesium Ion Token Nasıl Alınır?

Bu token **ücretsiz**, sadece bir hesap oluşturmanız gerekiyor.

1. Şu adresi açın: **https://ion.cesium.com/signup**
2. E-posta ve şifre ile hesap oluşturun
3. E-postanıza gelen onay linkine tıklayın
4. Giriş yaptıktan sonra sol menüden **"Access Tokens"** tıklayın
5. **"default"** token'ın yanındaki kopyalama simgesine tıklayın
6. Kopyaladığınız metni Mountain Explorer → Ayarlar → Cesium Ion Token kutusuna yapıştırın
7. Kaydet'e basın, Globe sekmesine gidin

Artık 3D uydu görüntüsü ile dağları görebilirsiniz!

---

## Sorun Giderme

### "Bağlantı kurulamadı" hatası
- Telefon ve bilgisayarın **aynı WiFi'da** olduğunu kontrol edin
- Backend URL'nin doğru olduğunu kontrol edin (Ayarlar sekmesi)
- Docker Desktop'ın çalıştığını kontrol edin (sistem tepsisindeki balina simgesi)

### Küre yüklenmedi / siyah ekran
- Backend URL boşsa, Ayarlar sekmesinden girin
- Cesium Ion token yoksa, düz harita görünümü yüklenir — token girdikten sonra uydu görüntüsü gelir
- Uygulama Tracks sekmesine gidip geri gelin (WebView yenilenir)

### QR kod taranamıyor
- Expo Go uygulamasının güncel olduğunu kontrol edin
- Telefon ve bilgisayar aynı WiFi'da mı?
- Komut penceresinde QR kod görünüyor mu?

### "Docker çalışmıyor" hatası
- Docker Desktop uygulamasını açın
- Sistem tepsisinde balina simgesini bekleyin ("Docker Desktop is running" yazısı çıkmalı)

---

## Uygulamayı Kapatma

1. Komut penceresini kapatın (Ctrl+C veya çarpıya basın)
2. Docker container'ı durdurmak için: yeni bir terminal açıp `docker compose down` yazın

Veya sadece bilgisayarınızı kapatabilirsiniz — bir sonraki `start.bat/start.sh` çalıştırmada her şey yeniden başlar.

---

## Özellikler

| Özellik | Nasıl Kullanılır |
|---------|-----------------|
| 3D kürede gezinme | Parmakla sürükle, pinch-to-zoom |
| Dağ arama | Üstteki arama kutusuna yaz, "Ara" ya bas |
| Hava durumu | Haritada herhangi bir noktaya dokun |
| Eğim analizi | "Eğim" butonuna bas (önce bir noktaya dokun) |
| Bakı analizi | "Bakı" butonuna bas |
| GPX/FIT/IGC yükle | Tracks sekmesi → Import |
| 3D rota görüntüle | Tracks sekmesinde "3D View" butonu |
