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
  Check,
  Filter,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { DeviceNode, type DeviceNodeData, ICON_MAP_LG, ALL_ICON_KEYS, ICON_LABELS } from "@/components/DeviceNode"
import { DiscoveryButton } from "@/components/DiscoveryButton"
import { PageHeader } from "@/components/layout/PageHeader"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { fetchDevice, fetchTopology, updateDevice, deleteDevice, type TopologyNode } from "@/lib/api"
import { cn } from "@/lib/utils"

const nodeTypes = { device: DeviceNode }
const dagreGraph = new dagre.graphlib.Graph()
dagreGraph.setDefaultEdgeLabel(() => ({}))

const TYPE_FILTERS = ["all", "switch", "router", "server", "computer", "printer", "phone", "access_point", "firewall", "unknown"] as const

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

function layoutElements(nodes: Node[], edges: Edge[]) {
  dagreGraph.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 100 })
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 170, height: 80 }))
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target))
  dagre.layout(dagreGraph)
  return nodes.map((node) => {
    const pos = dagreGraph.node(node.id)
    return { ...node, position: { x: pos.x - 85, y: pos.y - 40 } }
  })
}

function toFlowNodes(apiNodes: TopologyNode[]): Node[] {
  return apiNodes.map((n) => ({
    id: n.id,
    type: "device",
    data: {
      label: n.label,
      type: n.type,
      ip: n.ip,
      l2_only: n.l2_only,
      icon_type: n.icon_type,
      display_name: n.display_name,
    } satisfies DeviceNodeData,
    position: { x: 0, y: 0 },
  }))
}

export function TopologyPage() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>("all")
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

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; display_name?: string | null; icon_type?: string | null; device_type?: string | null }) =>
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
    const edges = topologyQuery.data.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    return { nodes, edges }
  }, [topologyQuery.data, typeFilter])

  useEffect(() => {
    const flowNodes = toFlowNodes(filtered.nodes)
    const flowEdges = filtered.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      type: "smoothstep",
      animated: true,
      style: { stroke: "#475569", strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: "#64748b" },
      labelBgStyle: { fill: "#f8fafc", fillOpacity: 0.9 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
    }))
    setNodes(layoutElements(flowNodes, flowEdges))
    setEdges(flowEdges)
  }, [filtered, setNodes, setEdges])

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

  const isEmpty = !topologyQuery.data?.nodes.length

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] flex-col gap-3 sm:h-[calc(100dvh-3rem)] sm:gap-4 lg:h-[calc(100vh-3rem)]">
      <PageHeader
        title="Mapa de Topologia"
        description={`${topologyQuery.data?.nodes.length ?? 0} equipamentos · ${topologyQuery.data?.edges.length ?? 0} links`}
      >
        <DiscoveryButton />
      </PageHeader>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {topologyQuery.isLoading ? (
          <div className="flex h-full items-center justify-center text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando...
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center text-slate-500">
            <p className="text-base font-medium sm:text-lg">Nenhum dispositivo mapeado</p>
            <p className="max-w-md text-sm">
              Execute a descoberta para mapear a rede via LLDP, ARP e Ping.
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
            minZoom={0.2}
          >
            <Background gap={20} color="#e2e8f0" />
            <Controls className="!bottom-2 !left-2 sm:!bottom-4 sm:!left-4" />
            <MiniMap className="!hidden sm:!block" nodeStrokeWidth={3} zoomable pannable />
            <Panel
              position="top-left"
              className="max-w-[calc(100%-1rem)] overflow-x-auto rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-sm p-1.5 shadow-md sm:p-2"
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <Filter className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                {TYPE_FILTERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      "shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150",
                      typeFilter === t
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    {TYPE_FILTER_LABELS[t] ?? t}
                  </button>
                ))}
              </div>
            </Panel>
          </ReactFlow>
        )}
      </div>

      {/* --- Detail / Edit Sheet --- */}
      <Sheet open={!!selectedId} onOpenChange={(open) => { if (!open) { setSelectedId(null); setIsEditing(false) } }}>
        <SheetContent>
          <SheetHeader>
            <div className="flex items-center justify-between pr-6">
              <SheetTitle>
                {deviceQuery.data?.display_name || deviceQuery.data?.hostname || "Dispositivo"}
              </SheetTitle>
              {!isEditing && deviceQuery.data && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={startEditing} className="gap-1.5 text-slate-600">
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
            <div className="mt-4 space-y-3 text-sm">
              {deviceQuery.data.display_name && (
                <DetailRow label="Nome customizado" value={deviceQuery.data.display_name} />
              )}
              <DetailRow label="Hostname" value={deviceQuery.data.hostname ?? "—"} />
              <DetailRow label="Tipo" value={ICON_LABELS[deviceQuery.data.device_type] ?? deviceQuery.data.device_type} />
              {deviceQuery.data.icon_type && (
                <DetailRow label="Ícone" value={ICON_LABELS[deviceQuery.data.icon_type] ?? deviceQuery.data.icon_type} />
              )}
              <DetailRow label="IP" value={deviceQuery.data.ip_address ?? "—"} />
              <DetailRow label="MAC" value={deviceQuery.data.mac_address ?? "—"} />
              <DetailRow label="Vendor" value={deviceQuery.data.vendor ?? "—"} />
              <DetailRow label="Modelo" value={deviceQuery.data.model ?? "—"} />
              <DetailRow label="Chassis ID" value={deviceQuery.data.chassis_id ?? "—"} />
              <DetailRow label="Mgmt IP" value={deviceQuery.data.mgmt_ip ?? "—"} />
              <div>
                <span className="font-medium text-slate-700">Fontes</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {deviceQuery.data.sources.map((s) => (
                    <Badge key={s} className="bg-blue-50 text-blue-700 border-blue-200/60">{s.toUpperCase()}</Badge>
                  ))}
                </div>
              </div>
              {deviceQuery.data.connected_ports.length > 0 && (
                <div>
                  <span className="font-medium text-slate-700">Portas conectadas</span>
                  <div className="mt-1 space-y-0.5">
                    {deviceQuery.data.connected_ports.map((p, i) => (
                      <div key={i} className="text-xs text-slate-500 font-mono">{p}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ——— Edit Mode ——— */}
          {deviceQuery.data && isEditing && (
            <div className="mt-4 space-y-5">
              {/* Name input */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Nome do dispositivo
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={deviceQuery.data.hostname || "Nome customizado"}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <p className="mt-1 text-xs text-slate-400">
                  Deixe vazio para usar o hostname detectado automaticamente.
                </p>
              </div>

              {/* Device type selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Tipo de dispositivo
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["router", "switch", "server", "computer", "printer", "phone", "access_point", "firewall", "unknown"] as const).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditType(t)}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-all duration-150",
                          editType === t
                            ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                        )}
                      >
                        {editType === t && <Check className="h-3 w-3 text-blue-500" />}
                        {ICON_LABELS[t] ?? t}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Icon picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
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
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm scale-105"
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
                <p className="mt-1.5 text-xs text-slate-400">
                  Selecione um ícone customizado ou deixe sem seleção para usar o padrão do tipo.
                </p>
              </div>

              {/* Actions */}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 pb-2 sm:flex-row sm:justify-between sm:gap-4">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="break-all text-slate-600 sm:text-right">{value}</span>
    </div>
  )
}
