# Guia de Instalação e Implantação — InfraView

Guia oficial para instalação limpa e implantação em produção do **InfraView** em servidores Linux (Ubuntu 22.04 LTS, Ubuntu 24.04 LTS ou Debian 12).

---

## Sumário

1. [Requisitos do Servidor e da Rede](#1-requisitos-do-servidor-e-da-rede)
2. [Método 1: Instalação Automatizada (Recomendado)](#2-método-1-instalação-automatizada-recomendado)
3. [Método 2: Instalação Nativa Passo a Passo (Systemd + Nginx)](#3-método-2-instalação-nativa-passo-a-passo)
4. [Método 3: Instalação com Docker e Docker Compose](#4-método-3-instalação-com-docker-e-docker-compose)
5. [Configuração de Banco de Dados (SQLite vs PostgreSQL)](#5-configuração-de-banco-de-dados)
6. [Configuração de HTTPS / SSL com Let's Encrypt](#6-configuração-de-https--ssl-com-lets-encrypt)
7. [Configuração de Firewall (UFW)](#7-configuração-de-firewall-ufw)
8. [Variáveis de Ambiente (.env)](#8-variáveis-de-ambiente-env)
9. [Rotina de Backup e Restauração](#9-rotina-de-backup-e-restauração)
10. [Atualização do Sistema](#10-atualização-do-sistema)
11. [Diagnóstico e Solução de Problemas](#11-diagnóstico-e-solução-de-problemas)

---

## 1. Requisitos do Servidor e da Rede

### Hardware Mínimo Recomendado

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| **CPU** | 1 vCPU | 2 vCPUs |
| **Memória RAM** | 1.5 GB | 2 GB ou superior |
| **Disco** | 10 GB SSD | 20 GB SSD |
| **Sistema Operacional** | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 LTS |

### Requisitos de Rede (CRÍTICO)

> [!IMPORTANT]
> O servidor onde o InfraView será instalado **deve estar conectado diretamente à LAN / VLAN monitorada** (modo bridge / switch access ou trunk).
> Ambientes como **WSL2** ou VMs com NAT padrão não enxergam os pacotes L2 reais (LLDP e ARP) dos equipamentos de rede. Utilize servidor físico ou VM com placa de rede em modo **Bridged** na rede do cliente.

---

## 2. Método 1: Instalação Automatizada (Recomendado)

O repositório inclui um script instalador autônomo que prepara o sistema operacional, instala as dependências necessárias, configura o serviço `systemd`, compila o frontend e configura o Nginx.

### Passo 1: Baixar ou clonar o repositório no servidor

```bash
sudo mkdir -p /opt/infraview
sudo chown $USER:$USER /opt/infraview
git clone <URL_DO_REPOSITORIO_GITHUB> /opt/infraview
cd /opt/infraview
```

*(Caso transfira via SSH/SCP ou tarball, descompacte o conteúdo em `/opt/infraview`)*

### Passo 2: Executar o instalador

```bash
chmod +x install.sh
sudo bash install.sh
```

O instalador executará:
1. Instalação de pacotes essenciais (`lldpd`, `iproute2`, `python3`, `nginx`, etc.).
2. Ativação e configuração de permissões do daemon `lldpd`.
3. Instalação do Node.js 24 LTS e compilação otimizada do frontend SPA.
4. Criação do ambiente virtual Python (`venv`) e instalação dos módulos da API.
5. Configuração do serviço `/etc/systemd/system/infraview-api.service`.
6. Configuração do Nginx com proxy reverso na porta 80.
7. Teste de saúde da API (`/api/health`).

Ao término, o sistema estará acessível em:
```text
http://<IP_DO_SERVIDOR>/
```

---

## 3. Método 2: Instalação Nativa Passo a Passo

Caso prefira executar cada etapa manualmente:

### 3.1. Instalar pacotes do sistema operacional

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y lldpd iproute2 iputils-ping python3 python3-venv python3-pip python3-dev \
  nginx git curl build-essential
```

Ative o daemon LLDP e conceda permissão de leitura ao usuário `www-data`:

```bash
sudo systemctl enable --now lldpd
sudo usermod -aG _lldpd www-data 2>/dev/null || true
sudo usermod -aG lldpd www-data 2>/dev/null || true
sudo chmod a+rx /usr/sbin/lldpctl /usr/sbin/lldpcli 2>/dev/null || true
```

### 3.2. Instalar Node.js 24 LTS (usado para compilar o frontend)

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # deve ser v24.x.x
```

### 3.3. Clonar e configurar o diretório da aplicação

```bash
sudo mkdir -p /opt/infraview
sudo chown $USER:$USER /opt/infraview
git clone <URL_DO_REPOSITORIO_GITHUB> /opt/infraview
```

### 3.4. Configurar o Backend (FastAPI)

```bash
cd /opt/infraview/backend

# Criar ambiente virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependências
pip install --upgrade pip
pip install -r requirements.txt
pip install psycopg2-binary  # se for usar PostgreSQL

# Criar diretório de dados
mkdir -p data

# Configurar variáveis de ambiente
cp .env.example .env
nano .env
deactivate
```

### 3.5. Compilar o Frontend (React + Vite)

```bash
cd /opt/infraview/frontend
npm install
npm run build
```

Ajuste as permissões de acesso:

```bash
sudo chown -R www-data:www-data /opt/infraview
sudo chmod 755 /opt/infraview
sudo chmod -R 755 /opt/infraview/frontend/dist
sudo chmod -R 775 /opt/infraview/backend/data
```

### 3.6. Configurar o Serviço Systemd para a API

Crie o arquivo `/etc/systemd/system/infraview-api.service`:

```bash
sudo nano /etc/systemd/system/infraview-api.service
```

Cole o seguinte conteúdo:

```ini
[Unit]
Description=InfraView API Service
After=network.target lldpd.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/infraview/backend
Environment="PATH=/opt/infraview/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/opt/infraview/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Ative e inicie o serviço:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now infraview-api
sudo systemctl status infraview-api
```

### 3.7. Configurar o Nginx

Crie a configuração do site `/etc/nginx/sites-available/infraview`:

```bash
sudo nano /etc/nginx/sites-available/infraview
```

Conteúdo:

```nginx
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

    # Proxy para API FastAPI
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
```

Habilite o site e recarregue o Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/infraview /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. Método 3: Instalação com Docker e Docker Compose

O InfraView pode ser executado em containers Docker com suporte a rede do host (`network_mode: host`) para permitir a captura de tráfego L2/L3 e varreduras ARP/Ping.

### 4.1. Instalar Docker e Docker Compose

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo systemctl enable --now docker
```

### 4.2. Executar a pilha InfraView

No diretório do projeto:

```bash
cd /opt/infraview
docker compose up -d --build
```

Verificar logs:

```bash
docker compose logs -f
```

---

## 5. Configuração de Banco de Dados

### Opção A: SQLite (Padrão)

Ideal para instalações simples, testes e redes com até centenas de dispositivos. O banco de dados é gravado em `/opt/infraview/backend/data/network.db` utilizando modo WAL de alta concorrência. Não requer configuração adicional.

### Opção B: PostgreSQL (Recomendado para Grandes Redes)

Para redes com múltiplos switches, milhares de dispositivos ou auditoria intensiva:

1. Instale o PostgreSQL:
   ```bash
   sudo apt install -y postgresql postgresql-contrib
   ```

2. Crie a base e o usuário:
   ```bash
   sudo -u postgres psql
   ```
   ```sql
   CREATE USER infraview WITH ENCRYPTED PASSWORD 'SENHA_MUITO_SEGURA';
   CREATE DATABASE infraview OWNER infraview;
   GRANT ALL PRIVILEGES ON DATABASE infraview TO infraview;
   \q
   ```

3. Instale o driver psycopg2 no ambiente virtual:
   ```bash
   cd /opt/infraview/backend
   source venv/bin/activate
   pip install psycopg2-binary
   deactivate
   ```

4. Atualize `/opt/infraview/backend/.env`:
   ```env
   DATABASE_URL=postgresql+psycopg2://infraview:SENHA_MUITO_SEGURA@localhost:5432/infraview
   ```

5. Reinicie a API:
   ```bash
   sudo systemctl restart infraview-api
   ```

---

## 6. Configuração de HTTPS / SSL com Let's Encrypt

Se o servidor possui um nome de domínio apontado para seu IP (ex: `infraview.empresa.com.br`):

1. Instale o Certbot:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

2. Ajuste o `server_name` no Nginx (`/etc/nginx/sites-available/infraview`):
   ```nginx
   server_name infraview.empresa.com.br;
   ```

3. Emita o certificado SSL automaticamente:
   ```bash
   sudo certbot --nginx -d infraview.empresa.com.br
   ```

4. Atualize `CORS_ORIGINS` no arquivo `/opt/infraview/backend/.env`:
   ```env
   CORS_ORIGINS=https://infraview.empresa.com.br
   ```

5. Reinicie o backend:
   ```bash
   sudo systemctl restart infraview-api
   ```

---

## 7. Configuração de Firewall (UFW)

Para garantir segurança na rede local:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # portas 80 e 443
sudo ufw enable
sudo ufw status verbose
```

---

## 8. Variáveis de Ambiente (.env)

O arquivo de configuração fica localizado em `/opt/infraview/backend/.env`:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DATABASE_URL` | `sqlite:///./data/network.db` | URL de conexão SQLAlchemy (SQLite ou PostgreSQL) |
| `SNMP_COMMUNITY` | `public` | Community string SNMPv2c para enriquecimento de switches/roteadores |
| `PING_ENABLED` | `true` | Ativa a varredura paralela por ping sweep |
| `PING_TIMEOUT_SEC`| `1` | Tempo limite de resposta de cada ping (em segundos) |
| `SCAN_SUBNET` | *(vazio)* | *(Opcional)* Faixa CIDR fixa para ping (ex: `192.168.10.0/24`). Se omitido, auto-detecta via rota default. |
| `CORS_ORIGINS` | `http://localhost:3000` | Origens autorizadas para consumo da API |

---

## 9. Rotina de Backup e Restauração

O InfraView inclui o script automatizado `backup.sh`:

```bash
sudo bash /opt/infraview/backup.sh
```

Os backups são salvos compactados em `/var/backups/infraview/` e o script mantém automaticamente os últimos 15 dias de histórico.

Para agendar o backup diário às 03:00 no `crontab`:

```bash
sudo crontab -e
# Adicione a linha:
0 3 * * * /bin/bash /opt/infraview/backup.sh >/dev/null 2>&1
```

---

## 10. Atualização do Sistema

Para atualizar o InfraView de forma rápida no servidor de produção, utilize o script `update.sh`:

```bash
cd /opt/infraview
sudo bash update.sh
```

Ou execute manualmente se preferir:

```bash
cd /opt/infraview
git pull

# Atualizar backend
cd /opt/infraview/backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

# Atualizar frontend
cd /opt/infraview/frontend
npm install
npm run build

# Ajustar permissões e reiniciar serviços
sudo chown -R www-data:www-data /opt/infraview
sudo systemctl restart infraview-api
sudo systemctl reload nginx
```

---

## 11. Diagnóstico e Solução de Problemas

| Sintoma | Causa Mais Provável | Solução |
|---------|---------------------|---------|
| **Descoberta retorna 0 dispositivos** | Servidor não está conectado à LAN física correta ou interface sem tráfego | Verifique `ip neigh show` no terminal. O servidor deve ter IP na faixa dos equipamentos. |
| **LLDP vazio na descoberta** | Switches da rede não possuem LLDP ativo ou servidor está em porta isolada | Ative o LLDP nos switches (`lldp run` no Cisco/HP/Dell) e confirme `lldpctl -f json`. |
| **Erro "lldpctl permission denied"** | Usuário `www-data` sem grupo `_lldpd` ou binário sem permissão | Execute: `sudo usermod -aG _lldpd,lldpd www-data && sudo chmod a+rx /usr/sbin/lldpctl && sudo systemctl restart infraview-api`. |
| **API offline / Erro 502 Bad Gateway** | Serviço FastAPI parou ou falhou na inicialização | Verifique os logs: `sudo journalctl -u infraview-api -n 50 --no-pager`. |
| **Erro de CORS no navegador** | `CORS_ORIGINS` não corresponde à URL usada | Altere `CORS_ORIGINS` no `.env` para o IP ou domínio exato acessado no navegador. |
| **Sub-rede detectada incorreta no Ping Sweep** | Múltiplas interfaces de rede ativas no servidor | Configure `SCAN_SUBNET=192.168.X.0/24` no arquivo `.env` e reinicie a API. |

---

## Checklist de Validação Final

- [ ] Serviço `lldpd` ativo (`systemctl is-active lldpd`)
- [ ] Serviço `infraview-api` ativo (`systemctl is-active infraview-api`)
- [ ] Serviço `nginx` ativo (`systemctl is-active nginx`)
- [ ] Acesso via navegador exibindo a interface do InfraView
- [ ] Execução da Descoberta via interface concluída com sucesso
- [ ] Visualização do Mapa de Topologia interativo e nós conectados
- [ ] Exportação do inventário CSV funcionando (`infraview-devices.csv`)
