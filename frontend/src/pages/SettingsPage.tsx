import { useQuery } from "@tanstack/react-query"
import { CheckCircle2, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchHealth, fetchSystemInfo } from "@/lib/api"

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-700">{label}</span>
      {ok ? (
        <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> OK</span>
      ) : (
        <span className="flex items-center gap-1 text-sm text-red-500"><XCircle className="h-4 w-4" /> Indisponível</span>
      )}
    </div>
  )
}

export function SettingsPage() {
  const health = useQuery({ queryKey: ["health"], queryFn: fetchHealth })
  const system = useQuery({ queryKey: ["system"], queryFn: fetchSystemInfo })

  return (
    <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Configurações</h2>
        <p className="text-sm text-slate-500">Status do sistema e requisitos de descoberta</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aplicação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <InfoRow label="Nome" value={health.data?.app ?? "InfraView"} />
          <InfoRow label="Versão" value={health.data?.version ?? "—"} />
          <InfoRow label="API" value={health.data?.status === "ok" ? "Online" : "Offline"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ambiente de descoberta</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Sistema operacional" value={`${system.data?.platform ?? "—"} ${system.data?.platform_release ?? ""}`} />
          <InfoRow label="Python" value={system.data?.python_version ?? "—"} />
          <StatusRow ok={!!system.data?.lldpd_installed} label="lldpctl instalado" />
          <StatusRow ok={!!system.data?.lldpd_running} label="Serviço lldpd ativo" />
          <StatusRow ok={!!system.data?.ip_command} label="Comando ip (ARP)" />
          <StatusRow ok={!!system.data?.ping_enabled} label="Ping sweep habilitado" />
          {system.data?.scan_subnet && (
            <InfoRow label="Sub-rede configurada" value={system.data.scan_subnet} />
          )}
          <StatusRow ok={!!system.data?.snmp_community_configured} label="SNMP configurado" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Variáveis de ambiente (.env)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-xs text-slate-600">
          <p>DATABASE_URL — banco SQLite ou PostgreSQL</p>
          <p>SNMP_COMMUNITY — community string SNMP</p>
          <p>PING_ENABLED — true/false para ping sweep</p>
          <p>SCAN_SUBNET — sub-rede CIDR opcional (ex: 192.168.1.0/24)</p>
          <p>CORS_ORIGINS — origens permitidas do frontend</p>
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 text-sm text-blue-800">
          <strong>Deploy em produção:</strong> instale o InfraView em um servidor Linux conectado à rede do cliente.
          Requer lldpd, iproute2 e acesso L2/L3 à infraestrutura monitorada.
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}
