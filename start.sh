#!/usr/bin/env bash
# Mountain Explorer — Kolay başlatma scripti (Mac/Linux)
set -e

# ─── Renk kodları ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Mountain Explorer — Başlatıcı      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
echo ""

# ─── Docker kontrolü ──────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗ Docker bulunamadı.${NC}"
  echo "  → https://www.docker.com/products/docker-desktop adresinden Docker Desktop'ı indirin."
  exit 1
fi

if ! docker info &>/dev/null 2>&1; then
  echo -e "${RED}✗ Docker çalışmıyor.${NC}"
  echo "  → Docker Desktop uygulamasını açın ve tekrar deneyin."
  exit 1
fi
echo -e "${GREEN}✓ Docker hazır${NC}"

# ─── Node.js kontrolü ──────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js bulunamadı.${NC}"
  echo "  → https://nodejs.org adresinden LTS sürümünü indirin."
  exit 1
fi
echo -e "${GREEN}✓ Node.js hazır${NC}"

# ─── Bilgisayarın yerel IP adresini bul ───────────────────────────────────────
if [[ "$OSTYPE" == "darwin"* ]]; then
  LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
else
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
fi

if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP="BILGISAYAR_IP_ADRESINIZ"
  echo -e "${YELLOW}⚠ IP adresi otomatik bulunamadı. Manuel olarak girin.${NC}"
fi

# ─── .env dosyası ─────────────────────────────────────────────────────────────
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${YELLOW}⚠ .env dosyası oluşturuldu (opsiyonel: OpenTopography API key ekleyebilirsiniz)${NC}"
fi

# ─── Backend başlat ────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}► Backend başlatılıyor (Docker)…${NC}"
echo "  İlk seferinde birkaç dakika sürebilir — paketler indiriliyor."
docker compose up -d --build

echo ""
echo -e "${GREEN}✓ Backend başladı:${NC} http://localhost:8000"
echo -e "  Test: http://localhost:8000/health"

# ─── Mobile dependencies ───────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}► Mobile bağımlılıklar yükleniyor…${NC}"
cd mobile
if [ ! -d "node_modules" ]; then
  npm install
fi

# ─── Expo başlat ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  KURULUM TAMAM — Şimdi yapmanız gerekenler:                 ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  1. Android telefonunuzda 'Expo Go' uygulamasını açın        ║${NC}"
echo -e "${GREEN}║     (Google Play'den ücretsiz indirebilirsiniz)              ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  2. Aşağıda çıkacak QR kodu telefonla tarayın               ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  3. Uygulama açıldıktan sonra 'Ayarlar' sekmesine gidin:    ║${NC}"
echo -e "${GREEN}║     Backend URL: http://${LOCAL_IP}:8000                    ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║  4. Cesium Ion token girin (SETUP.md'de nasıl alınır        ║${NC}"
echo -e "${GREEN}║     açıklanıyor)                                            ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Bilgisayarınızın IP adresi: ${LOCAL_IP}${NC}"
echo -e "${YELLOW}(Telefon ve bilgisayar aynı WiFi'da olmalı)${NC}"
echo ""

npx expo start
