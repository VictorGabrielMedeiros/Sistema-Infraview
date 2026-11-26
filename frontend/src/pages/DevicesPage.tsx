import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Download, Search, Trash2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { DiscoveryButton } from "@/components/DiscoveryButton"
import { PageHeader, ResponsiveTable } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { exportDevicesCsv, fetchDevices, clearDevices, deleteDevice } from "@/lib/api"

const TYPE_BADGE: Record<string, string> = {
  switch: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50",
  router: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/50",
  printer: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/50",
  server: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/50",
  computer: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/50",
  phone: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/60 dark:text-pink-300 dark:border-pink-800/50",
  tablet: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 dark:border-fuchsia-800/50",
  access_point: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/50",
  firewall: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/50",
  camera: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50",
  tv: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/50",
  unknown: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/70 dark:text-slate-400 dark:border-slate-700/50",
}

const CONFIDENCE_BADGE: Record<string, string> = {
  alta: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50",
  media: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/50",
  baixa: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50",
}

export function DevicesPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["devices", page, search],
    queryFn: () => fetchDevices(page, 20, search),
  })

  const clearMutation = useMutation({
    mutationFn: clearDevices,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      queryClient.invalidateQueries({ queryKey: ["metrics"] })
      queryClient.invalidateQueries({ queryKey: ["topology"] })
      toast.success("Dispositivos limpos com sucesso")
    },
    onError: () => toast.error("Falha ao limpar dispositivos"),
  })

  const deleteSingleMutation = useMutation({
    mutationFn: (id: string) => deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      queryClient.invalidateQueries({ queryKey: ["metrics"] })
      queryClient.invalidateQueries({ queryKey: ["topology"] })
      toast.success("Dispositivo removido com sucesso")
    },
    onError: () => toast.error("Falha ao remover dispositivo"),
  })

  const handleExport = async () => {
    try {
      const response = await exportDevicesCsv()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement("a")
      link.href = url
      link.download = "infraview-devices.csv"
      link.click()
      window.URL.revokeObjectURL(url)
      toast.success("CSV exportado com sucesso")
    } catch {
      toast.error("Falha ao exportar CSV")
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Inventário de Equipamentos"
        description={`${data?.total ?? 0} equipamentos detectados na rede local`}
      >
        <Button
          variant="destructive"
          className="w-full sm:w-auto gap-2"
          onClick={() => {
            if (confirm("Limpar todos os dispositivos e links da base?")) clearMutation.mutate()
          }}
          disabled={clearMutation.isPending}
        >
          <Trash2 className="h-4 w-4" /> Limpar tudo
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={handleExport}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
        <DiscoveryButton />
      </PageHeader>

      <Card className="p-3 sm:p-4">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(searchInput)
            setPage(1)
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
              placeholder="Buscar por hostname, máquina (ex: VICTOR-TI), IP ou MAC..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" className="w-full sm:w-auto">
            Buscar
          </Button>
          {search && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("")
                setSearchInput("")
                setPage(1)
              }}
              className="gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <X className="h-4 w-4" /> Limpar filtro
            </Button>
          )}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <ResponsiveTable>
          <table className="min-w-[640px] w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
              <tr>
                <th className="px-3 py-3 sm:px-4">Dispositivo</th>
                <th className="px-3 py-3 sm:px-4">IP</th>
                <th className="hidden px-3 py-3 sm:table-cell sm:px-4">MAC</th>
                <th className="px-3 py-3 sm:px-4">Tipo</th>
                <th className="hidden px-3 py-3 md:table-cell md:px-4">Fabricante / Modelo</th>
                <th className="hidden px-3 py-3 lg:table-cell lg:px-4">Identificação</th>
                <th className="hidden px-3 py-3 sm:table-cell sm:px-4">Última visão</th>
                <th className="px-3 py-3 text-right sm:px-4">Ação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                    Carregando dispositivos...
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                    Nenhum dispositivo encontrado.
                  </td>
                </tr>
              ) : (
                data?.items.map((d) => {
                  const mainName = d.display_name || d.hostname || d.ip_address || "—"
                  const subName = d.display_name && d.hostname && d.display_name !== d.hostname ? d.hostname : null

                  return (
                    <tr
                      key={d.id}
                      className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors dark:border-slate-800/80 dark:hover:bg-slate-850/50"
                    >
                      <td className="px-3 py-3 sm:px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{mainName}</div>
                        {subName && (
                          <div className="text-xs text-slate-400 dark:text-slate-500 font-mono">{subName}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs sm:px-4 text-slate-700 dark:text-slate-300">
                        {d.ip_address ?? "—"}
                      </td>
                      <td className="hidden px-3 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 sm:table-cell sm:px-4">
                        <div>{d.mac_address ?? "—"}</div>
                        {d.is_randomized_mac && (
                          <span className="inline-block mt-0.5 rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-sans font-medium text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                            MAC Privado
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <span
                          className={`rounded-lg border px-2 py-0.5 text-xs font-medium capitalize ${
                            TYPE_BADGE[d.device_type] ?? TYPE_BADGE.unknown
                          }`}
                        >
                          {d.device_type}
                        </span>
                        {d.device_category_detail && (
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {d.device_category_detail}
                          </div>
                        )}
                      </td>
                      <td className="hidden px-3 py-3 text-slate-600 dark:text-slate-400 md:table-cell md:px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{d.vendor ?? "—"}</div>
                        {d.model && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">{d.model}</div>
                        )}
                      </td>
                      <td className="hidden px-3 py-3 lg:table-cell lg:px-4">
                        <div className="flex flex-wrap items-center gap-1">
                          {d.identification_confidence && (
                            <span
                              className={`rounded-md border px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                                CONFIDENCE_BADGE[d.identification_confidence] ?? CONFIDENCE_BADGE.baixa
                              }`}
                            >
                              {d.identification_confidence}
                            </span>
                          )}
                          {d.sources.map((s) => (
                            <Badge
                              key={s}
                              className="text-[10px] uppercase font-mono px-1.5 py-0.2"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                        {d.identification_method && (
                          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {d.identification_method}
                          </div>
                        )}
                      </td>
                      <td className="hidden px-3 py-3 text-xs text-slate-500 dark:text-slate-400 sm:table-cell sm:px-4">
                        {new Date(d.last_seen).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-3 text-right sm:px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="Remover dispositivo"
                          onClick={() => {
                            if (confirm(`Remover "${mainName}"?`)) {
                              deleteSingleMutation.mutate(d.id)
                            }
                          }}
                          disabled={deleteSingleMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </ResponsiveTable>
      </Card>

      {data && data.pages > 1 && (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Página {data.page} de {data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  )
}
