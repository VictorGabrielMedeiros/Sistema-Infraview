#!/usr/bin/env bash
# ==============================================================================
# InfraView — Script de Backup do Banco de Dados
# ==============================================================================
set -e

BACKUP_DIR="/var/backups/infraview"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y%m%d_%H%M%S)
INSTALL_DIR="/opt/infraview"
if [ ! -d "$INSTALL_DIR" ]; then
  INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

ENV_FILE="$INSTALL_DIR/backend/.env"
if [ -f "$ENV_FILE" ]; then
  export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

echo "Iniciando backup do InfraView em $DATE..."

if [[ "$DATABASE_URL" == *"sqlite"* ]]; then
  DB_FILE="$INSTALL_DIR/backend/data/network.db"
  if [ -f "$DB_FILE" ]; then
    BACKUP_FILE="$BACKUP_DIR/infraview_sqlite_$DATE.db"
    sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"
    echo "Backup SQLite criado em: $BACKUP_FILE"
    gzip -f "$BACKUP_FILE"
    echo "Arquivo comprimido: ${BACKUP_FILE}.gz"
  else
    echo "Arquivo SQLite não encontrado em $DB_FILE."
  fi
elif [[ "$DATABASE_URL" == *"postgres"* ]]; then
  BACKUP_FILE="$BACKUP_DIR/infraview_postgres_$DATE.sql.gz"
  # Extrair parâmetros ou rodar pg_dump
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
  echo "Backup PostgreSQL criado em: $BACKUP_FILE"
fi

# Manter apenas os últimos 15 backups para economizar disco
find "$BACKUP_DIR" -type f -name "infraview_*" -mtime +15 -delete 2>/dev/null || true
echo "Rotina de backup finalizada."

