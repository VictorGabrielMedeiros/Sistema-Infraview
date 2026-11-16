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

const typeConfig: Record<
  string,
  {
    bg: string
    border: string
    iconBg: string
    iconColor: string
    badgeBg: string
    badgeText: string
    label: string
  }
> = {
  computer: {
    bg: "bg-cyan-50/90 hover:bg-cyan-50",
    border: "border-cyan-400/70 hover:border-cyan-500",
    iconBg: "bg-cyan-100 text-cyan-700",
    iconColor: "text-cyan-700",
    badgeBg: "bg-cyan-100/70 text-cyan-800",
    badgeText: "Computador",
    label: "Computador",
  },
  switch: {
    bg: "bg-emerald-50/90 hover:bg-emerald-50",
    border: "border-emerald-400/70 hover:border-emerald-500",
    iconBg: "bg-emerald-100 text-emerald-700",
    iconColor: "text-emerald-700",
    badgeBg: "bg-emerald-100/70 text-emerald-800",
    badgeText: "Switch",
    label: "Switch",
  },
  router: {
    bg: "bg-blue-50/90 hover:bg-blue-50",
    border: "border-blue-400/70 hover:border-blue-500",
    iconBg: "bg-blue-100 text-blue-700",
    iconColor: "text-blue-700",
    badgeBg: "bg-blue-100/70 text-blue-800",
    badgeText: "Roteador",
    label: "Roteador",
  },
  server: {
    bg: "bg-violet-50/90 hover:bg-violet-50",
    border: "border-violet-400/70 hover:border-violet-500",
    iconBg: "bg-violet-100 text-violet-700",
    iconColor: "text-violet-700",
    badgeBg: "bg-violet-100/70 text-violet-800",
    badgeText: "Servidor",
    label: "Servidor",
  },
  printer: {
    bg: "bg-orange-50/90 hover:bg-orange-50",
    border: "border-orange-400/70 hover:border-orange-500",
    iconBg: "bg-orange-100 text-orange-700",
    iconColor: "text-orange-700",
    badgeBg: "bg-orange-100/70 text-orange-800",
    badgeText: "Impressora",
    label: "Impressora",
  },
  phone: {
    bg: "bg-pink-50/90 hover:bg-pink-50",
    border: "border-pink-400/70 hover:border-pink-500",
    iconBg: "bg-pink-100 text-pink-700",
    iconColor: "text-pink-700",
    badgeBg: "bg-pink-100/70 text-pink-800",
    badgeText: "Telefone IP",
    label: "Telefone IP",
  },
  access_point: {
    bg: "bg-teal-50/90 hover:bg-teal-50",
    border: "border-teal-400/70 hover:border-teal-500",
    iconBg: "bg-teal-100 text-teal-700",
    iconColor: "text-teal-700",
    badgeBg: "bg-teal-100/70 text-teal-800",
    badgeText: "Access Point",
    label: "Access Point",
  },
  firewall: {
    bg: "bg-red-50/90 hover:bg-red-50",
    border: "border-red-400/70 hover:border-red-500",
    iconBg: "bg-red-100 text-red-700",
    iconColor: "text-red-700",
    badgeBg: "bg-red-100/70 text-red-800",
    badgeText: "Firewall",
    label: "Firewall",
  },
  unknown: {
    bg: "bg-slate-50/90 hover:bg-slate-50",
    border: "border-slate-300 hover:border-slate-400",
    iconBg: "bg-slate-200 text-slate-600",
    iconColor: "text-slate-600",
    badgeBg: "bg-slate-100 text-slate-600",
    badgeText: "Equipamento",
    label: "Dispositivo",
  },
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
  "router",
  "switch",
  "server",
  "computer",
  "monitor",
  "printer",
  "phone",
  "access_point",
  "firewall",
  "cloud",
  "database",
  "camera",
  "unknown",
] as const

export const ICON_LABELS: Record<string, string> = {
  router: "Roteador",
  switch: "Switch",
  server: "Servidor",
  computer: "Computador",
  monitor: "Monitor",
  printer: "Impressora",
  phone: "Telefone IP",
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
  isHighlighted?: boolean
}

export function DeviceNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as DeviceNodeData
  const effectiveType = nodeData.type || "unknown"
  const cfg = typeConfig[effectiveType] ?? typeConfig.unknown
  const effectiveIcon = nodeData.icon_type || effectiveType

  return (
    <div
      className={cn(
        "group relative w-[210px] rounded-xl border-2 p-3 shadow-sm backdrop-blur-sm transition-all duration-200 cursor-pointer",
        cfg.bg,
        cfg.border,
        selected && "ring-2 ring-blue-500 ring-offset-2 shadow-lg scale-105 z-20",
        nodeData.isHighlighted && "ring-2 ring-amber-400 ring-offset-2 scale-105 shadow-md",
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !bg-slate-400 !border-2 !border-white transition-transform group-hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !bg-slate-400 !border-2 !border-white transition-transform group-hover:scale-125"
      />

      {/* Header: Icon + Machine Name + Online Dot */}
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-xs",
            cfg.iconBg,
          )}
        >
          {ICON_MAP[effectiveIcon] ?? ICON_MAP.unknown}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h4
              className="truncate text-xs font-bold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors"
              title={nodeData.label}
            >
              {nodeData.label}
            </h4>
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-xs"
              title="Dispositivo Ativo"
            />
          </div>
          <p className="truncate font-mono text-[11px] text-slate-500 font-medium mt-0.5">
            {nodeData.ip ?? (nodeData.l2_only ? "L2 Only" : "—")}
          </p>
        </div>
      </div>

      {/* Footer / Badges */}
      <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-slate-200/50 pt-2 text-[10px]">
        <span className={cn("rounded-md px-1.5 py-0.5 font-medium text-[9px]", cfg.badgeBg)}>
          {ICON_LABELS[effectiveType] ?? effectiveType}
        </span>
        {nodeData.l2_only && (
          <Badge className="border-amber-300 bg-amber-50 text-amber-700 text-[9px] px-1.5 py-0">
            L2
          </Badge>
        )}
      </div>
    </div>
  )
}
