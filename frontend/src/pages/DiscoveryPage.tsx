import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, CheckCircle2, Clock, Loader2, XCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { DiscoveryButton } from "@/components/DiscoveryButton"
import { PageHeader, ResponsiveTable } from "@/components/layout/PageHeader"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchDiscoveryRuns, clearDiscoveryRuns } from "@/lib/api"

const STATUS_ICON = {
  completed: CheckCircle2,
  running: Loader2,
  failed: XCircle,
} as const

const STATUS_COLOR = {
  completed: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800/50",
  running: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-300 dark:bg-blue-950/60 dark:border-blue-800/50",
  failed: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/60 dark:border-red-800/50",
} as const

export function DiscoveryPage() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ["discovery-runs"],
    queryFn: fetchDiscoveryRuns,
    refetchInterval: 5000,
  })

  const clearMutation = useMutation({
    mutationFn: clearDiscoveryRuns,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discovery-runs"] })
      queryClient.invalidateQueries({ queryKey: ["metrics"] })
      toast.success("Histórico limpo com sucesso")
    },
    onError: () => toast.error("Falha ao limpar histórico")
  })

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Histórico de Descobertas"
        description="Auditoria de varreduras LLDP, NetBIOS, ARP, Ping e SNMP"
      >
        <Button
          variant="destructive"
          className="w-full sm:w-auto gap-2"
          onClick={() => {
            if (confirm("Limpar histórico de auditoria de descobertas?")) clearMutation.mutate()
          }}
          disabled={clearMutation.isPending}
        >
          <Trash2 className="h-4 w-4" /> Limpar histórico
        </Button>
        <DiscoveryButton />
      </PageHeader>

      <Card className="overflow-hidden">
        <ResponsiveTable>
          <table className="min-w-[560px] w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3 sm:px-4">Status</th>
                <th className="px-3 py-3 sm:px-4">Início</th>
                <th className="hidden px-3 py-3 sm:table-cell sm:px-4">Duração</th>
                <th className="px-3 py-3 sm:px-4">Dispositivos</th>
                <th className="px-3 py-3 sm:px-4">Conexões</th>
                <th className="hidden px-3 py-3 md:table-cell md:px-4">Observações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                    Carregando auditoria...
                  </td>
                </tr>
              ) : data?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                    Nenhuma execução de descoberta gravada.
                  </td>
                </tr>
              ) : (
                data?.map((run) => {
                  const Icon = STATUS_ICON[run.status as keyof typeof STATUS_ICON] ?? Clock
                  const color = STATUS_COLOR[run.status as keyof typeof STATUS_COLOR] ?? "text-slate-600 bg-slate-50 dark:text-slate-300 dark:bg-slate-800"
                  const duration =
                    run.completed_at && run.started_at
                      ? `${Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s`
                      : "—"

                  return (
                    <tr
                      key={run.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors dark:border-slate-800/80 dark:hover:bg-slate-850/50"
                    >
                      <td className="px-3 py-3 sm:px-4">
                        <Badge className={`gap-1.5 border font-medium ${color}`}>
                          <Icon className={`h-3 w-3 ${run.status === "running" ? "animate-spin" : ""}`} />
                          <span className="capitalize">{run.status}</span>
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-xs sm:px-4 sm:text-sm font-medium text-slate-800 dark:text-slate-200">
                        {new Date(run.started_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="hidden px-3 py-3 sm:table-cell sm:px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {duration}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100 sm:px-4">
                        {run.devices_found}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900 dark:text-slate-100 sm:px-4">
                        {run.links_found}
                      </td>
                      <td className="hidden px-3 py-3 md:table-cell md:px-4">
                        {run.error_message ? (
                          <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="line-clamp-2">{run.error_message}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </ResponsiveTable>
      </Card>
    </div>
  )
}
