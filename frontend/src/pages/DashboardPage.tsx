import type { ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Link2, Monitor, Radar, WifiOff } from "lucide-react"
import { DiscoveryButton } from "@/components/DiscoveryButton"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchMetrics } from "@/lib/api"

const TYPE_COLORS: Record<string, string> = {
  switch: "#10b981",
  router: "#3b82f6",
  printer: "#f97316",
  server: "#8b5cf6",
  unknown: "#64748b",
}

export function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics })

  const typeData = Object.entries(data?.devices_by_type ?? {}).map(([name, value]) => ({
    name,
    value,
    fill: TYPE_COLORS[name] ?? "#64748b",
  }))

  const sourceData = Object.entries(data?.devices_by_source ?? {}).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
  }))

  const lastScan = data?.last_scan
    ? `Último scan: ${new Date(data.last_scan).toLocaleString("pt-BR")}`
    : undefined

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Dashboard"
        description={lastScan ?? "Visão geral da infraestrutura de rede"}
      >
        <DiscoveryButton />
      </PageHeader>

      {isLoading ? (
        <p className="text-slate-500">Carregando métricas...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <MetricCard icon={<Monitor />} title="Dispositivos" value={data?.total_devices ?? 0} />
            <MetricCard icon={<Link2 />} title="Links L2" value={data?.total_links ?? 0} />
            <MetricCard icon={<WifiOff />} title="Somente L2" value={data?.l2_only_devices ?? 0} />
            <MetricCard icon={<Radar />} title="Fontes" value={Object.keys(data?.devices_by_source ?? {}).length} />
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Dispositivos por tipo</CardTitle>
              </CardHeader>
              <CardContent className="h-56 sm:h-72">
                {typeData.length === 0 ? (
                  <EmptyChart message="Execute uma descoberta para ver estatísticas" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {typeData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Fontes de descoberta</CardTitle>
              </CardHeader>
              <CardContent className="h-56 sm:h-72">
                {sourceData.length === 0 ? (
                  <EmptyChart message="LLDP, ARP, Ping e SNMP aparecerão aqui" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} width={30} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({ icon, title, value }: { icon: ReactNode; title: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:h-12 sm:w-12">
          {icon}
        </div>
        <div>
          <p className="text-xs text-slate-500 sm:text-sm">{title}</p>
          <p className="text-2xl font-bold text-slate-900 sm:text-3xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">{message}</div>
  )
}
