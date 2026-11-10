#!/usr/bin/env bash
# ==============================================================================
# InfraView — Script de Instalação Automatizada em Servidor Linux (Ubuntu/Debian)
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "=========================================================="
echo "          InfraView — Instalador de Produção             "
echo "=========================================================="
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: Este script deve ser executado com permissões de root (sudo).${NC}"
  echo "Uso: sudo bash install.sh"
  exit 1
fi

INSTALL_DIR="/opt/infraview"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}[1/7] Atualizando repositórios e instalando dependências base...${NC}"
apt-get update -y
apt-get install -y --no-install-recommends \
  lldpd \
  iproute2 \
  iputils-ping \
  python3 \
  python3-venv \
  python3-pip \
  python3-dev \
  nginx \
  git \
  curl \
  build-essential

# Garantir serviço LLDP ativo e permissão para www-data
systemctl enable --now lldpd
usermod -aG lldpd www-data || true

echo -e "${BLUE}[2/7] Verificando Node.js para compilação do frontend...${NC}"
NODE_OK=0
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 20 ]; then
    NODE_OK=1
    echo -e "${GREEN}Node.js $(node -v) já está instalado.${NC}"
  fi
fi

if [ $NODE_OK -eq 0 ]; then
  echo -e "${YELLOW}Instalando Node.js 24 LTS via NodeSource...${NC}"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
  echo -e "${GREEN}Node.js $(node -v) instalado com sucesso.${NC}"
fi

echo -e "${BLUE}[3/7] Preparando diretório de instalação (${INSTALL_DIR})...${NC}"
if [ "$CURRENT_DIR" != "$INSTALL_DIR" ]; then
  mkdir -p "$INSTALL_DIR"
  echo "Copiando arquivos de $CURRENT_DIR para $INSTALL_DIR..."
  rsync -a --exclude 'node_modules' --exclude 'venv' --exclude '.git' "$CURRENT_DIR/" "$INSTALL_DIR/"
fi

cd "$INSTALL_DIR"

echo -e "${BLUE}[4/7] Configurando Backend (Python / FastAPI)...${NC}"
cd "$INSTALL_DIR/backend"
if [ ! -d "venv" ]; then
  python3 -m venv venv
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install psycopg2-binary || true

mkdir -p "$INSTALL_DIR/backend/data"
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo -e "${YELLOW}Arquivo .env criado a partir de .env.example.${NC}"
fi
deactivate

echo -e "${BLUE}[5/7] Compilando Frontend (React + Vite)...${NC}"
cd "$INSTALL_DIR/frontend"
npm install
npm run build

# Ajustar permissões para o usuário www-data
chown -R www-data:www-data "$INSTALL_DIR"
chmod 755 "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR/frontend/dist"
chmod -R 775 "$INSTALL_DIR/backend/data"

echo -e "${BLUE}[6/7] Configurando serviço systemd (infraview-api)...${NC}"
cat << 'EOF' > /etc/systemd/system/infraview-api.service
[Unit]
Description=InfraView API Service
After=network.target lldpd.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/infraview/backend
Environment="PATH=/opt/infraview/backend/venv/bin"
ExecStart=/opt/infraview/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now infraview-api
systemctl restart infraview-api

echo -e "${BLUE}[7/7] Configurando Nginx (Reverse Proxy + SPA)...${NC}"
cat << 'EOF' > /etc/nginx/sites-available/infraview
server {
    listen 80;
    server_name _;

    root /opt/infraview/frontend/dist;
    index index.html;

    client_max_body_size 20M;

    # Frontend SPA
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/infraview /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default || true

nginx -t
systemctl reload nginx

# Testar saúde da API
echo -e "${BLUE}Verificando status dos serviços...${NC}"
sleep 2
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health || echo "000")

echo ""
echo -e "${GREEN}==========================================================${NC}"
echo -e "${GREEN}          Instalação Concluída com Sucesso!               ${NC}"
echo -e "${GREEN}==========================================================${NC}"
echo ""
if [ "$HEALTH_CODE" = "200" ]; then
  echo -e "API Status:     ${GREEN}ONLINE (HTTP 200)${NC}"
else
  echo -e "API Status:     ${YELLOW}Iniciando (HTTP $HEALTH_CODE) — verifique com: sudo systemctl status infraview-api${NC}"
fi
echo -e "Nginx Status:   ${GREEN}ATIVO${NC}"
echo -e "LLDP Service:   ${GREEN}ATIVO${NC}"
echo ""
echo "Acesse o InfraView no seu navegador:"
echo -e "  -> ${BLUE}http://$(hostname -I | awk '{print $1}')${NC}"
echo ""
echo "Comandos úteis de gerenciamento:"
echo "  - Status da API:      sudo systemctl status infraview-api"
echo "  - Logs em tempo real: sudo journalctl -u infraview-api -f"
echo "  - Reiniciar API:      sudo systemctl restart infraview-api"
echo "  - Recarregar Nginx:   sudo systemctl reload nginx"
echo ""

