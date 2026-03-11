@echo off
chcp 65001 >nul
echo.
echo ╔══════════════════════════════════════════╗
echo ║       Mountain Explorer - Başlatıcı      ║
echo ╚══════════════════════════════════════════╝
echo.

:: ─── Docker kontrolü ──────────────────────────────────────────────────────────
where docker >nul 2>&1
if %errorlevel% neq 0 (
  echo [HATA] Docker bulunamadı.
  echo   -^> https://www.docker.com/products/docker-desktop adresinden indirin.
  pause
  exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
  echo [HATA] Docker çalışmıyor.
  echo   -^> Docker Desktop uygulamasını açın ve tekrar deneyin.
  pause
  exit /b 1
)
echo [OK] Docker hazır

:: ─── Node.js kontrolü ─────────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [HATA] Node.js bulunamadı.
  echo   -^> https://nodejs.org adresinden LTS sürümünü indirin.
  pause
  exit /b 1
)
echo [OK] Node.js hazır

:: ─── Bilgisayarın IP adresi ───────────────────────────────────────────────────
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
  set LOCAL_IP=%%a
  goto :found_ip
)
set LOCAL_IP= BILGISAYAR_IP_ADRESINIZ
:found_ip
set LOCAL_IP=%LOCAL_IP: =%

:: ─── .env dosyası ─────────────────────────────────────────────────────────────
if not exist ".env" (
  copy .env.example .env >nul
  echo [BILGI] .env dosyası oluşturuldu
)

:: ─── Backend başlat ────────────────────────────────────────────────────────────
echo.
echo [►] Backend başlatılıyor (Docker)...
echo     İlk seferinde birkaç dakika sürebilir.
docker compose up -d --build

echo.
echo [OK] Backend başladı: http://localhost:8000

:: ─── Mobile dependencies ──────────────────────────────────────────────────────
echo.
echo [►] Mobile bağımlılıklar yükleniyor...
cd mobile
if not exist "node_modules" (
  npm install
)

:: ─── Bilgi ekranı ─────────────────────────────────────────────────────────────
echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║  KURULUM TAMAM - Şimdi yapmanız gerekenler:                 ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║  1. Android telefonunuzda 'Expo Go' uygulamasını açın        ║
echo ║     (Google Play'den ücretsiz indirebilirsiniz)              ║
echo ║                                                              ║
echo ║  2. Aşağıda çıkacak QR kodu telefonla tarayın               ║
echo ║                                                              ║
echo ║  3. Uygulama açıldıktan sonra Ayarlar sekmesine gidin:       ║
echo ║     Backend URL: http://%LOCAL_IP%:8000
echo ║                                                              ║
echo ║  4. Cesium Ion token girin (SETUP.md'de anlatılıyor)         ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo Bilgisayarinizin IP adresi: %LOCAL_IP%
echo (Telefon ve bilgisayar ayni WiFi'da olmali)
echo.

npx expo start
