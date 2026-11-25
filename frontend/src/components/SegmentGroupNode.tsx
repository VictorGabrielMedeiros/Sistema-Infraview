import { type NodeProps } from "@xyflow/react"
import { Layers, Monitor, HelpCircle, Network } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SegmentGroupNodeData {
  title: string
  subtitle: string
  segment: "infra" | "endpoints" | "unknown"
  count: number
  width: number
  height: number
}

const SEGMENT_STYLES = {
  infra: {
    container:
      "border-blue-300/80 bg-blue-50/40 dark:border-blue-500/35 dark:bg-blue-950/20",
    header:
      "border-blue-200/80 bg-blue-100/80 text-blue-900 dark:border-blue-800/60 dark:bg-blue-950/70 dark:text-blue-100",
    badge:
      "bg-blue-600 text-white dark:bg-blue-500",
    icon: Network,
  },
  endpoints: {
    container:
      "border-cyan-300/80 bg-cyan-50/35 dark:border-cyan-500/35 dark:bg-cyan-950/15",
    header:
      "border-cyan-200/80 bg-cyan-100/80 text-cyan-900 dark:border-cyan-800/60 dark:bg-cyan-950/70 dark:text-cyan-100",
    badge:
      "bg-cyan-600 text-white dark:bg-cyan-500",
    icon: Monitor,
  },
  unknown: {
    container:
      "border-amber-300/80 bg-amber-50/35 dark:border-amber-500/35 dark:bg-amber-950/15",
    header:
      "border-amber-200/80 bg-amber-100/80 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/70 dark:text-amber-100",
    badge:
      "bg-amber-600 text-white dark:bg-amber-500",
    icon: HelpCircle,
  },
} as const

export function SegmentGroupNode({ data }: NodeProps) {
  const groupData = data as unknown as SegmentGroupNodeData
  const style = SEGMENT_STYLES[groupData.segment] ?? {
    ...SEGMENT_STYLES.infra,
    icon: Layers,
  }
  const Icon = style.icon

  return (
    <div
      style={{ width: groupData.width, height: groupData.height }}
      className={cn(
        "rounded-2xl border-2 border-dashed shadow-xs transition-colors",
        style.container,
      )}
    >
      <div
        className={cn(
          "segment-drag-handle flex items-center justify-between rounded-t-[14px] border-b px-4 py-2.5 cursor-grab active:cursor-grabbing",
          style.header,
        )}
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-bold tracking-tight leading-none">
              {groupData.title}
            </h3>
            <p className="mt-0.5 text-[11px] opacity-75 leading-none">
              {groupData.subtitle}
            </p>
          </div>
        </div>

        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-xs",
            style.badge,
          )}
        >
          {groupData.count} {groupData.count === 1 ? "dispositivo" : "dispositivos"}
        </span>
      </div>
    </div>
  )
}
