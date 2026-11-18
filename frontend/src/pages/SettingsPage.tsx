import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, XCircle, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/PageHeader"
import { fetchHealth, fetchSystemInfo } from "@/lib/api"

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 py-3 last:border-0">
      <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{label}</span>
      {ok ? (
        <span className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" /> OK
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-red-500 dark:text-red-400">
          <XCircle className="h-4 w-4" /> Indisponível
        </span>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 py-3 last:border-0">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  )
}

export function SettingsPage() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth })
  const system = useQuery({ queryKey: ["system"], queryFn: fetchSystemInfo })

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <PageHeader
        title="Configurações do Sistema"
        description="Diagnóstico em tempo real, status do ambiente e parâmetros de varredura"
      />

      <Card>
        <CardHeader>
          <CardTitle>Aplicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="Nome da Plataforma" value={health.data?.app ?? "InfraView"} />
          <InfoRow label="Versão do Sistema" value={health.data?.version ?? "—"} />
          <InfoRow
            label="Status da API FastAPI"
            value={health.data?.status === "ok" ? "Online (Ativo)" : "Offline"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ambiente de Descoberta</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow
            label="Sistema Operacional"
            value={`${system.data?.platform ?? "—"} ${system.data?.platform_release ?? ""}`}
          />
          <InfoRow label="Versão Python" value={system.data?.python_version ?? "—"} />
          <StatusRow ok={!!system.data?.lldpd_installed} label="lldpctl instalado" />
          <StatusRow ok={!!system.data?.lldpd_running} label="Serviço lldpd ativo" />
          <StatusRow ok={!!system.data?.ip_command} label="Comando ip (Tabela ARP)" />
          <StatusRow ok={!!system.data?.ping_enabled} label="Ping Sweep habilitado" />
          {system.data?.scan_subnet && (
            <InfoRow label="Sub-rede configurada (CIDR)" value={system.data.scan_subnet} />
          )}
          <StatusRow ok={!!system.data?.snmp_community_configured} label="SNMPv2c configurado" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variáveis de Ambiente (.env)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-xs text-slate-600 dark:text-slate-300">
          <p>
            <span className="font-semibold text-blue-600 dark:text-blue-400">DATABASE_URL</span> — banco SQLite (local) ou PostgreSQL (produção)
          </p>
          <p>
            <span className="font-semibold text-blue-600 dark:text-blue-400">SNMP_COMMUNITY</span> — community string SNMP (padrão: public)
          </p>
          <p>
            <span className="font-semibold text-blue-600 dark:text-blue-400">PING_ENABLED</span> — true/false para varredura por ping sweep
          </p>
          <p>
            <span className="font-semibold text-blue-600 dark:text-blue-400">SCAN_SUBNET</span> — sub-rede(s) CIDR fixa(s) (ex: 192.168.1.0/24, 10.0.0.0/24)
          </p>
          <p>
            <span className="font-semibold text-blue-600 dark:text-blue-400">CORS_ORIGINS</span> — origens autorizadas para consumo da API
          </p>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/30">
        <CardContent className="p-4 sm:p-5 text-sm text-blue-900 dark:text-blue-200 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Servidor de Produção</p>
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
              Para mapeamento completo da topologia L2/L3 (switches, roteadores e computadores), instale o InfraView em um servidor Linux conectado fisicamente à rede local. Requer lldpd, iproute2 e rotas ativas na LAN monitorada.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
