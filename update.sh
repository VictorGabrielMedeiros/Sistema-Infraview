#!/usr/bin/env bash
# ==============================================================================
# InfraView — Script de Atualização Rápida em Produção
# ==============================================================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Erro: Execute este script como root ou com sudo.${NC}"
  echo "Uso: sudo bash update.sh"
  exit 1
fi

INSTALL_DIR="/opt/infraview"
if [ ! -d "$INSTALL_DIR" ]; then
  INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

cd "$INSTALL_DIR"
echo -e "${BLUE}=== Atualizando InfraView em ${INSTALL_DIR} ===${NC}"

# 1. Puxar as novidades do Git
echo -e "${BLUE}[1/4] Baixando atualizações do repositório...${NC}"
git pull origin main

# 2. Atualizar Backend
echo -e "${BLUE}[2/4] Atualizando dependências do Backend...${NC}"
cd "$INSTALL_DIR/backend"
if [ -d "venv" ]; then
  source venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
  deactivate
fi

# 3. Recompilar Frontend
echo -e "${BLUE}[3/4] Recompilando o Frontend...${NC}"
cd "$INSTALL_DIR/frontend"
npm install
npm run build

# 4. Ajustar permissões e reiniciar serviços
echo -e "${BLUE}[4/4] Reiniciando serviços...${NC}"
chown -R www-data:www-data "$INSTALL_DIR"
chmod -R 755 "$INSTALL_DIR/frontend/dist"
chmod -R 775 "$INSTALL_DIR/backend/data"

systemctl restart infraview-api
systemctl reload nginx

echo ""
echo -e "${GREEN}==========================================================${NC}"
echo -e "${GREEN}        InfraView atualizado com sucesso!                ${NC}"
echo -e "${GREEN}==========================================================${NC}"
echo "Status da API: $(systemctl is-active infraview-api)"
echo "Status do Nginx: $(systemctl is-active nginx)"
