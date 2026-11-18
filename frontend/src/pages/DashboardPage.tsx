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
import { Link2, Monitor, Radar, WifiOff, Activity } from "lucide-react"
import { DiscoveryButton } from "@/components/DiscoveryButton"
import { PageHeader } from "@/components/layout/PageHeader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchMetrics } from "@/lib/api"
import { useTheme } from "@/lib/theme"

const TYPE_COLORS: Record<string, string> = {
  switch: "#10b981",
  router: "#3b82f6",
  printer: "#f97316",
  server: "#8b5cf6",
  computer: "#06b6d4",
  phone: "#ec4899",
  access_point: "#14b8a6",
  firewall: "#ef4444",
  unknown: "#64748b",
}

const TYPE_LABELS: Record<string, string> = {
  switch: "Switch",
  router: "Roteador",
  printer: "Impressora",
  server: "Servidor",
  computer: "Computador",
  phone: "Telefone IP",
  access_point: "Access Point",
  firewall: "Firewall",
  unknown: "Outros",
}

export function DashboardPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const { data, isLoading } = useQuery({ queryKey: ["metrics"], queryFn: fetchMetrics })

  const typeData = Object.entries(data?.devices_by_type ?? {}).map(([name, value]) => ({
    name: TYPE_LABELS[name] ?? name,
    rawName: name,
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
        description={lastScan ?? "Visão geral da infraestrutura e topologia de rede"}
      >
        <DiscoveryButton />
      </PageHeader>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center text-slate-500 dark:text-slate-400">
          <Activity className="h-6 w-6 animate-spin text-blue-600 mr-2" />
          <span>Carregando métricas da infraestrutura...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <MetricCard
              icon={<Monitor className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Dispositivos Ativos"
              value={data?.total_devices ?? 0}
              color="blue"
            />
            <MetricCard
              icon={<Link2 className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Conexões L2 Mapeadas"
              value={data?.total_links ?? 0}
              color="emerald"
            />
            <MetricCard
              icon={<WifiOff className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Somente L2 (Sem IP)"
              value={data?.l2_only_devices ?? 0}
              color="amber"
            />
            <MetricCard
              icon={<Radar className="h-5 w-5 sm:h-6 sm:w-6" />}
              title="Protocolos Ativos"
              value={Object.keys(data?.devices_by_source ?? {}).length}
              color="indigo"
            />
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Dispositivos por Categoria</CardTitle>
              </CardHeader>
              <CardContent className="h-64 sm:h-80">
                {typeData.length === 0 ? (
                  <EmptyChart message="Execute uma descoberta para gerar estatísticas da rede" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={typeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        stroke={isDark ? "#0f172a" : "#ffffff"}
                        strokeWidth={2}
                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {typeData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#0f172a" : "#ffffff",
                          borderColor: isDark ? "#334155" : "#e2e8f0",
                          borderRadius: "0.75rem",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
                          color: isDark ? "#f8fafc" : "#0f172a",
                          fontSize: "12px",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">Fontes de Descoberta</CardTitle>
              </CardHeader>
              <CardContent className="h-64 sm:h-80">
                {sourceData.length === 0 ? (
                  <EmptyChart message="Dados de LLDP, NetBIOS, ARP, Ping e SNMP aparecerão aqui" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sourceData}>
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: isDark ? "#94a3b8" : "#64748b" }}
                        axisLine={{ stroke: isDark ? "#334155" : "#e2e8f0" }}
                        tickLine={{ stroke: isDark ? "#334155" : "#e2e8f0" }}
                      />
                      <YAxis
                        allowDecimals={false}
                        width={30}
                        tick={{ fontSize: 11, fill: isDark ? "#94a3b8" : "#64748b" }}
                        axisLine={{ stroke: isDark ? "#334155" : "#e2e8f0" }}
                        tickLine={{ stroke: isDark ? "#334155" : "#e2e8f0" }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? "#0f172a" : "#ffffff",
                          borderColor: isDark ? "#334155" : "#e2e8f0",
                          borderRadius: "0.75rem",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
                          color: isDark ? "#f8fafc" : "#0f172a",
                          fontSize: "12px",
                        }}
                      />
                      <Bar
                        dataKey="value"
                        name="Equipamentos"
                        fill="#3b82f6"
                        radius={[6, 6, 0, 0]}
                      />
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

function MetricCard({
  icon,
  title,
  value,
  color = "blue",
}: {
  icon: ReactNode
  title: string
  value: number
  color?: "blue" | "emerald" | "amber" | "indigo"
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border-blue-100 dark:border-blue-900/50",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100 dark:border-amber-900/50",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50",
  }

  return (
    <Card className="hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150">
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-xs sm:h-12 sm:w-12 ${colorMap[color]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-3xl">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center text-xs sm:text-sm text-slate-400 dark:text-slate-500">
      {message}
    </div>
  )
}
