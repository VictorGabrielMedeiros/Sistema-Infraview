import dagre from "@dagrejs/dagre"
import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ArrowDownUp,
  ArrowLeftRight,
  BookmarkPlus,
  Copy,
  Download,
  Filter,
  FolderGit2,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  DeviceNode,
  type DeviceNodeData,
  ICON_MAP_LG,
  ALL_ICON_KEYS,
  ICON_LABELS,
} from "@/components/DeviceNode"
import { DiscoveryButton } from "@/components/DiscoveryButton"
import { PageHeader } from "@/components/layout/PageHeader"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  fetchDevice,
  fetchTopology,
  updateDevice,
  deleteDevice,
  fetchSnapshots,
  fetchSnapshot,
  createSnapshot,
  deleteSnapshot,
  restoreSnapshot,
  type TopologyNode,
  type SnapshotSummary,
} from "@/lib/api"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

const nodeTypes = { device: DeviceNode }

const TYPE_FILTERS = [
  "all",
  "switch",
  "router",
  "server",
  "computer",
  "printer",
  "phone",
  "access_point",
  "firewall",
  "unknown",
] as const

const TYPE_FILTER_LABELS: Record<string, string> = {
  all: "Todos",
  switch: "Switch",
  router: "Roteador",
  server: "Servidor",
  computer: "Computador",
  printer: "Impressora",
  phone: "Telefone",
  access_point: "AP",
  firewall: "Firewall",
  unknown: "Outros",
}

function layoutElements(nodes: Node[], edges: Edge[], direction: "TB" | "LR" = "TB") {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  const isHorizontal = direction === "LR"

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: isHorizontal ? 60 : 70,
    ranksep: isHorizontal ? 100 : 90,
  })

  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 220, height: 95 }))
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target))
  dagre.layout(dagreGraph)

  return nodes.map((node) => {
    const pos = dagreGraph.node(node.id)
    return {
      ...node,
      position: { x: pos.x - 110, y: pos.y - 47 },
    }
  })
}

function toFlowNodes(apiNodes: TopologyNode[], searchFilter: string): Node[] {
  const lowerSearch = searchFilter.trim().toLowerCase()

  return apiNodes.map((n) => {
    const isMatch =
      lowerSearch.length > 0 &&
      Boolean(
        (n.label && n.label.toLowerCase().includes(lowerSearch)) ||
          (n.ip && n.ip.toLowerCase().includes(lowerSearch)) ||
          (n.mac && n.mac.toLowerCase().includes(lowerSearch)) ||
          (n.hostname && n.hostname.toLowerCase().includes(lowerSearch)) ||
          (n.display_name && n.display_name.toLowerCase().includes(lowerSearch)),
      )

    return {
      id: n.id,
      type: "device",
      data: {
        label: n.display_name || n.hostname || n.ip || n.mac || "Dispositivo",
        type: n.type,
        ip: n.ip,
        l2_only: n.l2_only,
        icon_type: n.icon_type,
        display_name: n.display_name,
        isHighlighted: isMatch,
      } satisfies DeviceNodeData,
      position: { x: 0, y: 0 },
    }
  })
}

export function TopologyPage() {
  const queryClient = useQueryClient()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string>("live")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [direction, setDirection] = useState<"TB" | "LR">("TB")
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Modals
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [snapshotName, setSnapshotName] = useState("")
  const [snapshotDescription, setSnapshotDescription] = useState("")

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Edit node state in Sheet
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editIcon, setEditIcon] = useState<string | null>(null)
  const [editType, setEditType] = useState<string>("unknown")

  // Live queries
  const topologyQuery = useQuery({
    queryKey: ["topology"],
    queryFn: fetchTopology,
    enabled: selectedSnapshotId === "live",
  })
  const snapshotsQuery = useQuery({
    queryKey: ["snapshots"],
    queryFn: fetchSnapshots,
  })
  const snapshotDetailQuery = useQuery({
    queryKey: ["snapshot", selectedSnapshotId],
    queryFn: () => fetchSnapshot(selectedSnapshotId),
    enabled: selectedSnapshotId !== "live",
  })

  // Device query for sheet
  const deviceQuery = useQuery({
    queryKey: ["device", selectedId],
    queryFn: () => fetchDevice(selectedId!),
    enabled: !!selectedId && selectedSnapshotId === "live",
  })

  // Mutations
  const createSnapshotMutation = useMutation({
    mutationFn: (vars: { name: string; description?: string }) => createSnapshot(vars),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["snapshots"] })
      toast.success(`Rede "${data.name}" salva no histórico!`)
      setIsSaveModalOpen(false)
      setSnapshotName("")
      setSnapshotDescription("")
      setSelectedSnapshotId(data.id)
    },
    onError: () => toast.error("Erro ao salvar topologia no histórico"),
  })

  const deleteSnapshotMutation = useMutation({
    mutationFn: (id: string) => deleteSnapshot(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["snapshots"] })
      toast.success("Topologia excluída do histórico")
      if (selectedSnapshotId === id) {
        setSelectedSnapshotId("live")
      }
    },
    onError: () => toast.error("Erro ao excluir histórico"),
  })

  const restoreSnapshotMutation = useMutation({
    mutationFn: (id: string) => restoreSnapshot(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["topology"] })
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      queryClient.invalidateQueries({ queryKey: ["metrics"] })
      toast.success(`Rede "${data.name}" restaurada como a rede ativa no sistema!`)
      setSelectedSnapshotId("live")
      setIsHistoryModalOpen(false)
    },
    onError: () => toast.error("Erro ao restaurar rede"),
  })

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string
      display_name?: string | null
      icon_type?: string | null
      device_type?: string | null
    }) =>
      updateDevice(vars.id, {
        display_name: vars.display_name,
        icon_type: vars.icon_type,
        device_type: vars.device_type,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topology"] })
      queryClient.invalidateQueries({ queryKey: ["device", selectedId] })
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      toast.success("Dispositivo atualizado com sucesso")
      setIsEditing(false)
    },
    onError: () => {
      toast.error("Erro ao atualizar dispositivo")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topology"] })
      queryClient.invalidateQueries({ queryKey: ["devices"] })
      queryClient.invalidateQueries({ queryKey: ["metrics"] })
      toast.success("Dispositivo removido com sucesso")
      setSelectedId(null)
      setIsEditing(false)
    },
    onError: () => {
      toast.error("Erro ao remover dispositivo")
    },
  })

  // Current active data (either live or historical snapshot)
  const currentData = useMemo(() => {
    if (selectedSnapshotId === "live") {
      return topologyQuery.data ?? { nodes: [], edges: [] }
    }
    return snapshotDetailQuery.data ?? { nodes: [], edges: [] }
  }, [selectedSnapshotId, topologyQuery.data, snapshotDetailQuery.data])

  // Dynamic counts for filters
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    if (!currentData.nodes) return counts
    counts.all = currentData.nodes.length
    for (const n of currentData.nodes) {
      counts[n.type] = (counts[n.type] || 0) + 1
    }
    return counts
  }, [currentData.nodes])

  const filtered = useMemo(() => {
    const rawNodes = currentData.nodes || []
    const nodes =
      typeFilter === "all" ? rawNodes : rawNodes.filter((n) => n.type === typeFilter)
    const nodeIds = new Set(nodes.map((n) => n.id))
    const edges = (currentData.edges || []).filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
    )
    return { nodes, edges }
  }, [currentData, typeFilter])

  useEffect(() => {
    const flowNodes = toFlowNodes(filtered.nodes, searchQuery)
    const flowEdges = filtered.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#3b82f6", strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: isDark ? "#94a3b8" : "#475569", fontWeight: 600 },
      labelBgStyle: { fill: isDark ? "#0f172a" : "#ffffff", fillOpacity: 0.95 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 6,
    }))
    setNodes(layoutElements(flowNodes, flowEdges, direction))
    setEdges(flowEdges)
  }, [filtered, searchQuery, direction, isDark, setNodes, setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(node.id)
    setIsEditing(false)
  }, [])

  const selectedNodeFromSnapshot = useMemo(() => {
    if (selectedSnapshotId === "live" || !selectedId) return null
    return currentData.nodes.find((n) => n.id === selectedId) || null
  }, [selectedSnapshotId, selectedId, currentData.nodes])

  const startEditing = useCallback(() => {
    if (!deviceQuery.data) return
    setEditName(deviceQuery.data.display_name || deviceQuery.data.hostname || "")
    setEditIcon(deviceQuery.data.icon_type || null)
    setEditType(deviceQuery.data.device_type)
    setIsEditing(true)
  }, [deviceQuery.data])

  const saveEdit = useCallback(() => {
    if (!selectedId) return
    updateMutation.mutate({
      id: selectedId,
      display_name: editName.trim() || null,
      icon_type: editIcon,
      device_type: editType,
    })
  }, [selectedId, editName, editIcon, editType, updateMutation])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado!`)
  }

  const exportSnapshotJson = (snap: SnapshotSummary | null) => {
    if (!snap) return
    fetchSnapshot(snap.id).then((full) => {
      const blob = new Blob([JSON.stringify(full, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `topologia-${snap.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("Arquivo JSON exportado com sucesso!")
    })
  }

  const isLoading =
    selectedSnapshotId === "live" ? topologyQuery.isLoading : snapshotDetailQuery.isLoading
  const isEmpty = !currentData.nodes.length

  const activeSnapshotMeta = useMemo(() => {
    if (selectedSnapshotId === "live") return null
    return snapshotsQuery.data?.find((s) => s.id === selectedSnapshotId) || null
  }, [selectedSnapshotId, snapshotsQuery.data])

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all duration-200",
        isFullscreen
          ? "fixed inset-0 z-50 bg-slate-100 dark:bg-slate-950 p-4"
          : "h-[calc(100dvh-4.5rem)] sm:h-[calc(100dvh-3rem)] sm:gap-4 lg:h-[calc(100vh-3rem)]",
      )}
    >
      <PageHeader
        title="Mapa de Topologia"
        description={
          selectedSnapshotId === "live"
            ? `${currentData.nodes.length} equipamentos detectados · ${currentData.edges.length} conexões mapeadas`
            : `Histórico: ${activeSnapshotMeta?.name || "Rede Salva"} (${currentData.nodes.length} disp. · ${currentData.edges.length} conexões)`
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Rede / Histórico */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rede:</span>
            <select
              value={selectedSnapshotId}
              onChange={(e) => setSelectedSnapshotId(e.target.value)}
              className="h-8 rounded-lg border-0 bg-transparent pr-2 text-xs font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
            >
              <option value="live">● Rede Ao Vivo (Ativa)</option>
              {snapshotsQuery.data && snapshotsQuery.data.length > 0 && (
                <optgroup label="Histórico de Redes Salvas">
                  {snapshotsQuery.data.map((s) => (
                    <option key={s.id} value={s.id}>
                      📁 {s.name} ({s.device_count} disp. • {new Date(s.created_at).toLocaleDateString("pt-BR")})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Salvar Topologia Atual */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSnapshotName(
                `Rede ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
              )
              setIsSaveModalOpen(true)
            }}
            className="h-9 gap-1.5 bg-white text-xs font-medium text-slate-700 shadow-xs hover:border-blue-400 hover:text-blue-600"
            title="Salvar esta rede no histórico com um nome personalizado"
          >
            <BookmarkPlus className="h-3.5 w-3.5 text-blue-600" />
            <span className="hidden sm:inline">Salvar Rede</span>
          </Button>

          {/* Histórico de Redes */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryModalOpen(true)}
            className="h-9 gap-1.5 bg-white text-xs font-medium text-slate-700 shadow-xs hover:border-slate-400"
            title="Gerenciar e ver histórico de topologias salvas"
          >
            <History className="h-3.5 w-3.5 text-slate-600" />
            <span className="hidden sm:inline">Histórico ({snapshotsQuery.data?.length ?? 0})</span>
          </Button>

          <DiscoveryButton />
        </div>
      </PageHeader>

      {/* Banner de Visualização Histórica */}
      {selectedSnapshotId !== "live" && activeSnapshotMeta && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900 shadow-xs dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200/80 text-amber-800 dark:bg-amber-900/80 dark:text-amber-300">
              <FolderGit2 className="h-3.5 w-3.5" />
            </div>
            <div>
              Visualizando histórico: <strong>{activeSnapshotMeta.name}</strong>
              {activeSnapshotMeta.description && (
                <span className="ml-1 text-amber-700 dark:text-amber-400 italic">“{activeSnapshotMeta.description}”</span>
              )}
              <span className="ml-2 text-slate-500 dark:text-slate-400">
                (Salvo em {new Date(activeSnapshotMeta.created_at).toLocaleString("pt-BR")})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (
                  confirm(
                    `Deseja restaurar a rede "${activeSnapshotMeta.name}" como a rede ativa no sistema?`,
                  )
                ) {
                  restoreSnapshotMutation.mutate(activeSnapshotMeta.id)
                }
              }}
              disabled={restoreSnapshotMutation.isPending}
              className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-medium dark:border-amber-800 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950/50"
            >
              {restoreSnapshotMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Restaurar como Rede Ativa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedSnapshotId("live")}
              className="h-7 text-xs hover:bg-amber-200 text-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/50"
            >
              Voltar para Ao Vivo
            </Button>
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-slate-500 dark:text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" /> Carregando mapa de rede...
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-slate-500 dark:text-slate-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-xs dark:bg-blue-950/50 dark:text-blue-400">
              <Filter className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200 sm:text-lg">
              {selectedSnapshotId === "live"
                ? "Nenhum dispositivo mapeado ainda"
                : "Topologia salva sem dispositivos registrados"}
            </p>
            <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
              {selectedSnapshotId === "live"
                ? "Clique em 'Executar descoberta' para escanear a LAN via NetBIOS, LLDP, ARP, Ping e SNMP."
                : "Selecione outra rede salva ou volte para a visualização ao vivo."}
            </p>
            {selectedSnapshotId === "live" ? (
              <DiscoveryButton className="max-w-xs" />
            ) : (
              <Button onClick={() => setSelectedSnapshotId("live")} variant="outline">
                Voltar para Ao Vivo
              </Button>
            )}
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.15}
            maxZoom={2}
          >
            <Background gap={22} color={isDark ? "#1e293b" : "#cbd5e1"} />
            <Controls className="!bottom-3 !left-3 sm:!bottom-4 sm:!left-4 shadow-md rounded-xl overflow-hidden dark:!bg-slate-900 dark:!border-slate-800 dark:!fill-slate-200" />
            <MiniMap
              className="!hidden sm:!block !rounded-xl !overflow-hidden !border-slate-200 !shadow-md dark:!border-slate-800 dark:!bg-slate-900"
              maskColor={isDark ? "rgba(15, 23, 42, 0.75)" : "rgba(240, 240, 240, 0.6)"}
              nodeColor={isDark ? "#3b82f6" : "#64748b"}
              nodeStrokeWidth={3}
              zoomable
              pannable
            />

            {/* Top Toolbar: Search + Direction Toggle + Fullscreen */}
            <Panel position="top-right" className="m-3 flex items-center gap-2">
              <div className="relative flex items-center rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
                <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 mr-1.5" />
                <input
                  type="text"
                  placeholder="Buscar máquina (ex: VICTOR-TI, IP)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-44 sm:w-56 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none bg-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setDirection((d) => (d === "TB" ? "LR" : "TB"))}
                className="h-9 gap-1.5 bg-white/95 dark:bg-slate-900/95 shadow-sm text-xs backdrop-blur-sm"
                title={`Orientação atual: ${direction === "TB" ? "Vertical" : "Horizontal"}`}
              >
                {direction === "TB" ? (
                  <>
                    <ArrowDownUp className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Vertical</span>
                  </>
                ) : (
                  <>
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Horizontal</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen((f) => !f)}
                className="h-9 w-9 p-0 bg-white/95 dark:bg-slate-900/95 shadow-sm backdrop-blur-sm text-slate-600 dark:text-slate-300"
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </Panel>

            {/* Category Filter Pills on Top Left */}
            <Panel
              position="top-left"
              className="m-3 max-w-[calc(100%-8rem)] overflow-x-auto rounded-xl border border-slate-200/90 bg-white/95 p-1.5 shadow-md backdrop-blur-sm sm:max-w-xl dark:border-slate-800 dark:bg-slate-900/95"
            >
              <div className="flex items-center gap-1">
                <Filter className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 sm:block ml-1" />
                {TYPE_FILTERS.map((t) => {
                  const count = typeCounts[t] ?? 0
                  if (t !== "all" && count === 0) return null
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150",
                        typeFilter === t
                          ? "bg-slate-900 text-white dark:bg-blue-600 dark:text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
                      )}
                    >
                      <span>{TYPE_FILTER_LABELS[t] ?? t}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px]",
                          typeFilter === t
                            ? "bg-slate-700 dark:bg-blue-700 text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300",
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>

      {/* --- Modal: Salvar Topologia Atual --- */}
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Topologia no Histórico</DialogTitle>
            <DialogDescription>
              Guarde esta estrutura de rede para poder consultar, comparar ou restaurar no futuro (ex:
              "Rede Prefeitura", "Rede Câmara", etc).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nome da Rede / Identificador *</label>
              <input
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="Ex: Rede Prefeitura, Rede Câmara, Matriz..."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Descrição / Observações (opcional)</label>
              <textarea
                value={snapshotDescription}
                onChange={(e) => setSnapshotDescription(e.target.value)}
                placeholder="Ex: Prédio central, switch core no rack principal, VLAN 10 e 20"
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200 dark:bg-slate-950/60 dark:border-slate-800 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Resumo da captura: </span>
              {currentData.nodes.length} equipamentos e {currentData.edges.length} conexões serão gravados
              neste snapshot.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!snapshotName.trim()) {
                  toast.error("Por favor, insira um nome para a rede.")
                  return
                }
                createSnapshotMutation.mutate({
                  name: snapshotName.trim(),
                  description: snapshotDescription.trim() || undefined,
                })
              }}
              disabled={createSnapshotMutation.isPending}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createSnapshotMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar Topologia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Modal: Histórico de Topologias Salvas --- */}
      <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Histórico de Topologias Salvas</DialogTitle>
            <DialogDescription>
              Gerencie suas redes salvas. Você pode visualizá-las no canvas, torná-las a rede ativa ou exportá-las em JSON.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            {!snapshotsQuery.data || snapshotsQuery.data.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                <FolderGit2 className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">Nenhuma rede salva no histórico ainda</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  Clique em <strong>Salvar Rede</strong> na barra superior para registrar a topologia atual.
                </p>
              </div>
            ) : (
              snapshotsQuery.data.map((snap) => {
                const isCurrent = selectedSnapshotId === snap.id
                return (
                  <div
                    key={snap.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all",
                      isCurrent
                        ? "border-blue-400 bg-blue-50/50 shadow-xs dark:border-blue-500/50 dark:bg-blue-950/30"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700",
                    )}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{snap.name}</span>
                        {isCurrent && (
                          <Badge className="bg-blue-600 text-[10px] text-white">Visualizando</Badge>
                        )}
                      </div>
                      {snap.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">{snap.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                        <span>{new Date(snap.created_at).toLocaleString("pt-BR")}</span>
                        <span>•</span>
                        <span className="font-medium text-slate-600 dark:text-slate-300">{snap.device_count} equipamentos</span>
                        <span>•</span>
                        <span className="font-medium text-slate-600 dark:text-slate-300">{snap.link_count} conexões</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <Button
                        size="sm"
                        variant={isCurrent ? "default" : "outline"}
                        className="h-8 text-xs gap-1"
                        onClick={() => {
                          setSelectedSnapshotId(snap.id)
                          setIsHistoryModalOpen(false)
                        }}
                      >
                        Visualizar
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 border-amber-300 hover:bg-amber-50 text-amber-900 dark:border-amber-800/80 dark:text-amber-300 dark:hover:bg-amber-950/50"
                        title="Tornar esta rede ativa no sistema (inventário, métricas e topologia)"
                        onClick={() => {
                          if (
                            confirm(
                              `Deseja restaurar a rede "${snap.name}" como a rede ativa no sistema?`,
                            )
                          ) {
                            restoreSnapshotMutation.mutate(snap.id)
                          }
                        }}
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span className="hidden md:inline">Ativar</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                        title="Exportar dados da topologia em JSON"
                        onClick={() => exportSnapshotJson(snap)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                        title="Excluir do histórico"
                        onClick={() => {
                          if (confirm(`Excluir o snapshot "${snap.name}" do histórico?`)) {
                            deleteSnapshotMutation.mutate(snap.id)
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsHistoryModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Detail / Edit Sheet --- */}
      <Sheet
        open={!!selectedId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedId(null)
            setIsEditing(false)
          }
        }}
      >
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between pr-6">
              <SheetTitle className="text-base sm:text-lg font-bold text-slate-900">
                {selectedSnapshotId === "live"
                  ? deviceQuery.data?.display_name || deviceQuery.data?.hostname || "Dispositivo"
                  : selectedNodeFromSnapshot?.display_name ||
                    selectedNodeFromSnapshot?.hostname ||
                    selectedNodeFromSnapshot?.label ||
                    "Dispositivo (Histórico)"}
              </SheetTitle>
              {selectedSnapshotId === "live" && !isEditing && deviceQuery.data && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={startEditing}
                    className="gap-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm("Remover este dispositivo da rede ativa?")) {
                        deleteMutation.mutate(selectedId!)
                      }
                    }}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 h-8 w-8"
                    title="Excluir dispositivo"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </SheetHeader>

          {/* Sheet Body for Live Device */}
          {selectedSnapshotId === "live" && deviceQuery.data && (
            <div className="mt-6 space-y-6">
              {isEditing ? (
                /* Mode Edit */
                <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Nome de Exibição</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Ex: Switch Core Andar 1"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Tipo de Equipamento</label>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      {TYPE_FILTERS.filter((t) => t !== "all").map((t) => (
                        <option key={t} value={t}>
                          {TYPE_FILTER_LABELS[t] ?? t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Ícone Personalizado</label>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditIcon(null)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] transition-all",
                          editIcon === null
                            ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/30 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-700",
                        )}
                      >
                        <span className="text-xs font-bold">Auto</span>
                        <span>Padrão</span>
                      </button>
                      {ALL_ICON_KEYS.map((key) => {
                        const isSel = editIcon === key
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setEditIcon(key)}
                            className={cn(
                              "flex flex-col items-center gap-1 rounded-xl border p-2 text-[10px] transition-all",
                              isSel
                                ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/30 dark:border-blue-500 dark:bg-blue-950/60 dark:text-blue-300"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-700",
                            )}
                          >
                            <span className="flex h-5 w-5 items-center justify-center">{ICON_MAP_LG[key]}</span>
                            <span className="truncate max-w-full">{ICON_LABELS[key] ?? key}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={updateMutation.isPending}
                      className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize text-slate-700 bg-slate-50 border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  {TYPE_FILTER_LABELS[deviceQuery.data.device_type] ?? deviceQuery.data.device_type}
                </Badge>
                {deviceQuery.data.is_active ? (
                  <Badge className="bg-emerald-500 text-white">Online</Badge>
                ) : (
                  <Badge variant="secondary">Offline</Badge>
                )}
                {deviceQuery.data.connected_ports.length > 0 && (
                  <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/40 dark:border-blue-800">
                    {deviceQuery.data.connected_ports.length} portas ativas
                  </Badge>
                )}
              </div>

              {/* Data Rows */}
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Endereço IP</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {deviceQuery.data.ip_address ?? "— (L2 apenas)"}
                    </span>
                    {deviceQuery.data.ip_address && (
                      <button
                        onClick={() => copyToClipboard(deviceQuery.data.ip_address!, "IP")}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Copiar IP"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Endereço MAC</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                      {deviceQuery.data.mac_address ?? "—"}
                    </span>
                    {deviceQuery.data.mac_address && (
                      <button
                        onClick={() => copyToClipboard(deviceQuery.data.mac_address!, "MAC")}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Copiar MAC"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Hostname / Máquina</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                    {deviceQuery.data.hostname ?? "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fabricante (Vendor)</span>
                  <span className="text-slate-800 dark:text-slate-200 text-xs">{deviceQuery.data.vendor ?? "—"}</span>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Modelo</span>
                  <span className="text-slate-800 dark:text-slate-200 text-xs">{deviceQuery.data.model ?? "—"}</span>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fontes de Descoberta</span>
                  <div className="flex flex-wrap gap-1">
                    {deviceQuery.data.sources.map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Visto por último</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(deviceQuery.data.last_seen).toLocaleString("pt-BR")}
                  </span>
                </div>
              </div>

              {/* Connected Ports */}
              {deviceQuery.data.connected_ports.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Portas com Conexão Mapeada
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {deviceQuery.data.connected_ports.map((port) => (
                      <span
                        key={port}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-mono font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                      >
                        {port}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sheet Body for Snapshot Device */}
          {selectedSnapshotId !== "live" && selectedNodeFromSnapshot && (
            <div className="mt-6 space-y-6">
              <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                Visualizando equipamento gravado no histórico de topologia.
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize text-slate-700 bg-slate-50 border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  {TYPE_FILTER_LABELS[selectedNodeFromSnapshot.type] ?? selectedNodeFromSnapshot.type}
                </Badge>
              </div>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/60">
                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Endereço IP</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {selectedNodeFromSnapshot.ip ?? "— (L2 apenas)"}
                    </span>
                    {selectedNodeFromSnapshot.ip && (
                      <button
                        onClick={() => copyToClipboard(selectedNodeFromSnapshot.ip!, "IP")}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Copiar IP"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Endereço MAC</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-800 dark:text-slate-200">
                      {selectedNodeFromSnapshot.mac ?? "—"}
                    </span>
                    {selectedNodeFromSnapshot.mac && (
                      <button
                        onClick={() => copyToClipboard(selectedNodeFromSnapshot.mac!, "MAC")}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title="Copiar MAC"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Hostname / Máquina</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                    {selectedNodeFromSnapshot.hostname ?? "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fabricante (Vendor)</span>
                  <span className="text-slate-800 dark:text-slate-200 text-xs">
                    {selectedNodeFromSnapshot.vendor ?? "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 text-sm">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Fontes</span>
                  <div className="flex flex-wrap gap-1">
                    {(selectedNodeFromSnapshot.sources || []).map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 uppercase tracking-wider"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
