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
  switch: "bg-emerald-50 text-emerald-700",
  router: "bg-blue-50 text-blue-700",
  printer: "bg-orange-50 text-orange-700",
  server: "bg-violet-50 text-violet-700",
  computer: "bg-cyan-50 text-cyan-700",
  phone: "bg-pink-50 text-pink-700",
  access_point: "bg-teal-50 text-teal-700",
  firewall: "bg-red-50 text-red-700",
  unknown: "bg-slate-100 text-slate-600",
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
        title="Inventário"
        description={`${data?.total ?? 0} equipamentos registrados`}
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
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Buscar hostname, nome, IP ou MAC..."
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
              className="gap-1 text-slate-500"
            >
              <X className="h-4 w-4" /> Limpar filtro
            </Button>
          )}
        </form>
      </Card>

      <Card className="overflow-hidden">
        <ResponsiveTable>
          <table className="min-w-[640px] w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 sm:px-4">Dispositivo</th>
                <th className="px-3 py-3 sm:px-4">IP</th>
                <th className="hidden px-3 py-3 sm:table-cell sm:px-4">MAC</th>
                <th className="px-3 py-3 sm:px-4">Tipo</th>
                <th className="hidden px-3 py-3 md:table-cell md:px-4">Vendor</th>
                <th className="hidden px-3 py-3 lg:table-cell lg:px-4">Fontes</th>
                <th className="hidden px-3 py-3 sm:table-cell sm:px-4">Última visão</th>
                <th className="px-3 py-3 text-right sm:px-4">Ação</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    Carregando dispositivos...
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    Nenhum dispositivo registrado.
                  </td>
                </tr>
              ) : (
                data?.items.map((d) => {
                  const mainName = d.display_name || d.hostname || d.ip_address || "—"
                  const subName = d.display_name && d.hostname && d.display_name !== d.hostname ? d.hostname : null

                  return (
                    <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3 sm:px-4">
                        <div className="font-medium text-slate-900">{mainName}</div>
                        {subName && <div className="text-xs text-slate-400">{subName}</div>}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs sm:px-4 text-slate-700">
                        {d.ip_address ?? "—"}
                      </td>
                      <td className="hidden px-3 py-3 font-mono text-xs text-slate-500 sm:table-cell sm:px-4">
                        {d.mac_address ?? "—"}
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs capitalize ${
                            TYPE_BADGE[d.device_type] ?? TYPE_BADGE.unknown
                          }`}
                        >
                          {d.device_type}
                        </span>
                      </td>
                      <td className="hidden px-3 py-3 text-slate-600 md:table-cell md:px-4">
                        {d.vendor ?? "—"}
                      </td>
                      <td className="hidden px-3 py-3 lg:table-cell lg:px-4">
                        <div className="flex flex-wrap gap-1">
                          {d.sources.map((s) => (
                            <Badge key={s} className="text-[10px] uppercase">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 text-slate-500 sm:table-cell sm:px-4">
                        {new Date(d.last_seen).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-3 text-right sm:px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
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
          <span className="text-sm text-slate-500">
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
