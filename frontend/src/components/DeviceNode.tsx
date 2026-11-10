import type { ReactNode } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Camera,
  Cloud,
  Database,
  Flame,
  Laptop,
  Monitor,
  Network,
  Phone,
  Printer,
  Router,
  Server,
  Shield,
  Wifi,
} from "lucide-react"

const typeStyles: Record<string, string> = {
  switch: "border-emerald-500/60 bg-gradient-to-br from-emerald-50 to-emerald-100/60",
  router: "border-blue-500/60 bg-gradient-to-br from-blue-50 to-blue-100/60",
  printer: "border-orange-500/60 bg-gradient-to-br from-orange-50 to-orange-100/60",
  server: "border-violet-500/60 bg-gradient-to-br from-violet-50 to-violet-100/60",
  computer: "border-cyan-500/60 bg-gradient-to-br from-cyan-50 to-cyan-100/60",
  phone: "border-pink-500/60 bg-gradient-to-br from-pink-50 to-pink-100/60",
  access_point: "border-teal-500/60 bg-gradient-to-br from-teal-50 to-teal-100/60",
  firewall: "border-red-500/60 bg-gradient-to-br from-red-50 to-red-100/60",
  unknown: "border-slate-400/60 bg-gradient-to-br from-slate-50 to-slate-100/60",
}

const typeIconColors: Record<string, string> = {
  switch: "text-emerald-600",
  router: "text-blue-600",
  printer: "text-orange-600",
  server: "text-violet-600",
  computer: "text-cyan-600",
  phone: "text-pink-600",
  access_point: "text-teal-600",
  firewall: "text-red-600",
  unknown: "text-slate-500",
}

export const ICON_MAP: Record<string, ReactNode> = {
  switch: <Network className="h-4 w-4" />,
  router: <Router className="h-4 w-4" />,
  printer: <Printer className="h-4 w-4" />,
  server: <Server className="h-4 w-4" />,
  computer: <Laptop className="h-4 w-4" />,
  monitor: <Monitor className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  access_point: <Wifi className="h-4 w-4" />,
  firewall: <Shield className="h-4 w-4" />,
  cloud: <Cloud className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  camera: <Camera className="h-4 w-4" />,
  unknown: <Network className="h-4 w-4" />,
}

export const ICON_MAP_LG: Record<string, ReactNode> = {
  switch: <Network className="h-5 w-5" />,
  router: <Router className="h-5 w-5" />,
  printer: <Printer className="h-5 w-5" />,
  server: <Server className="h-5 w-5" />,
  computer: <Laptop className="h-5 w-5" />,
  monitor: <Monitor className="h-5 w-5" />,
  phone: <Phone className="h-5 w-5" />,
  access_point: <Wifi className="h-5 w-5" />,
  firewall: <Shield className="h-5 w-5" />,
  cloud: <Cloud className="h-5 w-5" />,
  database: <Database className="h-5 w-5" />,
  camera: <Camera className="h-5 w-5" />,
  flame: <Flame className="h-5 w-5" />,
  unknown: <Network className="h-5 w-5" />,
}

export const ALL_ICON_KEYS = [
  "router", "switch", "server", "computer", "monitor",
  "printer", "phone", "access_point", "firewall",
  "cloud", "database", "camera", "unknown",
] as const

export const ICON_LABELS: Record<string, string> = {
  router: "Roteador",
  switch: "Switch",
  server: "Servidor",
  computer: "Computador",
  monitor: "Monitor",
  printer: "Impressora",
  phone: "Telefone",
  access_point: "Access Point",
  firewall: "Firewall",
  cloud: "Nuvem",
  database: "Banco de dados",
  camera: "Câmera",
  unknown: "Desconhecido",
}

export interface DeviceNodeData {
  label: string
  type: string
  ip: string | null
  l2_only: boolean
  icon_type: string | null
  display_name: string | null
}

export function DeviceNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as DeviceNodeData
  const effectiveIcon = nodeData.icon_type || nodeData.type
  const style = typeStyles[nodeData.type] ?? typeStyles.unknown
  const iconColor = typeIconColors[effectiveIcon] ?? typeIconColors[nodeData.type] ?? typeIconColors.unknown

  return (
    <div
      className={cn(
        "min-w-[130px] max-w-[180px] rounded-xl border-2 px-3 py-2.5 shadow-sm transition-all duration-200 sm:min-w-[150px] sm:max-w-none",
        style,
        selected && "ring-2 ring-blue-400 ring-offset-1 shadow-md scale-105",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-2 !h-2" />
      <div className="flex items-center gap-2">
        <div className={cn("shrink-0", iconColor)}>
          {ICON_MAP[effectiveIcon] ?? ICON_MAP.unknown}
        </div>
        <span className="truncate text-sm font-semibold text-slate-800">{nodeData.label}</span>
      </div>
      <div className="mt-1 text-[10px] text-slate-500 font-medium">
        {nodeData.ip ?? (nodeData.l2_only ? "L2 only" : "—")}
      </div>
      {nodeData.l2_only && (
        <Badge className="mt-1.5 border-amber-300/60 bg-amber-50 text-amber-700 text-[9px] px-1.5 py-0">
          L2 only
        </Badge>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  )
}
