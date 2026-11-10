# InfraView

Plataforma profissional de descoberta, auditoria e mapeamento de topologia de rede L2/L3.

![InfraView](frontend/src/assets/hero.png)

---

## Funcionalidades

- **Descoberta Multi-Protocolo:**
  - **LLDP (Link Layer Discovery Protocol):** detecta switches, roteadores, portas locais/remotas, chassis ID e recursos.
  - **ARP Inspection:** mapeia endereços IP e MAC em tempo real diretamente da tabela de vizinhança.
  - **Ping Sweep Paralelo:** descobre hosts ativos de forma rápida com múltiplos threads por sub-rede CIDR.
  - **SNMPv2c Enrichment:** coleta sysDescr, sysName, vendor, modelo e tipo de dispositivo automaticamente.
- **Topologia Interativa:**
  - Visualização gráfica com React Flow e algoritmo de layout hierárquico Dagre.
  - Filtros interativos por tipo (Switch, Roteador, Servidor, Firewall, AP, etc.).
  - Edição direta de nós: alteração de nome de exibição, tipo e ícone customizado.
  - Remoção de dispositivos obsoletos diretamente pelo mapa.
- **Dashboard e Métricas:**
  - Distribuição gráfica de dispositivos por categoria e por protocolo de descoberta (Recharts).
  - Contador de equipamentos com conectividade somente L2.
- **Inventário Completo:**
  - Tabela paginada com busca em tempo real (hostname, IP, MAC, nome customizado).
  - Exportação completa em formato CSV (`infraview-devices.csv`).
  - Remoção individual ou em lote.
- **Histórico e Auditoria:**
  - Registro de auditoria de cada execução de scan com data, duração, alertas e status.
- **Painel de Configurações:**
  - Diagnóstico em tempo real do ambiente de rede (lldpd, iproute2, ping, SNMP).

---

## Requisitos do Sistema

- **Servidor Linux** (Ubuntu 22.04+, Ubuntu 24.04+ ou Debian 12+) conectado diretamente à LAN monitorada.
- **Python 3.12+**, `lldpd`, `iproute2`.
- **Node.js 24 LTS** (apenas para compilação estática do frontend).

> [!NOTE]
> Para descoberta L2 real de switches e roteadores, o servidor deve ter interface física ou placa de rede em modo bridge na LAN. WSL2 ou VMs com NAT não enxergam pacotes LLDP/ARP reais.

---

## Instalação e Implantação

### Opção 1: Instalação Automatizada (Linux / Produção)

No servidor Linux de destino:

```bash
git clone <URL_DO_REPOSITORIO> /opt/infraview
cd /opt/infraview
sudo bash install.sh
```

O script configura automaticamente as dependências, `lldpd`, Python `venv`, compila o frontend, cria o serviço `infraview-api.service` no systemd e habilita o proxy no Nginx.

Guia completo e detalhado: [docs/INSTALACAO-SERVIDOR.md](docs/INSTALACAO-SERVIDOR.md).

---

### Opção 2: Docker Compose

```bash
docker compose up -d --build
```

O container utiliza `network_mode: host` e capabilities de rede para garantir visibilidade direta das interfaces da máquina hospedeira.

---

### Opção 3: Ambiente de Desenvolvimento Local

#### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate    # No Windows: .\venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse no navegador: `http://localhost:3000`

---

## Variáveis de Ambiente (`.env`)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DATABASE_URL` | `sqlite:///./data/network.db` | Conexão SQLite ou PostgreSQL (`postgresql+psycopg2://user:pass@host/db`) |
| `SNMP_COMMUNITY` | `public` | Community SNMP para enriquecimento |
| `PING_ENABLED` | `true` | Ativar varredura por ping sweep |
| `PING_TIMEOUT_SEC` | `1` | Timeout do ping sweep em segundos |
| `SCAN_SUBNET` | *(vazio)* | *(Opcional)* Sub-rede fixa para ping (ex: `192.168.1.0/24`) |
| `CORS_ORIGINS` | `http://localhost:3000` | Origens autorizadas do frontend |

---

## Rotas Principais da API

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/discovery/run` | Dispara execução de descoberta de rede |
| `GET` | `/api/discovery/runs` | Lista histórico de execuções |
| `DELETE` | `/api/discovery/runs/clear` | Limpa histórico de auditoria |
| `GET` | `/api/topology` | Nós e arestas do mapa de rede |
| `GET` | `/api/devices` | Lista paginada do inventário |
| `GET` | `/api/devices/{id}` | Detalhes e portas de um dispositivo |
| `PATCH` | `/api/devices/{id}` | Atualiza nome customizado, tipo ou ícone |
| `DELETE` | `/api/devices/{id}` | Remove um dispositivo individual |
| `DELETE` | `/api/devices/clear` | Limpa inventário completo |
| `GET` | `/api/metrics` | Métricas resumidas para o dashboard |
| `GET` | `/api/system/info` | Diagnóstico de serviços (lldpd, arp, ping) |
| `GET` | `/api/export/devices.csv` | Exportação de inventário em CSV |
| `GET` | `/api/health` | Status de saúde da aplicação |

---

## Licença

Desenvolvido para auditoria e gestão profissional de infraestrutura de redes.
