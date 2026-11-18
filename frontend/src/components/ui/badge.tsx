import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900",
    secondary: "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    destructive: "border-transparent bg-red-500 text-white shadow-xs dark:bg-red-600 dark:text-white",
    outline: "text-slate-800 border-slate-200 bg-white/50 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-200",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden",
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    />
  )
}

export { Badge }
