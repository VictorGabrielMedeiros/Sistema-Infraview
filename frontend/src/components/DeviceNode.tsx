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
    bg: "bg-cyan-50/90 hover:bg-cyan-50 dark:bg-slate-900/95 dark:hover:bg-slate-850",
    border: "border-cyan-400/70 hover:border-cyan-500 dark:border-cyan-500/40 dark:hover:border-cyan-400",
    iconBg: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border dark:border-cyan-800/50",
    iconColor: "text-cyan-700 dark:text-cyan-300",
    badgeBg: "bg-cyan-100/70 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border dark:border-cyan-900/40",
    badgeText: "Computador",
    label: "Computador",
  },
  switch: {
    bg: "bg-emerald-50/90 hover:bg-emerald-50 dark:bg-slate-900/95 dark:hover:bg-slate-850",
    border: "border-emerald-400/70 hover:border-emerald-500 dark:border-emerald-500/40 dark:hover:border-emerald-400",
    iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border dark:border-emerald-800/50",
    iconColor: "text-emerald-700 dark:text-emerald-300",
    badgeBg: "bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-900/40",
    badgeText: "Switch",
    label: "Switch",
  },
  router: {
    bg: "bg-blue-50/90 hover:bg-blue-50 dark:bg-slate-900/95 dark:hover:bg-slate-850",
    border: "border-blue-400/70 hover:border-blue-500 dark:border-blue-500/40 dark:hover:border-blue-400",
    iconBg: "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 dark:border dark:border-blue-800/50",
    iconColor: "text-blue-700 dark:text-blue-300",
    badgeBg: "bg-blue-100/70 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-900/40",
    badgeText: "Roteador",
    label: "Roteador",
  },
  server: {
    bg: "bg-violet-50/90 hover:bg-violet-50 dark:bg-slate-900/95 dark:hover:bg-slate-850",
    border: "border-violet-400/70 hover:border-violet-500 dark:border-violet-500/40 dark:hover:border-violet-400",
    iconBg: "bg-violet-100 text-violet-700 dark:bg-violet-950/80 dark:text-violet-300 dark:border dark:border-violet-800/50",
    iconColor: "text-violet-700 dark:text-violet-300",
    badgeBg: "bg-violet-100/70 text-violet-800 dark:bg-violet-950/60 dark:text-violet-300 dark:border dark:border-violet-900/40",
    badgeText: "Servidor",
    label: "Servidor",
  },
  printer: {
    bg: "bg-orange-50/90 hover:bg-orange-50 dark:bg-slate-900/95 dark:hover:bg-slate-850",
    border: "border-orange-400/70 hover:border-orange-500 dark:border-orange-500/40 dark:hover:border-orange-400",
    iconBg: "bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300 dark:border dark:border-orange-800/50",
    iconColor: "text-orange-700 dark:text-orange-300",
    badgeBg: "bg-orange-100/70 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 dark:border dark:border-orange-900/40",
    badgeText: "Impressora",
    label: "Impressora",
  },
  phone: {
    bg: "bg-pink-50/90 hover:bg-pink-50 dark:bg-slate-900/95 dark:hover:bg-slate-850",
    border: "border-pink-400/70 hover:border-pink-500 dark:border-pink-500/40 dark:hover:border-pink-400",
    iconBg: "bg-pink-100 text-pink-700 dark:bg-pink-950/80 dark:text-pink-300 dark:border dark:border-pink-800/50",
    iconColor: "text-pink-700 dark:text-pink-300",
    badgeBg: "bg-pink-100/70 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300 dark:border dark:border-pink-900/40",
    badgeText: "Telefone IP",
    label: "Telefone IP",
  },
  access_point: {
    bg: "bg-teal-50/90 hover:bg-teal-50 dark:bg-slate-900/95 dark:hover:bg-slate-850",
    border: "border-teal-400/70 hover:border-teal-500 dark:border-teal-500/40 dark:hover:border-teal-400",
    iconBg: "bg-teal-100 text-teal-700 dark:bg-teal-950/80 dark:text-teal-300 dark:border dark:border-teal-800/50",
    iconColor: "text-teal-700 dark:text-teal-300",
    badgeBg: "bg-teal-100/70 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 dark:border dark:border-teal-900/40",
    badgeText: "Access Point",
    label: "Access Point",
  },
  firewall: {
    bg: "bg-red-50/90 hover:bg-red-50 dark:bg-slate-900/95 dark:hover:bg-slate-850",
    border: "border-red-400/70 hover:border-red-500 dark:border-red-500/40 dark:hover:border-red-400",
    iconBg: "bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 dark:border dark:border-red-800/50",
    iconColor: "text-red-700 dark:text-red-300",
    badgeBg: "bg-red-100/70 text-red-800 dark:bg-red-950/60 dark:text-red-300 dark:border dark:border-red-900/40",
    badgeText: "Firewall",
    label: "Firewall",
  },
  unknown: {
    bg: "bg-slate-50/90 hover:bg-slate-50 dark:bg-slate-900/95 dark:hover:bg-slate-850",
    border: "border-slate-300 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-700",
    iconBg: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    iconColor: "text-slate-600 dark:text-slate-300",
    badgeBg: "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-400",
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
  "flame",
]

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
        "group relative w-[210px] rounded-xl border-2 p-3 shadow-sm backdrop-blur-xs transition-all duration-200 cursor-pointer",
        cfg.bg,
        cfg.border,
        selected && "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 shadow-xl scale-105 z-20",
        nodeData.isHighlighted && "ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-slate-950 scale-105 shadow-md",
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-white dark:!border-slate-900 transition-transform group-hover:scale-125"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !bg-slate-400 dark:!bg-slate-500 !border-2 !border-white dark:!border-slate-900 transition-transform group-hover:scale-125"
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
              className="truncate text-xs font-bold tracking-tight text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-cyan-400 transition-colors"
              title={nodeData.label}
            >
              {nodeData.label}
            </h4>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
          <p className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {nodeData.ip ?? (nodeData.l2_only ? "L2 Only" : "—")}
          </p>
        </div>
      </div>

      {/* Footer / Badges */}
      <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-slate-200/50 dark:border-slate-800/80 pt-2 text-[10px]">
        <span className={cn("rounded-md px-1.5 py-0.5 font-medium text-[9px]", cfg.badgeBg)}>
          {ICON_LABELS[effectiveType] ?? effectiveType}
        </span>
        {nodeData.l2_only && (
          <Badge className="border-amber-300/80 bg-amber-50 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/60 dark:text-amber-300 text-[9px] px-1.5 py-0">
            L2
          </Badge>
        )}
      </div>
    </div>
  )
}
