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
  Check,
  Copy,
  Filter,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  fetchDevice,
  fetchTopology,
  updateDevice,
  deleteDevice,
  type TopologyNode,
} from "@/lib/api"
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [direction, setDirection] = useState<"TB" | "LR">("TB")
  const [isFullscreen, setIsFullscreen] = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Edit state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editIcon, setEditIcon] = useState<string | null>(null)
  const [editType, setEditType] = useState<string>("unknown")

  const topologyQuery = useQuery({ queryKey: ["topology"], queryFn: fetchTopology })
  const deviceQuery = useQuery({
    queryKey: ["device", selectedId],
    queryFn: () => fetchDevice(selectedId!),
    enabled: !!selectedId,
  })

  // Dynamic counts for filters
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    if (!topologyQuery.data?.nodes) return counts
    counts.all = topologyQuery.data.nodes.length
    for (const n of topologyQuery.data.nodes) {
      counts[n.type] = (counts[n.type] || 0) + 1
    }
    return counts
  }, [topologyQuery.data?.nodes])

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

  const filtered = useMemo(() => {
    if (!topologyQuery.data) return { nodes: [], edges: [] }
    const nodes =
      typeFilter === "all"
        ? topologyQuery.data.nodes
        : topologyQuery.data.nodes.filter((n) => n.type === typeFilter)
    const nodeIds = new Set(nodes.map((n) => n.id))
    const edges = topologyQuery.data.edges.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
    )
    return { nodes, edges }
  }, [topologyQuery.data, typeFilter])

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
      labelStyle: { fontSize: 10, fill: "#475569", fontWeight: 600 },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.95 },
      labelBgPadding: [6, 4] as [number, number],
      labelBgBorderRadius: 6,
    }))
    setNodes(layoutElements(flowNodes, flowEdges, direction))
    setEdges(flowEdges)
  }, [filtered, searchQuery, direction, setNodes, setEdges])

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(node.id)
    setIsEditing(false)
  }, [])

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

  const isEmpty = !topologyQuery.data?.nodes.length

  return (
    <div
      className={cn(
        "flex flex-col gap-3 transition-all duration-200",
        isFullscreen
          ? "fixed inset-0 z-50 bg-slate-100 p-4"
          : "h-[calc(100dvh-4.5rem)] sm:h-[calc(100dvh-3rem)] sm:gap-4 lg:h-[calc(100vh-3rem)]",
      )}
    >
      <PageHeader
        title="Mapa de Topologia"
        description={`${topologyQuery.data?.nodes.length ?? 0} equipamentos detectados · ${topologyQuery.data?.edges.length ?? 0} conexões mapeadas`}
      >
        <DiscoveryButton />
      </PageHeader>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        {topologyQuery.isLoading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" /> Carregando mapa de rede...
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-slate-500">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-xs">
              <Filter className="h-8 w-8" />
            </div>
            <p className="text-base font-semibold text-slate-800 sm:text-lg">
              Nenhum dispositivo mapeado ainda
            </p>
            <p className="max-w-md text-sm text-slate-500">
              Clique em <strong>Executar descoberta</strong> para escanear a LAN via NetBIOS, LLDP,
              ARP, Ping e SNMP.
            </p>
            <DiscoveryButton className="max-w-xs" />
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
            <Background gap={22} color="#cbd5e1" />
            <Controls className="!bottom-3 !left-3 sm:!bottom-4 sm:!left-4 shadow-md rounded-xl overflow-hidden" />
            <MiniMap
              className="!hidden sm:!block !rounded-xl !overflow-hidden !border-slate-200 !shadow-md"
              nodeStrokeWidth={3}
              zoomable
              pannable
            />

            {/* Top Toolbar: Search + Direction Toggle + Fullscreen */}
            <Panel position="top-right" className="m-3 flex items-center gap-2">
              <div className="relative flex items-center rounded-xl border border-slate-200 bg-white/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm">
                <Search className="h-3.5 w-3.5 text-slate-400 mr-1.5" />
                <input
                  type="text"
                  placeholder="Buscar máquina (ex: VICTOR-TI, IP)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-44 sm:w-56 text-xs text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="p-0.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setDirection((d) => (d === "TB" ? "LR" : "TB"))}
                className="h-9 gap-1.5 bg-white/95 shadow-sm text-xs backdrop-blur-sm"
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
                className="h-9 w-9 p-0 bg-white/95 shadow-sm backdrop-blur-sm text-slate-600"
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </Panel>

            {/* Category Filter Pills on Top Left */}
            <Panel
              position="top-left"
              className="m-3 max-w-[calc(100%-8rem)] overflow-x-auto rounded-xl border border-slate-200/90 bg-white/95 p-1.5 shadow-md backdrop-blur-sm sm:max-w-xl"
            >
              <div className="flex items-center gap-1">
                <Filter className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 sm:block ml-1" />
                {TYPE_FILTERS.map((t) => {
                  const count = typeCounts[t] ?? 0
                  if (t !== "all" && count === 0) return null // Hide zero-count types
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150",
                        typeFilter === t
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                      )}
                    >
                      <span>{TYPE_FILTER_LABELS[t] ?? t}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 text-[10px]",
                          typeFilter === t
                            ? "bg-slate-700 text-white"
                            : "bg-slate-200 text-slate-700",
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
                {deviceQuery.data?.display_name || deviceQuery.data?.hostname || "Dispositivo"}
              </SheetTitle>
              {!isEditing && deviceQuery.data && (
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
                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Remover dispositivo"
                    onClick={() => {
                      if (selectedId && confirm("Remover este dispositivo da topologia?")) {
                        deleteMutation.mutate(selectedId)
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </SheetHeader>

          {deviceQuery.data && !isEditing && (
            <div className="mt-5 space-y-3.5 text-sm">
              {deviceQuery.data.display_name && (
                <DetailRow label="Nome customizado" value={deviceQuery.data.display_name} />
              )}
              <DetailRow
                label="Nome da Máquina"
                value={deviceQuery.data.hostname ?? "—"}
                onCopy={deviceQuery.data.hostname ? () => copyToClipboard(deviceQuery.data!.hostname!, "Hostname") : undefined}
              />
              <DetailRow
                label="Tipo"
                value={ICON_LABELS[deviceQuery.data.device_type] ?? deviceQuery.data.device_type}
              />
              {deviceQuery.data.icon_type && (
                <DetailRow
                  label="Ícone"
                  value={ICON_LABELS[deviceQuery.data.icon_type] ?? deviceQuery.data.icon_type}
                />
              )}
              <DetailRow
                label="Endereço IP"
                value={deviceQuery.data.ip_address ?? "—"}
                onCopy={deviceQuery.data.ip_address ? () => copyToClipboard(deviceQuery.data!.ip_address!, "IP") : undefined}
              />
              <DetailRow
                label="Endereço MAC"
                value={deviceQuery.data.mac_address ?? "—"}
                onCopy={deviceQuery.data.mac_address ? () => copyToClipboard(deviceQuery.data!.mac_address!, "MAC") : undefined}
              />
              <DetailRow label="Fabricante / Vendor" value={deviceQuery.data.vendor ?? "—"} />
              <DetailRow label="Modelo" value={deviceQuery.data.model ?? "—"} />
              <DetailRow label="Chassis ID" value={deviceQuery.data.chassis_id ?? "—"} />
              <DetailRow label="IP de Gerência" value={deviceQuery.data.mgmt_ip ?? "—"} />

              <div>
                <span className="font-semibold text-slate-700">Protocolos Detectados</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {deviceQuery.data.sources.map((s) => (
                    <Badge key={s} className="bg-blue-50 text-blue-700 border-blue-200">
                      {s.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>

              {deviceQuery.data.connected_ports.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-700">Portas Conectadas (LLDP)</span>
                  <div className="mt-1.5 space-y-1">
                    {deviceQuery.data.connected_ports.map((p, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-slate-50 border border-slate-200/80 px-2.5 py-1 font-mono text-xs text-slate-600"
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ——— Edit Mode ——— */}
          {deviceQuery.data && isEditing && (
            <div className="mt-5 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nome do dispositivo
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={deviceQuery.data.hostname || "Ex: Computador TI"}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Deixe vazio para usar o nome de máquina detectado ({deviceQuery.data.hostname || "hostname"}).
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Tipo de dispositivo
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      "router",
                      "switch",
                      "server",
                      "computer",
                      "printer",
                      "phone",
                      "access_point",
                      "firewall",
                      "unknown",
                    ] as const
                  ).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditType(t)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-all duration-150",
                        editType === t
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-xs"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                      )}
                    >
                      {editType === t && <Check className="h-3 w-3 text-blue-500" />}
                      {ICON_LABELS[t] ?? t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Ícone na topologia
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {ALL_ICON_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditIcon(editIcon === key ? null : key)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 p-2.5 transition-all duration-150",
                        editIcon === key
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-xs scale-105"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700",
                      )}
                    >
                      <div className="relative">
                        {ICON_MAP_LG[key]}
                        {editIcon === key && (
                          <div className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500">
                            <Check className="h-2 w-2 text-white" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-medium leading-tight text-center">
                        {ICON_LABELS[key] ?? key}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 gap-1.5"
                  onClick={saveEdit}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={cancelEdit}
                  disabled={updateMutation.isPending}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function DetailRow({
  label,
  value,
  onCopy,
}: {
  label: string
  value: string
  onCopy?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
      <span className="font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs text-slate-900 font-semibold">{value}</span>
        {onCopy && value !== "—" && (
          <button
            onClick={onCopy}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Copiar"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
